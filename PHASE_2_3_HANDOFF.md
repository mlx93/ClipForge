# Phase 2 & 3 Implementation - Agent Handoff Brief

## Mission Statement

ClipForge's MVP foundation is complete (Phases 1 & 1.5), and Phase 1.75 is addressing critical video player and trim issues concurrently. Your mission is to implement **Phase 2 UI polish (5 high/medium-risk tasks, 6-7 hours)** and **Phase 3 nice-to-haves (6 low-risk tasks, 3-4 hours)** as documented in `@POST_PRD1_POLISH_SPEC.md`. **CRITICAL COORDINATION**: Phase 1.75 is actively modifying `Timeline.tsx` (trim precision snapping, trim preview state, playhead adjustment), so you must implement Phase 2 tasks in a specific order - start with **Task 2 (Thumbnail Generation, 1-1.5 hours)** which has zero file overlap, then wait for Phase 1.75 completion before touching Timeline.tsx for Tasks 1, 3, and 4, ensuring no merge conflicts or regressions.

POST_PRD1_POLISH_SPEC.md provides comprehensive pre-implementation code analysis (lines 10-54) that maps current implementation details, identifies safe zones, and documents critical safety rules for each task - notably that trim handle event handlers (Timeline.tsx lines 408-559) are "VERY delicate" and must not be modified beyond visual properties, and that zoom is already implemented via viewport transform but has inconsistent formula usage. The spec includes detailed implementation steps, extensive testing checklists (10-12 scenarios per task), and explicit fallback strategies (e.g., "If >2.5 hours or trim handles break, REVERT ALL CHANGES") to protect existing functionality while enabling systematic improvements to zoom, thumbnails, trim handle visuals, trim indicators, and media library organization.

## Detailed Implementation Guide

### 🎯 Phase 2: High/Medium Risk UI Changes (6-7 hours)

**IMPLEMENTATION ORDER (Critical for Concurrency):**

#### ✅ START HERE: Task 2 - Generate Thumbnail Previews (1-1.5 hours, MEDIUM RISK)
**Why First:** Zero file overlap with Phase 1.75 - can be done concurrently  
**Files:** MediaLibrary.tsx, ffmpeg.ts, handlers.ts, preload.ts, types.ts  
**Goal:** Replace canvas placeholders with real FFmpeg-generated video frame thumbnails

**Current State (lines 24-30):**
- `generateThumbnail()` already exists in ffmpeg.ts (160x90 JPEG)
- `Clip.thumbnailPath` field already exists in types.ts
- MediaLibrary UI already has 64x48px thumbnail container
- Currently uses canvas placeholder with play icon

**Implementation Steps (lines 234-305):**
1. Add `generate-thumbnail` IPC handler in handlers.ts
2. Modify `import-videos` handler to auto-generate thumbnails (don't block if fails)
3. Add IPC method to preload.ts
4. Update MediaLibrary.tsx to use `clip.thumbnailPath` with file:// protocol
5. Keep fallback icon for missing/failed thumbnails

**Critical Safety Rules:**
- ⚠️ DO NOT block video import if thumbnail generation fails
- ⚠️ DO NOT break existing drag & drop (lines 81-115 in MediaLibrary.tsx)
- ⚠️ DO NOT change layout dimensions (64x48px container is correct)
- ⚠️ Test with corrupted videos (thumbnail generation may fail)

**Testing Checklist (lines 294-303):**
- Import 3 normal videos → thumbnails appear within 2 seconds
- Thumbnails show actual video frame, not placeholder
- Import same video twice → thumbnails appear for both
- Import corrupted video → fallback icon shows, no error
- Drag & drop reordering still works
- Thumbnails don't affect timeline addition (+ button)

**Fallback:** If FFmpeg fails consistently (>30% of videos), keep canvas placeholder

---

#### ⏸️ WAIT FOR PHASE 1.75: Task 5 - Media Library Two-Button System (30 min, MEDIUM RISK)
**Why Second:** Minimal Timeline.tsx overlap, safer than Tasks 1, 3, 4  
**Files:** MediaLibrary.tsx (primary), timelineStore.ts, mediaLibraryStore.ts  
**Goal:** Add trash icon for library removal with cascade delete to timeline

**Current State (lines 42-46, 431-509):**
- "+" button adds clip to timeline (creates unique ID)
- "X" button removes from timeline only (not library)
- Confusion: X button name implies library removal but doesn't do it

**Desired Behavior:**
- Keep "+" and "X" buttons unchanged
- Add NEW trash icon button for library removal
- Trash icon removes clip from library AND all timeline instances

**Implementation (lines 447-488):**
1. Add trash icon button to MediaLibrary.tsx UI
2. Implement cascade delete: find all timeline clips with matching ID prefix
3. Remove all timeline instances, then remove from library
4. Show confirmation dialog (destructive action)
5. Toast notification: "Removed [name] from library and timeline"

**Critical Safety Rules:**
- ⚠️ DO NOT break existing + and X buttons
- ⚠️ DO NOT change drag & drop logic
- ⚠️ Test cascade delete thoroughly (must remove ALL instances)

**Testing Checklist (lines 496-507):**
- Import 2 clips, add first clip to timeline 3 times (3 instances)
- Click X on middle instance → only that instance removes
- Click trash icon on first clip in library → all instances disappear
- Second clip still in library and timeline (if added)

---

#### ⏸️ WAIT FOR PHASE 1.75 COMPLETION: Tasks 1, 3, 4 (HIGH RISK - Timeline.tsx)

**⚠️ CRITICAL: Do NOT start these until Phase 1.75 commits to git**

These tasks ALL modify Timeline.tsx which Phase 1.75 is actively changing:

**Task 1: Fix Timeline Zoom Implementation (2-3 hours, HIGH RISK)**
- Lines 179-232 in POST_PRD1_POLISH_SPEC.md
- Audits zoom formulas, standardizes calculations
- **Danger Zone**: Lines 408-559 (trim handle logic) CANNOT be touched

**Task 3: Trim Handle Visual Improvements (1 hour, HIGH RISK)**
- Lines 306-375 in POST_PRD1_POLISH_SPEC.md  
- Changes ONLY size (12px x 70px) and hover state
- **Critical Warning**: "Trim handles took extensive debugging to get working"

**Task 4: Visual Trim Indicators - Two-Layer Overlay (1-1.5 hours, MEDIUM RISK)**
- Lines 376-430 in POST_PRD1_POLISH_SPEC.md
- Adds gray overlays for trimmed regions
- Must ensure trimmed regions don't play

---

### 🎨 Phase 3: Nice-to-Have Improvements (3-4 hours, LOW RISK)

**When to Start:** After Phase 2 complete, all tests pass

**All tasks are pure additions, no existing functionality changed:**

1. **Keyboard Shortcuts for Zoom** (15 min) - Cmd+Plus/Minus/0
2. **Show Clip Count Prominently** (10 min) - "Media Library (5 clips)" in header
3. **Video Preview on Media Library Hover** (45 min) - Show actual video frame
4. **Estimated Time Remaining for Exports** (30 min) - "~2 minutes remaining"
5. **Clip Selection Keyboard Shortcuts** (20 min) - Tab/Shift+Tab cycle clips
6. **Code Cleanup** (1 hour) - Remove console.logs, extract constants, fix memory leaks

**Testing:** Full workflow test after Phase 3: Import → Trim → Split → Export

---

## Critical Coordination Protocol

### File Conflict Matrix

| File | Phase 1.75 | Phase 2 | Conflict? | Solution |
|------|-----------|---------|-----------|----------|
| Timeline.tsx | ✓ (#4, #5, #8) | ✓ (Tasks 1,3,4) | ❌ **YES** | Phase 2 waits |
| VideoPreview.tsx | ✓ (#0, #3, #5) | ✗ | ✅ No | Safe |
| timelineStore.ts | ✓ (#1, #2, #5) | ✗ | ✅ No | Safe |
| MediaLibrary.tsx | ✗ | ✓ (Task 2, 5) | ✅ No | Can proceed |
| ffmpeg.ts | ✗ | ✓ (Task 2) | ✅ No | Can proceed |

### Coordination Checkpoints

**Before Starting:**
1. ✅ Verify Phase 1 & 1.5 complete (they are)
2. ⏳ Acknowledge Phase 1.75 in progress (video player + trim fixes)
3. ✅ Confirm you'll start with Task 2 (Thumbnails) only

**After Task 2 Complete:**
1. Test thumbnails thoroughly (all 8 test scenarios)
2. Commit: "Phase 2 Task 2: Add thumbnail previews for media library clips"
3. Check if Phase 1.75 committed (search git log for "Phase 1.75")
4. If yes → Proceed to Task 5 (Media Library buttons)
5. If no → Wait or help with Phase 1.75 testing

**After Task 5 Complete:**
1. Test media library buttons (all 8 test scenarios)
2. Commit: "Phase 2 Task 5: Add two-button system for media library"
3. **MANDATORY CHECKPOINT**: Confirm Phase 1.75 fully complete and committed
4. Pull latest changes: `git pull origin main`
5. Verify no Timeline.tsx conflicts
6. Only then proceed to Tasks 1, 3, 4

**After All Phase 2 Complete:**
1. Run full regression test suite
2. Test all Phase 1, 1.5, 1.75 features still work
3. Commit: "Phase 2: UI improvements and thumbnail generation complete"
4. Proceed to Phase 3

---

## Safety Rules & Fallback Strategies

### Universal Safety Rules
1. ⚠️ **NEVER touch trim handle logic** (Timeline.tsx lines 408-559) beyond what's specified
2. ⚠️ **NEVER modify dependency arrays** without understanding implications
3. ⚠️ **NEVER skip testing** - each task has 8-12 test scenarios for a reason
4. ⚠️ **Test after EVERY change** - one formula fix at a time for high-risk tasks
5. ⚠️ **If ANY test fails, REVERT IMMEDIATELY** - don't try to fix forward

### Fallback Strategies (from spec)
- **Zoom (Task 1)**: If >2.5 hours or trim breaks → REVERT, remove zoom buttons, defer to PRD-2
- **Thumbnails (Task 2)**: If >30% failure rate → Keep canvas placeholder, defer to PRD-2
- **Trim Handles (Task 3)**: If any drag test fails → REVERT to 8px x 60px handles
- **Trim Indicators (Task 4)**: If trimmed regions play → REVERT to single-rectangle design
- **Media Library (Task 5)**: If cascade delete breaks → REVERT, keep single X button

### Risk Mitigation
- Phase 2 has detailed pre-implementation code analysis (lines 10-54)
- Each task includes "What Can/Cannot Change" sections
- Critical files are mapped with line number ranges
- Extensive testing checklists prevent regressions

---

## Success Criteria

**Phase 2 Complete When:**
- ✅ Task 2: Thumbnails display for all imported clips
- ✅ Task 5: Library removal cascades correctly to all timeline instances
- ✅ Task 1: Zoom works at all levels without breaking playhead/text
- ✅ Task 3: Trim handles larger (12x70px), easier to grab, drag still perfect
- ✅ Task 4: Trimmed regions show as gray overlays, don't play in preview
- ✅ **Zero regressions** in Phase 1, 1.5, 1.75 features
- ✅ All testing checklists pass (50+ test scenarios across 5 tasks)

**Phase 3 Complete When:**
- ✅ All 6 polish features working
- ✅ Code cleaned up (no console.logs, constants extracted)
- ✅ Final full workflow test: Import → Trim → Split → Export
- ✅ Ready for demo video recording

---

## After Completion

1. **Comprehensive Testing** (2-3 hours)
   - Test all Phase 2 features
   - Re-test all Phase 1, 1.5, 1.75 features
   - Run through 5 complete editing workflows
   
2. **Build & Verify**
   - `npm run build`
   - Test packaged app (not just dev mode)
   - Verify no console warnings or errors

3. **Final Commits**
   - "Phase 2: UI improvements and thumbnail generation complete"
   - "Phase 3: Nice-to-have polish complete"

4. **Demo Video**
   - Record 3-5 minute demo showing all features
   - Upload to GitHub Release
   - MVP COMPLETE! 🎉

---

**Read POST_PRD1_POLISH_SPEC.md (lines 173-571) in full before starting.** The spec contains detailed implementation analysis, safety rules, testing checklists, and fallback strategies that are critical for successful execution without breaking existing functionality.

