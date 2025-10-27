import React, { useRef, useEffect } from 'react';
import { useTimelineStore } from '../store/timelineStore';

const Timeline: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { clips, playhead, totalDuration, zoom, setPlayhead } = useTimelineStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw timeline grid
    drawTimelineGrid(ctx, rect.width, rect.height);

    // Draw clips
    drawClips(ctx, rect.width, rect.height);

    // Draw playhead
    drawPlayhead(ctx, rect.width, rect.height);
  }, [clips, playhead, totalDuration, zoom]);

  const drawTimelineGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    // Time markers every 5 seconds
    const timeInterval = 5;
    const pixelsPerSecond = (width * zoom) / Math.max(totalDuration, 60); // At least 60 seconds visible

    for (let time = 0; time <= totalDuration; time += timeInterval) {
      const x = (time / totalDuration) * width * zoom;
      if (x > width) break;

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Time label
      ctx.fillStyle = '#666';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(formatTime(time), x + 4, 20);
    }
  };

  const drawClips = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (clips.length === 0) return;

    const clipHeight = 60;
    const clipY = (height - clipHeight) / 2;
    const pixelsPerSecond = (width * zoom) / Math.max(totalDuration, 60);

    let currentTime = 0;

    clips.forEach((clip, index) => {
      const clipDuration = clip.trimEnd > 0 ? clip.trimEnd - clip.trimStart : clip.duration - clip.trimStart;
      const clipWidth = clipDuration * pixelsPerSecond;

      // Clip background
      ctx.fillStyle = index % 2 === 0 ? '#3b82f6' : '#8b5cf6';
      ctx.fillRect(currentTime * pixelsPerSecond, clipY, clipWidth, clipHeight);

      // Clip border
      ctx.strokeStyle = '#1e40af';
      ctx.lineWidth = 2;
      ctx.strokeRect(currentTime * pixelsPerSecond, clipY, clipWidth, clipHeight);

      // Clip name
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(clip.name, currentTime * pixelsPerSecond + 8, clipY + 20);

      // Duration
      ctx.fillStyle = '#e5e7eb';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(formatTime(clipDuration), currentTime * pixelsPerSecond + 8, clipY + 40);

      currentTime += clipDuration;
    });
  };

  const drawPlayhead = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const pixelsPerSecond = (width * zoom) / Math.max(totalDuration, 60);
    const x = (playhead / totalDuration) * width * zoom;

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    // Playhead triangle
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(x - 6, 0);
    ctx.lineTo(x + 6, 0);
    ctx.lineTo(x, 12);
    ctx.closePath();
    ctx.fill();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const pixelsPerSecond = (rect.width * zoom) / Math.max(totalDuration, 60);
    const clickedTime = (x / (rect.width * zoom)) * totalDuration;

    setPlayhead(Math.max(0, clickedTime));
  };

  if (clips.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-lg font-medium">Timeline Empty</p>
          <p className="text-sm">Import videos to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Timeline controls */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-400">
            Duration: {formatTime(totalDuration)}
          </span>
          <span className="text-sm text-gray-400">
            Clips: {clips.length}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => useTimelineStore.getState().setZoom(zoom * 0.8)}
            className="text-gray-400 hover:text-white px-2 py-1 rounded"
            title="Zoom out"
          >
            −
          </button>
          <span className="text-sm text-gray-400 min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => useTimelineStore.getState().setZoom(zoom * 1.25)}
            className="text-gray-400 hover:text-white px-2 py-1 rounded"
            title="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {/* Timeline canvas */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-pointer"
          onClick={handleCanvasClick}
        />
      </div>
    </div>
  );
};

export default Timeline;
