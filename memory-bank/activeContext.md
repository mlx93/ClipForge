# Active Context

## Current Work Focus
**Priority**: Fix critical synchronization bugs in trim functionality and video-timeline sync

## Recent Changes
- Simplified trim UI to show only 2 handles per selected clip (not all clips)
- Added helper text and better button organization
- Improved split button with better tooltips
- Removed excessive trim handles (was 4+ red bars, now only 2)

## Active Issues (Critical - Blocking Usability)

### 1. Timeline-Video Synchronization Broken
**Problem**: Video player and timeline playhead are not properly synchronized
**Symptoms**:
- Clicking timeline doesn't move playhead
- Video player time doesn't match timeline time
- Playhead doesn't follow video playback
- Playhead doesn't respond to clicks

**Root Cause**: 
- `useLayoutEffect` dependencies exclude `playhead`
- Separate playhead update effect may not be triggering
- Event handlers not properly connected to state updates

**Impact**: User cannot accurately navigate timeline or sync with video

### 2. Trim Apply Button Not Visible
**Problem**: Green "Apply Trim" button never appears when dragging trim handles
**Symptoms**:
- Drag trim handle → `isTrimming` becomes `true` (logged correctly)
- Apply/Cancel buttons should render but don't
- Can't actually apply trim to video

**Root Cause**:
- State updates not triggering re-render
- Conditional rendering logic may have issue
- Component not re-rendering when `isTrimming` changes

**Impact**: Users cannot complete trim operation

### 3. Trimmed Clips Don't Visualize Correctly
**Problem**: After applying trim, clips should get shorter but don't
**Symptoms**:
- Trim values stored correctly in `clip.trimStart/trimEnd`
- But timeline doesn't reflect shorter duration
- Clip width calculation may be wrong

**Impact**: No visual feedback that trim worked

## Next Steps to Resolve

### Immediate Priority
1. Fix playhead synchronization (timeline ↔ video player)
2. Debug Apply Trim button rendering
3. Fix trimmed clip visualization
4. Test complete trim workflow end-to-end

### Technical Approach Needed
- Investigate React re-rendering triggers
- Check Zustand state updates
- Verify Fabric.js canvas update logic
- Add more debugging to trace state flow

### Code Locations
- **Timeline Component**: `src/renderer/components/Timeline.tsx`
- **Video Preview**: `src/renderer/components/VideoPreview.tsx`
- **Timeline Store**: `src/renderer/store/timelineStore.ts`

## Active Decisions
- **Trim UI**: Only show handles on selected clip (not all clips) ✓
- **Workflow**: Click clip → Drag handles → Apply button appears
- **Visual Feedback**: Clips should visibly shorten when trimmed

## Blockers
- Cannot demonstrate working trim functionality
- Core editing feature is broken
- User cannot complete basic video edit

## Success Criteria for Current Sprint
1. ✓ Timeline click moves playhead
2. ✓ Video player and timeline stay synced
3. ✓ Dragging trim handle shows Apply button
4. ✓ Clicking Apply makes clip shorter
5. ✓ Video playback respects trim

