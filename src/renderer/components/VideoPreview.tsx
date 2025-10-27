import React, { useRef, useEffect } from 'react';
import { useTimelineStore } from '../store/timelineStore';

const VideoPreview: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { clips, playhead, selectedClipId } = useTimelineStore();
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);

  // Get the current clip based on playhead position
  const getCurrentClip = () => {
    if (clips.length === 0) return null;
    
    let currentTime = 0;
    for (const clip of clips) {
      const clipDuration = clip.trimEnd > 0 ? clip.trimEnd - clip.trimStart : clip.duration - clip.trimStart;
      if (playhead >= currentTime && playhead <= currentTime + clipDuration) {
        return clip;
      }
      currentTime += clipDuration;
    }
    
    return clips[0]; // Fallback to first clip
  };

  const currentClip = getCurrentClip();

  // Update video source when clip changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentClip) return;

    video.src = `file://${currentClip.path}`;
    video.load();
  }, [currentClip]);

  // Sync video time with timeline playhead
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentClip) return;

    // Calculate the time within the current clip
    let clipStartTime = 0;
    for (const clip of clips) {
      if (clip.id === currentClip.id) break;
      const clipDuration = clip.trimEnd > 0 ? clip.trimEnd - clip.trimStart : clip.duration - clip.trimStart;
      clipStartTime += clipDuration;
    }

    const timeInClip = playhead - clipStartTime;
    const videoTime = currentClip.trimStart + timeInClip;
    
    if (Math.abs(video.currentTime - videoTime) > 0.1) {
      video.currentTime = videoTime;
    }
  }, [playhead, currentClip, clips]);

  // Handle video events
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
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

  return (
    <div className="h-full flex flex-col">
      {/* Video player */}
      <div className="flex-1 video-preview flex items-center justify-center">
        <video
          ref={videoRef}
          className="max-w-full max-h-full"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
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

          {/* Time display */}
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Progress bar */}
          <div className="flex-1 bg-gray-600 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-100"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>

          {/* Clip info */}
          <div className="text-sm text-gray-400">
            {currentClip.name}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPreview;
