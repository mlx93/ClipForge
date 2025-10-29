import React, { useState, useEffect, useRef } from 'react';
import { useRecordingStore, RecordingSource } from '../store/recordingStore';
import { useMediaLibraryStore } from '../store/mediaLibraryStore';
import { useTimelineStore } from '../store/timelineStore';
import toast from 'react-hot-toast';

interface RecordingPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const RecordingPanel: React.FC<RecordingPanelProps> = ({ isOpen, onClose }) => {
  const {
    isRecording,
    isPaused,
    availableSources,
    settings,
    recordingBlob,
    recordingUrl,
    setRecording,
    setPaused,
    setRecordingTime,
    setAvailableSources,
    updateSettings,
    setRecordingBlob,
    resetRecording,
    getFormattedTime,
    isReadyToRecord
  } = useRecordingStore();
  
  // Explicitly subscribe to recordingTime changes to ensure timer updates
  const recordingTime = useRecordingStore((state) => state.recordingTime);

  const { addClips } = useTimelineStore();
  const { addClip } = useMediaLibraryStore();

  const [isLoading, setIsLoading] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [chunks, setChunks] = useState<Blob[]>([]);
  const [cameraReady, setCameraReady] = useState(false); // Track if camera exposure is ready
  const [streamReady, setStreamReady] = useState(false); // Track if stream is ready for preview
  const micStreamRef = useRef<MediaStream | null>(null); // Keep reference to mic stream for screen recording

  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]); // Track chunks in ref to avoid closure issues

  // Load available sources when panel opens
  useEffect(() => {
    if (isOpen && availableSources.length === 0) {
      loadRecordingSources();
    }
  }, [isOpen, availableSources.length]);

      // Cleanup recording state when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Reset all recording state when modal closes
      console.log('[Recording] Modal closed, cleaning up recording state');
      setStreamReady(false);
      setCameraReady(false);
      // Reset recording blob and chunks when modal closes
      setRecordingBlob(null);
      setChunks([]);
      chunksRef.current = [];
      // Stop microphone stream if it exists
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
      resetRecording();
    }
  }, [isOpen, setRecordingBlob]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Attach stream to preview video element
  useEffect(() => {
    if (stream && previewVideoRef.current) {
      const video = previewVideoRef.current;
      console.log('[Recording] Setting preview video srcObject, stream tracks:', stream.getTracks().map(track => ({
        kind: track.kind,
        label: track.label,
        enabled: track.enabled
      })));
      
      // Set stream source - ALWAYS set it, even if already set, to ensure it's attached
      if (video.srcObject !== stream) {
        console.log('[Recording] Attaching stream to video element');
        video.srcObject = stream;
      }
      
      // For camera, show spinner initially - preview will be shown when recording starts
      if (settings.videoSource?.type === 'webcam') {
        setStreamReady(false); // Show spinner initially
        // Don't set streamReady here - it will be set when MediaRecorder starts
        // But ensure video is set up to play when ready
        video.muted = true; // Mute preview to avoid feedback
        video.autoplay = true;
        video.playsInline = true;
        
        // Try to play immediately for camera - sometimes it works
        video.play().catch(err => {
          console.log('[Recording] Initial play attempt failed (expected):', err.message);
        });
      } else {
        // Screen recording shows immediately - no loading state needed
        setStreamReady(true);
        // Ensure video plays for screen recording
        video.play().catch(err => {
          console.error('[Recording] Error playing screen preview:', err);
        });
      }
      
      // Log video track details to verify source
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        const track = videoTracks[0];
        console.log('[Recording] Preview video track label:', track.label);
        console.log('[Recording] Preview video track settings:', track.getSettings());
      }
      
      // Log audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        console.log('[Recording] Preview audio tracks:', audioTracks.length);
        audioTracks.forEach(track => {
          console.log('[Recording] Audio track:', {
            label: track.label,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState
          });
        });
      } else {
        console.warn('[Recording] No audio tracks found in stream!');
      }
    } else if (!stream && previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
      setStreamReady(false);
    }
  }, [stream, settings.videoSource]);

  // Create blob when recording stops and chunks are available
  useEffect(() => {
    console.log('[Recording] Blob creation effect triggered:', {
      isRecording,
      chunksLength: chunks.length,
      hasRecordingBlob: !!recordingBlob,
      totalChunkSize: chunks.reduce((sum, c) => sum + c.size, 0)
    });
    
    if (!isRecording && chunks.length > 0 && !recordingBlob) {
      const totalSize = chunks.reduce((acc, chunk) => acc + chunk.size, 0);
      console.log('[Recording] Creating blob from', chunks.length, 'chunks, total size:', totalSize, 'bytes');
      
      // Only create blob if we have actual data (non-zero size chunks)
      // WebM files need at least a few KB to be valid
      if (totalSize > 1024) { // Require at least 1KB
        const blob = new Blob(chunks, { type: 'video/webm' });
        console.log('[Recording] Blob created, size:', blob.size, 'bytes');
        setRecordingBlob(blob);
      } else {
        console.warn('[Recording] Chunks too small or empty, cannot create valid blob. Total size:', totalSize, 'bytes');
      }
    } else if (!isRecording && chunks.length === 0) {
      console.log('[Recording] No chunks available to create blob');
    } else if (!isRecording && recordingBlob) {
      console.log('[Recording] Blob already exists');
    }
  }, [isRecording, chunks, recordingBlob, setRecordingBlob]);

  const loadRecordingSources = async () => {
    try {
      setIsLoading(true);
      const result = await window.electronAPI.getRecordingSources();
      
      if (result.success && result.sources) {
        setAvailableSources(result.sources);
      } else {
        toast.error(result.error || 'Failed to load recording sources');
      }
    } catch (error) {
      console.error('Error loading recording sources:', error);
      toast.error('Failed to load recording sources');
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    if (!settings.videoSource) {
      toast.error('Please select a recording source');
      return;
    }

    try {
      setIsLoading(true);
      
      // Request permissions BEFORE starting recording
      const isWebcam = settings.videoSource.type === 'webcam';
      const needsMic = settings.audioSource;
      const needsCamera = isWebcam;
      
      // For screen recording with audio, we also need microphone permission
      const needsMicPermission = needsMic; // Both webcam and screen recording need mic if audio is enabled
      
      if (needsMicPermission || needsCamera) {
        console.log('[Recording] Requesting media permissions...', { mic: needsMicPermission, camera: needsCamera });
        
        try {
          const permissionResult = await window.electronAPI.requestMediaPermissions({
            mic: needsMicPermission,
            camera: needsCamera
          });
          
          console.log('[Recording] Permission check result:', permissionResult);
          
          // If permissions are denied on macOS, show helpful message
          if (permissionResult.platform === 'darwin') {
            if (permissionResult.denied && permissionResult.denied.length > 0) {
              const deniedMessages: string[] = [];
              if (permissionResult.denied.includes('microphone')) {
                deniedMessages.push('Microphone access was denied. Please enable it in System Settings > Privacy & Security > Microphone.');
              }
              if (permissionResult.denied.includes('camera')) {
                deniedMessages.push('Camera access was denied. Please enable it in System Settings > Privacy & Security > Camera.');
              }
              toast.error(deniedMessages.join(' '), { duration: 8000 });
              setIsLoading(false);
              return;
            }
            
            // Check if permissions were successfully granted
            if (permissionResult.success && permissionResult.granted) {
              const newlyGranted: string[] = [];
              if (needsMic && permissionResult.granted.microphone) {
                newlyGranted.push('microphone');
              }
              if (needsCamera && permissionResult.granted.camera) {
                newlyGranted.push('camera');
              }
              
              if (newlyGranted.length > 0) {
                console.log('[Recording] Permissions granted:', newlyGranted.join(', '));
                // Continue with recording - permissions are now granted
              }
            } else if (!permissionResult.success) {
              const missingPermissions: string[] = [];
              if (needsMic && (!permissionResult.granted?.microphone)) {
                missingPermissions.push('microphone');
              }
              if (needsCamera && (!permissionResult.granted?.camera)) {
                missingPermissions.push('camera');
              }
              
              if (missingPermissions.length > 0) {
                toast.error(`${missingPermissions.join(' and ')} access is required to record. Please grant permissions when prompted.`, { duration: 8000 });
                setIsLoading(false);
                return;
              }
            }
            
            // Permissions are granted or were just granted - continue with recording
            console.log('[Recording] Permissions granted, proceeding with recording');
          }
        } catch (permError) {
          console.warn('[Recording] Permission check failed (will proceed anyway):', permError);
          // Continue anyway - getUserMedia will handle permission requests
        }
      }
      
      // Get recording constraints from main process
      const result = await window.electronAPI.startRecording({
        videoSourceId: settings.videoSource.id,
        audioEnabled: settings.audioSource,
        resolution: settings.resolution,
        frameRate: settings.frameRate
      });

      if (!result.success || !result.constraints) {
        throw new Error(result.error || 'Failed to start recording');
      }

      // Get user media with the constraints
      // This will trigger system permission prompts if not already granted
      console.log('[Recording] Constraints from main process:', JSON.stringify(result.constraints, null, 2));
      console.log('[Recording] Selected video source:', settings.videoSource);
      console.log('[Recording] Video source ID:', settings.videoSource?.id);
      console.log('[Recording] Is webcam:', result.isWebcam);
      
      let mediaStream: MediaStream;
      
      if (result.isWebcam) {
        // For webcam, use standard getUserMedia
        console.log('[Recording] Requesting webcam stream...');
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(result.constraints);
        } catch (userMediaError: any) {
          console.error('[Recording] getUserMedia error:', userMediaError);
          
          // Check if it's a permission error
          if (userMediaError.name === 'NotAllowedError' || userMediaError.name === 'PermissionDeniedError') {
            const errorMessage = needsMic && needsCamera
              ? 'Microphone and camera access are required. Please grant permissions in System Settings > Privacy & Security.'
              : needsMic
              ? 'Microphone access is required. Please grant permissions in System Settings > Privacy & Security > Microphone.'
              : 'Camera access is required. Please grant permissions in System Settings > Privacy & Security > Camera.';
            
            toast.error(errorMessage, { duration: 8000 });
            setIsLoading(false);
            return;
          }
          
          // Re-throw other errors
          throw userMediaError;
        }
      } else {
        // For screen/window recording in Electron
        // Electron requires getUserMedia with chromeMediaSource, but it might not work directly
        // Try using the constraints - if it fails, we'll get an error
        console.log('[Recording] Requesting screen capture stream with getUserMedia...');
        console.log('[Recording] Using constraints:', JSON.stringify(result.constraints, null, 2));
        console.log('[Recording] Expected source ID:', settings.videoSource?.id);
        
        try {
          // Electron's getUserMedia should support chromeMediaSource constraints
          // But if it doesn't work, we might need to check Electron version or permissions
          mediaStream = await navigator.mediaDevices.getUserMedia(result.constraints);
          
          // Verify we got the right source
          const videoTracks = mediaStream.getVideoTracks();
          if (videoTracks.length > 0) {
            const track = videoTracks[0];
            const trackSettings = track.getSettings();
            console.log('[Recording] Video track settings:', trackSettings);
            console.log('[Recording] Video track label:', track.label);
            
            // Check if label indicates screen vs camera
            const label = track.label.toLowerCase();
            if (label.includes('camera') || label.includes('webcam') || label.includes('facetime')) {
              console.error('[Recording] ERROR: Got camera track instead of screen!');
              console.error('[Recording] Track label:', track.label);
              console.error('[Recording] Electron may not support chromeMediaSource constraints in getUserMedia');
              
              // Stop the incorrectly created camera stream immediately
              console.log('[Recording] Stopping incorrect camera stream...');
              mediaStream.getTracks().forEach(track => track.stop());
              mediaStream = null as any; // Clear reference
              
              console.error('[Recording] Trying alternative: getDisplayMedia...');
              
              // Try getDisplayMedia as fallback
              try {
                const displayStream = await navigator.mediaDevices.getDisplayMedia({
                  video: true,
                  audio: settings.audioSource
                });
                
                // Verify display stream
                const displayTracks = displayStream.getVideoTracks();
                if (displayTracks.length > 0) {
                  const displayLabel = displayTracks[0].label.toLowerCase();
                  if (!displayLabel.includes('camera') && !displayLabel.includes('webcam')) {
                    console.log('[Recording] getDisplayMedia succeeded with screen capture');
                    mediaStream = displayStream;
                  } else {
                    displayStream.getTracks().forEach(track => track.stop());
                    throw new Error('getDisplayMedia also returned camera');
                  }
                } else {
                  throw new Error('getDisplayMedia returned no video tracks');
                }
              } catch (displayError) {
                console.error('[Recording] getDisplayMedia also failed:', displayError);
                console.error('[Recording] DisplayMedia error details:', displayError);
                
                // Provide helpful error message
                const errorMessage = displayError instanceof Error 
                  ? displayError.message 
                  : String(displayError);
                
                if (errorMessage.includes('Not supported')) {
                  throw new Error(
                    'Screen recording is not supported in this Electron version. ' +
                    'Please ensure Screen Recording permission is granted in System Preferences > Privacy & Security > Screen Recording. ' +
                    'Also verify that Electron has the necessary permissions.'
                  );
                } else {
                  throw new Error(
                    `Failed to capture screen - Electron fell back to camera. ` +
                    `Track label: ${track.label}. ` +
                    `Error: ${errorMessage}. ` +
                    `This may be an Electron permissions or configuration issue. ` +
                    `Please check System Preferences > Privacy & Security > Screen Recording.`
                  );
                }
              }
            } else {
              console.log('[Recording] Screen capture confirmed - track label:', track.label);
              // Note: Audio fallback for screen recording is handled AFTER stream creation (see below)
            }
          }
        } catch (error) {
          console.error('[Recording] Error getting screen capture stream:', error);
          throw error; // Re-throw to show error to user
        }
      }
      
      console.log('[Recording] MediaStream created:', mediaStream);
      console.log('[Recording] MediaStream active:', mediaStream.active);
      console.log('[Recording] MediaStream id:', mediaStream.id);
      console.log('[Recording] MediaStream video tracks:', mediaStream.getVideoTracks().map(track => ({
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        readyState: track.readyState,
        settings: track.getSettings()
      })));
      
      // CRITICAL: For screen recording, ensure we have audio if requested
      // Check audio tracks AFTER stream is created but BEFORE MediaRecorder
      console.log('[Recording] ===== AUDIO CHECK START =====');
      console.log('[Recording] Checking audio requirements:', {
        isWebcam: result.isWebcam,
        audioSource: settings.audioSource,
        audioTracksInStream: mediaStream.getAudioTracks().length,
        audioSourceType: typeof settings.audioSource,
        audioSourceValue: settings.audioSource
      });
      
      if (!result.isWebcam && settings.audioSource) {
        console.log('[Recording] ===== ADDING MICROPHONE AUDIO =====');
        const currentAudioTracks = mediaStream.getAudioTracks();
        console.log('[Recording] Screen recording with audio requested. Current audio tracks:', currentAudioTracks.length);
        
        // Check if desktop audio tracks are actually working (not ended)
        const activeAudioTracks = currentAudioTracks.filter(track => track.readyState === 'live');
        console.log('[Recording] Active (live) audio tracks:', activeAudioTracks.length);
        
        // ALWAYS add microphone audio for screen recording if audio is requested
        // Desktop audio capture often fails or ends immediately, so we proactively add mic audio
        console.log('[Recording] Proactively adding microphone audio for screen recording...');
        
        try {
          // Request microphone audio separately
          console.log('[Recording] Calling getUserMedia for microphone...');
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: true
          });
          console.log('[Recording] Microphone stream obtained:', micStream.id);
          
          // Store reference to mic stream so it doesn't get garbage collected
          micStreamRef.current = micStream;
          
          // Get audio tracks from microphone stream
          const micAudioTracks = micStream.getAudioTracks();
          console.log('[Recording] Microphone audio tracks found:', micAudioTracks.length);
          
          if (micAudioTracks.length > 0) {
            console.log('[Recording] Adding microphone audio tracks to screen recording:', micAudioTracks.length);
            // Add microphone audio tracks to the screen stream
            micAudioTracks.forEach(track => {
              mediaStream.addTrack(track);
              console.log('[Recording] Added audio track:', track.label, 'enabled:', track.enabled, 'readyState:', track.readyState);
              
              // Ensure track is enabled
              if (!track.enabled) {
                track.enabled = true;
                console.log('[Recording] Enabled audio track:', track.label);
              }
              
              // Monitor audio track to ensure it stays alive
              track.addEventListener('ended', () => {
                console.error('[Recording] CRITICAL: Microphone audio track ended unexpectedly!');
              });
            });
            
            // CRITICAL: Don't stop the mic stream - keep it alive during recording
            // Only stop video tracks if any (there shouldn't be any)
            micStream.getVideoTracks().forEach(track => track.stop());
            
            // Verify audio tracks are now in the stream
            const finalAudioTracks = mediaStream.getAudioTracks();
            console.log('[Recording] ===== AUDIO ADDED SUCCESSFULLY =====');
            console.log('[Recording] Audio tracks after adding mic:', finalAudioTracks.length);
            finalAudioTracks.forEach((track, idx) => {
              console.log(`[Recording] Final audio track ${idx}:`, {
                label: track.label,
                enabled: track.enabled,
                readyState: track.readyState,
                muted: track.muted
              });
            });
          } else {
            console.warn('[Recording] No microphone audio tracks available');
            micStream.getTracks().forEach(track => track.stop());
            micStreamRef.current = null;
          }
        } catch (micError) {
          console.error('[Recording] ===== ERROR ADDING MICROPHONE AUDIO =====');
          console.error('[Recording] Could not add microphone audio:', micError);
          micStreamRef.current = null;
          // Show error toast if microphone permission is denied
          if (micError instanceof Error && micError.name === 'NotAllowedError') {
            toast.error('Microphone access is required for screen recording with audio. Please enable it in System Settings.');
          }
          // Continue without audio - screen recording will work without it
        }
        
        // Also monitor desktop audio tracks if they exist (they often end immediately)
        if (currentAudioTracks.length > 0) {
          console.log('[Recording] Monitoring desktop audio tracks:', currentAudioTracks.length);
          currentAudioTracks.forEach((track, idx) => {
            console.log(`[Recording] Desktop audio track ${idx}:`, {
              label: track.label,
              enabled: track.enabled,
              readyState: track.readyState,
              muted: track.muted
            });
            
            // Monitor these tracks - they might end unexpectedly
            track.addEventListener('ended', () => {
              console.error(`[Recording] CRITICAL: Desktop audio track ${idx} ended unexpectedly!`);
              // If desktop audio track ends and we don't have mic audio, try to add it
              const remainingAudioTracks = mediaStream.getAudioTracks();
              if (remainingAudioTracks.length === 0 && !micStreamRef.current) {
                console.log('[Recording] Desktop audio track ended, attempting to add microphone audio as fallback...');
                navigator.mediaDevices.getUserMedia({ audio: true }).then(micStream => {
                  micStreamRef.current = micStream;
                  const micTracks = micStream.getAudioTracks();
                  micTracks.forEach(micTrack => {
                    mediaStream.addTrack(micTrack);
                    console.log('[Recording] Added microphone audio track as fallback:', micTrack.label);
                  });
                }).catch(err => {
                  console.error('[Recording] Could not add microphone audio fallback:', err);
                });
              }
            });
          });
        }
      } else {
        console.log('[Recording] Skipping microphone audio:', {
          isWebcam: result.isWebcam,
          audioSource: settings.audioSource,
          reason: result.isWebcam ? 'is webcam' : (!settings.audioSource ? 'audio not requested' : 'unknown')
        });
      }
      console.log('[Recording] ===== AUDIO CHECK END =====');
      
      // For camera, wait a moment before marking stream as ready to show spinner
      if (result.isWebcam) {
        // Set stream but don't mark as ready - video element will handle it
        setStream(mediaStream);
      } else {
        setStream(mediaStream);
        setStreamReady(true); // Screen recording shows immediately
      }

      // Reset chunks before starting new recording
      setChunks([]);
      chunksRef.current = []; // Reset ref as well
      
      // Reset previous recording state if starting new recording
      if (recordingBlob) {
        resetRecording();
        setStreamReady(false);
        setCameraReady(false);
      }

      // Create MediaRecorder
      console.log('[Recording] Creating MediaRecorder with stream:', mediaStream);
      console.log('[Recording] Stream tracks:', mediaStream.getTracks().map(track => ({
        kind: track.kind,
        enabled: track.enabled,
        readyState: track.readyState,
        id: track.id,
        label: track.label,
        muted: track.muted
      })));
      
      // Check if we have video tracks
      const videoTracks = mediaStream.getVideoTracks();
      const audioTracks = mediaStream.getAudioTracks();
      console.log('[Recording] Video tracks count:', videoTracks.length);
      console.log('[Recording] Audio tracks count:', audioTracks.length);
      
      if (videoTracks.length === 0) {
        console.error('[Recording] No video tracks found in stream!');
      } else {
        const videoTrack = videoTracks[0];
        console.log('[Recording] Video track details:', videoTrack.getSettings());
        console.log('[Recording] Video track constraints:', videoTrack.getConstraints());
        console.log('[Recording] Video track capabilities:', videoTrack.getCapabilities());
        
        // Check if the video track is actually producing frames
        videoTrack.addEventListener('ended', () => {
          console.log('[Recording] Video track ended!');
        });
        
        videoTrack.addEventListener('mute', () => {
          console.log('[Recording] Video track muted!');
        });
        
        videoTrack.addEventListener('unmute', () => {
          console.log('[Recording] Video track unmuted!');
        });
      }
      
      // Check audio tracks
      if (audioTracks.length === 0) {
        console.warn('[Recording] No audio tracks found in stream! Audio may not be recorded.');
        if (settings.audioSource && !result.isWebcam) {
          console.warn('[Recording] Screen recording requested audio but no audio tracks available.');
          console.warn('[Recording] This may be an Electron permissions issue - system audio capture requires additional permissions.');
        }
      } else {
        console.log('[Recording] Audio tracks found:', audioTracks.length);
        audioTracks.forEach((track, index) => {
          console.log(`[Recording] Audio track ${index}:`, {
            label: track.label,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
            settings: track.getSettings()
          });
          
          // Ensure audio track is enabled
          if (!track.enabled) {
            console.warn(`[Recording] Audio track ${index} is disabled, enabling...`);
            track.enabled = true;
          }
          
          // Monitor audio track events
          track.addEventListener('ended', () => {
            console.error(`[Recording] Audio track ${index} ended unexpectedly!`);
          });
          
          track.addEventListener('mute', () => {
            console.error(`[Recording] Audio track ${index} became muted!`);
          });
        });
      }
      
      // Try different MIME types in order of preference
      // Note: MP4 recording is supported in Chrome 126+ (June 2024) and newer Electron versions
      // However, WebM is more reliable for streaming/recording scenarios
      // We'll try MP4 first, but fall back to WebM if not supported
      const hasAudio = audioTracks.length > 0;
      
      // CRITICAL: Verify audio tracks are actually enabled and producing data
      if (hasAudio) {
        const enabledAudioTracks = audioTracks.filter(t => t.enabled && t.readyState === 'live');
        if (enabledAudioTracks.length === 0) {
          console.error('[Recording] WARNING: Audio tracks exist but none are enabled/live!');
          console.error('[Recording] Audio tracks state:', audioTracks.map(t => ({
            enabled: t.enabled,
            readyState: t.readyState,
            muted: t.muted,
            label: t.label
          })));
        } else {
          console.log('[Recording] Audio tracks verified:', enabledAudioTracks.length, 'enabled and live');
        }
      }
      
      // Try MP4 first (if supported by Electron version)
      let mimeType = hasAudio 
        ? 'video/mp4;codecs=avc1.42E01E,mp4a.40.2' // H.264 Baseline + AAC
        : 'video/mp4;codecs=avc1.42E01E'; // H.264 Baseline only
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        // Fallback to WebM with VP9/Opus (more universally supported)
        // IMPORTANT: Include opus codec in MIME type to ensure audio is recorded
        mimeType = hasAudio ? 'video/webm;codecs=vp9,opus' : 'video/webm;codecs=vp9';
        
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = hasAudio ? 'video/webm;codecs=vp8,opus' : 'video/webm;codecs=vp8';
          
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            // Generic WebM - MediaRecorder will choose codec automatically
            // Note: This may not include audio if codec isn't specified
            mimeType = 'video/webm';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
              mimeType = 'video/mp4'; // Last resort - generic MP4
            }
          }
        }
      }
      
      const isDirectMP4 = mimeType.startsWith('video/mp4');
      const hasOpusCodec = mimeType.includes('opus');
      console.log('[Recording] Using MIME type:', mimeType, 'Has audio:', hasAudio, 'Direct MP4:', isDirectMP4, 'Opus codec:', hasOpusCodec);
      
      const recorder = new MediaRecorder(mediaStream, {
        mimeType: mimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
        audioBitsPerSecond: 128000   // 128 kbps
      });
      
      // Verify MediaRecorder is configured to record audio
      if (hasAudio) {
        console.log('[Recording] MediaRecorder configured with audio:', {
          mimeType: mimeType,
          audioBitsPerSecond: 128000,
          audioTracksInStream: audioTracks.length,
          audioTracksEnabled: audioTracks.filter(t => t.enabled).length,
          audioTracksReady: audioTracks.filter(t => t.readyState === 'live').length
        });
        
        // Double-check audio tracks are actually enabled and live
        audioTracks.forEach((track, index) => {
          if (!track.enabled) {
            console.warn(`[Recording] Audio track ${index} is disabled! Enabling...`);
            track.enabled = true;
          }
          if (track.readyState !== 'live') {
            console.warn(`[Recording] Audio track ${index} is not live! State:`, track.readyState);
          }
        });
      } else {
        console.warn('[Recording] MediaRecorder created WITHOUT audio (no audio tracks in stream)');
      }
      
      // For screen recording, we might need to start with a longer interval
      // or use different settings
      console.log('[Recording] MediaRecorder options:', {
        mimeType: mimeType,
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000
      });
      
      console.log('[Recording] MediaRecorder created, state:', recorder.state);
      
      recorder.ondataavailable = (event) => {
        console.log('[Recording] ondataavailable event fired, data size:', event.data.size);
        console.log('[Recording] Event details:', {
          type: event.type,
          timecode: event.timecode,
          dataType: event.data.type,
          dataSize: event.data.size
        });
        
        // Always add chunks, even if size is 0 (could be metadata)
        // But prioritize non-empty chunks
        if (event.data.size > 0) {
          console.log('[Recording] Data chunk received:', event.data.size, 'bytes');
          chunksRef.current.push(event.data); // Update ref immediately
          setChunks(prev => {
            const newChunks = [...prev, event.data];
            console.log('[Recording] Total chunks now:', newChunks.length, 'Total size:', newChunks.reduce((sum, c) => sum + c.size, 0), 'bytes');
            return newChunks;
          });
        } else {
          console.log('[Recording] Empty data chunk received (may be metadata or end-of-stream)');
          // Still add empty chunks if they're the last ones (end-of-stream marker)
          if (recorder.state === 'inactive') {
            chunksRef.current.push(event.data);
            setChunks(prev => {
              console.log('[Recording] Adding final empty chunk');
              return [...prev, event.data];
            });
          }
        }
      };

      recorder.onstop = async () => {
        console.log('[Recording] MediaRecorder stopped, state:', recorder.state);
        // Wait longer for final chunks to be fully collected
        // WebM files need time to finalize properly
        setTimeout(async () => {
          const finalChunks = [...chunksRef.current];
          const totalSize = finalChunks.reduce((sum, c) => sum + c.size, 0);
          console.log('[Recording] onstop - Final chunks:', finalChunks.length, 'Total size:', totalSize, 'bytes');
          
          // Recreate blob from all chunks including final ones
          if (totalSize > 1024) {
            const finalBlob = new Blob(finalChunks, { type: 'video/webm' });
            console.log('[Recording] onstop - Recreating blob, size:', finalBlob.size, 'bytes');
            
            // Verify blob is valid by checking size
            if (finalBlob.size > 0) {
              // Update chunks state to trigger blob recreation
              setChunks(finalChunks);
              console.log('[Recording] Blob recreated successfully');
            } else {
              console.error('[Recording] Blob recreation failed - size is 0');
            }
          } else {
            console.warn('[Recording] Total chunk size too small:', totalSize, 'bytes');
          }
        }, 500); // Increased delay to ensure WebM file is finalized
      };

      recorder.onerror = (event) => {
        console.error('[Recording] MediaRecorder error:', event);
        console.error('[Recording] MediaRecorder error details:', {
          error: event.error,
          type: event.type,
          target: event.target
        });
      };

      recorder.onstart = () => {
        console.log('[Recording] MediaRecorder started, state:', recorder.state);
      };

      setMediaRecorder(recorder);
      mediaRecorderRef.current = recorder; // Store in ref for timer access
      
      // Reset recording time to 0 BEFORE starting
      setRecordingTime(0);
      setRecording(true);
      
      // For webcam, wait 600ms for camera exposure adjustment, then start recording + show preview together
      const cameraDelay = result.isWebcam ? 600 : 0; // 0.6 seconds for camera exposure
      
      if (result.isWebcam) {
        console.log('[Recording] Webcam recording - showing spinner for', cameraDelay, 'ms while camera adjusts');
        setCameraReady(false); // Hide preview initially
        setStreamReady(false); // Show spinner
      } else {
        setCameraReady(true); // Screen recording shows immediately
        setStreamReady(true);
      }
      
      // Start recording and show preview together after delay
      setTimeout(() => {
        // Set recording start time NOW when MediaRecorder actually starts
        recordingStartTimeRef.current = Date.now();
        
        // Start recording timer - sync with MediaRecorder start
        console.log('[Recording] Starting timer interval');
        const timerCallback = () => {
          try {
            // Get fresh state from store to avoid closure issues
            const currentState = useRecordingStore.getState();
            const startTime = recordingStartTimeRef.current;
            
            // Only increment if we're actually recording and not paused (using fresh state)
            if (currentState.isRecording && !currentState.isPaused && startTime) {
              // Calculate elapsed time from start for accuracy
              const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
              
              console.log('[Recording] Timer tick - updating to', elapsedSeconds, 'seconds');
              
              // Always update, even if same value, to force re-render
              setRecordingTime(elapsedSeconds);
            }
          } catch (error) {
            console.error('[Recording] Timer callback error:', error);
          }
        };
        
        recordingIntervalRef.current = setInterval(timerCallback, 100); // Update every 100ms for smoother display
        
        // Verify stream is producing frames before starting recorder
        const videoTracks = mediaStream.getVideoTracks();
        if (videoTracks.length > 0) {
          const videoTrack = videoTracks[0];
          console.log('[Recording] Video track readyState before start:', videoTrack.readyState);
          console.log('[Recording] Video track enabled:', videoTrack.enabled);
          console.log('[Recording] Video track muted:', videoTrack.muted);
          
          // Check if track is actually producing frames
          videoTrack.addEventListener('mute', () => {
            console.error('[Recording] Video track became muted!');
          });
          
          videoTrack.addEventListener('ended', () => {
            console.error('[Recording] Video track ended unexpectedly!');
          });
        }
        
        // For screen recording, ensure video element is playing before starting recorder
        if (!result.isWebcam && previewVideoRef.current) {
          const video = previewVideoRef.current;
          // Ensure video is playing to produce frames
          video.play().catch(err => {
            console.error('[Recording] Error playing video:', err);
          });
          
          // Wait a moment for video to start playing, then start recorder
          setTimeout(() => {
            startRecorder();
          }, 200);
        } else {
          startRecorder();
        }
        
        function startRecorder() {
          // Use timeslice for both camera and screen
          // For screen recording, use a shorter timeslice to ensure chunks are produced
          const timeslice = result.isWebcam ? 1000 : 500; // Camera: 1s, Screen: 500ms
          console.log('[Recording] Starting MediaRecorder with timeslice:', timeslice);
          recorder.start(timeslice);
          
          console.log('[Recording] MediaRecorder started, state:', recorder.state);
          
          // For camera, NOW show preview and mark camera as ready (synced with recording start)
          if (result.isWebcam) {
            console.log('[Recording] Camera exposure ready, showing preview and starting recording');
            setStreamReady(true); // Show preview NOW
            setCameraReady(true); // Camera is ready NOW - do this FIRST to remove opacity:0
            
            // Ensure video element is playing to show preview - use setTimeout to ensure DOM is updated
            setTimeout(() => {
              if (previewVideoRef.current) {
                const video = previewVideoRef.current;
                console.log('[Recording] Attempting to play video preview, srcObject:', video.srcObject ? 'set' : 'null');
                console.log('[Recording] Video paused state:', video.paused);
                console.log('[Recording] Video readyState:', video.readyState);
                
                // CRITICAL: If srcObject is null, set it to the stream FIRST
                if (!video.srcObject || video.srcObject !== mediaStream) {
                  console.log('[Recording] Setting srcObject to mediaStream');
                  video.srcObject = mediaStream;
                  // Wait for stream to attach before playing
                  setTimeout(() => {
                    video.play().then(() => {
                      console.log('[Recording] Video preview playing successfully after setting srcObject');
                    }).catch(err => {
                      console.error('[Recording] Error playing video after setting srcObject:', err);
                      // Try again after a short delay
                      setTimeout(() => {
                        video.play().catch(e => {
                          console.error('[Recording] Second play attempt failed:', e);
                        });
                      }, 100);
                    });
                  }, 50);
                } else {
                  // srcObject is already set, just play
                  video.play().then(() => {
                    console.log('[Recording] Video preview playing successfully');
                  }).catch(err => {
                    console.error('[Recording] Error playing video preview:', err);
                    // Try again after a short delay
                    setTimeout(() => {
                      video.play().catch(e => {
                        console.error('[Recording] Second play attempt failed:', e);
                      });
                    }, 100);
                  });
                }
              } else {
                console.warn('[Recording] previewVideoRef.current is null');
              }
            }, 50);
          }
          
          // Test if MediaRecorder is actually working
          setTimeout(() => {
            const recorderState = mediaRecorderRef.current?.state;
            console.log('[Recording] MediaRecorder state after 1s:', recorderState);
            console.log('[Recording] MediaStream active after 1s:', mediaStream.active);
            const tracks = mediaStream.getVideoTracks();
            const audioTracks = mediaStream.getAudioTracks();
            console.log('[Recording] Audio tracks after 1s:', audioTracks.length);
            if (audioTracks.length > 0) {
              console.log('[Recording] Audio track details:', audioTracks.map(track => ({
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState,
                label: track.label,
                settings: track.getSettings()
              })));
            }
            if (tracks.length > 0) {
              console.log('[Recording] Video tracks after 1s:', tracks.map(track => ({
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState,
                label: track.label,
                settings: track.getSettings()
              })));
            }
            if (recorderState === 'recording') {
              console.log('[Recording] MediaRecorder is still recording');
            } else {
              console.log('[Recording] MediaRecorder stopped unexpectedly');
            }
          }, 1000);
        }
      }, cameraDelay);

      toast.success('Recording started');
    } catch (error: any) {
      console.error('Error starting recording:', error);
      
      // Handle permission errors specifically
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError' || error.message?.includes('permission')) {
        const isWebcam = settings.videoSource?.type === 'webcam';
        const needsMic = settings.audioSource;
        
        if (isWebcam && needsMic) {
          toast.error('Camera and microphone access are required. Please grant permissions in System Settings > Privacy & Security.', { duration: 8000 });
        } else if (isWebcam) {
          toast.error('Camera access is required. Please grant permissions in System Settings > Privacy & Security > Camera.', { duration: 8000 });
        } else if (needsMic) {
          toast.error('Microphone access is required. Please grant permissions in System Settings > Privacy & Security > Microphone.', { duration: 8000 });
        } else {
          toast.error('Recording permission denied. Please check System Settings > Privacy & Security.', { duration: 8000 });
        }
      } else {
        toast.error(error.message || 'Failed to start recording', { duration: 5000 });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const stopRecording = () => {
    console.log('[Recording] Stopping recording...');
    
    // Stop MediaRecorder FIRST to ensure all chunks are collected
    const recorder = mediaRecorderRef.current;
    if (recorder && (recorder.state === 'recording' || recorder.state === 'paused')) {
      console.log('[Recording] Stopping MediaRecorder, state:', recorder.state);
      console.log('[Recording] Current chunks before stop:', chunks.length);
      
      // Request final data chunks before stopping
      recorder.requestData();
      
      // Stop the recorder - this will trigger onstop event
      recorder.stop();
      
      // Wait longer for final chunks to be collected - important for WebM files
      setTimeout(() => {
        console.log('[Recording] Chunks after MediaRecorder stop:', chunksRef.current.length, 'chunks');
        console.log('[Recording] Total size:', chunksRef.current.reduce((sum, c) => sum + c.size, 0), 'bytes');
        // Force update chunks state from ref
        setChunks([...chunksRef.current]);
      }, 500); // Increased delay to ensure all chunks are collected
    }

    // Calculate final duration from elapsed time
    if (recordingStartTimeRef.current) {
      const finalDuration = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
      console.log('[Recording] Final duration calculated:', finalDuration, 'seconds');
      setRecordingTime(finalDuration); // Ensure final time is accurate
    }

    if (stream) {
      console.log('[Recording] Stopping media stream tracks');
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    // Stop microphone stream if it exists (for screen recording)
    if (micStreamRef.current) {
      console.log('[Recording] Stopping microphone stream');
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }

    if (recordingIntervalRef.current) {
      console.log('[Recording] Clearing timer interval');
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    setRecording(false);
    setPaused(false);
    recordingStartTimeRef.current = null;
    setCameraReady(false); // Reset camera ready state
    toast.success('Recording stopped');
  };

  const saveRecording = async () => {
    if (!recordingBlob) {
      toast.error('No recording to save');
      return;
    }

    try {
      console.log('[Recording] Saving recording...');
      console.log('[Recording] Recording blob size:', recordingBlob.size, 'bytes');
      
      // Get the actual duration from the store at the time of saving
      // If timer failed, calculate from start time
      let actualRecordingTime = useRecordingStore.getState().recordingTime;
      if (actualRecordingTime === 0 && recordingStartTimeRef.current) {
        // Fallback: calculate from elapsed time
        actualRecordingTime = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        console.log('[Recording] Timer was 0, calculated duration from elapsed time:', actualRecordingTime);
      } else {
        console.log('[Recording] Using duration from store:', actualRecordingTime);
      }
      
      const arrayBuffer = await recordingBlob.arrayBuffer();
      const result = await window.electronAPI.saveRecording(arrayBuffer);
      
      if (result.success && result.filePath) {
        console.log('[Recording] Recording saved to:', result.filePath);
        console.log('[Recording] Using duration:', actualRecordingTime, 'seconds');
        
        // Create a clip object for the media library
        const clip = {
          id: `recording-${Date.now()}`,
          path: result.filePath,
          name: `Recording ${new Date().toLocaleString()}`,
          duration: actualRecordingTime, // Use actual recorded time, not stale closure value
          width: settings.resolution.width,
          height: settings.resolution.height,
          frameRate: settings.frameRate,
          codec: 'mp4',
          fileSize: recordingBlob.size,
          trimStart: 0,
          trimEnd: actualRecordingTime > 0 ? actualRecordingTime : 0, // Use 0 if duration is 0
          thumbnailPath: undefined // Will be generated later
        };
        
        console.log('[Recording] Created clip object:', clip);
        
        // Add to media library
        addClip(clip);
        
        // Add to timeline if duration > 0
        if (actualRecordingTime > 0) {
          addClips([clip]);
          console.log('[Recording] Added clip to timeline');
        } else {
          console.warn('[Recording] Duration is 0, not adding to timeline');
        }
        
      toast.success('Recording saved and added to library');
      
      // Reset recording state after successful save
      resetRecording();
      setChunks([]);
      setStreamReady(false);
      setCameraReady(false);
      
      onClose(); // Close the modal
      } else {
        throw new Error(result.error || 'Failed to save recording');
      }
    } catch (error) {
      console.error('[Recording] Error saving recording:', error);
      toast.error('Failed to save recording');
    }
  };

  const pauseRecording = () => {
    console.log('[Recording] Pause button clicked');
    const recorder = mediaRecorderRef.current;
    console.log('[Recording] MediaRecorder state:', recorder?.state);
    console.log('[Recording] isPaused:', isPaused);
    console.log('[Recording] isRecording:', isRecording);
    
    if (recorder && recorder.state === 'recording') {
      console.log('[Recording] Pausing MediaRecorder and timer');
      recorder.pause();
      setPaused(true);
      
      // Don't clear timer on pause - it will skip incrementing while paused
      // Timer will continue checking state
    } else {
      console.log('[Recording] Cannot pause - MediaRecorder not recording');
    }
  };

  const resumeRecording = () => {
    console.log('[Recording] Resume button clicked');
    const recorder = mediaRecorderRef.current;
    console.log('[Recording] MediaRecorder state:', recorder?.state);
    console.log('[Recording] isPaused:', isPaused);
    
    if (recorder && recorder.state === 'paused') {
      console.log('[Recording] Resuming MediaRecorder');
      recorder.resume();
      setPaused(false);
      
      // Update start time to account for pause duration
      const currentTime = useRecordingStore.getState().recordingTime;
      if (recordingStartTimeRef.current) {
        // Adjust start time to account for elapsed time
        recordingStartTimeRef.current = Date.now() - (currentTime * 1000);
      }
      
      // Timer is already running, it will resume incrementing automatically
    } else {
      console.log('[Recording] Cannot resume - MediaRecorder not paused');
    }
  };


  const discardRecording = () => {
    resetRecording();
    setChunks([]);
    chunksRef.current = []; // Reset ref
    setStreamReady(false);
    setCameraReady(false); // Reset camera ready state
    toast.success('Recording discarded');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        ref={(el) => {
          if (el && isRecording) {
            // One-time scroll to bottom when recording starts
            setTimeout(() => {
              el.scrollTop = el.scrollHeight;
            }, 100);
          }
        }}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Record Screen</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Recording Source Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Recording Source
          </label>
          {isLoading ? (
            <div className="text-center py-4">Loading sources...</div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {availableSources.map((source: RecordingSource) => (
                <button
                  key={source.id}
                  onClick={() => updateSettings({ videoSource: source })}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    settings.videoSource?.id === source.id
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300 shadow-lg'
                      : 'border-gray-300 hover:border-gray-400 hover:shadow-md'
                  }`}
                >
                  <div className="relative">
                    <img
                      src={source.thumbnail}
                      alt={source.name}
                      className="w-full h-24 object-cover rounded mb-2"
                    />
                    {settings.videoSource?.id === source.id && (
                      <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                        ✓
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-medium text-gray-900 truncate" title={source.name}>
                    {source.name}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {source.type}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recording Settings */}
        <div className="mb-6 space-y-4">
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.audioSource}
                onChange={(e) => updateSettings({ audioSource: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">
                Include Audio
              </span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resolution
              </label>
              <select
                value={`${settings.resolution.width}x${settings.resolution.height}`}
                onChange={(e) => {
                  console.log('[Recording] Resolution changed to:', e.target.value);
                  const [width, height] = e.target.value.split('x').map(Number);
                  updateSettings({ resolution: { width, height } });
                }}
                className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900"
                style={{ color: '#111827' }}
              >
                <option value="1920x1080">1920x1080 (1080p)</option>
                <option value="1280x720">1280x720 (720p)</option>
                <option value="854x480">854x480 (480p)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Frame Rate
              </label>
              <select
                value={settings.frameRate}
                onChange={(e) => {
                  console.log('[Recording] Frame rate changed to:', e.target.value);
                  updateSettings({ frameRate: Number(e.target.value) });
                }}
                className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900"
                style={{ color: '#111827' }}
              >
                <option value={30}>30 FPS</option>
                <option value={60}>60 FPS</option>
                <option value={24}>24 FPS</option>
              </select>
            </div>
          </div>
        </div>

        {/* Recording Controls */}
        <div className="mb-6">
          {!isRecording ? (
            <div className="text-center">
              <button
                onClick={startRecording}
                disabled={!isReadyToRecord() || isLoading}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                {isLoading ? 'Starting...' : 'Start Recording'}
              </button>
            </div>
          ) : (
            <>
              {/* Live Preview */}
              {stream && (
                <div className="mb-4">
                  <div className="flex items-center justify-center mb-2">
                    <span className="w-3 h-3 bg-red-600 rounded-full animate-pulse mr-2"></span>
                    <h3 className="text-lg font-medium text-gray-900">Recording...</h3>
                  </div>
                  {!streamReady ? (
                    // Loading spinner while stream is initializing
                    <div className="w-full max-w-md mx-auto border-4 border-red-500 rounded-lg bg-black h-64 flex items-center justify-center">
                      <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                        <p className="text-white text-sm">Initializing camera...</p>
                      </div>
                    </div>
                  ) : (
                    <video
                      ref={previewVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full max-w-md mx-auto border-4 border-red-500 rounded-lg bg-black"
                      style={{ opacity: settings.videoSource?.type === 'webcam' && !cameraReady ? 0 : 1 }}
                      onLoadedMetadata={() => {
                        // Ensure video plays when metadata loads
                        console.log('[Recording] Video metadata loaded, attempting to play');
                        if (previewVideoRef.current && streamReady) {
                          previewVideoRef.current.play().then(() => {
                            console.log('[Recording] Video playing successfully after metadata load');
                          }).catch(err => {
                            console.error('[Recording] Error auto-playing video:', err);
                          });
                        }
                      }}
                      onCanPlay={() => {
                        // Additional play attempt when video can play
                        console.log('[Recording] Video can play, ensuring it plays');
                        if (previewVideoRef.current && streamReady && previewVideoRef.current.paused) {
                          previewVideoRef.current.play().catch(err => {
                            console.error('[Recording] Error playing video on canplay:', err);
                          });
                        }
                      }}
                      onPlaying={() => {
                        console.log('[Recording] Video is now playing');
                      }}
                    />
                  )}
                  {settings.videoSource?.type === 'webcam' && !cameraReady && streamReady && (
                    <div className="text-center text-sm text-gray-500 mt-2">
                      Camera adjusting exposure...
                    </div>
                  )}
                </div>
              )}
              
              <div className="text-center space-y-4">
                {/* Timer display - use recordingTime from selector to ensure updates */}
                <div className="text-2xl font-mono text-gray-900" key={recordingTime}>
                  {(() => {
                    // Use recordingTime from selector - this will trigger re-renders
                    const minutes = Math.floor(recordingTime / 60);
                    const seconds = Math.floor(recordingTime % 60);
                    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                  })()}
                </div>
                
                <div className="flex justify-center space-x-4">
                  {isPaused ? (
                    <button
                      onClick={resumeRecording}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      Resume
                    </button>
                  ) : (
                    <button
                      onClick={pauseRecording}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      Pause
                    </button>
                  )}
                  
                  <button
                    onClick={stopRecording}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Stop
                  </button>
                </div>
                
                {/* Save button - only show when there's a recording blob */}
                {recordingBlob && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={saveRecording}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Save Recording
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Recording Preview/Save */}
        {recordingBlob && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Recording Complete
            </h3>
            <div className="bg-gray-100 p-4 rounded-lg">
              <video
                src={recordingUrl || undefined}
                controls
                className="w-full max-w-md mx-auto"
              />
              <div className="mt-4 flex justify-center space-x-4">
                <button
                  onClick={saveRecording}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Save Recording
                </button>
                <button
                  onClick={discardRecording}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Close Button */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordingPanel;

