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
  
  // Only subscribe to the state we actually need
  const { clips, playhead, totalDuration } = useTimelineStore();
  
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');

  // DERIVED STATE: Calculate during render, not in useEffect
  // This is pure computation from props/state - no need for useEffect
  const currentClipInfo = useMemo((): ClipInfo | null => {
    if (clips.length === 0) return null;
    
    let currentTime = 0;
    for (const clip of clips) {
      const clipDuration = clip.trimEnd > 0 ? clip.trimEnd - clip.trimStart : clip.duration - clip.trimStart;
      if (playhead >= currentTime && playhead < currentTime + clipDuration) {
        return {
          clip,
          clipStartTime: currentTime,
          clipDuration
        };
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
      return {
        clip: lastClip,
        clipStartTime: totalTime,
        clipDuration: lastClip.trimEnd > 0 ? lastClip.trimEnd - lastClip.trimStart : lastClip.duration - lastClip.trimStart
      };
    }
    
    return null;
  }, [clips, playhead]); // Memoize to avoid recalculation on every render

  const currentClip = currentClipInfo?.clip || null;

  // EFFECT 1: Manage video source loading and clip transitions
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentClip) return;

    // Reset error state when loading new video
    setHasError(false);
    setErrorMessage('');
    videoReadyStateRef.current = 'loading';
    
    // Only update source if it's different
    const newSrc = `file://${currentClip.path}`;
    if (video.src !== newSrc) {
      console.log('[Video Source] Loading new clip:', currentClip.name);
      video.src = newSrc;
      video.load();
    } else {
      // Same clip, already loaded
      videoReadyStateRef.current = 'canplay';
    }
  }, [currentClip]);

  // EFFECT 2: Sync video currentTime with timeline playhead (when paused or seeking)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentClip || !currentClipInfo) return;

    const timeInClip = playhead - currentClipInfo.clipStartTime;
    const videoTime = currentClip.trimStart + timeInClip;
    
    // Only seek if:
    // 1. Video is paused (user is scrubbing timeline)
    // 2. OR difference is significant (avoid micro-adjustments during playback)
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

  const handleError = useCallback(() => {
    console.error('[Video Error] Failed to load:', currentClip?.path);
    videoReadyStateRef.current = 'error';
    setHasError(true);
    setErrorMessage('Unable to load video. File may be corrupted or unsupported format.');
    setIsPlaying(false);
  }, [currentClip]);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      console.log('[User Action] Play button clicked');
      
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
  }, []);

  // EFFECT 1: Manage video source loading and clip transitions
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentClip) return;

    // Reset error state when loading new video
    setHasError(false);
    setErrorMessage('');
    videoReadyStateRef.current = 'loading';
    
    // Only update source if it's different
    const newSrc = `file://${currentClip.path}`;
    if (video.src !== newSrc) {
      console.log('[Video Source] Loading new clip:', currentClip.name);
      video.src = newSrc;
      video.load();
    } else {
      // Same clip, already loaded
      videoReadyStateRef.current = 'canplay';
    }
  }, [currentClip]);

  // EFFECT 2: Sync video currentTime with timeline playhead (when paused or seeking)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentClip || !currentClipInfo) return;

    const timeInClip = playhead - currentClipInfo.clipStartTime;
    const videoTime = currentClip.trimStart + timeInClip;
    
    // Only seek if:
    // 1. Video is paused (user is scrubbing timeline)
    // 2. OR difference is significant (avoid micro-adjustments during playback)
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

  // EFFECT 3: Sync timeline playhead with video during playback (using requestAnimationFrame for smoothness)
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
      if (!video || video.paused) {
        console.log('[RAF Loop] Sync skipped - video paused or not available');
        // Don't stop the loop, just skip this frame
        playbackAnimationFrameRef.current = requestAnimationFrame(syncPlayhead);
        return;
      }

      const timelineTime = currentClipInfo.clipStartTime + (video.currentTime - currentClip.trimStart);
      
      // Check if we've reached the end of the current clip
      const clipEndTime = currentClipInfo.clipStartTime + currentClipInfo.clipDuration;
      const clipEndVideoTime = currentClip.trimEnd > 0 ? currentClip.trimEnd : currentClip.duration;
      
      if (timelineTime >= clipEndTime || video.currentTime >= clipEndVideoTime) {
        // We've reached the end of the current clip - trigger transition
        console.log('[Clip Boundary] Reached end of clip:', {
          timelineTime,
          clipEndTime,
          videoCurrentTime: video.currentTime,
          clipEndVideoTime
        });
        
        // Manually trigger the ended handler logic
        handleEnded();
        return; // Stop the sync loop, handleEnded will restart if needed
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
  }, [isPlaying, currentClip, currentClipInfo, handleEnded]);

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
          seekRelative(-5); // Seek back 5 seconds
          break;
        case 'ArrowRight':
          event.preventDefault();
          seekRelative(5); // Seek forward 5 seconds
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
  }, [togglePlayPause]);

  const seekRelative = useCallback((seconds: number) => {
    const newTime = Math.max(0, Math.min(playhead + seconds, totalDuration));
    useTimelineStore.getState().setPlayhead(newTime);
  }, [playhead, totalDuration]);

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
        currentClipName={currentClip?.name || ''}
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
    <div className="bg-gray-800 border-t border-gray-700 p-4">
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
