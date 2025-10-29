import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { useTimelineStore } from '../store/timelineStore';
import { Clip } from '@shared/types';

interface ClipInfo {
  clip: Clip;
  clipStartTime: number;
  clipDuration: number;
}

const VideoPreview: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Video element readiness tracking
  const videoReadyStateRef = useRef<'loading' | 'canplay' | 'error'>('loading');
  const pendingPlayRef = useRef<boolean>(false);
  const playbackAnimationFrameRef = useRef<number | null>(null);
  const previousClipIdRef = useRef<string | null>(null); // Track previous clip to prevent duplicate loads
  const handleEndedRef = useRef<(() => void) | null>(null); // Stable ref for handleEnded to avoid RAF loop restarts
  const previousVideoTimeRef = useRef<number>(0); // Track previous video time for boundary crossing detection
  
  // Only subscribe to the state we actually need
  const { clips, playhead, totalDuration } = useTimelineStore();
  
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  
  // Stable reference to current clip info to prevent RAF loop restarts
  const currentClipInfoRef = useRef<ClipInfo | null>(null);
  // DERIVED STATE: Calculate during render, not in useEffect
  // This is pure computation from props/state - no need for useEffect
  const currentClipInfo = useMemo((): ClipInfo | null => {
    if (clips.length === 0) {
      currentClipInfoRef.current = null;
      return null;
    }
    
    let currentTime = 0;
    for (const clip of clips) {
      const clipDuration = clip.trimEnd > 0 ? clip.trimEnd - clip.trimStart : clip.duration - clip.trimStart;
      if (playhead >= currentTime && playhead < currentTime + clipDuration) {
        const newInfo = {
          clip,
          clipStartTime: currentTime,
          clipDuration
        };
        
        // Only return new object if clip actually changed
        if (currentClipInfoRef.current?.clip.id !== clip.id) {
          console.log('[Clip Info] Clip changed:', clip.name);
          currentClipInfoRef.current = newInfo;
          return newInfo;
        }
        
        // Same clip - return existing reference to prevent RAF restart
        return currentClipInfoRef.current;
      }
      currentTime += clipDuration;
    }
    
    // Fallback to last clip if playhead is at the end
    if (clips.length > 0) {
      let totalTime = 0;
      for (let i = 0; i < clips.length - 1; i++) {
        const clip = clips[i];
        totalTime += clip.trimEnd > 0 ? clip.trimEnd - clip.trimStart : clip.duration - clip.trimStart;
      }
      const lastClip = clips[clips.length - 1];
      const newInfo = {
        clip: lastClip,
        clipStartTime: totalTime,
        clipDuration: lastClip.trimEnd > 0 ? lastClip.trimEnd - lastClip.trimStart : lastClip.duration - lastClip.trimStart
      };
      
      // Only return new object if clip actually changed
      if (currentClipInfoRef.current?.clip.id !== lastClip.id) {
        console.log('[Clip Info] Clip changed to last clip:', lastClip.name);
        currentClipInfoRef.current = newInfo;
        return newInfo;
      }
      
      // Same clip - return existing reference
      return currentClipInfoRef.current;
    }
    
    currentClipInfoRef.current = null;
    return null;
  }, [clips, playhead]); // Memoize to avoid recalculation on every render

  const currentClip = currentClipInfo?.clip || null;

  // Stable currentClipName reference to prevent VideoControls re-renders
  // Only changes when the actual clip ID changes, not on every render
  const currentClipName = useMemo(() => {
    return currentClip?.name || '';
  }, [currentClip?.id]); // Only depend on clip ID, not the full clip object

  // EFFECT 1: Manage video source loading and clip transitions
  // Depend on currentClipInfo (stable reference) not currentClip (unstable)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentClipInfo) return;
    
    const clip = currentClipInfo.clip;

    // Check if this is the same clip we just loaded (MUST check before logging)
    if (previousClipIdRef.current === clip.id) {
      // Same clip - no need to reload, just ensure we're ready
      if (video.readyState >= 3) {
        videoReadyStateRef.current = 'canplay';
      }
      return; // ✅ Return immediately - don't log, don't do anything
    }
    
    // Only log and proceed if we're actually changing clips
    console.log('[Video Source] Clip changed from', previousClipIdRef.current, 'to', clip.id, '-', clip.name);
    
    // Update tracking IMMEDIATELY after detecting change
    previousClipIdRef.current = clip.id;

    // Reset error state when loading new video
    setHasError(false);
    setErrorMessage('');
    videoReadyStateRef.current = 'loading';
    
    // Update source
    const newSrc = `file://${clip.path}`;
    console.log('[Video Source] Loading new clip:', clip.name);
    video.src = newSrc;
    video.load();
    
    // CRITICAL: Immediately seek to the correct position after metadata loads
    // This minimizes visible flicker by reducing the time the new clip shows its first frame
    video.addEventListener('loadedmetadata', () => {
      const currentPlayhead = useTimelineStore.getState().playhead;
      const timeInClip = currentPlayhead - currentClipInfo.clipStartTime;
      const targetTime = clip.trimStart + timeInClip;
      
      // Only seek if we're not at the start of the clip already
      if (Math.abs(video.currentTime - targetTime) > 0.05) {
        console.log('[Video Source] Metadata loaded, seeking to:', targetTime);
        video.currentTime = targetTime;
      }
    }, { once: true });
  }, [currentClipInfo]); // Only depend on stable currentClipInfo!

  // EFFECT 2: Sync video currentTime with timeline playhead (when paused or seeking)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentClip || !currentClipInfo) return;

    // Calculate the time in the current clip
    const timeInClip = playhead - currentClipInfo.clipStartTime;
    
    // Boundary check: ensure timeInClip is within valid range
    if (timeInClip < 0 || timeInClip > currentClipInfo.clipDuration) {
      console.log('[Playhead Sync] Time outside clip bounds, skipping:', {
        timeInClip,
        clipDuration: currentClipInfo.clipDuration
      });
      return;
    }
    
    const videoTime = currentClip.trimStart + timeInClip;
    
    // Only seek if:
    // 1. Video is paused (user is scrubbing timeline)
    // 2. AND difference is significant (avoid micro-adjustments during playback)
    const timeDiff = Math.abs(video.currentTime - videoTime);
    
    if (video.paused && timeDiff > 0.05) {
      console.log('[Playhead Sync] Seeking video:', {
        playhead,
        videoTime,
        currentVideoTime: video.currentTime,
        difference: timeDiff
      });
      video.currentTime = videoTime;
    }
  }, [playhead, currentClip, currentClipInfo]);

  // VIDEO EVENT HANDLERS - Define these first so they can be used in effects
  
  const handleCanPlay = useCallback(() => {
    console.log('[Video Ready] Video can play');
    videoReadyStateRef.current = 'canplay';
    
    // If there's a pending play request, fulfill it now
    if (pendingPlayRef.current) {
      const video = videoRef.current;
      if (video) {
        console.log('[Video Ready] Fulfilling pending play request');
        video.play()
          .then(() => {
            console.log('[Video Ready] Play promise resolved successfully');
            // Ensure isPlaying state is correct
            setIsPlaying(true);
          })
          .catch(err => {
            console.error('[Play Error] Failed to play after load:', err);
            setIsPlaying(false);
          });
      }
      pendingPlayRef.current = false;
    }
  }, []);

  const handlePlay = useCallback(() => {
    console.log('[Video Event] Play started');
    setIsPlaying(true);
    pendingPlayRef.current = false;
  }, []);

  const handlePause = useCallback(() => {
    console.log('[Video Event] Paused');
    setIsPlaying(false);
  }, []);

  const handleEnded = useCallback(() => {
    console.log('[Video Event] Current clip ended');
    
    if (!currentClipInfo) return;
    
    const currentClipIndex = clips.findIndex(c => c.id === currentClip?.id);
    if (currentClipIndex < clips.length - 1) {
      // There's a next clip - transition to it
      const nextClipStartTime = currentClipInfo.clipStartTime + currentClipInfo.clipDuration;
      
      console.log('[Clip Transition] Moving to next clip:', {
        currentClipIndex,
        nextClipIndex: currentClipIndex + 1,
        nextClipStartTime
      });
      
      // Update playhead to start of next clip
      // This will trigger the clip change via useMemo recalculation
      useTimelineStore.getState().setPlayhead(nextClipStartTime + 0.001);
      
      // Mark that we want to play the next clip
      pendingPlayRef.current = true;
      
      // The video source will change via useEffect when currentClipInfo updates
      // Then handleCanPlay will automatically resume playback
    } else {
      // End of timeline - stop playback
      console.log('[Playback Complete] Reached end of timeline');
      setIsPlaying(false);
      useTimelineStore.getState().setPlayhead(totalDuration);
    }
  }, [clips, currentClip, currentClipInfo, totalDuration]);

  // Store handleEnded in ref so RAF effect doesn't need it as dependency
  useEffect(() => {
    handleEndedRef.current = handleEnded;
  }, [handleEnded]);

  const handleError = useCallback(() => {
    console.error('[Video Error] Failed to load:', currentClip?.path);
    videoReadyStateRef.current = 'error';
    setHasError(true);
    setErrorMessage('Unable to load video. File may be corrupted or unsupported format.');
    setIsPlaying(false);
  }, [currentClip]);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video || !currentClip || !currentClipInfo) return;

    if (video.paused) {
      console.log('[User Action] Play button clicked');
      
      // Before playing, ensure video is at the correct timeline position
      const timeInClip = playhead - currentClipInfo.clipStartTime;
      if (timeInClip >= 0 && timeInClip <= currentClipInfo.clipDuration) {
        const videoTime = currentClip.trimStart + timeInClip;
        const timeDiff = Math.abs(video.currentTime - videoTime);
        
        if (timeDiff > 0.05) {
          console.log('[User Action] Seeking video to timeline position:', {
            playhead,
            videoTime,
            currentVideoTime: video.currentTime,
            difference: timeDiff
          });
          video.currentTime = videoTime;
        }
      }
      
      // Check if video is ready to play
      if (videoReadyStateRef.current === 'canplay') {
        video.play().catch(err => {
          console.error('[Play Error] Failed to play:', err);
          setIsPlaying(false);
        });
      } else if (videoReadyStateRef.current === 'loading') {
        // Video still loading, mark as pending
        console.log('[User Action] Video still loading, pending play');
        pendingPlayRef.current = true;
      }
    } else {
      console.log('[User Action] Pause button clicked');
      video.pause();
    }
  }, [playhead, currentClip, currentClipInfo]);

  // EFFECT 2: Sync timeline playhead with video during playback (using requestAnimationFrame for smoothness)
  useEffect(() => {
    const video = videoRef.current;
    
    console.log('[RAF Loop] Effect triggered:', {
      hasVideo: !!video,
      hasClip: !!currentClip,
      hasClipInfo: !!currentClipInfo,
      isPlaying,
      videoPaused: video?.paused,
      videoReadyState: video?.readyState
    });
    
    if (!video || !currentClip || !currentClipInfo || !isPlaying) {
      // Clean up animation frame if not playing
      if (playbackAnimationFrameRef.current !== null) {
        console.log('[RAF Loop] Cleaning up - conditions not met');
        cancelAnimationFrame(playbackAnimationFrameRef.current);
        playbackAnimationFrameRef.current = null;
      }
      return;
    }

    console.log('[RAF Loop] Starting sync loop for clip:', currentClip.name);

    // Use requestAnimationFrame for smooth 60fps updates instead of setInterval
    const syncPlayhead = () => {
      // Get fresh state from refs to avoid stale closures
      const clipInfo = currentClipInfoRef.current;
      const clip = clipInfo?.clip;
      
      // If video is paused during clip transition, keep the loop alive but skip sync
      // This prevents the playhead from freezing during video load
      if (!video || video.paused || !clipInfo || !clip) {
        // Still schedule next frame to keep loop alive
        playbackAnimationFrameRef.current = requestAnimationFrame(syncPlayhead);
        return;
      }

      const timelineTime = clipInfo.clipStartTime + (video.currentTime - clip.trimStart);
      
      // Check for trim boundaries - prioritize in this order:
      // 1. trimPreview (active drag state)
      // 2. Clip's actual applied trim values
      const trimPreview = useTimelineStore.getState().trimPreview;
      let effectiveTrimStart = clip.trimStart;
      let effectiveTrimEnd = clip.trimEnd > 0 ? clip.trimEnd : clip.duration;
      let checkTrimBoundaries = false;
      let sourceDescription = 'none';
      
      // Always use trim preview if it exists for this clip
      if (trimPreview && trimPreview.clipId === clip.id) {
        effectiveTrimStart = trimPreview.start;
        effectiveTrimEnd = trimPreview.end;
        checkTrimBoundaries = true;
        sourceDescription = 'trimPreview';
      } 
      // Otherwise, check if clip has actual trim values applied (from previous Apply)
      else if (clip.trimStart !== 0 || (clip.trimEnd > 0 && clip.trimEnd !== clip.duration)) {
        checkTrimBoundaries = true;
        sourceDescription = 'clip values';
      }
      
      // Only check boundaries if trim is active (not at default positions)
      const isTrimActive = effectiveTrimStart !== 0 || effectiveTrimEnd !== clip.duration;
      
      // Debug logging every 30 frames (~0.5 seconds)
      if (Math.random() < 0.033) {
        console.log('[Trim Debug]', {
          clipId: clip.id,
          clipName: clip.name,
          currentTime: video.currentTime.toFixed(2),
          effectiveTrimStart: effectiveTrimStart.toFixed(2),
          effectiveTrimEnd: effectiveTrimEnd.toFixed(2),
          clipActualTrimStart: clip.trimStart.toFixed(2),
          clipActualTrimEnd: (clip.trimEnd || clip.duration).toFixed(2),
          clipDuration: clip.duration.toFixed(2),
          isTrimActive,
          checkTrimBoundaries,
          source: sourceDescription,
          hasTrimPreview: !!trimPreview,
          trimPreviewClipId: trimPreview?.clipId,
          isBeforeStart: video.currentTime < effectiveTrimStart,
          isAfterEnd: video.currentTime >= effectiveTrimEnd
        });
      }
      
      if (checkTrimBoundaries && isTrimActive) {
        // Use a small tolerance (0.1s) to catch boundary crossings
        const BOUNDARY_TOLERANCE = 0.1;
        
        // Track previous video time to detect boundary crossings
        const previousTime = previousVideoTimeRef.current;
        const currentTime = video.currentTime;
        
        // Check for boundary crossings while video is actively playing
        // Hybrid approach: No pause at trim start, pause at trim end
        if (!video.paused) {
          // TRIM END: Only pause when crossing INTO trim end from before it
          // This allows playback from after trim end without interference
          const wasBeforeTrimEnd = previousTime < effectiveTrimEnd - BOUNDARY_TOLERANCE;
          const isAtTrimEnd = currentTime >= effectiveTrimEnd - BOUNDARY_TOLERANCE && 
                              currentTime < effectiveTrimEnd + BOUNDARY_TOLERANCE;
          
          if (wasBeforeTrimEnd && isAtTrimEnd) {
            // Video has crossed into trim end while playing - auto-pause (resumable)
            console.log('[Trim Boundary] Crossed into trim end - auto-pausing (resumable):', {
              currentTime,
              previousTime,
              trimEnd: effectiveTrimEnd,
              source: sourceDescription,
              videoHasMoved: Math.abs(currentTime - previousTime) > 0.01
            });
            video.pause();
            video.currentTime = effectiveTrimEnd;
            setIsPlaying(false);
            playbackAnimationFrameRef.current = requestAnimationFrame(syncPlayhead);
            return;
          }
          
          // TRIM START: No auto-pause - videos can play through trim start
          // This allows videos to start playing from trim start position without immediate pause
        }
        
        // Update previous time for next frame
        previousVideoTimeRef.current = currentTime;
      }
      
      // Check if we've reached the end of the current clip
      const clipEndTime = clipInfo.clipStartTime + clipInfo.clipDuration;
      const clipEndVideoTime = clip.trimEnd > 0 ? clip.trimEnd : clip.duration;
      
      if (timelineTime >= clipEndTime || video.currentTime >= clipEndVideoTime) {
        // We've reached the end of the current clip - trigger transition
        console.log('[Clip Boundary] Reached end of clip:', {
          timelineTime,
          clipEndTime,
          videoCurrentTime: video.currentTime,
          clipEndVideoTime
        });
        
        // Check if this is the last clip
        const currentClipIndex = useTimelineStore.getState().clips.findIndex(c => c.id === clip.id);
        const isLastClip = currentClipIndex === useTimelineStore.getState().clips.length - 1;
        
        if (isLastClip) {
          // Last clip - explicitly pause the video element to prevent ghost playback
          console.log('[Clip Boundary] Last clip reached - pausing video element');
          video.pause();
          setIsPlaying(false);
        }
        
        // Call handleEnded via ref to avoid making it a dependency
        if (handleEndedRef.current) {
          handleEndedRef.current();
        }
        
        // DON'T return here - continue the RAF loop!
        // During clip load, the video will be paused, but we want to keep the loop alive
        // so the playhead continues updating once the new clip is ready
        playbackAnimationFrameRef.current = requestAnimationFrame(syncPlayhead);
        return;
      }
      
      // Update timeline playhead to match video
      useTimelineStore.getState().setPlayhead(timelineTime);
      
      // Schedule next frame
      playbackAnimationFrameRef.current = requestAnimationFrame(syncPlayhead);
    };

    // Start the sync loop
    console.log('[RAF Loop] Initial RAF call');
    playbackAnimationFrameRef.current = requestAnimationFrame(syncPlayhead);

    return () => {
      console.log('[RAF Loop] Cleanup called');
      if (playbackAnimationFrameRef.current !== null) {
        cancelAnimationFrame(playbackAnimationFrameRef.current);
        playbackAnimationFrameRef.current = null;
      }
    };
  }, [isPlaying]); // Only depend on isPlaying, not currentClip or currentClipInfo!

  // Helper function for relative seeking
  const seekRelative = useCallback((seconds: number) => {
    const newTime = Math.max(0, Math.min(playhead + seconds, totalDuration));
    useTimelineStore.getState().setPlayhead(newTime);
  }, [playhead, totalDuration]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return; // Don't handle shortcuts when typing in inputs
      }

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          if (event.shiftKey) {
            // Shift + Left Arrow: Move back by 1 second (fine control)
            seekRelative(-1);
          } else {
            // Left Arrow: Move back 5 seconds
            seekRelative(-5);
          }
          break;
        case 'ArrowRight':
          event.preventDefault();
          if (event.shiftKey) {
            // Shift + Right Arrow: Move forward by 1 second (fine control)
            seekRelative(1);
          } else {
            // Right Arrow: Move forward 5 seconds
            seekRelative(5);
          }
          break;
        case 'Home':
          event.preventDefault();
          useTimelineStore.getState().setPlayhead(0);
          break;
        case 'End':
          event.preventDefault();
          const totalDuration = useTimelineStore.getState().totalDuration;
          useTimelineStore.getState().setPlayhead(totalDuration);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [togglePlayPause, seekRelative]);

  const handleProgressClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!currentClip) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    
    // Calculate the new global timeline position
    const newTimelineTime = percentage * totalDuration;
    useTimelineStore.getState().setPlayhead(newTimelineTime);
  }, [currentClip, totalDuration]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  if (!currentClip) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-lg font-medium">No Video</p>
          <p className="text-sm">Import videos to preview</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center max-w-md px-4">
          <svg className="w-16 h-16 mx-auto mb-4 text-red-400 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-lg font-medium text-red-400">Video Load Error</p>
          <p className="text-sm mt-2">{errorMessage}</p>
          {currentClip && (
            <p className="text-xs mt-3 text-gray-500 truncate">{currentClip.path}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Video player */}
      <div className="flex-1 video-preview flex items-center justify-center bg-black">
        <video
          ref={videoRef}
          className="max-w-full max-h-full object-contain"
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onError={handleError}
          onCanPlay={handleCanPlay}
          preload="auto"
          playsInline
          style={{ minHeight: '200px', minWidth: '300px' }}
        />
      </div>

      {/* Controls - Memoized to prevent re-render when video changes */}
      <VideoControls
        isPlaying={isPlaying}
        playhead={playhead}
        totalDuration={totalDuration}
        currentClipName={currentClipName}
        onTogglePlayPause={togglePlayPause}
        onProgressClick={handleProgressClick}
        formatTime={formatTime}
      />
    </div>
  );
};

// Separate Controls component to prevent re-renders when video state changes
const VideoControls = React.memo<{
  isPlaying: boolean;
  playhead: number;
  totalDuration: number;
  currentClipName: string;
  onTogglePlayPause: () => void;
  onProgressClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  formatTime: (seconds: number) => string;
}>(({ isPlaying, playhead, totalDuration, currentClipName, onTogglePlayPause, onProgressClick, formatTime }) => {
  return (
    <div className="bg-gray-800 border-t border-gray-700 p-2" style={{ minHeight: '56px' }}>
      <div className="flex items-center gap-4">
        {/* Play/Pause button - Fixed width */}
        <button
          onClick={onTogglePlayPause}
          className="text-white hover:text-gray-300 transition-colors flex-shrink-0"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        {/* Time display - Fixed width with monospace numbers */}
        <div className="flex items-center gap-2 text-sm text-gray-400 flex-shrink-0 w-24">
          <span className="tabular-nums">{formatTime(playhead)}</span>
          <span>/</span>
          <span className="tabular-nums">{formatTime(totalDuration)}</span>
        </div>

        {/* Progress bar - Takes remaining space */}
        <div 
          className="flex-1 bg-gray-600 rounded-full h-2 cursor-pointer relative min-w-0"
          onClick={onProgressClick}
        >
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-100"
            style={{ width: `${totalDuration > 0 ? (playhead / totalDuration) * 100 : 0}%` }}
          />
        </div>

        {/* Clip info - Fixed width at the end */}
        <div className="text-sm text-gray-400 flex-shrink-0 w-48 truncate text-right">
          {currentClipName}
        </div>
      </div>
    </div>
  );
});

export default VideoPreview;
