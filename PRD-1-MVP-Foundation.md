# ClipForge - Product Requirements Document
## Part 1: MVP Foundation

**Version:** 1.0  
**Last Updated:** October 27, 2025  
**Target Platform:** macOS (primary), Windows (supported)  
**Development Environment:** MacBook Pro M4, 24GB RAM

---

## 1. Project Overview

**Mission:** Build a production-grade desktop video editor enabling creators to import, arrange, edit, and export professional videos. Focus on essential workflow: Import → Arrange → Edit → Export.

**Target Users:** Content creators, educators, professionals needing simple, fast video editing without complexity.

**Value Proposition:** Native desktop app handling video editing fundamentals with performance and reliability.

---

## 2. Technical Stack

### 2.1 Framework & Languages
- **Desktop Framework:** Electron 28+
- **Frontend:** React 18+ with TypeScript
- **State Management:** Zustand (lightweight, excellent TypeScript support)
- **Styling:** Tailwind CSS + shadcn/ui components
- **Build Tool:** Vite (fast HMR, optimized builds)

### 2.2 Media Processing
- **Video Processing:** FFmpeg via fluent-ffmpeg (Node.js wrapper in main process)
- **Video Player:** HTML5 `<video>` element (native, reliable, sufficient for requirements)
- **Timeline UI:** Fabric.js (canvas-based for performance with multiple clips)

### 2.3 Development Tools
- **Package Manager:** npm or pnpm
- **Electron Packager:** electron-builder (cross-platform packaging)
- **TypeScript:** Strict mode enabled
- **Linting:** ESLint + Prettier

### 2.4 Key Dependencies
```json
{
  "electron": "^28.0.0",
  "react": "^18.2.0",
  "zustand": "^4.4.0",
  "fluent-ffmpeg": "^2.1.2",
  "fabric": "^5.3.0",
  "tailwindcss": "^3.3.0"
}
```

---

## 3. Architecture Overview

### 3.1 Electron Process Architecture

**Main Process (Node.js)**
- File system operations (import, export)
- FFmpeg video processing and encoding
- Desktop capture API management
- IPC communication with renderer
- Application lifecycle management

**Renderer Process (Browser/React)**
- UI rendering and user interactions
- Timeline canvas manipulation (Fabric.js)
- Video preview playback (HTML5)
- State management (Zustand)
- Real-time user feedback

### 3.2 Application Structure
```
clipforge/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts         # Main entry point
│   │   ├── ffmpeg.ts        # FFmpeg operations
│   │   ├── fileSystem.ts    # File handling
│   │   └── ipc/             # IPC handlers
│   ├── renderer/            # React application
│   │   ├── App.tsx          # Root component
│   │   ├── components/      # React components
│   │   │   ├── Timeline/    # Timeline editor
│   │   │   ├── Preview/     # Video preview
│   │   │   ├── MediaLibrary/# Imported clips
│   │   │   └── Controls/    # Playback controls
│   │   ├── store/           # Zustand stores
│   │   └── utils/           # Helper functions
│   └── shared/              # Shared types/constants
├── public/
└── electron-builder.json
```

### 3.3 Data Flow
1. **Import:** User drags video → Main process validates → Renderer updates state
2. **Timeline:** User arranges clips → Zustand state updates → Canvas re-renders
3. **Preview:** User scrubs playhead → Video element seeks → Frame displays
4. **Export:** User clicks export → Main process invokes FFmpeg → Progress updates via IPC

### 3.4 Memory Management

**Critical: Stream-Based Processing**

Given target videos (10-15 minutes, 100-500MB, up to 1GB total project size), memory management is essential for:
- Smooth performance on systems with 8-16GB RAM (Windows users)
- Preventing crashes during extended editing sessions
- Supporting multiple clips without loading all into memory

**Memory-Conscious Strategies:**

1. **FFmpeg Streaming**
   - Use fluent-ffmpeg's streaming capabilities (default behavior)
   - Process video in chunks rather than loading entire files
   - Read → Process → Write pipeline without full RAM storage
   - Example: When concatenating 5×300MB clips, stream each sequentially

2. **Preview Optimization**
   - Only load video frames for current playhead position + buffer
   - HTML5 `<video>` element handles this natively
   - Use `preload="metadata"` for clips not currently playing
   - Limit simultaneous video element instances (max 2-3 active)

3. **Timeline Rendering**
   - Fabric.js canvas: render visible timeline region only
   - Virtual scrolling for long timelines with 10+ clips
   - Lazy-load thumbnails (generate on-demand, cache to disk)

4. **State Management**
   - Store video file paths in Zustand, not actual video data
   - Keep metadata (duration, resolution) in memory
   - Reference files on disk, process on-demand

5. **Export Process**
   - Stream clips through FFmpeg without intermediate full renders
   - Write directly to output file
   - Monitor memory usage; abort if approaching limits

**Performance Targets:**
- Maintain < 500MB RAM usage during typical editing (5-6 clips)
- Handle 10+ clips without exceeding 1GB RAM
- No memory leaks during 15+ minute sessions

---

## 4. MVP Core Requirements

**Hard Gate Criteria - All Required:**

### 4.1 Desktop Application Launch ✓
- Electron app launches on macOS (primary target)
- Window opens with proper dimensions (1280×720 minimum)
- Application menu bar functional
- Graceful error handling if launch fails

### 4.2 Basic Video Import ✓
**Must Support:**
- **Drag & Drop:** Drag MP4/MOV files from Finder directly into app
- **File Picker:** "Import" button opens native file dialog
- **Supported Formats:** MP4, MOV (H.264 video, AAC audio)
- **Validation:** Reject unsupported formats with user-friendly error message

**Technical Requirements:**
- Parse video metadata (duration, resolution, frame rate, codec)
- Store file path reference (not video data) in application state
- Display confirmation when import succeeds

### 4.3 Simple Timeline View ✓
**Visual Requirements:**
- Horizontal timeline spanning viewport width
- Time markers (0:00, 0:05, 0:10, etc.) at regular intervals
- Imported clips displayed as visual blocks with:
  - Clip name overlay
  - Duration indicator
  - Visual distinction from background
- Playhead indicator (vertical red line) showing current time position

**Interaction Requirements:**
- Clips arranged horizontally in sequence (left-to-right = chronological)
- Scroll timeline if clips extend beyond viewport
- Click on timeline to move playhead to that position

### 4.4 Video Preview Player ✓
**Playback Requirements:**
- Preview window (640×360 minimum) showing current frame
- Standard controls:
  - Play button (toggles to Pause when playing)
  - Timeline scrubber bar showing current position
  - Time display (current / total duration)
- Audio plays synchronized with video
- Preview updates when playhead moves on timeline

**Technical Implementation:**
- HTML5 `<video>` element
- Sync video currentTime with timeline playhead position
- Handle video loading states (buffering, error)

### 4.5 Basic Trim Functionality ✓
**Required Capabilities:**
- Select a clip on timeline
- Set **In Point** (start trim) by positioning playhead and marking
- Set **Out Point** (end trim) by positioning playhead and marking
- Visual indicators show trimmed region vs. full clip
- Preview reflects trimmed version
- **Split Clip:** Ability to split clip at playhead position into two separate clips

**UI Pattern:**
- Trim handles at clip start/end on timeline
- Drag handles to adjust in/out points
- OR: Buttons to "Mark In" / "Mark Out" at current playhead
- "Split" button/shortcut cuts clip at playhead

### 4.6 Export to MP4 ✓
**Export Requirements:**
- "Export" button in main UI
- Export dialog with:
  - Output filename input
  - Save location selector
  - Resolution dropdown (720p, 1080p, Source)
  - "Start Export" confirmation
- Progress indicator during export (% complete or time remaining)
- Success notification with "Open Folder" option when complete

**Technical Implementation - Critical:**
> **Technical Hint:** FFmpeg is essential for encoding. You'll need to stitch clips, apply cuts, and render to final format.

**FFmpeg Export Pipeline:**
1. Generate FFmpeg command for timeline composition:
   - Concatenate multiple clips in sequence
   - Apply trim points (start/end times) for each clip
   - Set output resolution and encoding parameters
2. Execute fluent-ffmpeg in main process
3. Stream progress events to renderer via IPC
4. Write final MP4 to user-selected location

**Export Specifications:**
- Codec: H.264 (libx264)
- Audio: AAC, 128kbps
- Container: MP4
- Resolution: Match source or user-selected (720p/1080p)
- Frame rate: Preserve source frame rate

### 4.7 Native App Packaging ✓
**Build Requirements:**
- Use electron-builder to package for distribution
- Generate macOS `.app` (signed, notarized if possible)
- Generate Windows `.exe` (optional for MVP, recommended for compatibility)
- Application icon (1024×1024, scaled to required sizes)
- Application name: "ClipForge"
- Version: 1.0.0

**Distribution:**
- Provide downloadable `.dmg` (macOS) or `.app` bundle
- Include README with installation instructions
- Test packaged app on clean macOS installation (not just dev mode)

---

## 5. Natural Extensions (70% to Final Product)

These features flow naturally from MVP requirements and should be included if time permits, prioritizing top to bottom:

### 5.1 Multi-Clip Sequencing ✓
**Why It Matters:** MVP requires import and timeline display; this extends to actual editing workflow.

- **Drag clips onto timeline** from media library panel
- **Arrange clips in sequence:** Drag to reorder
- **Delete clips** from timeline (select + Delete key or button)
- Timeline updates preview to show sequence of multiple clips
- Export handles multi-clip projects (stitch all clips in order)

### 5.2 Enhanced Timeline Interactions
- **Snap-to-grid:** Clips snap to time markers or clip edges when dragging
- **Timeline zoom:** Zoom in/out to see more/less time detail (Cmd+/Cmd-)
- Visual feedback when hovering over clips (highlight, cursor change)

### 5.3 Media Library Panel
**Why It Matters:** Managing multiple imported clips requires organization.

- Dedicated panel showing all imported clips
- Thumbnail preview for each clip (generated from first frame)
- Metadata display: filename, duration, resolution, file size
- Click clip to preview in preview window
- Drag clip from library to timeline

### 5.4 Project Save/Load (Lower Priority)
**Why It Matters:** Users need to preserve work between sessions.

- Save project state to `.clipforge` JSON file:
  - Imported clip paths
  - Timeline arrangement (clip order, trim points)
  - Project settings (resolution, frame rate)
- Load project from file on app launch or via File → Open
- Auto-save to temp location every 2 minutes

**Note:** Lower priority than core editing features. Implement after import/timeline/export solidified.

### 5.5 Improved Export Options
- Export progress modal with cancel button
- Preview output settings before starting export
- "Export as..." dialog (vs. automatic filename)
- Maintain aspect ratio during resolution changes

---

---

## 6. Technical Hints (Critical Implementation Notes)

These technical hints from the project requirements are essential for successful implementation:

### 6.1 Recording APIs (For PRD Part 2)
> **Technical Hint for Electron:** Use desktopCapturer API to list available screens/windows, then pass source to getUserMedia(). For webcam, use standard navigator.mediaDevices.getUserMedia().

**Implementation Notes:**
- Desktop capture requires desktopCapturer to enumerate sources
- Pass selected source to getUserMedia() for actual capture
- Webcam uses standard web APIs (navigator.mediaDevices)
- Alternative: navigator.mediaDevices.getDisplayMedia() works in both Electron and Tauri but may have window selection limitations

### 6.2 FFmpeg Video Processing (For MVP)
> **Technical Hint:** FFmpeg is essential for encoding. You'll need to stitch clips, apply cuts, and render to final format.

**Implementation Notes:**
- FFmpeg handles all video encoding and manipulation
- Use fluent-ffmpeg wrapper for simpler Node.js integration
- Key operations: concatenate clips, apply trim points, scale resolution
- Stream processing (default) prevents memory overload
- Test export early with single clip to validate pipeline

---

## 7. Technical Implementation Guidelines

### 7.1 Video Import
**File Picker:** `dialog.showOpenDialog()` with MP4/MOV filters | **Drag/Drop:** Handle `onDrop`, filter videos, send paths via IPC | **Metadata:** `ffmpeg.ffprobe()` extracts duration, resolution, codec, frame rate

### 7.2 Timeline (Fabric.js)
Initialize canvas with time markers every 5s | Render clips as `Rect` positioned by `(startTime/totalDuration) * canvasWidth` | Store clip ID on each object

### 7.3 Video Preview
HTML5 `<video>` with `preload="metadata"` | Sync `video.currentTime` with playhead via useEffect | Load as `file://${clip.path}`

### 7.4 Trim & Split
Store `trimStart/trimEnd` offsets in clip state | **Split:** Create two clips from original, first ends at splitTime, second starts there | Update canvas to reflect trimmed widths

### 7.5 Export (FFmpeg - Critical)
> **Technical Hint:** FFmpeg is essential for encoding. Stitch clips, apply cuts, render to final format.

**Pseudo-code:**
```
for clip: ffmpeg.input(clip.path).inputOptions(['-ss trimStart', '-to trimEnd'])
ffmpeg.complexFilter([scale to resolution, concat video/audio streams])
  .outputOptions(['-c:v libx264 -preset fast -c:a aac'])
  .on('progress', sendIPCUpdate).run()
```

### 7.6 IPC Communication
**Main:** `ipcMain.handle('import-videos')`, `ipcMain.handle('export-timeline')` | **Renderer:** `window.electron.invoke('import-videos', paths)` | **Progress:** `mainWindow.webContents.send('export-progress', percent)`

---

## 8. State Management (Zustand)

**Timeline Store:** Clips array, playhead position, selected clip, CRUD operations  
**Project Store:** Project path, dirty flag, save/load functions  
**Export Store:** Export status, progress percentage, error handling

Each store manages its domain with simple, typed actions. Stores are independent and communicate via React hooks.

---

## 9. Performance Requirements

**Responsiveness:** Timeline drag <16ms (60fps) | Video seeks <100ms | App launch <5s  
**Memory:** Idle <150MB | 5 clips <500MB | 10+ clips <1GB | No leaks over 15+ min sessions  
**Export:** 2x realtime speed minimum (1 min video exports in <30s)  
**Quality:** Exported videos match source quality, reasonable file sizes

---

## 10. Testing & Validation

**MVP Acceptance Tests:**
1. **Import:** Drag MP4/MOV → Appears in library with metadata
2. **Timeline:** Drag clips → Arrange sequence → Delete clips
3. **Preview:** Click clip → Play → Video/audio sync
4. **Trim/Split:** Mark in/out → Split at playhead → Displays correctly
5. **Export:** 2-3 clips → Export 720p MP4 → Plays in external player
6. **Packaged:** Build .app → Test all features (not dev mode)

**Edge Cases:** Invalid file → Error | Empty timeline export → Warning | Boundary splits → Graceful

---

## 11. Deliverables

- **GitHub Repository:** Source code, README with setup/build instructions, architecture overview
- **Packaged App:** macOS .dmg or .app bundle, download link (GitHub Releases/Google Drive)
- **Demo Video (3-5 min):** Import → Arrange → Edit → Export walkthrough
- **Documentation:** Key technical decisions, dependency list, known limitations

---

## 12. Development Workflow

### 12.1 Initial Setup
**Initial Setup:** Electron + React + TypeScript with Vite | electron-builder config | Tailwind + shadcn/ui | FFmpeg (system + fluent-ffmpeg) | IPC handlers

### 12.2 Build Order (Recommended)
**Phase 1: Foundation**
- Electron app launches with React UI
- Basic window setup and app menu
- File picker integration working

**Phase 2: Import & Display**
- Video import (drag & drop + file picker)
- Metadata extraction with FFmpeg
- Display imported clips in media library

**Phase 3: Timeline**
- Fabric.js canvas setup
- Render clips on timeline
- Playhead indicator and click-to-seek

**Phase 4: Preview**
- HTML5 video player
- Sync with timeline playhead
- Play/pause controls

**Phase 5: Edit Operations**
- Trim functionality (in/out points)
- Split clip at playhead
- Delete clip from timeline
- Drag to reorder clips

**Phase 6: Export**
- FFmpeg export pipeline
- Multi-clip concatenation
- Progress indicator
- Resolution options

**Phase 7: Packaging & Testing**
- electron-builder configuration
- Build .app bundle
- Test on clean system
- Record demo video

### 12.3 Critical Path
**Must Have for MVP:**
1. Import videos ✓
2. Display on timeline ✓
3. Preview playback ✓
4. Trim/split ✓
5. Export ✓
6. Package app ✓

**Nice to Have (if time permits):**
1. Media library panel with thumbnails
2. Snap-to-grid on timeline
3. Project save/load
4. Timeline zoom
5. Multiple resolution export options

---

## 13. Risk Mitigation

### 13.1 Technical Risks
**FFmpeg Installation:** Bundle FFmpeg binaries with app using @ffmpeg-installer/ffmpeg package  
**Cross-Platform:** Use path.join() consistently; test file paths on Windows (backslashes vs forward slashes)  
**Memory:** Implement streaming processing (Section 3.4); test with 1GB+ projects  
**Export:** Use FFmpeg presets optimized for speed; test early with various clip combinations

### 13.2 Development Notes
**FFmpeg:** Use fluent-ffmpeg wrapper (simpler API) and reference documentation early to avoid encoding surprises. Test export with single clip as soon as possible.

**Packaging:** Test packaged app early, not just dev mode. File paths and resources behave differently in production builds.

---

## 14. Success Criteria

**MVP Complete:** All 7 requirements met | Import multiple files | Arrange on timeline | Preview at playhead | Trim/split clips | Export playable MP4 | Packaged app functions correctly

**70% to Full Product:** Multi-clip sequencing | Media library with thumbnails | Timeline zoom/snap | Project save/load | Resolution export options  

---

## 15. Next Steps

After MVP completion, proceed to **PRD Part 2: Full Features**, which will cover:
- Screen and webcam recording (desktopCapturer API)
- Advanced timeline features (multi-track, PiP)
- Enhanced export options
- Stretch goals (undo/redo, transitions, keyboard shortcuts)

**PRD Part 3: AI Subtitles** will be created separately after PRD Part 2 features are complete.

---

**End of PRD Part 1**