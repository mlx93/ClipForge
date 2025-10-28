
Phase 2 Items (6-7 hours estimated)
From POST_PRD1_POLISH_SPEC.md:


0.5 - When the Clips get trimmed, the video preview footer needs to update state and display the new times (total time and current time of the video)

1. Fix Timeline Zoom Implementation (2-3 hours) ⚠️ HIGH RISK
Standardize zoom formula calculations (some multiply, some divide)
Fix clip rendering, playhead, time markers, click-to-seek
Test at 0.5x, 1x, 2x, 4x zoom levels
Protect trim handle logic (lines 408-559)

2. Generate Thumbnail Previews for Media Library Clips (1-1.5 hours) 🟡 MEDIUM RISK
Replace canvas placeholders with real FFmpeg-generated thumbnails
Create IPC handler for thumbnail generation
Store thumbnails in ~/Library/Application Support/ClipForge/thumbnails/
Display 160x90 JPEG thumbnails (scaled to 64x48px in UI)

3. Trim Handle Visual Improvements (1 hour) ⚠️ HIGH RISK
Increase width: 8px → 12px
Increase height: 60px → 70px
Add hover state (brighter red #f87171)
Add shadow/glow effect
CRITICAL: Only change visual properties, not drag logic

4. Visual Trim Indicators - Two-Layer Overlay (1-1.5 hours) 🟡 MEDIUM RISK
Show full clip width with trimmed regions as semi-transparent gray
Active region: solid blue (#3b82f6)
Trimmed regions: gray (#9ca3af, 40% opacity)
Users can re-expand trims without re-importing

5. Media Library Two-Button System (30 min) 🟡 MEDIUM RISK
Keep existing "+" (add to timeline) and "X" (remove from timeline) buttons
Add new trash icon "Remove from Library" button
Cascade delete: removes clip from library AND all timeline instances


Phase 3 Items (3-4 hours estimated)
From POST_PRD1_POLISH_SPEC.md:

1. Keyboard Shortcuts for Zoom (15 min)
Cmd+Plus (zoom in)
Cmd+Minus (zoom out)
Cmd+0 (reset zoom)

2. Show Clip Count Prominently (10 min)
Move clip count to media library header: "Media Library (5 clips)"
Always visible

3. Video Preview on Media Library Hover (45 min)
Show actual video frame instead of placeholder on hover
Create temp <video> element, seek to 1s, capture frame

4. Estimated Time Remaining for Exports (30 min)
Calculate export speed (2x realtime)
Display: "Encoding... 45% (~2 minutes remaining)"
Update every second

5. Clip Selection Keyboard Shortcuts (20 min)
Tab (select next clip)
Shift+Tab (select previous clip)
Cycle through timeline clips keyboard-only

6. Code Cleanup (1 hour)
Remove all console.log statements (✅ already done for imports!)
Extract magic numbers to constants.ts
Fix ResizeObserver memory leak (use useRef)
Fix keyboard handler dependency array
Add TypeScript null checks



Summary:

Phase 2 & 3 Importance Assessment
Phase 2: Nice-to-Have Polish (NOT Required for MVP)
Importance: LOW-MEDIUM for submission, HIGH for production quality
Timeline Zoom Fix: Zoom works but has coordinate inconsistencies. Not blocking MVP submission.
Thumbnail Previews: Currently shows placeholder. Real thumbnails are nice polish, not essential.
Trim Handle Visual Improvements: Current handles work perfectly. Purely cosmetic.
Visual Trim Indicators: Current solid blue clips work fine. UX enhancement, not requirement.
Media Library Two-Button System: Current X button works. Quality of life improvement.
Verdict: Phase 2 can ALL come post-MVP. These are polish features that enhance UX but don't add core functionality.
Phase 3: Pure Polish (Definitely NOT Required for MVP)
Importance: LOW for submission, MEDIUM for user experience
All Phase 3 items are polish:
Keyboard shortcuts (Cmd+/-, Tab selection)
Clip count display
Hover previews
Export time estimates (you already have progress!)
Code cleanup
Verdict: Phase 3 should definitely come post-MVP. These are the "10% that makes it feel 100%" features.