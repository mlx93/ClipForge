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
  const selectedClipId = useTimelineStore(state => state.selectedClipId);
  const setPlayhead = useTimelineStore(state => state.setPlayhead);
  const setSelectedClip = useTimelineStore(state => state.setSelectedClip);
  
  // Local state for trim preview (before applying)
  const [tempTrimStart, setTempTrimStart] = React.useState<number | null>(null);
  const [tempTrimEnd, setTempTrimEnd] = React.useState<number | null>(null);
  const [isTrimming, setIsTrimming] = React.useState(false);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Split clip at current playhead
  const splitClipAtPlayhead = () => {
    if (!selectedClipId) return;

    const clip = clips.find(c => c.id === selectedClipId);
    if (!clip) return;

    // Calculate current clip position on timeline
    let clipStartTime = 0;
    for (const c of clips) {
      if (c.id === clip.id) break;
      const clipDuration = c.trimEnd > 0 ? c.trimEnd - c.trimStart : c.duration - c.trimStart;
      clipStartTime += clipDuration;
    }

    const clipEndTime = clipStartTime + (clip.trimEnd > 0 ? clip.trimEnd - clip.trimStart : clip.duration - clip.trimStart);
    
    // Check if playhead is within this clip
    if (playhead >= clipStartTime && playhead <= clipEndTime) {
      const splitTime = playhead - clipStartTime;
      useTimelineStore.getState().splitClip(clip.id, splitTime);
    }
  };

  // Apply or cancel trim
  const applyTrim = () => {
    if (!selectedClipId || tempTrimStart === null || tempTrimEnd === null) return;
    
    useTimelineStore.getState().updateClip(selectedClipId, {
      trimStart: tempTrimStart,
      trimEnd: tempTrimEnd
    });
    
    setTempTrimStart(null);
    setTempTrimEnd(null);
    setIsTrimming(false);
    console.log('Applied trim:', { trimStart: tempTrimStart, trimEnd: tempTrimEnd });
  };

  const cancelTrim = () => {
    setTempTrimStart(null);
    setTempTrimEnd(null);
    setIsTrimming(false);
    console.log('Cancelled trim');
  };

  // Move selected clip left or right
  const moveClipLeft = () => {
    if (!selectedClipId) return;
    const currentIndex = clips.findIndex(c => c.id === selectedClipId);
    if (currentIndex > 0) {
      useTimelineStore.getState().reorderClips(currentIndex, currentIndex - 1);
    }
  };

  const moveClipRight = () => {
    if (!selectedClipId) return;
    const currentIndex = clips.findIndex(c => c.id === selectedClipId);
    if (currentIndex < clips.length - 1) {
      useTimelineStore.getState().reorderClips(currentIndex, currentIndex + 1);
    }
  };

  // Keyboard shortcuts for clip reordering
  React.useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (event.key === 's' && selectedClipId) {
        event.preventDefault();
        splitClipAtPlayhead();
      } else if (event.key === '[' && selectedClipId) {
        event.preventDefault();
        moveClipLeft();
      } else if (event.key === ']' && selectedClipId) {
        event.preventDefault();
        moveClipRight();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedClipId, playhead, clips]);

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

      // Handle clicks and object interactions
      canvas.on('mouse:down', (event) => {
        console.log('Canvas clicked!', { target: event.target, pointer: canvas.getPointer(event.e) });
        if (!event.target) {
          const pointer = canvas.getPointer(event.e);
          const currentTotalDuration = useTimelineStore.getState().totalDuration;
          const clickedTime = (pointer.x / canvas.width!) * currentTotalDuration;
          const newTime = Math.max(0, Math.min(clickedTime, currentTotalDuration));
          console.log('Timeline clicked at x:', pointer.x, 'time:', formatTime(newTime), 'totalDuration:', currentTotalDuration);
          setPlayhead(newTime);
          // Don't deselect clip when clicking empty space - keep selection
        } else {
          console.log('Clicked on object:', event.target);
          const target = event.target as any;
          if (target.clipId && !target.isTrimHandle) {
            setSelectedClip(target.clipId);
          }
        }
      });

      // Handle trim handle dragging
      canvas.on('object:moving', (event) => {
        const target = event.target as any;
        if (!target || !target.isTrimHandle) return;
        
        const clip = clips.find(c => c.id === target.clipId);
        if (!clip) return;

        // Select the clip being trimmed and show trim UI
        setSelectedClip(target.clipId);
        setIsTrimming(true);

        const currentTotalDuration = useTimelineStore.getState().totalDuration;
        const newX = target.left + target.width / 2; // Center of handle
        const newTime = (newX / canvas.width!) * currentTotalDuration;

        // Find clip's start time on timeline
        let clipStartTime = 0;
        for (const c of clips) {
          if (c.id === clip.id) break;
          const clipDuration = c.trimEnd > 0 ? c.trimEnd - c.trimStart : c.duration - c.trimStart;
          clipStartTime += clipDuration;
        }

        if (target.handleType === 'left') {
          // Constrain to clip bounds
          const minX = target.clipStartX;
          const maxX = target.clipStartX + target.clipWidth - handleWidth;
          target.left = Math.max(minX - handleWidth/2, Math.min(maxX - handleWidth/2, target.left));

          // Calculate new trim start (relative to clip start)
          const relativeTime = newTime - clipStartTime;
          const newTrimStart = Math.max(0, Math.min(relativeTime, clip.duration));
          setTempTrimStart(newTrimStart);
          if (tempTrimEnd === null) {
            setTempTrimEnd(clip.trimEnd > 0 ? clip.trimEnd : clip.duration);
          }
          
          // Update playhead to follow trim handle
          const newPlayheadTime = clipStartTime + newTrimStart;
          setPlayhead(newPlayheadTime);
          
          console.log('Left trim handle preview:', { newTrimStart, clipDuration: clip.duration, playhead: newPlayheadTime });
        } else if (target.handleType === 'right') {
          // Constrain to clip bounds
          const minX = target.clipStartX + handleWidth;
          const maxX = target.clipStartX + target.clipWidth;
          target.left = Math.max(minX - handleWidth/2, Math.min(maxX - handleWidth/2, target.left));

          // Calculate new trim end (relative to clip start)
          const relativeTime = newTime - clipStartTime;
          const newTrimEnd = Math.max(0, Math.min(relativeTime, clip.duration));
          setTempTrimEnd(newTrimEnd);
          if (tempTrimStart === null) {
            setTempTrimStart(clip.trimStart);
          }
          
          // Update playhead to follow trim handle
          const newPlayheadTime = clipStartTime + newTrimEnd;
          setPlayhead(newPlayheadTime);
          
          console.log('Right trim handle preview:', { newTrimEnd, clipDuration: clip.duration, playhead: newPlayheadTime });
        }
      });

      // Hover feedback on timeline objects
      canvas.on('mouse:over', (event) => {
        const target = event.target as any;
        if (target && target.clipId) {
          if (target.isTrimHandle) {
            canvas.setCursor('ew-resize');
          } else {
            canvas.setCursor('pointer');
            // Lighten clip color on hover
            if (target.type === 'rect' && !target.isTrimHandle) {
              target.set('fill', selectedClipId === target.clipId ? '#2563eb' : '#60a5fa');
              canvas.renderAll();
            }
          }
        }
      });

      canvas.on('mouse:out', (event) => {
        const target = event.target as any;
        if (target && target.clipId && target.type === 'rect' && !target.isTrimHandle) {
          // Restore original clip color
          target.set('fill', selectedClipId === target.clipId ? '#1e40af' : '#3b82f6');
          canvas.renderAll();
        }
        canvas.setCursor('default');
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

      // Draw clips with trim handles
      let currentTime = 0;
      const clipHeight = 60;
      const clipY = (canvas.height! - clipHeight) / 2;
      const handleWidth = 8;

      clips.forEach((clip) => {
        const clipDuration = clip.trimEnd > 0 ? clip.trimEnd - clip.trimStart : clip.duration - clip.trimStart;
        const clipWidth = (clipDuration / totalDuration) * canvas.width!;
        const clipX = (currentTime / totalDuration) * canvas.width!;

        // Main clip rectangle
        const clipRect = new fabric.Rect({
          left: clipX,
          top: clipY,
          width: clipWidth,
          height: clipHeight,
          fill: selectedClipId === clip.id ? '#1e40af' : '#3b82f6',
          stroke: selectedClipId === clip.id ? '#1d4ed8' : '#1e40af',
          strokeWidth: selectedClipId === clip.id ? 3 : 2,
          selectable: false, // Disable dragging for now to avoid overlap issues
          lockMovementY: true,
          hasControls: false,
          hasBorders: false,
          evented: true,
          clipId: clip.id,
          originalIndex: clips.indexOf(clip),
        } as any);
        
        canvas.add(clipRect);

        // Left trim handle (on all clips)
        const leftHandle = new fabric.Rect({
          left: clipX - handleWidth/2,
          top: clipY,
          width: handleWidth,
          height: clipHeight,
          fill: selectedClipId === clip.id ? '#ef4444' : '#dc2626',
          stroke: selectedClipId === clip.id ? '#dc2626' : '#b91c1c',
          strokeWidth: 1,
          selectable: true,
          lockMovementY: true,
          hasControls: false,
          hasBorders: false,
          clipId: clip.id,
          isTrimHandle: true,
          handleType: 'left',
          clipStartX: clipX,
          clipWidth: clipWidth,
        } as any);
        
        canvas.add(leftHandle);

        // Right trim handle (on all clips)
        const rightHandle = new fabric.Rect({
          left: clipX + clipWidth - handleWidth/2,
          top: clipY,
          width: handleWidth,
          height: clipHeight,
          fill: selectedClipId === clip.id ? '#ef4444' : '#dc2626',
          stroke: selectedClipId === clip.id ? '#dc2626' : '#b91c1c',
          strokeWidth: 1,
          selectable: true,
          lockMovementY: true,
          hasControls: false,
          hasBorders: false,
          clipId: clip.id,
          isTrimHandle: true,
          handleType: 'right',
          clipStartX: clipX,
          clipWidth: clipWidth,
        } as any);
        
        canvas.add(rightHandle);

        // Clip text
        canvas.add(new fabric.Text(clip.name, {
          left: clipX + 8,
          top: clipY + 10,
          fontSize: 14,
          fill: '#ffffff',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          selectable: false,
          evented: false,
          clipId: clip.id,
        } as any));

        // Duration text
        canvas.add(new fabric.Text(formatTime(clipDuration), {
          left: clipX + 8,
          top: clipY + 30,
          fontSize: 12,
          fill: '#e5e7eb',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          selectable: false,
          evented: false,
          clipId: clip.id,
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

                  {isTrimming && (
                    <>
                      <div className="border-l border-gray-600 h-6 mx-2"></div>
                      <span className="text-sm text-yellow-400 font-medium">
                        Trimming: {selectedClipId ? clips.find(c => c.id === selectedClipId)?.name : 'Unknown'}
                      </span>
                      <button
                        onClick={applyTrim}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-medium"
                        title="Apply trim"
                      >
                        ✓ Apply Trim
                      </button>
                      <button
                        onClick={cancelTrim}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-medium"
                        title="Cancel trim"
                      >
                        ✕ Cancel
                      </button>
                    </>
                  )}

                  {selectedClipId && !isTrimming && (
                    <>
                      <div className="border-l border-gray-600 h-6 mx-2"></div>
                      <button
                        onClick={moveClipLeft}
                        disabled={clips.findIndex(c => c.id === selectedClipId) === 0}
                        className="text-gray-400 hover:text-white px-2 py-1 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move clip left ([)"
                      >
                        ←
                      </button>
                      <button
                        onClick={moveClipRight}
                        disabled={clips.findIndex(c => c.id === selectedClipId) === clips.length - 1}
                        className="text-gray-400 hover:text-white px-2 py-1 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move clip right (])"
                      >
                        →
                      </button>
                      <button
                        onClick={splitClipAtPlayhead}
                        className="text-gray-400 hover:text-red-400 px-2 py-1 rounded text-sm"
                        title="Split clip at playhead (S)"
                      >
                        Split
                      </button>
                    </>
                  )}
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