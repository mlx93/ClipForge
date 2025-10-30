# Post-PRD1 Middle Fixes (Phase 1.75)
## Critical Trim & Playback Issues (Pre-Phase 2)

**Version:** 1.0  
**Last Updated:** October 29, 2025  
**Priority:** CRITICAL - Must fix before Phase 2/3 polish  
**Status:** Discovery Complete - Ready for Implementation

---

## 🚨 Executive Summary

During MVP demo recording, **5 critical trim and playback issues** were discovered that break core functionality. These must be fixed before proceeding with Phase 2/3 polish items.

**Impact:** These issues prevent the trim feature (core MVP requirement) from working correctly.

**Root Causes Identified:**
1. ✅ `totalDuration` not recalculated after trim (state update issue)
2. ✅ Video keeps playing beyond trim (clip boundary detection failure)
3. ✅ Playhead not adjusted after trim (causes spacebar jump)
4. ❌ No trim handle pause/seek behavior (UX feature missing)
5. ❌ No precision snapping for trim handles (UX feature missing)

---

## 📋 Issues Overview

| # | Issue | Severity | Root Cause | Fix Complexity |
|---|-------|----------|------------|----------------|
| 0 | Video player timestamp/progress frozen during playback | 🔴 **CRITICAL** | Throttled playhead not updating from RAF loop | Low |
| 1 | Timestamp not updating after trim | 🔴 Critical | `updateClip` doesn't recalc `totalDuration` | Low |
| 2 | Video time display frozen | 🔴 Critical | Same as #1 | Low |
| 3 | Ghost playback beyond trim | 🔴 Critical | RAF loop doesn't respect new clip duration | Medium |
| 4 | Spacebar causes playhead jump | 🟡 High | Playhead not adjusted after trim | Low |
| 5 | No pause at trim borders | 🟡 High | Feature not implemented | Medium |
| 8 | Trim precision too coarse | 🟡 Medium | No snapping logic | Low |

**Issues #6 & #7 (Audio/Overlays):** Deferred to PRD-2 (confirmed by user)

---

## 🔍 Detailed Root Cause Analysis

### Issue #0: Video Player Timestamp/Progress Bar Frozen During Playback 🔴 CRITICAL

**What's Happening:**
- User presses play → Video plays, timeline playhead moves
- BUT video player footer controls remain frozen
- Timestamp stays at "0:08 / 4:34" even though playhead moves to 0:28
- Blue progress bar scrubber doesn't move
- Timeline playhead updates smoothly (this IS working)
- Only when user pauses does the timestamp/progress bar "jump" to catch up

**User Impact:**
- **SEVERE UX PROBLEM**: Users cannot see current playback time while video is playing
- Appears like the video player is broken or unresponsive
- No visual feedback on progress through the video
- Breaks fundamental expectation of video player behavior

**Root Cause Analysis:**
- Location: `src/renderer/components/VideoPreview.tsx` (lines 22-30, 379-386, 512)
- **The Problem**: Throttled playhead display system is broken

**Current Implementation:**
1. RAF loop in VideoPreview updates timeline store's `playhead` at 60fps
2. Component subscribes to timeline `playhead` via `useTimelineStore()` 
3. Throttle effect (lines 379-386) updates local `displayPlayhead` state every 67ms (~15fps)
4. `displayPlayhead` passed to VideoControls component for UI display
5. VideoControls is wrapped in `React.memo` to prevent unnecessary re-renders

**Why It's Broken:**
- **Theory 1**: Throttle effect interval never starts during playback
  - Effect has `[playhead]` dependency
  - But playhead changes at 60fps, effect might not be setting up interval correctly
  - setInterval might be getting cleared before it fires
- **Theory 2**: VideoControls memo comparison failing
  - VideoControls checks if props changed before re-rendering
  - If `displayPlayhead` number hasn't changed significantly, memo blocks update
  - Or formatTime function reference changing, breaking memo
- **Theory 3**: State update timing issue
  - RAF loop updates timeline store immediately
  - Throttle effect schedules displayPlayhead update for later
  - React batching or render timing prevents displayPlayhead from propagating to VideoControls
- **Theory 4**: Closure staleness
  - Throttle effect captures stale `playhead` value
  - setInterval callback reads from closure, not fresh state
  - Result: displayPlayhead never updates with new values

**Most Likely Root Cause**: Theory 1 + Theory 4 combined
- setInterval effect depends on `playhead` which changes 60 times per second
- Effect cleanup runs on every playhead change, canceling the interval
- New interval set up, but before 67ms elapses, playhead changes again → cleanup
- Result: interval never actually fires during continuous playback
- displayPlayhead stays frozen at value from last pause

**Fix Logic:**
- **Option A (Recommended)**: Remove throttling entirely
  - VideoControls is already React.memo optimized
  - Pass raw `playhead` directly to VideoControls
  - formatTime is pure function, won't cause excess re-renders
  - React will batch updates efficiently
  - Simpler code, fewer moving parts
  
- **Option B**: Fix throttle effect dependencies
  - Remove `[playhead]` from dependency array
  - Use `useRef` to store current playhead value
  - setInterval reads from ref, not closure
  - Effect only runs once on mount
  - Interval fires reliably every 67ms
  
- **Option C**: Use RAF for display updates
  - Same pattern as timeline playhead updates
  - Create separate RAF loop for display updates
  - Update displayPlayhead in sync with timeline
  - More complex but guaranteed 60fps updates

**Recommendation**: Start with Option A (simplest). If performance issues arise (unlikely), fall back to Option B.

**Files to Change:**
1. `src/renderer/components/VideoPreview.tsx`
   - Remove displayPlayhead state
   - Remove throttle effect (lines 379-386)
   - Pass raw playhead to VideoControls (line 512)
   - OR fix throttle effect dependencies if keeping throttling

**Testing:**
- Import 3 clips, play from start
- ✅ Timestamp should update smoothly (e.g., 0:01, 0:02, 0:03...)
- ✅ Progress bar scrubber should move continuously
- ✅ Both should stay in sync with timeline playhead
- ✅ No "jump" when pausing - already at correct position

---

### Issue #1 & #2: Timestamp/Total Time Not Updating After Trim

**What's Happening:**
- User applies trim → New clip duration is calculated → But `totalDuration` in store is not updated
- Video preview footer shows OLD total time, making it appear frozen

**Root Cause:**
- Location: `src/renderer/store/timelineStore.ts` (lines 66-72)
- The `updateClip` action updates clip data but doesn't recalculate `totalDuration`
- `Timeline.tsx` manually updates `totalDuration` separately (line 196)
- This creates a race condition where `VideoPreview` reads stale state

**Fix Logic:**
- Modify `updateClip` action to recalculate `totalDuration` atomically
- Loop through all clips and sum their durations (considering trim values)
- Remove manual `setState` call in `Timeline.tsx`
- Ensures single source of truth for duration calculation

**Files to Change:**
1. `src/renderer/store/timelineStore.ts` - Add totalDuration recalc to `updateClip`
2. `src/renderer/components/Timeline.tsx` - Remove line 196 manual setState

**Testing:**
- Import 3 clips (total 5 min) → Trim one clip → Footer should immediately show new total

---

### Issue #3: Ghost Playback Beyond Trim

**What's Happening:**
- User applies trim → Clip gets new file and duration
- Video plays correctly until reaching end of trimmed clip
- Then video CONTINUES playing beyond timeline (31s, 32s, 33s...)

**Root Cause:**
- Location: `src/renderer/components/VideoPreview.tsx` (lines 333-356)
- RAF loop detects clip boundary and calls `handleEnded()`
- BUT the actual HTML5 `<video>` element is never paused
- Video element continues playing its source file even though RAF stopped updating playhead

**Fix Logic:**
- In RAF loop clip boundary detection, check if current clip is the last clip
- If last clip AND reached end time, explicitly pause the video element
- Set `isPlaying` state to false to update UI
- Then call `handleEnded()` for any cleanup

**Files to Change:**
1. `src/renderer/components/VideoPreview.tsx` (lines 333-356)

**Testing:**
- Trim clip to 30s → Play from start → Video should STOP at 30s (not continue to 31s+)

---

### Issue #4: Spacebar Causes Playhead Jump After Trim

**What's Happening:**
- Timeline is 5 min, playhead at 4:00 → User trims to 3 min total
- Playhead stays at 4:00 (now beyond timeline end)
- Spacebar causes playhead to jump unexpectedly

**Root Cause:**
- Location: `src/renderer/components/Timeline.tsx` (after line 196)
- When trim is applied, `totalDuration` updates but `playhead` doesn't
- Playhead is now beyond valid range, causing undefined behavior

**Fix Logic:**
- After updating `totalDuration`, check if `playhead > newTotalDuration`
- If true, snap playhead to `newTotalDuration` (end of timeline)
- Alternative: Scale playhead proportionally (more complex, not recommended)

**Files to Change:**
1. `src/renderer/components/Timeline.tsx` (after line 196)

**Testing:**
- Playhead at 4:00, trim to 3:00 total → Playhead should snap to 3:00 → Spacebar plays normally

---

### Issue #5: No Pause at Trim Borders (During Preview)

**What's Happening:**
- User drags trim handles (e.g., 10s → 40s) but video doesn't respect them until "Apply" is clicked
- Video plays past the trim end point, making it hard to preview the exact trim

**Current State:**
- Trim handles are visual only (yellow border on timeline)
- No interaction with video playback

**Desired Behavior:**
- When playing, video should pause when reaching `tempTrimEnd` boundary
- Clicking a trim handle should seek playhead to that position
- Provides instant feedback for trim adjustments

**Fix Logic:**
- **Option A (Recommended):** Add `trimPreview` state to timeline store
  - Store: `{ clipId, start, end }` when trim handles are dragged
  - Clear when trim is applied/cancelled
- **Option B:** Pass trim state via React Context (more prop drilling)

**Implementation Steps:**
1. Add `trimPreview` state + setter to `timelineStore.ts`
2. Update `Timeline.tsx` to set trim preview when handles move
3. Clear trim preview when Apply/Cancel is clicked
4. In `VideoPreview.tsx` RAF loop, check if trim preview exists for current clip
5. If `video.currentTime >= trimPreview.end`, pause and snap to end
6. Add click handlers to trim handles to seek playhead

**Files to Change:**
1. `src/renderer/store/timelineStore.ts` - Add `trimPreview` state
2. `src/renderer/components/Timeline.tsx` - Update trim handle drag + click handlers
3. `src/renderer/components/VideoPreview.tsx` - Add trim boundary check to RAF loop

**Testing:**
- Drag trim 10s → 40s → Click start handle → Playhead jumps to 10s → Play → Pauses at 40s

---

### Issue #8: Trim Precision (0.1 Second Snapping)

**What's Happening:**
- Trim handles follow mouse precisely (e.g., 10.234567s)
- User can't easily set exact 0.1s intervals (10.0s, 10.1s, 10.2s)
- QuickTime-style precision is missing

**Current State:**
- No snapping logic
- Time format shows whole seconds only (MM:SS)

**Desired Behavior:**
- Trim handles snap to 0.1s intervals
- Time display shows tenths: MM:SS.d (e.g., "1:05.3")
- Optional: Visual flash when snapping occurs

**Fix Logic:**
1. Add snap helper function: round value to nearest 0.1s interval
2. Apply snap threshold (e.g., only snap if within 0.05s of interval)
3. In trim handle drag logic, apply snap function before updating state
4. Update `formatTime` functions to show tenths place
5. Optional: Flash trim handle briefly when snap occurs

**Constants:**
- `TRIM_SNAP_INTERVAL = 0.1` (snap to tenths)
- `TRIM_SNAP_THRESHOLD = 0.05` (snap if within 0.05s)

**Files to Change:**
1. `src/renderer/components/Timeline.tsx` - Add snap logic to trim handle drag
2. `src/renderer/components/Timeline.tsx` - Update `formatTime` to show tenths
3. `src/renderer/components/VideoPreview.tsx` - Update `formatTime` to show tenths

**Testing:**
- Drag trim handle slowly → Snaps to 10.0s, 10.1s, 10.2s → Display shows "10.3s" format

---

## 🎯 Implementation Plan

**Priority 0 (CRITICAL - Fix Immediately):**
1. Issue #0: Video Player Timestamp/Progress Frozen → **20 min** (Low risk, high impact)

**Priority 1 (Blocking - Fix First):**
2. Issue #1 & #2: Timestamp/Total Duration → **15 min** (Low risk)
3. Issue #3: Ghost Playback → **30 min** (Medium risk - RAF loop)
4. Issue #4: Playhead Jump → **10 min** (Low risk)

**Priority 2 (UX Enhancement):**
5. Issue #5: Trim Preview Pause → **45 min** (Medium risk - new state)
6. Issue #8: Trim Precision → **30 min** (Low risk)

**Total Estimated Time:** 2 hours 30 minutes

---

## ✅ Testing Checklist

**Setup:** 3 clips (60s, 120s, 90s) = 4:30 total

**Scenario 1 - Basic Trim:**
- Trim 120s clip to 60s → Total should be 3:30 → Play to end stops at 3:30

**Scenario 2 - Playhead Adjust:**
- Playhead at 3:00 → Trim first clip → Playhead adjusts (no jump on spacebar)

**Scenario 3 - Trim Preview:**
- Drag trim 15s→45s → Click start handle → Jumps to 15s → Play → Pauses at 45s

**Scenario 4 - Precision:**
- Drag trim slowly → Snaps to 0.1s intervals → Display shows "10.3s" format

**Scenario 5 - Edge Cases:**
- Trim first/last clips → Duration updates → No unexpected jumps

---

## 🚀 Success Criteria

**Phase 1.75 complete when:**
- ✅ Video player timestamp/progress update smoothly during playback (Issue #0)
- ✅ Timestamp updates immediately after trim (Issues #1 & #2)
- ✅ Video stops at timeline end (no ghost playback) (Issue #3)
- ✅ Spacebar works after trim (Issue #4)
- ✅ Trim borders pause during preview (Issue #5)
- ✅ Trim snaps to 0.1s intervals (Issue #8)
- ✅ All tests pass, no regressions

---

## 📦 Integration Notes

**Phase Order:**
```
Phase 1     (COMPLETE) → Basic MVP
Phase 1.5   (COMPLETE) → Critical bugs
Phase 1.75  (THIS DOC) → Trim fixes ← YOU ARE HERE
Phase 2     (PLANNED)  → UI polish
Phase 3     (PLANNED)  → Nice-to-haves
```

**Zoom:** Fix broken zoom in Phase 2, enhance in PRD-2

**Build Steps:**
1. Test thoroughly (2-3 hours)
2. Record demo video (3-5 min)
3. `npm run build`
4. Git commit & push
5. Update memory bank

---

**End of Specification**

