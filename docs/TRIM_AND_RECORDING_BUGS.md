# Trim and Recording Bugs - Analysis and Fixes Needed

## Date: October 29, 2025

## Issues Identified

### 1. Trim Lines / Trim Handles ✅ PARTIALLY RESOLVED
**Status:** Understanding Complete, Visual Improvement Needed

**Current State:**
- Trim handles ARE working and ARE visible (red rectangles on timeline)
- The red rectangles shown in the timeline image are the actual trim handles
- They render at lines 924-970 in Timeline.tsx as `fabric.Rect` objects
- They move correctly with trimming operations

**Issue:**
- User wants them to look more like brackets `[` and `]` instead of solid rectangles
- Current: 12px wide x 70px tall solid red rectangles
- Desired: Sleek bracket-like design with clear vertical line showing exact trim position

**Solution Needed:**
- Modify the trim handle rendering (lines 924-970) to use a bracket design
- Keep existing drag functionality (DO NOT MODIFY DRAG LOGIC)
- Consider using Path or Group objects instead of Rect to create bracket shapes
- Reduce width from 12px to ~3-4px for the vertical line
- Add small horizontal caps at top/bottom to create bracket effect

---

### 2. Video Playback from Trim Start ❌ NOT WORKING
**Status:** Broken

**Current State:**
- User cannot play video when playhead is positioned exactly at trim start
- Playback works fine between trim start and trim end
- Playback works fine before trim start

**Root Cause:**
- Trim boundary logic in VideoPreview.tsx (lines 393-440) is too restrictive
- Logic checks if `video.currentTime >= effectiveTrimStart - BOUNDARY_TOLERANCE`
- When starting AT trim start, this condition triggers immediately and pauses

**Solution Needed:**
```typescript
// Current problematic logic (lines 401-415):
if (video.currentTime >= effectiveTrimStart - BOUNDARY_TOLERANCE && 
    video.currentTime < effectiveTrimStart + BOUNDARY_TOLERANCE &&
    !video.paused) {
  video.pause();
  // ...
}

// Fix: Only pause when CROSSING into trim start from before
// Need to track previous playhead position or playback direction
// Only pause if: was_before_trim_start && now_at_trim_start && playing_forward
```

---

### 3. Video Playback After Trim End ❌ NOT WORKING
**Status:** Broken

**Current State:**
- User cannot play video when playhead is positioned after trim end
- Clicking play does nothing

**Root Cause:**
- Similar to issue #2 - boundary logic is preventing playback initiation
- The condition `video.currentTime >= effectiveTrimEnd - BOUNDARY_TOLERANCE` triggers immediately

**Solution Needed:**
- Only auto-pause when video is PLAYING and REACHES trim end
- Do not prevent starting playback from a position after trim end
- Need to distinguish between "starting playback at position X" vs "playing and reaching position X"

---

### 4. Recording Resolution/Framerate Dropdowns ⚠️ MINOR UI ISSUE
**Status:** Minor annoyance, functionally working

**Current State:**
- Default values ARE set (1920x1080, 30fps in recordingStore.ts lines 51-52)
- Values don't display until user clicks the dropdown
- After clicking, correct values show

**Root Cause:**
- Browser select rendering timing issue
- Values are bound correctly but not displaying initially

**Solution:**
- This is a very minor cosmetic issue
- Can be fixed with CSS or by forcing a re-render
- Low priority compared to other bugs

---

### 5. Recording Timer Not Updating ✅ FIXED
**Status:** Fixed

**Fix Applied:**
- Modified `setRecordingTime` in recordingStore.ts to accept function updater
- Now properly increments: `setRecordingTime(prev => prev + 1)`

---

### 6. No Visual Indication of What's Being Recorded ❌ CRITICAL
**Status:** Broken

**Current State:**
- When recording starts, user has no visual feedback
- Cannot see what screen/window is actually being recorded
- No live preview during recording

**Required Features:**
1. **Live Preview Stream:**
   - Show the `mediaStream` in a video element during recording
   - Display in the RecordingPanel modal
   - Show recording indicator (red dot, timer overlay)

2. **Selected Source Highlight:**
   - When a source is selected, make it visually obvious
   - Consider adding a colored border or glow effect
   - Current: Only `border-blue-500` when selected (not obvious enough)

**Solution:**
```typescript
// In RecordingPanel.tsx, add:
{isRecording && stream && (
  <div className="mb-6">
    <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center">
      <span className="w-3 h-3 bg-red-600 rounded-full animate-pulse mr-2"></span>
      Recording...
    </h3>
    <video
      ref={previewVideoRef}
      autoPlay
      muted
      className="w-full max-w-md mx-auto border-4 border-red-500"
    />
  </div>
)}

useEffect(() => {
  if (stream && previewVideoRef.current) {
    previewVideoRef.current.srcObject = stream;
  }
}, [stream]);
```

---

### 7. Recordings Not Saving ❌ CRITICAL
**Status:** Broken

**Current State:**
- User clicks "Stop" button
- Recording blob is created
- "Recording Complete" section shows
- Video preview shows (but appears black - no data)
- Clicking "Save Recording" triggers download but file is empty/corrupt

**Root Cause Analysis:**

**Problem 1: Blob Creation Timing**
```typescript
// RecordingPanel.tsx line 117-121
recorder.onstop = () => {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  setRecordingBlob(blob);
  setChunks(recordedChunks);
};
```
- `recordedChunks` is a local variable inside `startRecording`
- It may not have all data when `onstop` fires
- Should use state `chunks` or ensure all data is collected

**Problem 2: Missing IPC for Saving**
- Current code uses browser download (lines 185-216)
- Should use Electron IPC to save to filesystem properly
- Need `window.electronAPI.saveRecording()` method

**Solution Needed:**
1. Fix blob data collection
2. Add proper IPC handler for saving recordings
3. Optionally: Auto-import saved recordings to media library

---

## Priority Order

1. **CRITICAL:** Fix recordings not saving (#7)
2. **CRITICAL:** Show what's being recorded (#6)
3. **HIGH:** Fix playback from trim start (#2)
4. **HIGH:** Fix playback after trim end (#3)
5. **MEDIUM:** Improve trim handle visual design (#1)
6. **LOW:** Fix resolution/framerate dropdown display (#4)

---

## Implementation Plan

### Phase 1: Fix Recording System (1-2 hours)
1. Add live preview video element
2. Fix blob data collection
3. Add IPC handler for saving recordings
4. Test full recording workflow

### Phase 2: Fix Playback Issues (30 minutes)
1. Modify trim boundary logic to track playback direction
2. Only pause when crossing boundaries, not when starting at them
3. Test all playback scenarios

### Phase 3: Visual Improvements (30 minutes)
1. Redesign trim handles as brackets
2. Improve selected source highlighting
3. Minor UI polish

---

## Testing Checklist

### Recording Tests
- [ ] Start recording - see live preview immediately
- [ ] Recording timer updates every second
- [ ] Pause recording - timer stops, preview freezes
- [ ] Resume recording - timer resumes, preview continues
- [ ] Stop recording - video preview loads correctly with actual content
- [ ] Save recording - file saves to disk and is playable
- [ ] Saved recording can be imported to media library

### Playback Tests
- [ ] Play video from before trim start - plays until trim start, pauses
- [ ] Play video from exactly at trim start - plays forward
- [ ] Play video from between trim boundaries - plays until trim end, pauses
- [ ] Play video from exactly at trim end - can resume playback
- [ ] Play video from after trim end - plays normally
- [ ] Manual pause/unpause works at any position

### Visual Tests
- [ ] Trim handles look like brackets `[` `]`
- [ ] Trim handles clearly show exact trim position
- [ ] Selected recording source is obviously highlighted
- [ ] Recording indicator (red dot) is visible during recording

