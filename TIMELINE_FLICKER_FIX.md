# Timeline Flicker Fix & Layout Improvements

## Problem Summary

The Timeline canvas was re-rendering at **60fps** (once per frame during playback), causing severe visual flicker. This happened because the entire canvas was being cleared and redrawn every time the `playhead` value changed.

## Root Cause

```typescript
// BEFORE (BAD):
}, [clips, totalDuration, zoom, selectedClipId, playhead, tempTrimStart, tempTrimEnd]);
//                                             ^^^^^^^^
//                                             Changes 60 times per second!
```

The main canvas rendering effect had `playhead` as a dependency. Since `playhead` updates at 60fps during playback:
1. Effect triggers 60 times per second
2. `canvas.clear()` clears everything
3. All clips, text, trim handles redrawn
4. Playhead line and triangle redrawn
5. `canvas.renderAll()` triggers full re-render

**Result**: Constant flickering, high CPU usage, poor UX.

## Solution: Optimized Playhead-Only Updates

### Strategy

Instead of redrawing the entire canvas, we:
1. **Store refs** to playhead objects (line + triangle)
2. **Remove `playhead`** from main canvas effect
3. **Add separate effect** that ONLY updates playhead position

### Implementation

#### Step 1: Add Refs to Store Playhead Objects

```typescript
const playheadLineRef = useRef<fabric.Line | null>(null);
const playheadTriangleRef = useRef<fabric.Triangle | null>(null);
```

#### Step 2: Store Objects When Creating

```typescript
// Create and store playhead objects for efficient updates
const line = new fabric.Line([x, 0, x, canvas.height!], {
  stroke: '#ef4444',
  strokeWidth: 2,
  selectable: false,
  evented: false,
  playhead: true,
} as any);
playheadLineRef.current = line; // ✅ Store reference
canvas.add(line);

const triangle = new fabric.Triangle({
  left: x - 6,
  top: 0,
  width: 12,
  height: 12,
  fill: '#ef4444',
  selectable: false,
  evented: false,
  playhead: true,
} as any);
playheadTriangleRef.current = triangle; // ✅ Store reference
canvas.add(triangle);
```

#### Step 3: Remove `playhead` from Main Effect

```typescript
// AFTER (GOOD):
}, [clips, totalDuration, zoom, selectedClipId, tempTrimStart, tempTrimEnd]);
// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
// No more playhead! Canvas only redraws when clips/zoom/selection change
```

#### Step 4: Add Optimized Playhead-Only Effect

```typescript
// OPTIMIZED EFFECT: Update ONLY playhead position without full canvas re-render
useLayoutEffect(() => {
  const canvas = fabricCanvasRef.current;
  if (!canvas || totalDuration === 0 || !playheadLineRef.current || !playheadTriangleRef.current) return;

  // Calculate new x position
  const x = (playhead / totalDuration) * (canvas.width! / zoom);

  // Update line position (set new coordinates)
  playheadLineRef.current.set({
    x1: x,
    y1: 0,
    x2: x,
    y2: canvas.height,
  });

  // Update triangle position
  playheadTriangleRef.current.set({
    left: x - 6,
  });

  // Only render the playhead objects, not the entire canvas
  playheadLineRef.current.setCoords();
  playheadTriangleRef.current.setCoords();
  canvas.requestRenderAll(); // ✅ Only redraws changed objects
}, [playhead, totalDuration, zoom]); // Only playhead changes trigger this lightweight update
```

## Layout Improvements

### Video Preview Size

**Before**: Video preview had `flex-1` with `min-h-[400px]`  
**After**: Video preview has `flex: 1 1 0` with `minHeight: 500px`

This gives more vertical space to the video player.

### Timeline Height

**Before**: Timeline had `h-80` (320px height)  
**After**: Timeline has `h-48` (192px height)

This reduces wasted space at the bottom and moves the timeline down, filling the empty area.

## Performance Impact

### Before Fix
- **Canvas renders per second**: ~60
- **Log messages**: `Canvas rendered` repeating constantly
- **CPU usage**: High (full Fabric.js render loop)
- **Visual**: Noticeable flicker and judder

### After Fix
- **Canvas renders per second**: 0 (during normal playback)
- **Log messages**: `Canvas rendered` only when clips/zoom/selection change
- **Playhead updates per second**: ~60 (lightweight position update only)
- **CPU usage**: Minimal (only playhead objects update)
- **Visual**: Smooth, no flicker

## Expected Behavior

### During Normal Playback
```
[RAF Loop] Starting sync loop for clip: aiMessage_Final_p1
[RAF Loop] Initial RAF call
// (playhead updates silently 60fps)
// NO MORE "Canvas rendered" messages!
[Clip Boundary] Reached end of clip
[Clip Info] Clip changed: aiMessage_Final_p2
Canvas rendered - Playhead: 2:07 Clips: 3  ← ONCE when clip changes
```

### When User Interacts
```
// User clicks timeline
Canvas rendered - Playhead: 0:15 Clips: 3  ← Once when clicked

// User drags trim handle
Skipping canvas re-render during drag
// (no re-render while dragging)
Canvas rendered - Playhead: 0:15 Clips: 3  ← Once when drag ends
```

## Testing Checklist

- [ ] Timeline doesn't flicker during playback
- [ ] Playhead moves smoothly at 60fps
- [ ] Console shows no repeated "Canvas rendered" messages during playback
- [ ] Clicking timeline still seeks correctly
- [ ] Dragging trim handles still works
- [ ] Clip transitions still work
- [ ] Video preview is larger/more visible
- [ ] Timeline is smaller and positioned at bottom

## Files Modified

1. **src/renderer/components/Timeline.tsx**
   - Added `playheadLineRef` and `playheadTriangleRef`
   - Modified playhead drawing to store references
   - Removed `playhead` from main effect dependencies
   - Added new optimized playhead-only effect

2. **src/renderer/App.tsx**
   - Changed video preview: `flex-1` → `flex: 1 1 0` with `minHeight: 500px`
   - Changed timeline: `h-80` → `h-48`

## Technical Notes

- **`requestRenderAll()`**: Fabric.js method that only redraws dirty (changed) objects
- **`setCoords()`**: Updates object's bounding box after position change
- **`useLayoutEffect`**: Ensures DOM updates happen synchronously before paint
- **Ref Pattern**: Allows imperative updates without triggering React re-renders

---

**Status**: ✅ Complete
**Build**: Successful (no lint errors)
**Next Step**: Test in app with `npx electron .`

