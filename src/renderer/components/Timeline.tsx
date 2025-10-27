import React, { useRef, useEffect, useState } from 'react';
import { fabric } from 'fabric';
import { useTimelineStore } from '../store/timelineStore';
import { Clip } from '@shared/types';

const Timeline: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const { clips, playhead, totalDuration, zoom, setPlayhead, setSelectedClip } = useTimelineStore();
  const [isInitialized, setIsInitialized] = useState(false);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const initializeCanvas = () => {
    if (!canvasRef.current || fabricCanvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: canvasRef.current.offsetWidth,
      height: canvasRef.current.offsetHeight,
      backgroundColor: '#1a1a1a',
      selection: false,
    });

    fabricCanvasRef.current = canvas;
    setIsInitialized(true);

    // Handle canvas clicks
    canvas.on('mouse:down', (event) => {
      if (event.target) {
        // Clicked on a clip
        if (event.target.clipId) {
          setSelectedClip(event.target.clipId);
        }
      } else {
        // Clicked on empty space - move playhead
        const pointer = canvas.getPointer(event.e);
        const clickedTime = (pointer.x / canvas.width!) * totalDuration;
        setPlayhead(Math.max(0, Math.min(clickedTime, totalDuration)));
        console.log('Playhead moved to:', formatTime(clickedTime), 'at x:', pointer.x);
      }
    });

    // Handle drag and drop
    canvas.on('drop', (event) => {
      const data = event.e.dataTransfer?.getData('application/json');
      if (data) {
        try {
          const clip: Clip = JSON.parse(data);
          const pointer = canvas.getPointer(event.e);
          const dropTime = (pointer.x / (canvas.width! * zoom)) * totalDuration;
          
          // Add clip to timeline at drop position
          addClipToTimeline(clip, dropTime);
        } catch (error) {
          console.error('Failed to parse dropped clip:', error);
        }
      }
    });

    canvas.on('dragover', (event) => {
      event.e.preventDefault();
    });
  };

  const addClipToTimeline = (clip: Clip, startTime: number) => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    const pixelsPerSecond = (canvas.width! * zoom) / Math.max(totalDuration, 60);
    const clipDuration = clip.trimEnd > 0 ? clip.trimEnd - clip.trimStart : clip.duration - clip.trimStart;
    const clipWidth = clipDuration * pixelsPerSecond;
    const clipHeight = 60;
    const clipY = (canvas.height! - clipHeight) / 2;

    // Create clip rectangle
    const clipRect = new fabric.Rect({
      left: startTime * pixelsPerSecond,
      top: clipY,
      width: clipWidth,
      height: clipHeight,
      fill: '#3b82f6',
      stroke: '#1e40af',
      strokeWidth: 2,
      selectable: true,
      clipId: clip.id,
    });

    // Add clip name text
    const clipText = new fabric.Text(clip.name, {
      left: startTime * pixelsPerSecond + 8,
      top: clipY + 10,
      fontSize: 14,
      fill: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      selectable: false,
    });

    // Add duration text
    const durationText = new fabric.Text(formatTime(clipDuration), {
      left: startTime * pixelsPerSecond + 8,
      top: clipY + 30,
      fontSize: 12,
      fill: '#e5e7eb',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      selectable: false,
    });

    // Group clip elements
    const clipGroup = new fabric.Group([clipRect, clipText, durationText], {
      left: startTime * pixelsPerSecond,
      top: clipY,
      selectable: true,
      clipId: clip.id,
    });

    canvas.add(clipGroup);
    canvas.renderAll();
  };

  const drawTimelineGrid = () => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    const pixelsPerSecond = (canvas.width! * zoom) / Math.max(totalDuration, 60);

    // Clear existing grid
    const existingGrid = canvas.getObjects().filter(obj => obj.gridLine);
    existingGrid.forEach(obj => canvas.remove(obj));

    // If no clips, show empty timeline message
    if (clips.length === 0) {
      const emptyText = new fabric.Text('Timeline Empty\nDrag videos here to start editing', {
        left: canvas.width! / 2,
        top: canvas.height! / 2,
        fontSize: 16,
        fill: '#666',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        textAlign: 'center',
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        gridLine: true,
      });
      canvas.add(emptyText);
      return;
    }

    // Calculate appropriate time interval based on zoom
    let timeInterval = 5;
    const minSpacing = 80; // Minimum pixels between markers
    const currentSpacing = timeInterval * pixelsPerSecond;
    
    if (currentSpacing < minSpacing) {
      // If markers are too close, increase interval
      timeInterval = Math.ceil(minSpacing / pixelsPerSecond / 5) * 5;
    }

    // Draw time markers
    for (let time = 0; time <= totalDuration; time += timeInterval) {
      const x = (time / totalDuration) * canvas.width! * zoom;
      if (x > canvas.width!) break;

      // Vertical line
      const line = new fabric.Line([x, 0, x, canvas.height!], {
        stroke: '#333',
        strokeWidth: 1,
        selectable: false,
        evented: false,
        gridLine: true,
      });

      // Time label
      const timeText = new fabric.Text(formatTime(time), {
        left: x + 4,
        top: 10,
        fontSize: 12,
        fill: '#666',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        selectable: false,
        evented: false,
        gridLine: true,
      });

      canvas.add(line);
      canvas.add(timeText);
    }
  };

  const drawPlayhead = () => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    
    // Calculate x position based on playhead time
    const x = totalDuration > 0 ? (playhead / totalDuration) * canvas.width! : 0;

    // Remove existing playhead
    const existingPlayhead = canvas.getObjects().filter(obj => obj.playhead);
    existingPlayhead.forEach(obj => canvas.remove(obj));

    // Draw playhead line
    const playheadLine = new fabric.Line([x, 0, x, canvas.height!], {
      stroke: '#ef4444',
      strokeWidth: 2,
      selectable: false,
      evented: false,
      playhead: true,
    });

    // Draw playhead triangle
    const triangle = new fabric.Triangle({
      left: x - 6,
      top: 0,
      width: 12,
      height: 12,
      fill: '#ef4444',
      selectable: false,
      evented: false,
      playhead: true,
    });

    canvas.add(playheadLine);
    canvas.add(triangle);
    canvas.renderAll();
  };

  const renderClips = () => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    
    // Remove existing clips (but keep grid and playhead)
    const existingClips = canvas.getObjects().filter(obj => obj.clipId);
    existingClips.forEach(obj => canvas.remove(obj));

    // Add clips to timeline
    let currentTime = 0;
    clips.forEach((clip) => {
      addClipToTimeline(clip, currentTime);
      const clipDuration = clip.trimEnd > 0 ? clip.trimEnd - clip.trimStart : clip.duration - clip.trimStart;
      currentTime += clipDuration;
    });
  };

  useEffect(() => {
    initializeCanvas();
  }, []);

  useEffect(() => {
    if (!isInitialized || !fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    
    // Update canvas size
    const rect = canvasRef.current!.getBoundingClientRect();
    canvas.setDimensions({
      width: rect.width,
      height: rect.height,
    });

    // Redraw everything
    drawTimelineGrid();
    renderClips();
    drawPlayhead();
    
    console.log('Timeline updated:', { clips: clips.length, totalDuration, zoom });
  }, [clips, playhead, totalDuration, zoom, isInitialized]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (fabricCanvasRef.current && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        fabricCanvasRef.current.setDimensions({
          width: rect.width,
          height: rect.height,
        });
        fabricCanvasRef.current.renderAll();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Always show the timeline, even when empty
  // The empty state will be handled by the canvas content

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
        />
      </div>
    </div>
  );
};

export default Timeline;