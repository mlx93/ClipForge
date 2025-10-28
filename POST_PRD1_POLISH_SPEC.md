# Post-PRD1 Polish & Fixes Specification (REVISED)

**Version:** 1.1  
**Date:** October 28, 2025  
**Scope:** Critical fixes and polish improvements before MVP demo submission  
**Estimated Total Time:** 13-16 hours across 3 phases

---

## Phase 1: Low-Risk Critical Fixes

**Priority:** MUST complete first - safe, high-impact changes  
**Estimated Time:** 5-6 hours  
**Risk Level:** LOW - No existing functionality affected

### 1. Delete Key Handler for Timeline Clips (15 min)
Add Delete/Backspace key handler in Timeline.tsx keyboard shortcuts. When clip selected, pressing Delete removes it from timeline. Show confirmation toast.

### 2. Fix ExportSettings Type Definitions (30 min)
Remove unused `quality` and `format` fields from types.ts ExportSettings interface. Update ExportDialog to match actual FFmpeg capabilities (MP4 only).

### 3. Video Load Error Handling (30 min)
Add `onError` handler to video element in VideoPreview.tsx. Display error: "Unable to load video. File may be corrupted or unsupported format."

### 4. Fix Source Resolution Export (30 min)
In ffmpeg.ts line 65, add conditional: `if (settings.resolution.name !== 'Source')` before applying videoFilters. Skip scaling when Source selected.

### 5. Verify FFmpeg Bundling in Packaged App (1 hour)
Test packaged DMG on clean Mac without system FFmpeg. If fails, explicitly add `node_modules/@ffmpeg-installer/**` to electron-builder.json files array.

### 6. Replace Alerts with Toast Notifications (45 min)
Install react-hot-toast. Replace alert() calls in Timeline.tsx with non-blocking toast notifications. Add toast container to App.tsx.

### 7. Clean Up Intermediate Trim Files (30 min)
Track previous trimmed file path in clip metadata. When applying new trim, delete old trimmed file first. Optionally clean up on project close.

### 8. Export Progress Bar in Dialog (30 min)
Add inline progress bar to ExportDialog.tsx. Display percentage + visual bar + current step. Similar to Timeline trim progress bar.

### 9. Improve Video Sync During Trim Drag (20 min)
In VideoPreview.tsx line 65, reduce threshold from 0.2s to 0.05s for more responsive frame updates during trim handle drag.

### 10. Disk Full Error Handling (20 min)
Catch ENOSPC error in ffmpeg.ts. Show error: "Export failed: Not enough disk space. Free up space and try again."

### 11. Prevent Concurrent Exports (15 min)
Disable Export button when `isExporting` is true. Add guard in exportStore with toast "Export in progress, please wait."

### 12. File Path Edge Case Handling (30 min)
Sanitize file paths before passing to FFmpeg. Wrap paths in quotes. Test with spaces, Unicode characters, apostrophes.

### 13. Installation README Section (30 min)
Add "Installation" section to README with macOS Gatekeeper bypass instructions. Include screenshots showing warning and how to right-click → Open.

**Phase 1 Checkpoint:** Test thoroughly, commit to git, verify no regressions before proceeding to Phase 1.5.

---

## Phase 1.5: Critical Bug Fixes (Post-User Testing)

**Priority:** MUST complete - fixes critical bugs found during user testing  
**Estimated Time:** 4-5 hours  
**Risk Level:** MEDIUM - Core functionality fixes, architectural changes required

### 1. Fix Export Dialog Button Handlers (30 min)
**Problem:** Browse, Preview, and Start Export buttons unresponsive in ExportDialog.tsx.  
**Root Cause:** Line 97 uses `window.electron.invoke` instead of `window.electronAPI`.  
**Solution:** Update all IPC calls to use the correct preload API (`window.electronAPI.invoke`).

### 2. Implement Project Save/Load Functionality (2-3 hours)
**Problem:** Saving creates `.clipforge` files, but macOS can't open them. LoadProject IPC handler may not be working.  

**Option A (Preferred):** Fix `.clipforge` project files
- Verify `saveProject` IPC handler writes JSON correctly
- Fix `loadProject` IPC handler to parse and restore project state
- Test opening `.clipforge` files within ClipForge app
- Document that `.clipforge` files must be opened via File → Open in ClipForge

**Option B (Fallback if Option A >2 hours):** Make Save = Export
- "Save" and "Save As" export timeline as MP4 (same as Export button)
- "Open" imports MP4 as single editable clip
- Simplifies implementation, no custom file format
- User can split/trim/edit the opened MP4

**Decision:** Start with Option A. If not working after 2 hours, switch to Option B.

### 3. Fix Video Player Global Time Sync (2 hours) 🔴 CRITICAL UX
**Problem:** Video player shows individual clip times (resets to 0 for each clip) instead of continuous timeline. Playhead out of sync.  
**Current Behavior:** Clip 1 shows 0:00-0:15, then Clip 2 shows 0:00-0:10 (confusing).  
**Desired Behavior:** Timeline shows 0:00-0:25 continuously, video player syncs.  

**Solution:**
- In `VideoPreview.tsx`, calculate global time offset for current clip
- Add `clipStartTime` to `video.currentTime` to get global timeline position
- When playhead crosses clip boundary, switch video source seamlessly
- Update video progress bar to reflect global timeline position (not individual clip time)

**Implementation Steps:**
- Calculate each clip's start time on global timeline (sum of previous clip durations)
- When playhead is at global time T, find which clip contains T
- Set video source to that clip's path
- Set `video.currentTime = T - clipStartTime`
- Display global time in video player UI

### 4. Export Browse Button Default to Desktop (15 min)
**Problem:** Export file picker doesn't default to Desktop folder.  
**Solution:** In ExportDialog.tsx line 99, change `defaultPath` from `'clipforge-export.mp4'` to `'~/Desktop/clipforge-export.mp4'`.

### 5. Remove Preview Button from Export Dialog (10 min)
**Rationale:** Preview feature not in PRD-1 or PRD-2. Video player already provides live preview during editing.  
**Solution:** Remove Preview button and `showPreview` state from ExportDialog.tsx. Simplify modal to Settings → Export workflow.

### 6. Add MOV Export Format Option (30 min)
**Current:** Only MP4 supported.  
**Required:** Default to MP4, but allow macOS users to select MOV.  
**Solution:**
- ExportDialog.tsx: Update file picker filters to include both MP4 and MOV
- Extract file extension from `settings.outputPath`
- Pass format to FFmpeg based on extension
- In ffmpeg.ts: Support both `.mp4` (format: 'mp4', codec: 'libx264') and `.mov` (format: 'mov', codec: 'libx264')

**Phase 1.5 Checkpoint:** Test Export Dialog, Project Save/Load, Video Player sync. Commit before Phase 2.

---

## Phase 2: High/Medium Risk UI Changes

**Priority:** Implement carefully after Phase 1 complete  
**Estimated Time:** 5-6 hours  
**Risk Level:** HIGH/MEDIUM - Touches delicate UI functionality

### 1. Fix Timeline Zoom Implementation (2-3 hours) ⚠️ HIGH RISK
**Problem:** Zoom breaks playhead, text, click-to-seek.  
**Solution:**
- Fix coordinate calculations for viewport transform
- Playhead X = `(playhead / totalDuration) * (canvas.width / zoom)`
- Click-to-seek time = `(pointer.x / (canvas.width * zoom)) * totalDuration`
- Verify inverse zoom on ALL text elements
- Test at 0.5x, 1x, 2x, 4x zoom levels
- **Fallback:** If >3 hours, consider removing zoom temporarily

### 2. Trim Handle Visual Improvements (1 hour) ⚠️ HIGH RISK
**CRITICAL:** Change ONLY visual appearance, DO NOT modify drag logic.  
**Changes:**
- Width: 8px → 12px
- Height: 70px (extends 5px above/below 60px clip)
- Hover: Brighter red (#f87171), subtle glow effect
- Cursor: ew-resize on hover
- **Testing:** Extensively verify drag still works perfectly after changes

### 3. Visual Trim Indicators - Two-Layer Overlay (1-1.5 hours) 🟡 MEDIUM RISK
**Solution:** Render full clip width. Active region = solid blue. Trimmed regions = semi-transparent gray (#9ca3af, 40% opacity).  
**Benefit:** User sees full context, can re-expand trim without re-importing.  
**Testing:** Verify trimmed regions don't accidentally play in video preview.

### 4. Media Library Two-Button System (30 min) 🟡 MEDIUM RISK
**Solution:** Keep "Remove from Timeline" (X icon). Add "Remove from Library" (trash icon, prominent). Library removal cascades to all timeline instances.  
**Testing:** Verify cascade delete removes ALL instances of clip from timeline, not just first one.

**Phase 2 Checkpoint:** Test all risky changes thoroughly. If any item breaks existing functionality, revert that item and move to post-MVP backlog. Commit working changes.

---

## Phase 3: Nice-to-Have Improvements

**Priority:** Polish features after Phases 1 & 2 complete  
**Estimated Time:** 3-4 hours  
**Risk Level:** LOW - Pure additions, no existing functionality changed

### 1. Keyboard Shortcuts for Zoom (15 min)
Add Cmd+Plus (zoom in), Cmd+Minus (zoom out), Cmd+0 (reset) handlers. Connect to existing zoom buttons.

### 2. Show Clip Count Prominently (10 min)
Move clip count to media library header: "Media Library (5 clips)". Always visible.

### 3. Video Preview on Media Library Hover (45 min)
On hover, show actual video frame instead of canvas placeholder. Create temp <video> element, seek to 1s, capture frame.

### 4. Estimated Time Remaining for Exports (30 min)
Calculate export speed (2x realtime) and display: "Encoding... 45% (~2 minutes remaining)". Update every second.

### 5. Clip Selection Keyboard Shortcuts (20 min)
Add Tab (next clip) and Shift+Tab (previous clip) shortcuts. Cycle through timeline clips keyboard-only.

### 6. Code Cleanup (1 hour)
- Remove all console.log statements
- Extract magic numbers to constants.ts
- Fix ResizeObserver memory leak (use useRef)
- Fix keyboard handler dependency array
- Add TypeScript null checks

**Phase 3 Checkpoint:** Final testing pass. Record demo video. Prepare for submission.

---

## Testing Strategy

**After Phase 1:**
- [ ] All 13 low-risk items working
- [ ] No regressions in trim, split, export, playback
- [ ] Commit to git with message: "Phase 1: Low-risk critical fixes complete"

**After Phase 2:**
- [ ] Zoom works at all levels without breaking playhead/text
- [ ] Trim handles larger, easier to grab, trim logic still perfect
- [ ] Trimmed regions show as gray, don't play in preview
- [ ] Library removal cascades correctly
- [ ] If ANY item breaks, revert and defer to post-MVP
- [ ] Commit to git with message: "Phase 2: Risky UI improvements complete"

**After Phase 3:**
- [ ] All polish features working
- [ ] Code cleaned up (no console.logs)
- [ ] Final full workflow test: Import → Trim → Split → Export
- [ ] Commit to git with message: "Phase 3: Nice-to-have polish complete"

---

## Risk Mitigation

**Phase 1:** No significant risks - all straightforward fixes.

**Phase 2 Risks:**
- **Zoom (item 1):** Budget 3 hours max. If not fixed, remove zoom buttons and defer to PRD-2.
- **Trim handles (item 2):** Change ONLY CSS/visual properties. Do NOT touch event listeners, coordinate math, or drag handlers.
- **Trim indicators (item 3):** Test extensively - trimmed regions must not play in preview.
- **Cascade delete (item 4):** Must remove ALL timeline instances, not just first match.

**Phase 3:** No risks - all additive features.

---

## Success Criteria

**Phase 1 Success:** All 13 items working, no regressions, committed to git  
**Phase 2 Success:** Risky items working OR safely reverted if broken  
**Phase 3 Success:** Polish complete, demo-ready MVP

---

**Total Estimated Time:**
- Phase 1: 5-6 hours ✅ COMPLETE
- Phase 1.5: 4-5 hours 🔄 IN PROGRESS
- Phase 2: 5-6 hours  
- Phase 3: 3-4 hours
- **Grand Total: 17-21 hours**

---

**End of Specification**

