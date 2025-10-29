import React, { useRef, useLayoutEffect } from 'react';
import toast from 'react-hot-toast';
import { fabric } from 'fabric';
import { useTimelineStore } from '../store/timelineStore';

// Trim snapping constants
const TRIM_SNAP_INTERVAL = 0.1; // Snap to 0.1 second intervals
const TRIM_SNAP_THRESHOLD = 0.05; // Snap if within 0.05s of interval

// Helper function to snap value to nearest 0.1s interval
const snapToInterval = (value: number): number => {
  const snappedValue = Math.round(value / TRIM_SNAP_INTERVAL) * TRIM_SNAP_INTERVAL;
  // Only snap if we're within the threshold
  if (Math.abs(value - snappedValue) <= TRIM_SNAP_THRESHOLD) {
    return snappedValue;
  }
  return value;
};

// Define all static dimensions as constants OUTSIDE the component
const CLIP_HEIGHT = 60; // Fixed pixel height for clips
const TRIM_HANDLE_WIDTH = 12; // Fixed pixel width for trim handles
const TRIM_HANDLE_HEIGHT = 70; // Fixed pixel height for trim handles
const TIME_GRID_HEIGHT = 40; // Fixed pixel height for time markers area
const SCROLLBAR_HEIGHT = 20; // Fixed pixel height for scrollbar
const MEDIA_LIBRARY_WIDTH = 384; // Fixed width of media library sidebar
const PLAYHEAD_LINE_HEIGHT = 200; // Fixed height for playhead line (tall enough to cover timeline area)
const PLAYHEAD_TRIANGLE_SIZE = 12; // Fixed size for playhead triangle

// Zoom and interaction constants
const ZOOM_IN_FACTOR = 1.25; // Zoom in multiplier
const ZOOM_OUT_FACTOR = 0.8; // Zoom out multiplier
const SCROLL_STEP_PERCENTAGE = 0.1; // 10% of canvas width for scroll step
const MIN_THUMBNAIL_WIDTH = 20; // Minimum scrollbar thumb width
const MIN_TIME_MARKER_SPACING = 80; // Minimum pixels between time markers
const DEFAULT_TIME_INTERVAL = 5; // Default time interval in seconds

const Timeline: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const isDraggingRef = useRef(false); // Track if user is dragging trim handles
  const playheadLineRef = useRef<fabric.Line | null>(null); // Store playhead line for efficient updates
  const playheadTriangleRef = useRef<fabric.Triangle | null>(null); // Store playhead triangle for efficient updates
  const [scrollPosition, setScrollPosition] = React.useState(0); // Horizontal scroll position
  const [isDraggingScrollbar, setIsDraggingScrollbar] = React.useState(false); // Track scrollbar drag state
  const actualScrollPositionRef = useRef(0); // Track the actual scroll position being used by rendering

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

  // Format time for tick marks and duration (whole seconds)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format time for playhead display (2 decimal places)
  const formatPlayheadTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const hundredths = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
  };

  // Sync trim preview with trim handle positions
  // This maintains trim preview even when clicking off (as long as clip is selected somewhere)
  React.useEffect(() => {
    if (selectedClipId) {
      const clip = clips.find(c => c.id === selectedClipId);
      if (clip) {
        // Use temp trim values if available (during active trimming), otherwise use clip's actual values
        const trimStart = tempTrimStart !== null ? tempTrimStart : clip.trimStart;
        const trimEnd = tempTrimEnd !== null ? tempTrimEnd : (clip.trimEnd > 0 ? clip.trimEnd : clip.duration);
        
        // Always set trim preview when a clip is selected
        useTimelineStore.getState().setTrimPreview({
          clipId: clip.id,
          start: trimStart,
          end: trimEnd
        });
        
        console.log('[Trim Preview Sync] Set for selected clip:', { 
          clipId: clip.id, 
          start: trimStart, 
          end: trimEnd,
          isTrimming,
          hasTempValues: tempTrimStart !== null || tempTrimEnd !== null
        });
      }
    }
    // Don't clear when selectedClipId becomes null - let it persist
  }, [selectedClipId, tempTrimStart, tempTrimEnd, clips, isTrimming]);

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
      
      // Execute the split operation first
      useTimelineStore.getState().splitClip(clip.id, splitTime);
      
      // Create history snapshot AFTER splitting (captures state after operation)
      if (typeof (window as any).createHistorySnapshot === 'function') {
        try {
          (window as any).createHistorySnapshot(`Split clip at ${formatPlayheadTime(playhead)}`);
        } catch (error) {
          console.warn('Failed to create history snapshot:', error);
        }
      }
      
      toast.success(`Split clip at ${formatPlayheadTime(playhead)}`);
    }
  };

  // Listen for trim progress updates
  React.useEffect(() => {
    const handleTrimProgress = (progress: { progress: number; currentStep: string }) => {
      setTrimProgress(progress.progress);
    };
    
    window.electronAPI.onTrimProgress(handleTrimProgress);
    
    return () => {
      window.electronAPI.removeAllListeners('trim-progress');
    };
  }, []);

  // Apply or cancel trim
  const applyTrim = async () => {
    
    // Use the current trim values, or fall back to clip values if they're null
    let trimStart = tempTrimStart;
    let trimEnd = tempTrimEnd;
    
    if (trimStart === null || trimEnd === null) {
      const clip = clips.find(c => c.id === selectedClipId);
      if (clip) {
        trimStart = clip.trimStart;
        trimEnd = clip.trimEnd > 0 ? clip.trimEnd : clip.duration;
      }
    } else {
    }
    
    if (!selectedClipId || trimStart === null || trimEnd === null) {
      console.error('Apply trim failed: Missing required data', { 
        selectedClipId, 
        trimStart, 
        trimEnd 
      });
      toast.error('Error: Missing trim data. Please drag the trim handles first.');
      return;
    }
    
    const clip = clips.find(c => c.id === selectedClipId);
    if (!clip) {
      console.error('Apply trim failed: Clip not found', { selectedClipId, availableClips: clips.map(c => c.id) });
      toast.error('Error: Clip not found.');
      return;
    }
    
    
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
        toast.error(`Invalid trim values: start=${trimStart.toFixed(2)}s, end=${trimEnd.toFixed(2)}s, duration=${clip.duration.toFixed(2)}s`);
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
        // Delete previous trimmed file if it exists
        if (clip.previousTrimPath) {
          try {
            await window.electronAPI.deleteFile(clip.previousTrimPath);
            console.log('Deleted previous trim file:', clip.previousTrimPath);
          } catch (error) {
            console.warn('Could not delete previous trim file:', error);
          }
        }
        
        // Update the clip with new trim values and new path
        // updateClip will automatically recalculate totalDuration
        useTimelineStore.getState().updateClip(selectedClipId, {
          trimStart: 0,  // Reset to 0 since we've created a new trimmed file
          trimEnd: 0,    // Reset to 0 since the new file is already trimmed
          path: result.outputPath!,
          duration: trimEnd - trimStart,
          previousTrimPath: result.outputPath! // Track this for future cleanup
        });
        
        // Adjust playhead if it's now beyond the new totalDuration
        const newTotalDuration = useTimelineStore.getState().totalDuration;
        const currentPlayhead = useTimelineStore.getState().playhead;
        if (currentPlayhead > newTotalDuration) {
          console.log('[Trim] Adjusting playhead from', currentPlayhead, 'to', newTotalDuration);
          useTimelineStore.getState().setPlayhead(newTotalDuration);
        }
        
        // Create history snapshot AFTER trimming (captures state after operation)
        // State is already updated synchronously by Zustand, so we can capture immediately
        if (typeof (window as any).createHistorySnapshot === 'function') {
          try {
            (window as any).createHistorySnapshot(`Trim "${clip.name}" to ${formatPlayheadTime(trimStart)}-${formatPlayheadTime(trimEnd)}`);
            console.log('[Trim] History snapshot created successfully');
          } catch (error) {
            console.error('[Trim] Failed to create history snapshot:', error);
          }
        } else {
          console.warn('[Trim] createHistorySnapshot function not available');
        }
        
        setTempTrimStart(null);
        setTempTrimEnd(null);
        setIsTrimming(false);
        setIsApplyingTrim(false);
        setTrimProgress(0);
        
        // Clear trim preview state
        useTimelineStore.getState().setTrimPreview(null);
        
        const newDuration = trimEnd - trimStart;
        const updatedTotalDuration = useTimelineStore.getState().totalDuration;
        console.log('Trim applied successfully, new clip duration:', newDuration, 'new total duration:', updatedTotalDuration);
        toast.success(`✓ Trim applied successfully! New duration: ${formatTime(newDuration)}`);
      } else {
        console.error('Trim failed:', result.error);
        setIsApplyingTrim(false);
        setTrimProgress(0);
        toast.error(`✗ Trim failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Trim error:', error);
      setIsApplyingTrim(false);
      setTrimProgress(0);
      toast.error(`✗ Trim failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const cancelTrim = () => {
    setTempTrimStart(null);
    setTempTrimEnd(null);
    setIsTrimming(false);
    
    // Clear trim preview state
    useTimelineStore.getState().setTrimPreview(null);
    
    console.log('Cancelled trim');
  };

  // Move selected clip left or right
  const moveClipLeft = () => {
    if (!selectedClipId) return;
    const currentIndex = clips.findIndex(c => c.id === selectedClipId);
    if (currentIndex > 0) {
      // Execute the move operation first
      useTimelineStore.getState().reorderClips(currentIndex, currentIndex - 1);
      
      // Create history snapshot AFTER moving (captures state after operation)
      if (typeof (window as any).createHistorySnapshot === 'function') {
        try {
          (window as any).createHistorySnapshot(`Move clip left`);
        } catch (error) {
          console.warn('Failed to create history snapshot:', error);
        }
      }
      
      toast.success('Moved clip left');
    }
  };

  const moveClipRight = () => {
    if (!selectedClipId) return;
    const currentIndex = clips.findIndex(c => c.id === selectedClipId);
    if (currentIndex < clips.length - 1) {
      // Execute the move operation first
      useTimelineStore.getState().reorderClips(currentIndex, currentIndex + 1);
      
      // Create history snapshot AFTER moving (captures state after operation)
      if (typeof (window as any).createHistorySnapshot === 'function') {
        try {
          (window as any).createHistorySnapshot(`Move clip right`);
        } catch (error) {
          console.warn('Failed to create history snapshot:', error);
        }
      }
      
      toast.success('Moved clip right');
    }
  };

  // Keyboard shortcuts for clip reordering, deletion, and timeline scrolling
  React.useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Zoom keyboard shortcuts (Cmd+Plus, Cmd+Minus, Cmd+0)
      if (event.metaKey) {
        if (event.key === '+' || event.key === '=') {
          event.preventDefault();
          const currentZoom = useTimelineStore.getState().zoom;
          useTimelineStore.getState().setZoom(currentZoom * ZOOM_IN_FACTOR);
          return;
        }
        if (event.key === '-') {
          event.preventDefault();
          const currentZoom = useTimelineStore.getState().zoom;
          useTimelineStore.getState().setZoom(currentZoom * ZOOM_OUT_FACTOR);
          return;
        }
        if (event.key === '0') {
          event.preventDefault();
          useTimelineStore.getState().setZoom(1);
          return;
        }
      }

      // Timeline scrolling with arrow keys (when zoomed)
      if (zoom > 1 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        const currentCanvasWidth = window.innerWidth - MEDIA_LIBRARY_WIDTH;
        const currentVirtualTimelineWidth = currentCanvasWidth * zoom;
        const currentMaxScroll = Math.max(0, currentVirtualTimelineWidth - currentCanvasWidth);
        const scrollStep = currentCanvasWidth * SCROLL_STEP_PERCENTAGE;
        
        if (event.key === 'ArrowLeft') {
          setScrollPosition(prev => Math.max(0, prev - scrollStep));
        } else if (event.key === 'ArrowRight') {
          setScrollPosition(prev => Math.min(currentMaxScroll, prev + scrollStep));
        }
        return;
      }

      // Tab/Shift+Tab to cycle through timeline clips
      if (event.key === 'Tab') {
        event.preventDefault();
        if (clips.length === 0) return;
        
        const currentIndex = selectedClipId ? clips.findIndex(c => c.id === selectedClipId) : -1;
        let nextIndex;
        
        if (event.shiftKey) {
          // Shift+Tab: previous clip
          nextIndex = currentIndex <= 0 ? clips.length - 1 : currentIndex - 1;
        } else {
          // Tab: next clip
          nextIndex = currentIndex >= clips.length - 1 ? 0 : currentIndex + 1;
        }
        
        setSelectedClip(clips[nextIndex].id);
        toast.success(`Selected "${clips[nextIndex].name}"`);
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
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedClipId) {
        event.preventDefault();
        // Remove clip from timeline
        const clip = clips.find(c => c.id === selectedClipId);
        if (clip) {
          // Execute the remove operation first
          useTimelineStore.getState().removeClip(selectedClipId);
          
          // Create history snapshot AFTER removing (captures state after operation)
          if (typeof (window as any).createHistorySnapshot === 'function') {
            try {
              (window as any).createHistorySnapshot(`Remove "${clip.name}" from timeline`);
            } catch (error) {
              console.warn('Failed to create history snapshot:', error);
            }
          }
          
          console.log('Removed clip from timeline:', clip.name);
          toast.success(`Removed "${clip.name}" from timeline`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedClipId, playhead, clips, zoom]);

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
        // Use constant for width calculation
        const newWidth = window.innerWidth - MEDIA_LIBRARY_WIDTH;
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

    // Define handleWidth and handleHeight at the top of the effect
    const handleWidth = 12;
    const handleHeight = 70;

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
          
          // Use the actual scroll position being used by the rendering system
          const canvasWidth = window.innerWidth - MEDIA_LIBRARY_WIDTH;
          const virtualTimelineWidth = canvasWidth * currentZoom;
          const maxScroll = Math.max(0, virtualTimelineWidth - canvasWidth);
          const actualScrollPosition = actualScrollPositionRef.current;
          
          // Click position in virtual timeline space with high precision
          const virtualX = pointer.x + actualScrollPosition;
          const clickedTime = (virtualX / virtualTimelineWidth) * currentTotalDuration;
          const newTime = Math.max(0, Math.min(clickedTime, currentTotalDuration));
          
          console.log('Timeline clicked:', {
            pointerX: pointer.x,
            scrollPosition: scrollPosition,
            actualScrollPosition: actualScrollPosition,
            virtualX,
            virtualTimelineWidth,
            clickedTime,
            newTime: formatTime(newTime),
            totalDuration: currentTotalDuration,
            zoom: currentZoom,
            maxScroll: maxScroll
          });
          
          // Pause video if it's playing when timeline is clicked
          const videoElement = document.querySelector('video');
          if (videoElement && !videoElement.paused) {
            console.log('Pausing video for timeline interaction');
            videoElement.pause();
          }
          
          setPlayhead(newTime);
          console.log('Playhead set to:', newTime);
          // Exit trim mode when clicking empty space (but keep trim preview active for selected clip)
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
                const trimStart = clip.trimStart;
                const trimEnd = clip.trimEnd > 0 ? clip.trimEnd : clip.duration;
                setTempTrimStart(trimStart);
                setTempTrimEnd(trimEnd);
                
                // Set trim preview so video pauses at boundaries
                useTimelineStore.getState().setTrimPreview({
                  clipId: clip.id,
                  start: trimStart,
                  end: trimEnd
                });
                
                console.log('Initialized trim values for newly selected clip:', { 
                  tempTrimStart: trimStart, 
                  tempTrimEnd: trimEnd 
                });
              }
            } else {
              // Same clip - update trim preview with current temp values
              const clip = currentState.clips.find(c => c.id === target.clipId);
              if (clip) {
                const trimStart = tempTrimStart !== null ? tempTrimStart : clip.trimStart;
                const trimEnd = tempTrimEnd !== null ? tempTrimEnd : (clip.trimEnd > 0 ? clip.trimEnd : clip.duration);
                
                useTimelineStore.getState().setTrimPreview({
                  clipId: clip.id,
                  start: trimStart,
                  end: trimEnd
                });
              }
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
        const currentScrollPosition = scrollPosition;
        
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

        // Convert handle position to virtual timeline space
        const handleCenterX = target.left + target.width / 2;
        const canvasWidth = window.innerWidth - MEDIA_LIBRARY_WIDTH;
        const virtualTimelineWidth = canvasWidth * currentZoom;
        const maxScroll = Math.max(0, virtualTimelineWidth - canvasWidth);
        const clampedScrollPosition = Math.max(0, Math.min(scrollPosition, maxScroll));
        const virtualX = handleCenterX + clampedScrollPosition;
        const newTime = (virtualX / virtualTimelineWidth) * currentTotalDuration;

        // Find clip's start time on timeline
        let clipStartTime = 0;
        for (const c of currentClips) {
          if (c.id === clip.id) break;
          const clipDuration = c.trimEnd > 0 ? c.trimEnd - c.trimStart : c.duration - c.trimStart;
          clipStartTime += clipDuration;
        }

        if (target.handleType === 'left') {
          // Constrain to clip bounds (using screen space for visible bounds)
          const clipStartXScreen = target.clipStartX - clampedScrollPosition;
          const minX = clipStartXScreen;
          const maxX = clipStartXScreen + target.clipWidth - TRIM_HANDLE_WIDTH;
          target.left = Math.max(minX - TRIM_HANDLE_WIDTH / 2, Math.min(maxX - TRIM_HANDLE_WIDTH / 2, target.left));

          // Calculate new trim start (relative to clip start)
          const relativeTime = newTime - clipStartTime;
          const rawTrimStart = Math.max(0, Math.min(relativeTime, clip.duration));
          const newTrimStart = snapToInterval(rawTrimStart); // Apply snapping
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
          
          // Update playhead line directly for immediate visual feedback with FIXED dimensions
          const playheadXVirtual = (newPlayheadTime / currentTotalDuration) * virtualTimelineWidth;
          const playheadX = playheadXVirtual - currentScrollPosition;
          const objects = canvas.getObjects();
          const playheadLine = objects.find((obj: any) => obj.playhead === true && obj.type === 'line') as fabric.Line;
          const playheadTriangle = objects.find((obj: any) => obj.playhead === true && obj.type === 'triangle') as fabric.Triangle;
          
          if (playheadLine) {
            (playheadLine as any).set({ x1: playheadX, x2: playheadX });
          }
          if (playheadTriangle) {
            playheadTriangle.set({ left: playheadX - PLAYHEAD_TRIANGLE_SIZE / 2 });
          }
          
          canvas.renderAll();
          
          // Update trim preview state for video playback boundary checking
          const currentTrimEnd = tempTrimEnd !== null ? tempTrimEnd : (clip.trimEnd > 0 ? clip.trimEnd : clip.duration);
          useTimelineStore.getState().setTrimPreview({
            clipId: clip.id,
            start: newTrimStart,
            end: currentTrimEnd
          });
          
          console.log('Left trim handle preview:', { newTrimStart, clipDuration: clip.duration, playhead: newPlayheadTime });
        } else if (target.handleType === 'right') {
          // Constrain to clip bounds (using screen space for visible bounds)
          const clipStartXScreen = target.clipStartX - clampedScrollPosition;
          const minX = clipStartXScreen + TRIM_HANDLE_WIDTH;
          const maxX = clipStartXScreen + target.clipWidth;
          target.left = Math.max(minX - TRIM_HANDLE_WIDTH / 2, Math.min(maxX - TRIM_HANDLE_WIDTH / 2, target.left));

          // Calculate new trim end (relative to clip start)
          const relativeTime = newTime - clipStartTime;
          const rawTrimEnd = Math.max(0, Math.min(relativeTime, clip.duration));
          const newTrimEnd = snapToInterval(rawTrimEnd); // Apply snapping
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
          
          // Update playhead line directly for immediate visual feedback with FIXED dimensions
          const playheadXVirtual = (newPlayheadTime / currentTotalDuration) * virtualTimelineWidth;
          const playheadX = playheadXVirtual - currentScrollPosition;
          const objects = canvas.getObjects();
          const playheadLine = objects.find((obj: any) => obj.playhead === true && obj.type === 'line') as fabric.Line;
          const playheadTriangle = objects.find((obj: any) => obj.playhead === true && obj.type === 'triangle') as fabric.Triangle;
          
          if (playheadLine) {
            (playheadLine as any).set({ x1: playheadX, x2: playheadX });
          }
          if (playheadTriangle) {
            playheadTriangle.set({ left: playheadX - PLAYHEAD_TRIANGLE_SIZE / 2 });
          }
          
          canvas.renderAll();
          
          // Update trim preview state for video playback boundary checking
          const currentTrimStart = tempTrimStart !== null ? tempTrimStart : clip.trimStart;
          useTimelineStore.getState().setTrimPreview({
            clipId: clip.id,
            start: currentTrimStart,
            end: newTrimEnd
          });
          
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
            // Add hover glow effect to trim handles
            target.set({ 
              fill: '#f87171', // Brighter red on hover
              shadow: new fabric.Shadow({
                color: 'rgba(239, 68, 68, 0.6)',
                blur: 8,
                offsetX: 0,
                offsetY: 0,
              })
            });
            canvas.renderAll();
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
        if (target && target.clipId) {
          if (target.isTrimHandle) {
            // Restore original trim handle appearance
            target.set({ 
              fill: '#ef4444',
              shadow: null
            });
            canvas.renderAll();
          } else if (target.type === 'rect' && !target.isTrimHandle) {
            // Restore original clip color
            const currentSelectedId = useTimelineStore.getState().selectedClipId;
            target.set('fill', currentSelectedId === target.clipId ? '#60a5fa' : '#3b82f6');
            canvas.renderAll();
          }
        }
        canvas.setCursor('default');
      });

      fabricCanvasRef.current = canvas;
    }

    const canvas = fabricCanvasRef.current;
    const rect = canvasRef.current.getBoundingClientRect();
    
    // Calculate dimensions using static constants
    const canvasWidth = window.innerWidth - MEDIA_LIBRARY_WIDTH;
    const canvasHeight = rect.height;
    
    // Calculate virtual timeline width (this is how wide the timeline "really" is when zoomed)
    const virtualTimelineWidth = canvasWidth * zoom;
    
    // Clamp scroll position to valid range
    const maxScroll = Math.max(0, virtualTimelineWidth - canvasWidth);
    const clampedScrollPosition = Math.max(0, Math.min(scrollPosition, maxScroll));
    
    // Store the actual scroll position being used by rendering
    actualScrollPositionRef.current = clampedScrollPosition;
    
    // Update scroll position if it was clamped
    if (clampedScrollPosition !== scrollPosition) {
      setScrollPosition(clampedScrollPosition);
    }
    
    // Calculate clip Y position - start immediately after time grid
    // Clips should start right after the time grid tick marks, not centered in available space
    const clipY = TIME_GRID_HEIGHT;
    
    console.log('🎨 Canvas render:', { 
      canvasWidth, 
      canvasHeight, 
      zoom,
      virtualTimelineWidth,
      scrollPosition: clampedScrollPosition,
      maxScroll,
      clipY,
      totalDuration,
      pixelsPerSecond: totalDuration > 0 ? virtualTimelineWidth / totalDuration : 0,
      canScrollRight: scrollPosition < maxScroll,
      scrollPercentage: maxScroll > 0 ? (scrollPosition / maxScroll * 100).toFixed(1) + '%' : '0%'
    });
    
    // Set canvas to actual viewport size
    canvas.setDimensions({
      width: canvasWidth,
      height: canvasHeight,
    });
    
    // NO viewport transform - identity matrix only
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

    // Clear and redraw - Zustand state drives the render
    canvas.clear();
    canvas.backgroundColor = '#1a1a1a';

      // Draw clips FIRST (so tick marks can be on top later)
      if (clips.length > 0 && totalDuration > 0) {
      let currentTime = 0;

      clips.forEach((clip) => {
        const clipDuration = clip.trimEnd > 0 ? clip.trimEnd - clip.trimStart : clip.duration - clip.trimStart;
        const clipWidth = (clipDuration / totalDuration) * virtualTimelineWidth; // Use virtual width
        const clipXVirtual = (currentTime / totalDuration) * virtualTimelineWidth; // Position in virtual timeline
        const clipX = clipXVirtual - clampedScrollPosition; // Offset by clamped scroll position
        
        // Always render clips for interaction, but only show visually if in viewport
        const isVisible = !(clipX + clipWidth < -100 || clipX > canvasWidth + 100);
        
        console.log('Rendering clip:', {
          clipName: clip.name,
          clipDuration,
          clipWidth,
          clipXVirtual,
          clipX,
          clipY,
          clampedScrollPosition
        });

        // Main clip rectangle - using CLIP_HEIGHT constant
        const clipRect = new fabric.Rect({
          left: clipX,
          top: clipY,
          width: clipWidth,
          height: isVisible ? CLIP_HEIGHT : 1, // Tiny height when outside viewport
          fill: selectedClipId === clip.id ? '#60a5fa' : '#3b82f6',
          stroke: selectedClipId === clip.id ? '#3b82f6' : '#2563eb',
          strokeWidth: selectedClipId === clip.id ? 3 : 2,
          selectable: false,
          lockMovementY: true,
          hasControls: false,
          hasBorders: false,
          evented: true,
          clipId: clip.id,
          originalIndex: clips.indexOf(clip),
          scaleX: 1, // Prevent any transforms
          scaleY: 1,
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
          // Left trim handle (ONLY for selected clip) - using constants
          const leftHandle = new fabric.Rect({
            left: trimStartX - TRIM_HANDLE_WIDTH / 2,
            top: clipY - (TRIM_HANDLE_HEIGHT - CLIP_HEIGHT) / 2, // Center the taller handle
            width: TRIM_HANDLE_WIDTH,
            height: TRIM_HANDLE_HEIGHT,
            fill: '#ef4444',
            stroke: '#dc2626',
            strokeWidth: 2,
            selectable: true,
            lockMovementY: true,
            hasControls: false,
            hasBorders: false,
            cursor: 'ew-resize',
            clipId: clip.id,
            isTrimHandle: true,
            handleType: 'left',
            clipStartX: clipXVirtual, // Store virtual position for drag calculations
            clipWidth: clipWidth,
            scaleX: 1, // Prevent any transforms
            scaleY: 1,
          } as any);
          
          canvas.add(leftHandle);

          // Right trim handle (ONLY for selected clip) - using constants
          const rightHandle = new fabric.Rect({
            left: trimEndX - TRIM_HANDLE_WIDTH / 2,
            top: clipY - (TRIM_HANDLE_HEIGHT - CLIP_HEIGHT) / 2, // Center the taller handle
            width: TRIM_HANDLE_WIDTH,
            height: TRIM_HANDLE_HEIGHT,
            fill: '#ef4444',
            stroke: '#dc2626',
            strokeWidth: 2,
            selectable: true,
            lockMovementY: true,
            hasControls: false,
            hasBorders: false,
            cursor: 'ew-resize',
            clipId: clip.id,
            isTrimHandle: true,
            handleType: 'right',
            clipStartX: clipXVirtual, // Store virtual position for drag calculations
            clipWidth: clipWidth,
            scaleX: 1, // Prevent any transforms
            scaleY: 1,
          } as any);
          
          canvas.add(rightHandle);
        }

        // Clip text - STATIC size regardless of zoom
        canvas.add(new fabric.Textbox(clip.name, {
          left: clipX + 8,
          top: clipY + 8,
          width: Math.max(clipWidth - 16, 50), // Ensure minimum width for text
          fontSize: 13,
          fill: '#ffffff',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          selectable: false,
          evented: false,
          clipId: clip.id,
          zoomX: 1, // Keep text at fixed size
          zoomY: 1,
          splitByGrapheme: true, // Better text wrapping
        } as any));

        // Duration text - STATIC size
        canvas.add(new fabric.Text(formatTime(clipDuration), {
          left: clipX + 8,
          top: clipY + 30,
          fontSize: 12,
          fill: '#e5e7eb',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          selectable: false,
          evented: false,
          clipId: clip.id,
          zoomX: 1, // Keep text at fixed size
          zoomY: 1,
        } as any));

        currentTime += clipDuration;
      });

      // Draw time grid ABOVE clips - STATIC markers at top of canvas, using TIME_GRID_HEIGHT constant
      let timeInterval = DEFAULT_TIME_INTERVAL;
      const minSpacing = MIN_TIME_MARKER_SPACING;
      const pixelsPerSecond = virtualTimelineWidth / totalDuration;
      
      // Adjust time interval based on zoom to keep markers readable
      if (timeInterval * pixelsPerSecond < minSpacing) {
        timeInterval = Math.ceil(minSpacing / pixelsPerSecond / 5) * 5;
      }

      console.log('Drawing timeline:', { virtualTimelineWidth, totalDuration, pixelsPerSecond, timeInterval, clampedScrollPosition });

      for (let time = 0; time <= totalDuration; time += timeInterval) {
        const xVirtual = (time / totalDuration) * virtualTimelineWidth;
        const x = xVirtual - clampedScrollPosition; // Offset by clamped scroll position
        
        // Only render if visible in viewport (with buffer)
        if (x < -100 || x > canvasWidth + 100) continue;

        // Draw tick mark line (only in the time grid area) - using TIME_GRID_HEIGHT constant
        canvas.add(new fabric.Line([x, 0, x, TIME_GRID_HEIGHT], {
          stroke: '#333',
          strokeWidth: 1,
          selectable: false,
          evented: false,
          scaleX: 1, // Prevent any transforms
          scaleY: 1,
        } as any));

        // Draw time label
        canvas.add(new fabric.Text(formatTime(time), {
          left: x + 4,
          top: 10,
          fontSize: 12,
          fill: '#666',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          selectable: false,
          evented: false,
          scaleX: 1, // Prevent any transforms
          scaleY: 1,
        } as any));
      }

      // Draw playhead - FIXED size, positioned based on virtual timeline with scroll offset
      if (totalDuration > 0) {
        const xVirtual = (playhead / totalDuration) * virtualTimelineWidth;
        const x = xVirtual - clampedScrollPosition; // Offset by clamped scroll position

        // Create and store playhead objects for efficient updates
        // Playhead line with FIXED height
        const line = new fabric.Line([x, 0, x, PLAYHEAD_LINE_HEIGHT], {
          stroke: '#ef4444',
          strokeWidth: 2,
          selectable: false,
          evented: false,
          playhead: true,
          scaleX: 1, // Prevent any transforms
          scaleY: 1,
        } as any);
        playheadLineRef.current = line;
        canvas.add(line);

        // Playhead triangle with FIXED size
        const triangle = new fabric.Triangle({
          left: x - PLAYHEAD_TRIANGLE_SIZE / 2,
          top: 0,
          width: PLAYHEAD_TRIANGLE_SIZE,
          height: PLAYHEAD_TRIANGLE_SIZE,
          fill: '#ef4444',
          selectable: false,
          evented: false,
          playhead: true,
          scaleX: 1, // Prevent any transforms
          scaleY: 1,
        } as any);
        playheadTriangleRef.current = triangle;
        canvas.add(triangle);
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
  }, [clips, totalDuration, zoom, selectedClipId, tempTrimStart, tempTrimEnd, scrollPosition]); // Added scrollPosition

  // OPTIMIZED EFFECT: Update ONLY playhead position without full canvas re-render
  useLayoutEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || totalDuration === 0) return;

    // If playhead objects don't exist, find them from the canvas
    if (!playheadLineRef.current || !playheadTriangleRef.current) {
      const objects = canvas.getObjects();
      const playheadLine = objects.find((obj: any) => obj.playhead === true && obj.type === 'line') as fabric.Line;
      const playheadTriangle = objects.find((obj: any) => obj.playhead === true && obj.type === 'triangle') as fabric.Triangle;
      
      if (playheadLine && playheadTriangle) {
        playheadLineRef.current = playheadLine;
        playheadTriangleRef.current = playheadTriangle;
        console.log('Found existing playhead objects');
      } else {
        console.log('Playhead objects not found, skipping update');
        return;
      }
    }

    // Calculate new x position in virtual timeline, then offset by scroll
    const canvasWidth = window.innerWidth - MEDIA_LIBRARY_WIDTH;
    const virtualTimelineWidth = canvasWidth * zoom;
    const maxScroll = Math.max(0, virtualTimelineWidth - canvasWidth);
    const clampedScrollPosition = Math.max(0, Math.min(scrollPosition, maxScroll));
    
    const xVirtual = (playhead / totalDuration) * virtualTimelineWidth;
    const x = xVirtual - clampedScrollPosition; // Offset by clamped scroll position

    console.log('Updating playhead position:', {
      playhead,
      xVirtual,
      x,
      clampedScrollPosition,
      virtualTimelineWidth,
      canvasWidth
    });

    // Update line position with FIXED height (set new coordinates)
    playheadLineRef.current.set({
      x1: x,
      y1: 0,
      x2: x,
      y2: PLAYHEAD_LINE_HEIGHT, // Use constant instead of canvas.height
    });

    // Update triangle position with FIXED size
    playheadTriangleRef.current.set({
      left: x - PLAYHEAD_TRIANGLE_SIZE / 2,
    });

    // Only render the playhead objects, not the entire canvas
    playheadLineRef.current.setCoords();
    playheadTriangleRef.current.setCoords();
    canvas.requestRenderAll();
    
    // Auto-scroll to keep playhead in view ONLY when video is playing
    // Don't auto-scroll during manual timeline interaction
    const videoElement = document.querySelector('video');
    const isVideoPlaying = videoElement && !videoElement.paused;
    
    if (isVideoPlaying) {
      if (xVirtual < clampedScrollPosition + 50) {
        setScrollPosition(Math.max(0, xVirtual - canvasWidth / 4));
      } else if (xVirtual > clampedScrollPosition + canvasWidth - 50) {
        setScrollPosition(Math.min(maxScroll, xVirtual - (canvasWidth * 3 / 4)));
      }
    }
  }, [playhead, totalDuration, zoom, scrollPosition]); // Include scrollPosition


  return (
    <div className="h-full flex flex-col w-full relative">
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-1 flex items-center justify-between w-full absolute top-0 z-10" style={{ width: 'calc(100vw - 24rem)', left: '0' }}>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-400">
            Duration: {formatTime(totalDuration)}
          </span>
          <span className="text-sm text-gray-400">
            Clips: {clips.length}
          </span>
          <span className="text-sm text-gray-400">
            Playhead: {formatPlayheadTime(playhead)}
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

      <div className="flex-1 relative overflow-hidden w-full flex flex-col items-center justify-center" style={{ width: 'calc(100vw - 24rem)', left: '0', paddingTop: '36px' }}>
        <canvas 
          ref={canvasRef} 
          className="w-full cursor-pointer flex-1" 
          style={{ width: '100%', height: '100%' }}
        />
        
        {/* Horizontal Scrollbar - always visible when zoomed, fixed height */}
        {zoom > 1 && totalDuration > 0 && (() => {
          const canvasWidth = window.innerWidth - MEDIA_LIBRARY_WIDTH;
          const virtualTimelineWidth = canvasWidth * zoom;
          const maxScroll = Math.max(0, virtualTimelineWidth - canvasWidth);
          
          // Clamp scrollPosition to valid range for display
          const displayScrollPosition = Math.max(0, Math.min(scrollPosition, maxScroll));
          
          // Calculate scrollbar position and width
          const scrollbarThumbWidth = Math.max(20, (canvasWidth / virtualTimelineWidth) * 100); // Increased minimum width
          const maxThumbPosition = 100 - scrollbarThumbWidth;
          const scrollbarThumbPosition = maxScroll > 0 
            ? (displayScrollPosition / maxScroll) * maxThumbPosition
            : 0;
          
          // Ensure thumb is always visible and clickable
          const finalThumbWidth = Math.max(20, scrollbarThumbWidth);
          const finalThumbPosition = Math.max(0, Math.min(100 - finalThumbWidth, scrollbarThumbPosition));
          
          console.log('Scrollbar calculations:', {
            canvasWidth,
            virtualTimelineWidth,
            maxScroll,
            displayScrollPosition,
            scrollbarThumbWidth,
            maxThumbPosition,
            scrollbarThumbPosition,
            finalThumbWidth,
            finalThumbPosition,
            zoom,
            totalDuration,
            isScrollable: maxScroll > 0,
            thumbVisible: finalThumbWidth > 0 && finalThumbPosition >= 0
          });
          
          return (
            <div 
              className="w-full bg-gray-800 border-t border-gray-700 flex items-center px-2" 
              style={{ height: `${SCROLLBAR_HEIGHT}px` }}
            >
              <div 
                className="flex-1 h-2 bg-gray-700 rounded-full relative border border-gray-600 cursor-pointer"
                onClick={(e) => {
                  // Don't handle track clicks if we're dragging the thumb
                  if (isDraggingScrollbar) return;
                  
                  // Handle clicking on the scrollbar track to jump to that position
                  const trackRect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - trackRect.left;
                  const trackWidth = e.currentTarget.clientWidth;
                  const clickRatio = Math.max(0, Math.min(1, clickX / trackWidth));
                  
                  const currentCanvasWidth = window.innerWidth - MEDIA_LIBRARY_WIDTH;
                  const currentVirtualTimelineWidth = currentCanvasWidth * zoom;
                  const currentMaxScroll = Math.max(0, currentVirtualTimelineWidth - currentCanvasWidth);
                  const newScroll = Math.round(clickRatio * currentMaxScroll);
                  
                  setScrollPosition(newScroll);
                }}
              >
                <div 
                  className="absolute h-full bg-blue-500 rounded-full cursor-pointer hover:bg-blue-400 transition-all duration-150 ease-out"
                  style={{
                    left: `${finalThumbPosition}%`,
                    width: `${finalThumbWidth}%`,
                    minWidth: '20px', // Ensure minimum clickable width
                    minHeight: '8px', // Ensure minimum clickable height
                    transform: isDraggingScrollbar ? 'scaleY(1.2)' : 'scaleY(1)',
                    boxShadow: isDraggingScrollbar ? '0 2px 8px rgba(59, 130, 246, 0.4)' : 'none',
                    zIndex: 10, // Ensure it's above other elements
                    pointerEvents: 'auto' // Ensure it can receive mouse events
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingScrollbar(true);
                    
                    // Store initial state - this is the standard scrollbar UX pattern
                    const startMouseX = e.clientX;
                    const startScroll = scrollPosition;
                    const scrollbarTrackEl = e.currentTarget.parentElement!;
                    const scrollbarTrackWidth = scrollbarTrackEl.clientWidth;
                    
                    // Calculate maxScroll once at the start
                    const currentCanvasWidth = window.innerWidth - MEDIA_LIBRARY_WIDTH;
                    const currentVirtualTimelineWidth = currentCanvasWidth * zoom;
                    const currentMaxScroll = Math.max(0, currentVirtualTimelineWidth - currentCanvasWidth);
                    
                    // Calculate thumb width percentage to determine available scrollable area
                    const thumbWidthPercent = Math.max(20, (currentCanvasWidth / currentVirtualTimelineWidth) * 100);
                    const maxThumbPositionPercent = 100 - thumbWidthPercent;
                    
                    // The thumb can only move within maxThumbPositionPercent of the track
                    const scrollableTrackWidth = (maxThumbPositionPercent / 100) * scrollbarTrackWidth;
                    
                    console.log('🎯 Scrollbar thumb drag started', { 
                      startMouseX, 
                      startScroll, 
                      currentMaxScroll,
                      scrollbarTrackWidth,
                      thumbWidthPercent,
                      maxThumbPositionPercent,
                      scrollableTrackWidth,
                      currentVirtualTimelineWidth,
                      currentCanvasWidth,
                      totalDuration,
                      canScrollToEnd: currentMaxScroll > 0
                    });
                    
                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      // Calculate how far the mouse has moved (delta-based approach)
                      const mouseDelta = moveEvent.clientX - startMouseX;
                      
                      // Convert mouse delta to scroll delta
                      // The ratio is: maxScroll / scrollable area of track (not full track width)
                      const scrollableRatio = currentMaxScroll / scrollableTrackWidth;
                      const scrollDelta = mouseDelta * scrollableRatio;
                      
                      // Calculate new scroll position based on where we started + how far we've moved
                      const newScroll = startScroll + scrollDelta;
                      
                      // Clamp to valid range
                      const clampedScroll = Math.max(0, Math.min(currentMaxScroll, newScroll));
                      
                      console.log('🔄 Scrollbar drag move', { 
                        mouseDelta,
                        scrollDelta,
                        newScroll,
                        clampedScroll,
                        startScroll,
                        currentMaxScroll,
                        scrollableRatio
                      });
                      
                      setScrollPosition(clampedScroll);
                    };
                    
                    const handleMouseUp = () => {
                      console.log('🛑 Scrollbar thumb drag ended');
                      setIsDraggingScrollbar(false);
                      window.removeEventListener('mousemove', handleMouseMove);
                      window.removeEventListener('mouseup', handleMouseUp);
                    };
                    
                    window.addEventListener('mousemove', handleMouseMove);
                    window.addEventListener('mouseup', handleMouseUp);
                  }}
                />
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default Timeline;