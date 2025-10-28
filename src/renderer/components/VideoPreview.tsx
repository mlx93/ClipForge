import React, { useRef, useEffect } from 'react';
import { useTimelineStore } from '../store/timelineStore';

const VideoPreview: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { clips, playhead, selectedClipId, totalDuration } = useTimelineStore();
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');

  // Get the current clip based on playhead position and its start time
  const getCurrentClipInfo = () => {
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
  };

  const currentClipInfo = getCurrentClipInfo();
  const currentClip = currentClipInfo?.clip || null;

  // Update video source when clip changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentClip) return;

    // Reset error state when loading new video
    setHasError(false);
    setErrorMessage('');
    
    video.src = `file://${currentClip.path}`;
    video.load();
  }, [currentClip]);

  // Sync video time with timeline playhead
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentClip || !currentClipInfo) return;

    const timeInClip = playhead - currentClipInfo.clipStartTime;
    const videoTime = currentClip.trimStart + timeInClip;
    
    console.log('Syncing video to timeline:', {
      playhead,
      clipStartTime: currentClipInfo.clipStartTime,
      timeInClip,
      videoTime,
      currentVideoTime: video.currentTime,
      difference: Math.abs(video.currentTime - videoTime)
    });
    
    // Only seek if the difference is significant to avoid constant seeking
    // Also check if video is not currently playing to avoid conflicts
    if (Math.abs(video.currentTime - videoTime) > 0.05 && video.paused) {
      video.currentTime = videoTime;
    }
  }, [playhead, currentClip, currentClipInfo]);

  // Sync timeline playhead when video is playing
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentClip || !currentClipInfo || !isPlaying) return;

    const interval = setInterval(() => {
      if (video.paused) return;

      const timelineTime = currentClipInfo.clipStartTime + (video.currentTime - currentClip.trimStart);
      
      console.log('Syncing timeline to video:', {
        videoCurrentTime: video.currentTime,
        clipStartTime: currentClipInfo.clipStartTime,
        timelineTime,
        currentPlayhead: playhead
      });
      
      // Only update if the difference is significant to avoid constant updates
      if (Math.abs(timelineTime - playhead) > 0.1) {
        useTimelineStore.getState().setPlayhead(timelineTime);
      }
    }, 100); // Update every 100ms for smooth playback

    return () => clearInterval(interval);
  }, [isPlaying, currentClip, currentClipInfo, playhead]);

  // Handle video events
  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleEnded = () => {
    // When current clip ends, move to next clip if available
    if (!currentClipInfo) return;
    
    const currentClipIndex = clips.findIndex(c => c.id === currentClip?.id);
    if (currentClipIndex < clips.length - 1) {
      // Move playhead to start of next clip
      const nextClipStartTime = currentClipInfo.clipStartTime + currentClipInfo.clipDuration;
      useTimelineStore.getState().setPlayhead(nextClipStartTime + 0.01); // Small offset to trigger new clip
      
      // Resume playing
      setTimeout(() => {
        const video = videoRef.current;
        if (video) {
          video.play();
        }
      }, 50);
    } else {
      // End of timeline - pause
      setIsPlaying(false);
      useTimelineStore.getState().setPlayhead(totalDuration);
    }
  };

  const handleError = () => {
    setHasError(true);
    setErrorMessage('Unable to load video. File may be corrupted or unsupported format.');
    console.error('Video load error:', currentClip?.path);
  };

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

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
  }, []);

  const seekRelative = (seconds: number) => {
    const newTime = Math.max(0, Math.min(playhead + seconds, useTimelineStore.getState().totalDuration));
    useTimelineStore.getState().setPlayhead(newTime);
  };

  const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!currentClip) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    
    // Calculate the new global timeline position
    const newTimelineTime = percentage * totalDuration;
    useTimelineStore.getState().setPlayhead(newTimelineTime);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
      <div className="flex-1 video-preview flex items-center justify-center">
        <video
          ref={videoRef}
          className="max-w-full max-h-full"
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onError={handleError}
          preload="metadata"
        />
      </div>

      {/* Controls */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="flex items-center space-x-4">
          {/* Play/Pause button */}
          <button
            onClick={togglePlayPause}
            className="text-white hover:text-gray-300 transition-colors"
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

          {/* Time display - Shows global timeline position */}
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <span>{formatTime(playhead)}</span>
            <span>/</span>
            <span>{formatTime(totalDuration)}</span>
          </div>

          {/* Progress bar - Represents entire timeline */}
          <div 
            className="flex-1 bg-gray-600 rounded-full h-2 cursor-pointer relative"
            onClick={handleProgressClick}
          >
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-100"
              style={{ width: `${totalDuration > 0 ? (playhead / totalDuration) * 100 : 0}%` }}
            />
          </div>

          {/* Clip info */}
          <div className="text-sm text-gray-400 min-w-0 flex-shrink-0 w-48 truncate">
            {currentClip.name}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPreview;
