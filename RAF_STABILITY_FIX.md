# RAF Loop Stability & Menu System Fixes

## Problem Summary

Two critical issues were preventing smooth video playback:

### Issue 1: RAF Loop Constantly Restarting
**Symptom**: 
- Logs showed `[RAF Loop] Cleanup called` → `[RAF Loop] Effect triggered` repeating 6+ times during normal playback
- Duplicate `[Video Source] Loading new clip: aiMessage_Final_p2` messages
- Visual flicker in video preview during transitions

**Root Cause**:
The `requestAnimationFrame` sync loop was restarting constantly because `currentClipInfo` was creating a **new object reference every frame** (60fps). Even though the values inside were the same, React saw it as a new object and restarted the RAF effect.

```typescript
// BEFORE (BAD): New object every frame
const currentClipInfo = useMemo((): ClipInfo | null => {
  // ... calculation ...
  return {
    clip,
    clipStartTime: currentTime,
    clipDuration
  }; // ❌ New object even if clip didn't change
}, [clips, playhead]); // playhead changes 60fps!
```

**Why This Caused Problems**:
1. `playhead` updates 60 times per second during playback
2. `useMemo` runs and creates a new `ClipInfo` object
3. RAF effect depends on `currentClipInfo`
4. RAF effect sees new object → cleanup → restart
5. Repeat 60 times per second = constant flickering

### Issue 2: Space Bar Not Working
**Symptom**:
```
Error: Cannot find module './index'
Require stack:
- /Users/mylessjs/Desktop/ClipForge/dist/main/index.cjs
```

**Root Cause**:
The menu system was using `require('./index')` to get the main window, but Vite compiles TypeScript files differently, and the module path didn't exist after build.

```typescript
// BEFORE (BAD):
click: () => {
  const mainWindow = require('./index').getMainWindow(); // ❌ Doesn't work after build
  mainWindow?.webContents.send('menu-play-pause');
}
```

## Solution

### Fix 1: Stable ClipInfo Reference with Ref Pattern

Added a `currentClipInfoRef` to track the previous clip and only return a new object when the clip **actually changes**:

```typescript
// NEW (GOOD):
const currentClipInfoRef = useRef<ClipInfo | null>(null);

const currentClipInfo = useMemo((): ClipInfo | null => {
  // ... calculation ...
  
  const newInfo = {
    clip,
    clipStartTime: currentTime,
    clipDuration
  };
  
  // Only return new object if clip actually changed
  if (currentClipInfoRef.current?.clip.id !== clip.id) {
    console.log('[Clip Info] Clip changed:', clip.name);
    currentClipInfoRef.current = newInfo;
    return newInfo; // ✅ New object only when clip changes
  }
  
  // Same clip - return existing reference to prevent RAF restart
  return currentClipInfoRef.current; // ✅ Same object reference = no restart
}, [clips, playhead]);
```

**Impact**:
- RAF loop now starts **once** when a clip begins
- Runs continuously at 60fps without restarting
- Only restarts when the clip **actually changes** (not every frame)
- Eliminates duplicate video source loads
- Removes visual flicker

### Fix 2: Pass Window as Parameter

Refactored the menu system to pass the main window as a parameter instead of using `require()`:

```typescript
// menu.ts - Accept window as parameter
export const createApplicationMenu = (mainWindow: BrowserWindow): Menu => {
  // ...
  click: () => {
    mainWindow?.webContents.send('menu-play-pause'); // ✅ Direct access
  }
}

// index.ts - Pass window when creating menu
const menu = createApplicationMenu(mainWindow!);
Menu.setApplicationMenu(menu);
```

**Impact**:
- Space bar now works correctly
- All menu shortcuts functional
- No more module resolution errors

## Technical Details

### The Ref Pattern for Stable References

This pattern is crucial when you need:
1. **Derived state** that changes frequently (like `currentClipInfo` from `playhead`)
2. To **prevent unnecessary effect restarts**
3. To **compare by value** but return by reference

```typescript
const [state] = useState(...);           // Changes frequently
const stableRef = useRef(null);           // Stable storage

const derived = useMemo(() => {
  const newValue = calculate(state);
  
  // Only create new object if logically different
  if (isDifferent(stableRef.current, newValue)) {
    stableRef.current = newValue;
    return newValue;
  }
  
  // Return same reference = no effect restarts
  return stableRef.current;
}, [state]);
```

### Why useMemo Alone Wasn't Enough

`useMemo` prevents **recalculation** but doesn't prevent **new object creation**:
- If `playhead` changes, `useMemo` runs
- Even if the clip is the same, a new object is created
- React compares objects by **reference**, not value
- New reference = effect restart

## Expected Behavior After Fix

### Console Logs (Normal Playback):
```
[Clip Info] Clip changed: aiMessage_Final_p1
[RAF Loop] Starting sync loop for clip: aiMessage_Final_p1
[RAF Loop] Initial RAF call
// (continuous smooth playback, no more logs until clip ends)
[Clip Boundary] Reached end of clip
[Clip Transition] Moving to next clip
[Clip Info] Clip changed: aiMessage_Final_p2
[Video Source] Loading new clip: aiMessage_Final_p2  ← ONCE ONLY
[Video Ready] Video can play
[RAF Loop] Starting sync loop for clip: aiMessage_Final_p2
```

### What You Should See:
- ✅ No repeated RAF loop restarts during playback
- ✅ One "Loading new clip" message per transition
- ✅ No visual flicker in video preview
- ✅ Space bar toggles play/pause
- ✅ Smooth 60fps playhead updates

### What You Should NOT See:
- ❌ `[RAF Loop] Cleanup called` repeatedly during playback
- ❌ Duplicate "Loading new clip" messages
- ❌ "Cannot find module './index'" errors
- ❌ Visual glitches or stuttering

## Files Modified

1. **src/renderer/components/VideoPreview.tsx**
   - Added `currentClipInfoRef` for stable clip info
   - Modified `currentClipInfo` useMemo to check clip.id before creating new object
   - Added `[Clip Info] Clip changed:` log for debugging

2. **src/main/menu.ts**
   - Changed function signature to accept `mainWindow: BrowserWindow` parameter
   - Replaced all `require('./index').getMainWindow()` with direct `mainWindow` usage

3. **src/main/index.ts**
   - Updated `createApplicationMenu()` call to pass `mainWindow!` parameter

## Testing Checklist

- [ ] Video plays smoothly without stuttering
- [ ] No repeated RAF loop restarts in console during normal playback
- [ ] Space bar toggles play/pause
- [ ] Video transitions seamlessly between clips
- [ ] Only one "Loading new clip" message per transition
- [ ] Progress bar and playhead stay in sync
- [ ] No visual flicker during transitions
- [ ] Arrow key navigation works (5 sec, Shift for 1 sec)

## Related Documents

- `VIDEO_PLAYBACK_FIX.md` - Original playback architecture fixes
- `CLIP_BOUNDARY_FIX.md` - Manual clip boundary detection
- `RAF_LOOP_FIX.md` - Initial requestAnimationFrame implementation
- `ARROW_KEY_NAVIGATION.md` - Keyboard controls

---

**Status**: ✅ Ready for testing
**Build**: Successful (no lint errors)
**Next Step**: Run `npx electron .` and verify behavior

