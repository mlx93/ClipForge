# Post-PRD1 Polish & Fixes Specification (REVISED)

**Version:** 1.2  
**Date:** October 28, 2025  
**Scope:** Critical fixes and polish improvements before MVP demo submission  
**Estimated Total Time:** 13-16 hours across 3 phases

---

## 🔍 Pre-Implementation Code Analysis Summary

**Analysis Date:** October 28, 2025  
**Purpose:** Reduce risk for Phase 2 by understanding current implementation details

### Key Findings:

**1. Timeline Zoom (HIGH RISK):**
- ✅ Zoom IS implemented via viewport transform: `canvas.setViewportTransform([zoom, 0, 0, 1, 0, 0])`
- ✅ Most calculations already account for zoom
- ⚠️ **Issue:** Inconsistent formula usage - some multiply, some divide by zoom
- 📍 **Safe zones:** DO NOT touch trim handle logic (lines 408-559), dependency array, or `isDraggingRef`
- 🎯 **Fix strategy:** Audit all zoom calculations, standardize formulas, test incrementally

**2. Thumbnail Generation (MEDIUM RISK):**
- ✅ `generateThumbnail()` function exists in `ffmpeg.ts` (160x90 JPEG)
- ✅ `Clip.thumbnailPath` field exists in types
- ✅ MediaLibrary UI already has thumbnail container (64x48px) and fallback
- ⚠️ **Current:** Uses canvas placeholder, not real video frames
- 🎯 **Fix strategy:** Add IPC handler, call during import, don't block if fails

**3. Trim Handles (HIGH RISK):**
- ✅ Current implementation: 8px x 60px red rectangles
- ✅ Positioned at lines 715-797 in Timeline.tsx
- ⚠️ **Danger:** Event handlers are VERY delicate (lines 408-559)
- 🎯 **Fix strategy:** Change ONLY visual properties (size, color, hover), test extensively

**4. Trim Indicators (MEDIUM RISK):**
- ✅ Current: Single blue rectangle per clip
- ⚠️ **Challenge:** Need 3-part rendering (gray-blue-gray) without breaking playback
- 🎯 **Fix strategy:** Use fabric.Group, test that trimmed regions don't play

**5. Media Library Buttons (MEDIUM RISK):**
- ✅ "+" button adds to timeline (lines 204-221)
- ✅ "X" button removes from timeline (lines 223-235)
- ⚠️ **Confusion:** X calls `useTimelineStore.removeClip()`, not library removal
- 🎯 **Fix strategy:** Add trash icon, implement cascade delete with ID prefix matching

### Critical Files Mapped:
- `src/renderer/components/Timeline.tsx` (976 lines) - Zoom, trim handles, rendering
- `src/renderer/components/MediaLibrary.tsx` (242 lines) - Thumbnails, buttons
- `src/main/ffmpeg.ts` (lines 182-197) - Thumbnail generation
- `src/shared/types.ts` (line 15) - `thumbnailPath` field
- `src/preload/preload.ts` - Needs new `generateThumbnail` IPC handler

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

**Phase 1 Checkpoint:** ✅ COMPLETE - Test thoroughly, commit to git, verify no regressions before proceeding to Phase 1.5.

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

**Phase 1.5 Checkpoint:** ✅ COMPLETE - Export working, Project Save/Load functional, Video Player sync improved. Ready for Phase 2.

---

## Phase 1.75: Critical Video Player & Trim Fixes (URGENT)

**Priority:** MUST fix before Phase 2  
**Document:** Post_PRD1_spec_middle.md (detailed specifications)  
**Estimated Time:** 2.5 hours  
**Risk Level:** LOW-MEDIUM - Well-understood issues with clear fix strategies

**Background:** During MVP demo recording, critical video player and trim functionality issues were discovered. These break core user experience and must be fixed before proceeding with Phase 2 UI polish.

### Issue #0: Video Player Timestamp/Progress Frozen (20 min) 🔴 CRITICAL
**Problem:** Video plays but timestamp and progress bar remain frozen. Only "jump" forward when pausing.  
**Root Cause:** Throttle effect with `[playhead]` dependency cancels interval on every 60fps update.  
**Solution:** Remove throttling, pass raw playhead to VideoControls (already React.memo optimized).

### Issues #1-4: Trim Workflow Fixes (65 min)
- #1 & #2: totalDuration not recalculated after trim (15 min)
- #3: Video keeps playing beyond timeline end (30 min)
- #4: Playhead jumps after trim when pressing spacebar (10 min)

### Issues #5 & #8: Trim UX Enhancements (75 min)
- #5: Pause playback at trim borders during preview (45 min)
- #8: Snap trim handles to 0.1s intervals (30 min)

**All fixes documented in Post_PRD1_spec_middle.md with detailed root cause analysis.**

**Phase 1.75 Checkpoint:** ✅ All issues fixed → Test thoroughly → Commit → Ready for Phase 2

---

## Phase 2: High/Medium Risk UI Changes

**Priority:** Implement carefully after Phase 1 & 1.5 complete  
**Estimated Time:** 6-7 hours  
**Risk Level:** HIGH/MEDIUM - Touches delicate UI functionality

### 1. Fix Timeline Zoom Implementation (2-3 hours) ⚠️ HIGH RISK
**Problem:** Zoom state updates but canvas doesn't scale clips correctly. Playhead, text, and click-to-seek break at different zoom levels.

**Current Implementation Analysis (Timeline.tsx lines 620-844):**
- Zoom is applied via viewport transform: `canvas.setViewportTransform([zoom, 0, 0, 1, 0, 0])`
- Current calculations already divide by zoom: `canvas.width! / zoom`
- Text elements use inverse zoom: `zoomX: 1 / zoom, zoomY: 1 / zoom`
- Zoom state is already in dependency array (line 844)
- **The viewport transform is X-axis only (zoom, 0, 0, 1)** - this is intentional

**What's Actually Broken:**
The zoom calculations ARE implemented, but there's a coordination issue:
- Line 677-678: Clips render with `canvas.width! / zoom` ✅
- Line 646-647: Time markers render with `canvas.width! / zoom` ✅
- Line 804: Playhead renders with `canvas.width! / zoom` ✅
- Line 334: Click-to-seek uses `canvas.width! * currentZoom` ✅
- Line 438: Trim handle drag uses `canvas.width! * currentZoom` ✅

**The Real Issue:**
The formulas are correct but **NOT being applied consistently**. Some multiply by zoom, others divide. We need to standardize.

**Solution - DO NOT REWRITE, ONLY FIX INCONSISTENCIES:**
1. **Standard formula for rendering:** `(time / totalDuration) * (canvas.width! / zoom)`
2. **Standard formula for click-to-time:** `(clickX / (canvas.width! * zoom)) * totalDuration`
3. Verify every calculation follows one of these two patterns
4. Test trim handles don't break (they're lines 416-529 and are VERY delicate)

**CRITICAL SAFETY RULES:**
- ⚠️ **DO NOT touch trim handle logic (lines 408-559)** - it's working perfectly after extensive debugging
- ⚠️ **DO NOT touch `isDraggingRef` logic** - prevents flicker during trim drags
- ⚠️ **DO NOT modify the dependency array** - it's carefully tuned
- ⚠️ **DO NOT change viewport transform** - X-axis only is correct
- ⚠️ **Test after EVERY change** - one formula fix at a time

**Implementation Steps:**
1. Audit all zoom calculations, make list of which need fixing
2. Fix clip rendering coordinates (if needed)
3. Fix playhead rendering coordinates (if needed)
4. Fix time marker coordinates (if needed)
5. Fix click-to-seek formula (if needed)
6. Test at 0.5x, 1x, 2x, 4x zoom levels after each change

**Testing Checklist:**
- [ ] Import 5+ clips totaling >60 seconds
- [ ] Zoom to 0.5x - see entire timeline, clip names readable
- [ ] Zoom to 2x - see fewer clips, more detail, no text overlap
- [ ] Zoom to 4x - see 1-2 clips, maximum detail
- [ ] Click timeline at random positions - playhead goes to correct time (verify with video preview)
- [ ] Drag playhead - smooth tracking at all zoom levels
- [ ] Select clip, drag trim handles - **MUST STILL WORK PERFECTLY**
- [ ] Apply trim, verify video plays trimmed section correctly

**Fallback:** If >2.5 hours or trim handles break, REVERT ALL CHANGES and remove zoom buttons temporarily.

### 2. Generate Thumbnail Previews for Media Library Clips (1-1.5 hours) 🟡 MEDIUM RISK
**Goal:** Display visual thumbnail for each imported video clip in the media library instead of just showing filename/metadata.

**Why It Matters:** 
- Users can visually identify clips without reading filenames
- Professional video editing UX standard
- Makes media library more intuitive and scannable

**Current State Analysis:**
- `MediaLibrary.tsx` already has thumbnail support (lines 12, 33-71, 155-167)
- Currently generates canvas-based placeholder with play icon and duration text
- `Clip` interface already has `thumbnailPath?: string` field (types.ts line 15)
- `generateThumbnail` function exists in `ffmpeg.ts` (lines 182-197)
- FFmpeg function generates 160x90 JPEG thumbnails ✅
- **Layout already correct:** 64x48px thumbnail container on left, metadata on right

**What Needs to Change:**
Replace the canvas placeholder generation with real FFmpeg thumbnail generation.

**Implementation:**

**Backend (Main Process):**
1. Create new IPC handler: `generate-thumbnail`
   - Location: `src/main/ipc/handlers.ts`
   - Input: `{ videoPath: string, clipId: string }`
   - Output: `{ success: boolean, thumbnailPath?: string, error?: string }`
   - Use existing `generateThumbnail` from `ffmpeg.ts`
   - Output path: `~/Library/Application Support/ClipForge/thumbnails/${clipId}.jpg`
   - Create thumbnails directory if not exists

2. Modify `import-videos` handler:
   - After importing each video, auto-generate thumbnail
   - Store `thumbnailPath` in returned `Clip` object
   - Don't block import if thumbnail generation fails - just log warning

**Frontend (Renderer Process):**
1. Add to `preload.ts`:
   ```
   generateThumbnail: (videoPath: string, clipId: string) => 
     ipcRenderer.invoke('generate-thumbnail', { videoPath, clipId })
   ```

2. Update `MediaLibrary.tsx` (lines 33-71):
   - Remove canvas-based `generateThumbnail` function
   - Check if `clip.thumbnailPath` exists and file is accessible
   - If no thumbnail, show existing video icon fallback (lines 163-166)
   - Use `file://` protocol for thumbnail image src: `src={`file://${clip.thumbnailPath}`}`

**CRITICAL SAFETY RULES:**
- ⚠️ **DO NOT break existing drag & drop** - MediaLibrary has working reorder logic (lines 81-115)
- ⚠️ **DO NOT change layout dimensions** - 64x48px container is correct
- ⚠️ **DO NOT block video import** - thumbnails should generate async, import should complete immediately
- ⚠️ **DO NOT assume thumbnails always succeed** - always have fallback UI
- ⚠️ **Test with corrupted videos** - thumbnail generation may fail for some files

**Edge Cases to Handle:**
- Video less than 1 second long - seek to 0 instead of 1.0
- Very large video files - FFmpeg may be slow, show loading state
- Thumbnail file gets deleted - regenerate on demand
- Same video imported multiple times - reuse existing thumbnail (check by file hash or path)

**Testing Checklist:**
- [ ] Import 3 normal videos - thumbnails appear within 2 seconds
- [ ] Thumbnails show actual video frame, not placeholder
- [ ] Import same video twice - thumbnails appear for both
- [ ] Import corrupted video - fallback icon shows, no error
- [ ] Restart app - thumbnails persist
- [ ] Drag & drop reordering still works
- [ ] Thumbnails don't affect timeline addition (+ button)
- [ ] Thumbnails scale correctly (no stretching/squashing)

**Fallback:** If FFmpeg thumbnail generation fails consistently (>30% of videos), keep canvas placeholder and defer real thumbnails to PRD-2.

### 3. Trim Handle Visual Improvements (1 hour) ⚠️ HIGH RISK
**Goal:** Make trim handles easier to see and grab without breaking the trim functionality.

**CRITICAL WARNING:** Trim handles took extensive debugging to get working. DO NOT modify ANY drag logic.

**Current Implementation (Timeline.tsx lines 715-797):**
- Handles are 8px wide, 60px tall fabric.Rect objects
- Red fill (#ef4444), positioned at clip left/right edges
- Have custom properties: `isTrimHandle`, `handleType` ('left'/'right'), `clipId`, etc.
- Dragging constrained to clip bounds (lines 431-559)
- **Event listeners:** `object:moving`, `mouse:down`, `selection:updated`

**What Can Safely Change:**
✅ Width: 8px → 12px (line 736, 770)
✅ Height: 60px → 70px (extends 5px above/below clip) (line 737, 771)
✅ Fill color on hover: #ef4444 → #f87171 (brighter red)
✅ Add shadow/glow effect for hover state
✅ Cursor property: should already be 'ew-resize' but verify (line 740, 774)

**What CANNOT Change:**
❌ Position calculation (`left` property) - lines 734-735, 768-769
❌ `clipStartX`, `clipWidth` properties - needed for drag constraints
❌ `isTrimHandle`, `handleType`, `clipId` properties - event handlers rely on these
❌ `selectable: true, evented: true` - required for dragging
❌ Any event handler logic (lines 408-559)

**Implementation Steps:**
1. Find trim handle creation code (lines 715-797)
2. Change ONLY these constants:
   ```
   handleWidth: 8 → 12
   handleHeight: 60 → 70
   fill: '#ef4444' (keep for non-hover)
   ```
3. Add hover state logic:
   ```
   canvas.on('mouse:over', (event) => {
     if (event.target?.isTrimHandle) {
       event.target.set({ fill: '#f87171', shadow: new fabric.Shadow({...}) });
       canvas.renderAll();
     }
   });
   
   canvas.on('mouse:out', (event) => {
     if (event.target?.isTrimHandle) {
       event.target.set({ fill: '#ef4444', shadow: null });
       canvas.renderAll();
     }
   });
   ```
4. Adjust `top` position if changing height: `clipY + (60-70)/2` to keep centered

**Testing Checklist (EXTENSIVE):**
- [ ] Import 2 clips, select first clip
- [ ] Trim handles appear, are 12px wide, 70px tall
- [ ] Hover over left handle - turns brighter red
- [ ] Drag left handle right - moves smoothly, video seeks to new trim start
- [ ] Drag left handle left - moves smoothly back
- [ ] Release left handle - stays in position
- [ ] Hover over right handle - turns brighter red
- [ ] Drag right handle left - moves smoothly, video seeks to new trim end
- [ ] Drag right handle right - moves smoothly back
- [ ] Click "Apply Trim" - trim processes correctly, video duration updates
- [ ] Select second clip - trim handles appear on new clip
- [ ] Repeat all drag tests on second clip
- [ ] Zoom to 2x - trim handles still work
- [ ] **If ANY test fails, REVERT IMMEDIATELY**

**Fallback:** If trim handles become unresponsive or jumpy, revert all changes and keep 8px x 60px handles.

### 4. Visual Trim Indicators - Two-Layer Overlay (1-1.5 hours) 🟡 MEDIUM RISK
**Goal:** Show full original clip width with trimmed regions visually de-emphasized, allowing users to re-expand trims.

**Benefit:** Users can see what they trimmed out and easily adjust trim handles to recover content without re-importing.

**Current Implementation (Timeline.tsx lines 674-799):**
- Clips render as single blue rectangles (line 686-714)
- Width based on trimmed duration: `(trimmedDuration / totalDuration) * canvasWidth`
- Trimmed portions are completely hidden - no visual indication

**Desired Behavior:**
- Clip width based on FULL duration (ignoring trim)
- Active region (what plays): Solid blue (#3b82f6, 100% opacity)
- Trimmed left region: Semi-transparent gray (#9ca3af, 40% opacity)
- Trimmed right region: Semi-transparent gray (#9ca3af, 40% opacity)
- Timeline arranges clips based on trimmed duration (no gaps)

**Implementation:**
1. Calculate clip positioning based on trimmed duration (existing logic)
2. Render clip in THREE parts using fabric.Rect:
   - **Left trim overlay** (if trimStart > 0):
     - Width: `(trimStart / clip.duration) * fullClipWidth`
     - Fill: `rgba(156, 163, 175, 0.4)`
     - Position: Aligned to left edge of clip
   - **Active region** (what plays):
     - Width: `(activeDuration / clip.duration) * fullClipWidth`
     - Fill: `#3b82f6` (current blue)
     - Position: After left trim
   - **Right trim overlay** (if trimEnd > 0):
     - Width: `((clip.duration - trimEnd) / clip.duration) * fullClipWidth`
     - Fill: `rgba(156, 163, 175, 0.4)`
     - Position: After active region
3. Group all three parts with `fabric.Group` so they move together
4. Adjust trim handle positions to align with active region edges (not clip edges)

**CRITICAL SAFETY RULES:**
- ⚠️ **Video playback MUST respect trim** - only play active region
- ⚠️ **Timeline duration MUST use trimmed duration** - ignore gray overlays
- ⚠️ **Trim handles MUST stay at active region edges** - not full clip edges
- ⚠️ **Test that trimmed regions don't play** - seek playhead into gray area, video should skip

**Testing Checklist:**
- [ ] Import clip, trim off 5 seconds from start
- [ ] Clip shows gray overlay on left, blue active region
- [ ] Play from beginning - video starts at trim point, not at gray area
- [ ] Drag left trim handle - gray overlay shrinks, active region expands
- [ ] Apply trim again - new gray overlay appears
- [ ] Drag left handle to far left - gray overlay disappears
- [ ] Trim off 5 seconds from end - gray overlay appears on right
- [ ] Play through entire clip - stops at right trim point, doesn't play gray
- [ ] Click on gray overlay - can still select clip
- [ ] Export timeline - final video has correct trimmed duration

**Fallback:** If video playback plays trimmed regions or timeline duration miscalculates, revert to current single-rectangle design.

### 5. Media Library Two-Button System (30 min) 🟡 MEDIUM RISK
**Goal:** Add ability to remove clips from library (and cascade-delete from timeline), while keeping existing "remove from timeline" button.

**Current Implementation (MediaLibrary.tsx lines 202-236):**
- **"+" button** (lines 204-221): Adds clip to timeline with unique ID
- **"X" button** (lines 223-235): Calls `removeClip(clip.id)` - removes from timeline only
- Buttons are in a flex container on the right side of each clip card

**Confusion:** The X button calls `removeClip` from `useTimelineStore` (line 11), which only removes from timeline, not library.

**Desired Behavior:**
- **"Add to Timeline" button** (+ icon): Keeps existing behavior
- **"Remove from Timeline" button** (X icon): Keeps existing behavior - removes this instance from timeline
- **"Remove from Library" button** (trash icon, NEW): Removes clip from library store AND cascades to all timeline instances

**Implementation:**

1. **Add library removal to stores:**
   - `mediaLibraryStore` already exists but check if it has `removeClip` method
   - Need to identify all timeline instances of a library clip (they share base ID)
   - When removing from library, remove all timeline clips that originated from this library clip

2. **Update MediaLibrary.tsx UI:**
   ```
   <div className="flex items-center space-x-1">
     {/* Add to Timeline - existing */}
     <button onClick={...} title="Add to timeline">
       <PlusIcon />
     </button>
     
     {/* Remove from Timeline - existing */}
     <button onClick={removeFromTimeline} title="Remove from timeline">
       <XIcon />
     </button>
     
     {/* Remove from Library - NEW */}
     <button onClick={removeFromLibrary} className="text-gray-400 hover:text-red-500" title="Remove from library (deletes all instances)">
       <TrashIcon />
     </button>
   </div>
   ```

3. **Cascade delete logic:**
   ```typescript
   const removeFromLibrary = (clip: Clip) => {
     // Remove all timeline instances that came from this library clip
     // Timeline clips have IDs like: `${clip.id}_timeline_${Date.now()}_${random}`
     const timelineClips = useTimelineStore.getState().clips;
     const instancesToRemove = timelineClips.filter(tc => tc.id.startsWith(clip.id));
     
     instancesToRemove.forEach(tc => useTimelineStore.getState().removeClip(tc.id));
     
     // Remove from library
     useMediaLibraryStore.getState().removeClip(clip.id);
     
     toast.success(`Removed "${clip.name}" from library and timeline`);
   };
   ```

**CRITICAL SAFETY RULES:**
- ⚠️ **DO NOT break existing + and X buttons** - they work perfectly
- ⚠️ **DO NOT change drag & drop logic** - MediaLibrary reordering works
- ⚠️ **Test cascade delete thoroughly** - must remove ALL instances, not just first
- ⚠️ **Show confirmation dialog** - removing from library is destructive

**Testing Checklist:**
- [ ] Import 2 clips to library
- [ ] Add first clip to timeline 3 times (creates 3 instances with different IDs)
- [ ] Click X button on middle instance - only that instance removes
- [ ] First clip now has 2 instances on timeline
- [ ] Click trash icon on first clip in library
- [ ] All remaining instances of first clip disappear from timeline
- [ ] First clip removed from library
- [ ] Second clip still in library and on timeline (if added)
- [ ] Test with clip that has trim applied - removes correctly
- [ ] Test with clip in middle of timeline - timeline reorders correctly

**Fallback:** If cascade delete breaks timeline (clips disappear unexpectedly, wrong clips removed), revert and keep single X button.

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
- [ ] Thumbnail previews display for all imported clips
- [ ] Trim handles larger, easier to grab, trim logic still perfect
- [ ] Trimmed regions show as gray, don't play in preview
- [ ] Library removal cascades correctly
- [ ] If ANY item breaks, revert and defer to post-MVP
- [ ] Commit to git with message: "Phase 2: UI improvements and thumbnail generation complete"

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
- **Thumbnails (item 2):** FFmpeg thumbnail generation should be straightforward, but test with various video formats.
- **Trim handles (item 3):** Change ONLY CSS/visual properties. Do NOT touch event listeners, coordinate math, or drag handlers.
- **Trim indicators (item 4):** Test extensively - trimmed regions must not play in preview.
- **Cascade delete (item 5):** Must remove ALL timeline instances, not just first match.

**Phase 3:** No risks - all additive features.

---

## Success Criteria

**Phase 1 Success:** All 13 items working, no regressions, committed to git  
**Phase 2 Success:** Risky items working OR safely reverted if broken  
**Phase 3 Success:** Polish complete, demo-ready MVP

---

**Total Estimated Time:**
- Phase 1: 5-6 hours ✅ COMPLETE
- Phase 1.5: 4-5 hours ✅ COMPLETE (Export fixed!)
- Phase 2: 6-7 hours ⏳ READY TO START
- Phase 3: 3-4 hours  
- **Grand Total: 18-22 hours**

---

**End of Specification**

