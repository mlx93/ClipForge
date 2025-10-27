import React, { useRef, useLayoutEffect } from 'react';
import { fabric } from 'fabric';
import { useTimelineStore } from '../store/timelineStore';

const Timeline: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  
  // Subscribe to Zustand store - this is the React way
  const clips = useTimelineStore(state => state.clips);
  const playhead = useTimelineStore(state => state.playhead);
  const totalDuration = useTimelineStore(state => state.totalDuration);
  const zoom = useTimelineStore(state => state.zoom);
  const setPlayhead = useTimelineStore(state => state.setPlayhead);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Use layoutEffect for DOM measurements and canvas operations
  // Force re-render when playhead changes by including it in dependencies
  useLayoutEffect(() => {
    // Add resize observer to handle container size changes
    if (!canvasRef.current) return;
    
    const resizeObserver = new ResizeObserver(() => {
      if (fabricCanvasRef.current && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        fabricCanvasRef.current.setDimensions({
          width: rect.width,
          height: rect.height,
        });
        fabricCanvasRef.current.renderAll();
      }
    });
    
    resizeObserver.observe(canvasRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    if (!canvasRef.current) return;

    // Initialize or get existing canvas
    if (!fabricCanvasRef.current) {
      const canvas = new fabric.Canvas(canvasRef.current, {
        backgroundColor: '#1a1a1a',
        selection: false,
      });

      // Handle clicks - update Zustand state directly
      canvas.on('mouse:down', (event) => {
        console.log('Canvas clicked!', { target: event.target, pointer: canvas.getPointer(event.e) });
        if (!event.target) {
          const pointer = canvas.getPointer(event.e);
          // Get current totalDuration from store at click time
          const currentTotalDuration = useTimelineStore.getState().totalDuration;
          const clickedTime = (pointer.x / canvas.width!) * currentTotalDuration;
          const newTime = Math.max(0, Math.min(clickedTime, currentTotalDuration));
          console.log('Timeline clicked at x:', pointer.x, 'time:', formatTime(newTime), 'totalDuration:', currentTotalDuration);
          setPlayhead(newTime);
        } else {
          console.log('Clicked on object:', event.target);
        }
      });

      fabricCanvasRef.current = canvas;
    }

    const canvas = fabricCanvasRef.current;
    const rect = canvasRef.current.getBoundingClientRect();
    
    // Force canvas to use full width and height
    const newWidth = rect.width;
    const newHeight = rect.height;
    
    console.log('Setting canvas dimensions:', { 
      newWidth, 
      newHeight, 
      rectWidth: rect.width, 
      rectHeight: rect.height,
      containerWidth: canvasRef.current.parentElement?.offsetWidth,
      windowWidth: window.innerWidth
    });
    
    // Force canvas to use full available width
    let finalWidth = newWidth;
    if (newWidth < 800) {
      console.warn('Canvas width too small, forcing full width');
      // Get the actual available width by going up the DOM tree
      const mainContainer = canvasRef.current.closest('.flex-1');
      const availableWidth = mainContainer?.offsetWidth || window.innerWidth - 300; // Account for sidebar
      console.log('Forcing width to:', availableWidth, 'from container:', mainContainer);
      finalWidth = availableWidth;
    }
    
    canvas.setDimensions({
      width: finalWidth,
      height: newHeight,
    });
    
    // Ensure canvas fills the container
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

    // Clear and redraw - Zustand state drives the render
    canvas.clear();
    canvas.backgroundColor = '#1a1a1a';

      // Draw time grid
      if (clips.length > 0 && totalDuration > 0) {
        let timeInterval = 5;
        const minSpacing = 80;
        const pixelsPerSecond = canvas.width! / totalDuration;
        
        if (timeInterval * pixelsPerSecond < minSpacing) {
          timeInterval = Math.ceil(minSpacing / pixelsPerSecond / 5) * 5;
        }

        console.log('Drawing timeline:', { canvasWidth: canvas.width, totalDuration, pixelsPerSecond });

        for (let time = 0; time <= totalDuration; time += timeInterval) {
          const x = (time / totalDuration) * canvas.width!;
          if (x > canvas.width!) break;

        canvas.add(new fabric.Line([x, 0, x, canvas.height!], {
          stroke: '#333',
          strokeWidth: 1,
          selectable: false,
          evented: false,
        } as any));

        canvas.add(new fabric.Text(formatTime(time), {
          left: x + 4,
          top: 10,
          fontSize: 12,
          fill: '#666',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          selectable: false,
          evented: false,
        } as any));
      }

      // Draw clips
      let currentTime = 0;
      const clipHeight = 60;
      const clipY = (canvas.height! - clipHeight) / 2;

      clips.forEach((clip) => {
        const clipDuration = clip.trimEnd > 0 ? clip.trimEnd - clip.trimStart : clip.duration - clip.trimStart;
        const clipWidth = (clipDuration / totalDuration) * canvas.width!;
        const clipX = (currentTime / totalDuration) * canvas.width!;

        canvas.add(new fabric.Rect({
          left: clipX,
          top: clipY,
          width: clipWidth,
          height: clipHeight,
          fill: '#3b82f6',
          stroke: '#1e40af',
          strokeWidth: 2,
          selectable: false,
          evented: false,
        } as any));

        canvas.add(new fabric.Text(clip.name, {
          left: clipX + 8,
          top: clipY + 10,
          fontSize: 14,
          fill: '#ffffff',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          selectable: false,
          evented: false,
        } as any));

        canvas.add(new fabric.Text(formatTime(clipDuration), {
          left: clipX + 8,
          top: clipY + 30,
          fontSize: 12,
          fill: '#e5e7eb',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          selectable: false,
          evented: false,
        } as any));

        currentTime += clipDuration;
      });

      // Draw playhead
      if (totalDuration > 0) {
        const x = (playhead / totalDuration) * canvas.width!;

        canvas.add(new fabric.Line([x, 0, x, canvas.height!], {
          stroke: '#ef4444',
          strokeWidth: 2,
          selectable: false,
          evented: false,
        } as any));

        canvas.add(new fabric.Triangle({
          left: x - 6,
          top: 0,
          width: 12,
          height: 12,
          fill: '#ef4444',
          selectable: false,
          evented: false,
        } as any));
      }
    } else {
      // Empty state
      canvas.add(new fabric.Text('Timeline Empty\nDrag videos here to start editing', {
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
      } as any));
    }

    canvas.renderAll();
    
    console.log('Canvas rendered - Playhead:', formatTime(playhead), 'Clips:', clips.length);
  }, [playhead, clips, totalDuration, zoom]); // Re-run when these Zustand values change

  return (
    <div className="h-full flex flex-col w-full">
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between w-full">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-400">
            Duration: {formatTime(totalDuration)}
          </span>
          <span className="text-sm text-gray-400">
            Clips: {clips.length}
          </span>
          <span className="text-sm text-gray-400">
            Playhead: {formatTime(playhead)}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => useTimelineStore.getState().setZoom(zoom * 0.8)}
            className="text-gray-400 hover:text-white px-2 py-1 rounded"
          >
            −
          </button>
          <span className="text-sm text-gray-400 min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => useTimelineStore.getState().setZoom(zoom * 1.25)}
            className="text-gray-400 hover:text-white px-2 py-1 rounded"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden w-full">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full cursor-pointer" 
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
};

export default Timeline;