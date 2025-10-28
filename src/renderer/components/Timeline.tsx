import React, { useRef, useLayoutEffect } from 'react';
import { fabric } from 'fabric';
import { useTimelineStore } from '../store/timelineStore';

const Timeline: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const isDraggingRef = useRef(false); // Track if user is dragging trim handles

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
  const [trimHandlePositions, setTrimHandlePositions] = React.useState<Record<string, { left: number; right: number }>>({});
  const [isApplyingTrim, setIsApplyingTrim] = React.useState(false);
  const [trimProgress, setTrimProgress] = React.useState<number>(0);

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

  // Listen for trim progress updates
  React.useEffect(() => {
    const handleTrimProgress = (progress: { progress: number; currentStep: string }) => {
      setTrimProgress(progress.progress);
      console.log('Trim progress:', progress);
    };
    
    window.electronAPI.onTrimProgress(handleTrimProgress);
    
    return () => {
      window.electronAPI.removeAllListeners('trim-progress');
    };
  }, []);

  // Apply or cancel trim
  const applyTrim = async () => {
    console.log('Apply trim called with:', { 
      selectedClipId, 
      tempTrimStart, 
      tempTrimEnd,
      isTrimming
    });
    
    // Use the current trim values, or fall back to clip values if they're null
    let trimStart = tempTrimStart;
    let trimEnd = tempTrimEnd;
    
    if (trimStart === null || trimEnd === null) {
      const clip = clips.find(c => c.id === selectedClipId);
      if (clip) {
        trimStart = clip.trimStart;
        trimEnd = clip.trimEnd > 0 ? clip.trimEnd : clip.duration;
        console.log('Using clip values for trim (fallback):', { trimStart, trimEnd });
      }
    } else {
      console.log('Using current trim values:', { trimStart, trimEnd });
    }
    
    if (!selectedClipId || trimStart === null || trimEnd === null) {
      console.error('Apply trim failed: Missing required data', { 
        selectedClipId, 
        trimStart, 
        trimEnd 
      });
      alert('Error: Missing trim data. Please drag the trim handles first.');
      return;
    }
    
    const clip = clips.find(c => c.id === selectedClipId);
    if (!clip) {
      console.error('Apply trim failed: Clip not found', { selectedClipId, availableClips: clips.map(c => c.id) });
      alert('Error: Clip not found.');
      return;
    }
    
    console.log('Applying trim:', { 
      clipId: selectedClipId, 
      trimStart: trimStart, 
      trimEnd: trimEnd,
      originalClip: clip,
      originalPath: clip.path
    });
    
    try {
      // Set processing state
      setIsApplyingTrim(true);
      setTrimProgress(0);
      
      // Create output path for trimmed video
      const originalPath = clip.path;
      const pathParts = originalPath.split('.');
      const extension = pathParts.pop();
      const basePath = pathParts.join('.');
      const timestamp = Date.now();
      const outputPath = `${basePath}_trimmed_${timestamp}.${extension}`;
      
      console.log('Trim paths:', { originalPath, outputPath });
      console.log('Trim validation:', { 
        trimStart, 
        trimEnd, 
        clipDuration: clip.duration,
        isValid: trimStart >= 0 && trimEnd > trimStart && trimEnd <= clip.duration
      });
      
      // Validate trim values
      if (trimStart < 0 || trimEnd <= trimStart || trimEnd > clip.duration) {
        throw new Error(`Invalid trim values: start=${trimStart.toFixed(2)}s, end=${trimEnd.toFixed(2)}s, duration=${clip.duration.toFixed(2)}s`);
      }
      
      // Show progress indicator
      console.log('Starting video trim...');
      
      // Call the trim video function
      const result = await window.electronAPI.trimVideo(
        originalPath,
        outputPath,
        trimStart,
        trimEnd
      );
      
      console.log('Trim result:', result);
      
      if (result.success) {
        // Update the clip with new trim values and new path
        useTimelineStore.getState().updateClip(selectedClipId, {
          trimStart: 0,  // Reset to 0 since we've created a new trimmed file
          trimEnd: 0,    // Reset to 0 since the new file is already trimmed
          path: result.outputPath!,
          duration: trimEnd - trimStart
        });
        
        // Recalculate total duration after trim
        const updatedClips = clips.map(c => 
          c.id === selectedClipId 
            ? { ...c, trimStart: 0, trimEnd: 0, path: result.outputPath!, duration: trimEnd - trimStart }
            : c
        );
        
        const newTotalDuration = updatedClips.reduce((sum, c) => {
          const duration = c.trimEnd > 0 ? c.trimEnd - c.trimStart : c.duration - c.trimStart;
          return sum + duration;
        }, 0);
        
        // Update total duration in store
        useTimelineStore.setState({ totalDuration: newTotalDuration });
        
        setTempTrimStart(null);
        setTempTrimEnd(null);
        setIsTrimming(false);
        setIsApplyingTrim(false);
        setTrimProgress(0);
        
        const newDuration = trimEnd - trimStart;
        console.log('Trim applied successfully, new clip duration:', newDuration, 'new total duration:', newTotalDuration);
        alert(`✓ Trim applied successfully!\n\nNew clip duration: ${formatTime(newDuration)}\nFile saved to: ${result.outputPath}`);
      } else {
        console.error('Trim failed:', result.error);
        setIsApplyingTrim(false);
        setTrimProgress(0);
        alert(`✗ Trim failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Trim error:', error);
      setIsApplyingTrim(false);
      setTrimProgress(0);
      alert(`✗ Trim failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    // Skip canvas re-render if user is dragging trim handles
    if (isDraggingRef.current) {
      console.log('Skipping canvas re-render during drag');
      return;
    }
    
    // Add resize observer to handle container size changes
    if (!canvasRef.current) return;
    
    const resizeObserver = new ResizeObserver(() => {
      if (fabricCanvasRef.current && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        // Use same width calculation as main useLayoutEffect
        const newWidth = window.innerWidth - 384; // Full width minus media library width (w-96 = 384px)
        fabricCanvasRef.current.setDimensions({
          width: newWidth,
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
    // Skip canvas re-render if user is dragging trim handles
    if (isDraggingRef.current) {
      console.log('Skipping canvas re-render during drag - main effect');
      return;
    }
    
    if (!canvasRef.current) return;

    // Define handleWidth at the top of the effect
    const handleWidth = 8;

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
          const currentState = useTimelineStore.getState();
          const currentZoom = currentState.zoom;
          const currentTotalDuration = currentState.totalDuration;
          const clickedTime = (pointer.x / (canvas.width! * currentZoom)) * currentTotalDuration;
          const newTime = Math.max(0, Math.min(clickedTime, currentTotalDuration));
          console.log('Timeline clicked at x:', pointer.x, 'time:', formatTime(newTime), 'totalDuration:', currentTotalDuration);
          
          // Pause video if it's playing when timeline is clicked
          const videoElement = document.querySelector('video');
          if (videoElement && !videoElement.paused) {
            console.log('Pausing video for timeline interaction');
            videoElement.pause();
          }
          
          setPlayhead(newTime);
          console.log('Playhead set to:', newTime);
          // Exit trim mode when clicking empty space
          setIsTrimming(false);
        } else {
          console.log('Clicked on object:', event.target);
          const target = event.target as any;
          if (target.clipId && !target.isTrimHandle) {
            // Start trim mode when clicking on a clip
            setIsTrimming(true);
            
            // Only reset trim values if selecting a DIFFERENT clip
            const currentState = useTimelineStore.getState();
            const wasAlreadySelected = currentState.selectedClipId === target.clipId;
            
            setSelectedClip(target.clipId);
            
            if (!wasAlreadySelected) {
              // New clip selected - initialize trim values
              const currentClips = currentState.clips;
              const clip = currentClips.find(c => c.id === target.clipId);
              if (clip) {
                setTempTrimStart(clip.trimStart);
                setTempTrimEnd(clip.trimEnd > 0 ? clip.trimEnd : clip.duration);
                console.log('Initialized trim values for newly selected clip:', { 
                  tempTrimStart: clip.trimStart, 
                  tempTrimEnd: clip.trimEnd > 0 ? clip.trimEnd : clip.duration 
                });
              }
            } else {
              console.log('Same clip clicked - preserving existing trim values');
            }
            console.log('Selected clip and started trim mode:', target.clipId);
          } else if (target.isTrimHandle) {
            // Clicking on trim handle - just ensure trim mode is on
            // Don't reset values, they should already be set from dragging or clip selection
            const currentState = useTimelineStore.getState();
            const wasAlreadySelected = currentState.selectedClipId === target.clipId;
            
            setSelectedClip(target.clipId);
            setIsTrimming(true);
            
            if (!wasAlreadySelected) {
              // Trim handle on a different clip - initialize values
              const currentClips = currentState.clips;
              const clip = currentClips.find(c => c.id === target.clipId);
              if (clip) {
                setTempTrimStart(clip.trimStart);
                setTempTrimEnd(clip.trimEnd > 0 ? clip.trimEnd : clip.duration);
                console.log('Initialized trim values for newly selected trim handle:', { 
                  tempTrimStart: clip.trimStart, 
                  tempTrimEnd: clip.trimEnd > 0 ? clip.trimEnd : clip.duration 
                });
              }
            } else {
              console.log('Trim handle clicked on same clip - preserving existing trim values');
            }
            console.log('Started trim mode for clip:', target.clipId);
            console.log('⚠️ DRAG the trim handles to adjust trim start/end. Clicking alone does not change trim values.');
          }
        }
      });

      // Handle trim handle dragging
      canvas.on('object:moving', (event) => {
        const target = event.target as any;
        if (!target || !target.isTrimHandle) return;
        
        // Set dragging flag to prevent canvas re-render
        isDraggingRef.current = true;
        
        // Get fresh state from store
        const currentState = useTimelineStore.getState();
        const currentClips = currentState.clips;
        const currentZoom = currentState.zoom;
        const currentTotalDuration = currentState.totalDuration;
        
        const clip = currentClips.find(c => c.id === target.clipId);
        if (!clip) return;

        // Pause video when starting to drag trim handles
        const videoElement = document.querySelector('video') as HTMLVideoElement;
        if (videoElement && !videoElement.paused) {
          videoElement.pause();
          console.log('Paused video for trim handle dragging');
        }

        // Select the clip being trimmed and show trim UI
        setSelectedClip(target.clipId);
        console.log('Setting isTrimming to true for clip:', target.clipId);
        setIsTrimming(true);

        const newX = target.left + target.width / 2; // Center of handle
        const newTime = (newX / (canvas.width! * currentZoom)) * currentTotalDuration;

        // Find clip's start time on timeline
        let clipStartTime = 0;
        for (const c of currentClips) {
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
          
          // Ensure trimEnd is also set
          setTempTrimEnd((prev) => {
            if (prev === null) {
              return clip.trimEnd > 0 ? clip.trimEnd : clip.duration;
            }
            return prev;
          });
          
          console.log('Left trim handle update:', { 
            newTrimStart, 
            clipDuration: clip.duration,
            relativeTime,
            clipStartTime
          });
          
          // Update playhead to follow trim handle
          const newPlayheadTime = clipStartTime + newTrimStart;
          setPlayhead(newPlayheadTime);
          
          // Update playhead line directly for immediate visual feedback
          const playheadX = (newPlayheadTime / currentTotalDuration) * canvas.width! * currentZoom;
          const objects = canvas.getObjects();
          const playheadLine = objects.find((obj: any) => obj.playhead === true && obj.type === 'line') as fabric.Line;
          const playheadTriangle = objects.find((obj: any) => obj.playhead === true && obj.type === 'triangle') as fabric.Triangle;
          
          if (playheadLine) {
            (playheadLine as any).set({ x1: playheadX, x2: playheadX });
          }
          if (playheadTriangle) {
            playheadTriangle.set({ left: playheadX - 6 });
          }
          
          canvas.renderAll();
          
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
          
          // Ensure trimStart is also set
          setTempTrimStart((prev) => {
            if (prev === null) {
              return clip.trimStart;
            }
            return prev;
          });
          
          console.log('Right trim handle update:', { 
            newTrimEnd, 
            clipDuration: clip.duration,
            relativeTime,
            clipStartTime
          });
          
          // Update playhead to follow trim handle
          const newPlayheadTime = clipStartTime + newTrimEnd;
          setPlayhead(newPlayheadTime);
          
          // Update playhead line directly for immediate visual feedback
          const playheadX = (newPlayheadTime / currentTotalDuration) * canvas.width! * currentZoom;
          const objects = canvas.getObjects();
          const playheadLine = objects.find((obj: any) => obj.playhead === true && obj.type === 'line') as fabric.Line;
          const playheadTriangle = objects.find((obj: any) => obj.playhead === true && obj.type === 'triangle') as fabric.Triangle;
          
          if (playheadLine) {
            (playheadLine as any).set({ x1: playheadX, x2: playheadX });
          }
          if (playheadTriangle) {
            playheadTriangle.set({ left: playheadX - 6 });
          }
          
          canvas.renderAll();
          
          console.log('Right trim handle preview:', { newTrimEnd, clipDuration: clip.duration, playhead: newPlayheadTime });
        }
      });

      // Handle trim handle drag end
      canvas.on('object:modified', (event) => {
        const target = event.target as any;
        if (!target || !target.isTrimHandle) return;
        
        // Clear dragging flag to allow canvas re-render
        isDraggingRef.current = false;
        
        console.log('Trim handle drag ended for clip:', target.clipId);
        
        // Resume video playback if it was playing before trim
        const videoElement = document.querySelector('video') as HTMLVideoElement;
        if (videoElement && videoElement.paused) {
          // Only resume if the video was playing before we started trimming
          // We'll check if the play button is visible to determine this
          const playButton = document.querySelector('[data-testid="play-button"]') as HTMLButtonElement;
          if (playButton && playButton.style.display !== 'none') {
            videoElement.play();
            console.log('Resumed video after trim handle dragging');
          }
        }
        
        // Keep isTrimming true so Apply/Cancel buttons remain visible
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
              const currentSelectedId = useTimelineStore.getState().selectedClipId;
              target.set('fill', currentSelectedId === target.clipId ? '#93c5fd' : '#60a5fa');
              canvas.renderAll();
            }
          }
        }
      });

      canvas.on('mouse:out', (event) => {
        const target = event.target as any;
        if (target && target.clipId && target.type === 'rect' && !target.isTrimHandle) {
          // Restore original clip color
          const currentSelectedId = useTimelineStore.getState().selectedClipId;
          target.set('fill', currentSelectedId === target.clipId ? '#60a5fa' : '#3b82f6');
          canvas.renderAll();
        }
        canvas.setCursor('default');
      });

      fabricCanvasRef.current = canvas;
    }

    const canvas = fabricCanvasRef.current;
    const rect = canvasRef.current.getBoundingClientRect();
    
    // Force canvas to use full width of timeline container and container height
    const newWidth = window.innerWidth - 384; // Full width minus media library width (w-96 = 384px)
    const newHeight = rect.height;
    
    // No content offset needed since timeline container is already positioned correctly
    const contentOffset = 0;
    
    console.log('Setting canvas dimensions:', { 
      newWidth, 
      newHeight, 
      rectWidth: rect.width, 
      rectHeight: rect.height,
      containerWidth: canvasRef.current.parentElement?.offsetWidth,
      windowWidth: window.innerWidth,
      contentOffset
    });
    
    // Force canvas to use full available width - zoom only affects visual scaling, not dimensions
    canvas.setDimensions({
      width: newWidth,
      height: newHeight,
    });
    
    // Apply zoom as viewport transform - this scales the content without changing canvas dimensions
    canvas.setViewportTransform([zoom, 0, 0, 1, 0, 0]);

    // Clear and redraw - Zustand state drives the render
    canvas.clear();
    canvas.backgroundColor = '#1a1a1a';

      // Draw time grid
      if (clips.length > 0 && totalDuration > 0) {
        let timeInterval = 5;
        const minSpacing = 80;
        const pixelsPerSecond = (canvas.width! / zoom) / totalDuration;
        
        if (timeInterval * pixelsPerSecond < minSpacing) {
          timeInterval = Math.ceil(minSpacing / pixelsPerSecond / 5) * 5;
        }

        console.log('Drawing timeline:', { canvasWidth: canvas.width, totalDuration, pixelsPerSecond });

        for (let time = 0; time <= totalDuration; time += timeInterval) {
          const x = (time / totalDuration) * (canvas.width! / zoom);
          if (x > (canvas.width! / zoom)) break;

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
          zoomX: 1 / zoom,
          zoomY: 1 / zoom,
        } as any));
      }

      // Draw clips with trim handles
      let currentTime = 0;
      const clipHeight = 60;
      const clipY = (canvas.height! - clipHeight) / 2;
      const handleWidth = 8;

      clips.forEach((clip) => {
        const clipDuration = clip.trimEnd > 0 ? clip.trimEnd - clip.trimStart : clip.duration - clip.trimStart;
        const clipWidth = (clipDuration / totalDuration) * (canvas.width! / zoom);
        const clipX = (currentTime / totalDuration) * (canvas.width! / zoom);
        
        console.log('Rendering clip:', {
          clipName: clip.name,
          originalDuration: clip.duration,
          trimStart: clip.trimStart,
          trimEnd: clip.trimEnd,
          clipDuration,
          clipWidth,
          clipX
        });

        // Main clip rectangle
        const clipRect = new fabric.Rect({
          left: clipX,
          top: clipY,
          width: clipWidth,
          height: clipHeight,
          fill: selectedClipId === clip.id ? '#60a5fa' : '#3b82f6',
          stroke: selectedClipId === clip.id ? '#3b82f6' : '#2563eb',
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

        // Calculate trim handle positions based on temp trim values (if in trim mode) or clip values
        // This ensures trim handles stay in place when video is playing
        const currentTrimStart = (selectedClipId === clip.id && tempTrimStart !== null) 
          ? tempTrimStart 
          : clip.trimStart;
        const currentTrimEnd = (selectedClipId === clip.id && tempTrimEnd !== null) 
          ? tempTrimEnd 
          : (clip.trimEnd > 0 ? clip.trimEnd : clip.duration);
        const trimStartX = clipX + (currentTrimStart / clip.duration) * clipWidth;
        const trimEndX = clipX + (currentTrimEnd / clip.duration) * clipWidth;

        // ONLY show trim handles for SELECTED clip
        if (selectedClipId === clip.id) {
          // Left trim handle (ONLY for selected clip)
          const leftHandle = new fabric.Rect({
            left: trimStartX - handleWidth/2,
            top: clipY,
            width: handleWidth,
            height: clipHeight,
            fill: '#ef4444',
            stroke: '#dc2626',
            strokeWidth: 2,
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

          // Right trim handle (ONLY for selected clip)
          const rightHandle = new fabric.Rect({
            left: trimEndX - handleWidth/2,
            top: clipY,
            width: handleWidth,
            height: clipHeight,
            fill: '#ef4444',
            stroke: '#dc2626',
            strokeWidth: 2,
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
        }

        // Clip text - use Textbox for wrapping
        const maxTextWidth = (clipWidth - 16) * zoom; // Account for padding and zoom
        canvas.add(new fabric.Textbox(clip.name, {
          left: clipX + 8,
          top: clipY + 8,
          width: maxTextWidth,
          fontSize: 13,
          fill: '#ffffff',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          selectable: false,
          evented: false,
          clipId: clip.id,
          zoomX: 1 / zoom,
          zoomY: 1 / zoom,
          splitByGrapheme: true, // Better text wrapping
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
          zoomX: 1 / zoom,
          zoomY: 1 / zoom,
        } as any));

        currentTime += clipDuration;
      });

      // Draw playhead
      if (totalDuration > 0) {
        const x = (playhead / totalDuration) * (canvas.width! / zoom);

        canvas.add(new fabric.Line([x, 0, x, canvas.height!], {
          stroke: '#ef4444',
          strokeWidth: 2,
          selectable: false,
          evented: false,
          playhead: true,
        } as any));

        canvas.add(new fabric.Triangle({
          left: x - 6,
          top: 0,
          width: 12,
          height: 12,
          fill: '#ef4444',
          selectable: false,
          evented: false,
          playhead: true,
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
  }, [clips, totalDuration, zoom, selectedClipId, playhead, tempTrimStart, tempTrimEnd]); // Re-run when clips, selection, playhead, or trim values change


  return (
    <div className="h-full flex flex-col w-full relative">
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between w-full absolute top-0 z-10" style={{ width: 'calc(100vw - 24rem)', left: '0' }}>
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
                  {isTrimming && (
                    <>
                      {isApplyingTrim ? (
                        <div className="flex items-center space-x-2">
                          <div className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium">
                            Processing... {trimProgress}%
                          </div>
                          <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 transition-all duration-300" 
                              style={{ width: `${trimProgress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={applyTrim}
                            disabled={tempTrimStart === null || tempTrimEnd === null}
                            className="bg-green-700 hover:bg-green-800 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-1 rounded text-xs font-medium"
                            title="Apply trim - this will permanently trim the video"
                          >
                            ✓ Apply
                          </button>
                          <button
                            onClick={cancelTrim}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-medium"
                            title="Cancel trim - discard changes"
                          >
                            ✕ Cancel
                          </button>
                        </>
                      )}
                      <div className="border-l border-gray-600 h-6 mx-2"></div>
                    </>
                  )}
                  
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

                  {!selectedClipId && clips.length > 0 && (
                    <span className="text-sm text-gray-400 italic">
                      Click a clip to select it and show trim handles
                    </span>
                  )}
                  
                  {/* Debug info */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="text-xs text-gray-500">
                      isTrimming: {isTrimming.toString()}, selectedClipId: {selectedClipId || 'null'}
                    </div>
                  )}

                  {selectedClipId && (
                    <>
                      <div className="border-l border-gray-600 h-6 mx-2"></div>
                      <span className="text-xs text-gray-500 mr-2">Reorder:</span>
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
                      <div className="border-l border-gray-600 h-6 mx-2"></div>
                      <span className="text-xs text-gray-500 mr-2">Edit:</span>
                      <button
                        onClick={splitClipAtPlayhead}
                        className="text-gray-400 hover:text-red-400 px-3 py-1 rounded text-sm border border-gray-600 hover:border-red-400"
                        title="Split clip at playhead (S) - cuts the selected clip into two separate clips at the red playhead line"
                      >
                        ✂️ Split
                      </button>
                    </>
                  )}
                </div>
      </div>

      <div className="flex-1 relative overflow-hidden w-full absolute bottom-0 flex items-center justify-center" style={{ width: 'calc(100vw - 24rem)', left: '0' }}>
        <canvas 
          ref={canvasRef} 
          className="w-full cursor-pointer" 
          style={{ width: '100%', height: '80%' }}
        />
      </div>
    </div>
  );
};

export default Timeline;