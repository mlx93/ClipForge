# ClipForge - Product Requirements Document
## Part 2: Full Features & Advanced Capabilities

**Version:** 1.0  
**Last Updated:** October 27, 2025  
**Prerequisites:** PRD Part 1 (MVP Foundation) must be completed first  
**Target Platform:** macOS (primary), Windows (supported)

---

## 1. Project Overview

### 1.1 Scope
PRD Part 2 builds upon the MVP foundation to create a complete video editor with:
- Native recording capabilities (screen, webcam, audio)
- Advanced timeline editing (multi-track, picture-in-picture)
- Professional export options
- Enhanced user experience (undo/redo, keyboard shortcuts, auto-save)

**This PRD assumes all MVP requirements from PRD Part 1 are implemented and functional.**

### 1.2 Feature Priority
**Phase 1 (Critical for Full Submission):**
1. Recording features (screen + webcam + audio)
2. Multi-track timeline with picture-in-picture
3. Enhanced export options

**Phase 2 (Polish & UX):**
4. Undo/redo functionality
5. Keyboard shortcuts
6. Auto-save on force quit

**Phase 3 (Enhancement):**
7. Transitions between clips
8. Text overlays

---

## 2. Technical Stack Additions

### 2.1 New Dependencies
```json
{
  "mediadevices": "For screen/webcam capture",
  "electron-store": "^8.1.0",  // Persistent app state
  "hotkeys-js": "^3.12.0",      // Keyboard shortcuts
  "canvas": "For text overlay rendering (if needed)"
}
```

### 2.2 Recording APIs
**Electron APIs:**
- `desktopCapturer` - List available screens/windows
- `navigator.mediaDevices.getUserMedia()` - Webcam access
- `navigator.mediaDevices.getDisplayMedia()` - Screen sharing (alternative)

**MediaRecorder API:**
- Record MediaStream to blob/file
- Support webm/mp4 containers
- Handle audio mixing from multiple sources

---

## 3. Architecture Additions

### 3.1 New Components

**Main Process Additions:**
```
src/main/
  ├── recorder.ts           # Screen/webcam recording logic
  ├── desktopCapture.ts     # desktopCapturer wrapper
  └── ipc/
      └── recordingHandlers.ts  # IPC for recording
```

**Renderer Process Additions:**
```
src/renderer/
  ├── components/
  │   ├── RecordingPanel/       # Recording UI
  │   │   ├── ScreenSelector.tsx
  │   │   ├── WebcamSelector.tsx
  │   │   ├── RecordButton.tsx
  │   │   └── RecordingPreview.tsx
  │   ├── AdvancedTimeline/     # Multi-track timeline
  │   │   ├── TrackManager.tsx
  │   │   ├── PiPOverlay.tsx
  │   │   └── TimelineZoom.tsx
  │   └── TextOverlay/          # Text overlay editor
  │       ├── TextEditor.tsx
  │       └── FontSelector.tsx
  ├── store/
  │   ├── recordingStore.ts     # Recording state
  │   ├── historyStore.ts       # Undo/redo
  │   └── shortcutsStore.ts     # Keyboard shortcuts
  └── hooks/
      ├── useRecording.ts       # Recording logic hook
      └── useKeyboardShortcuts.ts
```

### 3.2 Data Flow for Recording

**Recording Workflow:**
1. User selects screen source → IPC to main → desktopCapturer lists sources
2. User selects webcam → getUserMedia() in renderer
3. User starts recording → MediaRecorder captures both streams
4. Recording saves → Auto-imports to media library → Available for timeline

**Multi-Track Timeline:**
1. Main track (Track 1) - Primary video content
2. Overlay track (Track 2+) - Picture-in-picture, webcam overlays
3. Each track has independent clips with position/scale properties
4. Export: FFmpeg overlays tracks using `overlay` filter

---

## 4. Technical Hints (Critical Implementation Notes)

### 4.1 Recording Implementation
> **Technical Hint for Electron:** Use desktopCapturer API to list available screens/windows, then pass source to getUserMedia(). For webcam, use standard navigator.mediaDevices.getUserMedia().

**Implementation Overview:**

**Step 1: List Available Sources (Main Process)**
- Use `desktopCapturer.getSources()` with types: ['screen', 'window']
- Return array of sources with id, name, and thumbnail dataURL
- Send to renderer via IPC for display in UI

**Step 2: Capture Screen (Renderer Process)**
- Call `getUserMedia()` with constraints:
  - audio: false
  - video mandatory: chromeMediaSource='desktop', chromeMediaSourceId=sourceId
  - Set min/max resolution (1280x720 to 1920x1080)
- Returns MediaStream for screen content

**Step 3: Capture Webcam**
- Call `getUserMedia()` with constraints: video width/height, audio: true
- Returns MediaStream with webcam video + microphone audio

**Step 4: Combine Streams (Simultaneous Recording)**
- Get screen MediaStream (video only)
- Get webcam MediaStream (video + audio)
- Create new MediaStream combining: screen video tracks + webcam audio tracks
- Initialize MediaRecorder with combined stream, codec: 'video/webm;codecs=vp9'

**Step 5: Save Recording**
- MediaRecorder ondataavailable: collect chunks into array
- MediaRecorder onstop: combine chunks into Blob
- Convert Blob to ArrayBuffer
- Send buffer to main process via IPC to save as video file
- Main process writes to disk and auto-imports to media library

### 4.2 Multi-Track Timeline with Picture-in-Picture

**Concept:** Track 1 is main video, Track 2+ are overlay videos positioned/scaled on top.

**FFmpeg Implementation Logic:**
- Add all video inputs from all tracks to FFmpeg command
- Build overlay filter chain:
  - Scale Track 1 (base) to target resolution
  - Scale Track 2+ (overlays) to PiP size
  - Apply overlay filter: position Track 2 on Track 1 at (x, y) coordinates
  - For 3+ tracks: chain overlays sequentially (Track 1 + Track 2 = tmp, tmp + Track 3 = out)
- Map final output video stream
- Execute export

**Overlay Filter Syntax:**
- Single overlay: `[base][pip]overlay=x:y[out]`
- Multiple overlays: Chain with temp labels `[tmp1], [tmp2]...`
- Position examples:
  - Bottom-right: `overlay=W-w-10:H-h-10`
  - Top-left: `overlay=10:10`
  - Center: `overlay=(W-w)/2:(H-h)/2`

---

## 5. Core Features (Full Submission)

### 5.1 Recording Features

#### 5.1.1 Screen Recording
**Requirements:**
- Display list of available screens and windows with preview thumbnails
- User selects source (full screen, specific window, or display)
- Start/stop recording with visual indicator
- Save recording directly to media library
- Recording quality: 1080p at 30fps minimum

**UI Components:**
- Screen selector dropdown with thumbnails
- Red recording indicator when active
- Timer showing recording duration
- Stop button to end recording

**Technical Notes:**
- Use desktopCapturer to enumerate sources
- Pass sourceId to getUserMedia with chromeMediaSource: 'desktop'
- MediaRecorder saves to webm, convert to mp4 if needed via FFmpeg

#### 5.1.2 Webcam Recording
**Requirements:**
- List available webcams (if multiple)
- Preview webcam feed before recording
- Start/stop recording
- Save to media library
- Recording quality: 720p at 30fps minimum

**UI Components:**
- Webcam selector dropdown
- Live preview window
- Recording controls (start/stop)
- Audio level indicator

**Technical Notes:**
- Use navigator.mediaDevices.enumerateDevices() to list cameras
- getUserMedia() with video constraints
- Include audio from microphone by default

#### 5.1.3 Simultaneous Screen + Webcam (Picture-in-Picture)
**Requirements:**
- Record screen and webcam simultaneously
- Webcam appears as overlay in corner (configurable position)
- Single recording file with webcam composited onto screen
- OR: Save as two separate clips (screen + webcam) that user can arrange

**Implementation Options:**
**Option A (Recommended):** Save as two separate clips
- Easier to implement
- More flexible for user (can adjust PiP position/size in timeline)
- User drags webcam clip onto Track 2 above screen clip

**Option B:** Composite during recording
- More complex (requires canvas overlay during recording)
- Less flexible for user
- Recording is final composition

**Choose Option A for MVP.**

#### 5.1.4 Audio Capture
**Requirements:**
- Capture microphone audio during screen/webcam recording
- Audio level visualization during recording
- Sync audio with video
- Support for system audio capture (if possible)

**Technical Notes:**
- getUserMedia() with audio: true
- Visualize audio using Web Audio API (AnalyserNode)
- System audio capture is complex on macOS (requires additional permissions)

**Recording Controls UI:**
```
┌─────────────────────────────────┐
│  🎥 Recording Panel              │
├─────────────────────────────────┤
│  Screen: [🖥️ Display 1      ▼]  │
│  Webcam: [📷 FaceTime HD    ▼]  │
│  Audio:  [🎤 Built-in Mic   ▼]  │
│                                  │
│  [●  Start Recording]            │
│                                  │
│  ⏱️  00:00:00                    │
│  🔴 Recording...                 │
│  [■  Stop Recording]             │
└─────────────────────────────────┘
```

---

### 5.2 Advanced Timeline Editor

#### 5.2.1 Multi-Track Timeline
**Requirements:**
- Support at least 2 tracks (expandable to 3-4)
- Track 1: Main video track (primary content)
- Track 2+: Overlay tracks (picture-in-picture, annotations)
- Clips on upper tracks overlay clips on lower tracks
- Independent clip manipulation per track (trim, move, delete)

**Visual Design:**
```
Timeline:
┌────────────────────────────────────────────────┐
│ Track 2 (Overlay) │  [Webcam Clip]             │
│──────────────────────────────────────────────  │
│ Track 1 (Main)    │ [Screen Recording──────]   │
└────────────────────────────────────────────────┘
         0:00    0:10    0:20    0:30    0:40
```

**Implementation:**
- Fabric.js: Each track is a horizontal section of canvas at different Y positions
- Clips on Track 2 rendered above Track 1 clips visually
- Export: FFmpeg overlay filter composites tracks

#### 5.2.2 Picture-in-Picture Positioning
**Requirements:**
- Clips on overlay track have position properties (x, y)
- User can adjust PiP size (scale: 0.1 to 1.0)
- Drag PiP to different corner positions (preset: top-left, top-right, bottom-left, bottom-right)
- Preview window shows PiP overlay in real-time

**UI Controls:**
- PiP position preset buttons (4 corners)
- Size slider (small, medium, large)
- Custom position by dragging in preview window

**Export Behavior:**
```
FFmpeg overlay filter:
[base][overlay]overlay=x:y[out]

Example (bottom-right, small):
overlay=W-w-10:H-h-10
```

#### 5.2.3 Timeline Zoom (Enhanced from MVP)
**Requirements:**
- Zoom in: Show more detail (1 second = more pixels)
- Zoom out: See more timeline at once
- Keyboard shortcuts: Cmd+Plus, Cmd+Minus
- Zoom levels: 0.5x, 1x, 2x, 4x, 8x
- Zoom centers on playhead position

**Implementation:**
- Adjust Fabric.js canvas scaling factor
- Recalculate clip widths based on zoom level
- Update time marker intervals (zoom out = larger intervals)

#### 5.2.4 Snap-to-Grid (Enhanced from MVP)
**Requirements:**
- Clips snap to time grid (every 1 second by default)
- Clips snap to edges of adjacent clips
- Visual indicator when snap occurs (clip "magnets" to position)
- Toggle snap on/off via button or shortcut (Cmd+S)

**Implementation:**
- When dragging clip, check distance to nearest grid line
- If within threshold (e.g., 10 pixels), snap clip position
- When dragging near another clip edge, snap to align

---

### 5.3 Enhanced Media Library

**Beyond MVP (from PRD1 Section 5.3), add:**

#### 5.3.1 Advanced Metadata
**Display:**
- File format codec (H.264, VP9, etc.)
- Frame rate (30fps, 60fps)
- Bitrate (5 Mbps, 10 Mbps)
- Audio channels (Stereo, Mono)
- Date imported

#### 5.3.2 Clip Organization
**Features:**
- Sort clips by: Name, Duration, Date imported, File size
- Filter clips by: Format, Resolution, Duration range
- Search clips by filename
- Mark clips as "favorites" (star icon)

#### 5.3.3 Batch Operations
**Features:**
- Select multiple clips (Shift+Click, Cmd+Click)
- Delete multiple clips at once
- Add multiple clips to timeline in sequence
- Export metadata for selected clips

---

### 5.4 Export Enhancements

#### 5.4.1 Resolution Options
**MVP has:** 720p, 1080p, Source

**Full Submission:**
- Maintain the same three core options (sufficient for most use cases)
- 720p (1280×720) - Standard HD
- 1080p (1920×1080) - Full HD
- Source - Match original video resolution

**Aspect Ratio Handling:**
- Maintain aspect ratio by default
- Option to "Fill" (crop) or "Fit" (letterbox) if needed

#### 5.4.2 Cloud Export & Sharing

**Requirements:**
- Upload completed video to file hosting service
- Generate shareable link for easy distribution
- Time-limited links (24-48 hour expiry recommended)
- Upload progress indicator
- Copy link to clipboard functionality

**Implementation Approach:**
- Use simple file hosting API (e.g., file.io, tmpfiles.org, or similar)
- HTTP POST request with video file
- Receive shareable URL in response
- Display link to user with "Copy Link" button
- No backend infrastructure required
- No OAuth complexity

**UI Flow:**
1. User completes export → Video saved locally
2. "Share" button appears next to exported file
3. Click "Share" → Upload starts with progress bar
4. Upload completes → Link displayed in modal
5. User can copy link and share via email, chat, etc.

**Technical Notes:**
- File hosting services typically have size limits (check service limits)
- Consider compression for large files before upload
- Provide fallback: "Upload failed, but video saved locally at [path]"
- Link expiry notification: "Link expires in 24 hours"

**Alternative (if preferred):**
- Users can manually upload to Google Drive/Dropbox themselves
- App focuses on local export; sharing is user's responsibility
- Keeps app simple without upload complexity

---

## 6. Stretch Goals (Priority Order)

### 6.1 Undo/Redo Functionality

**Requirements:**
- Undo last action: Cmd+Z
- Redo last undone action: Cmd+Shift+Z
- Actions that can be undone:
  - Add clip to timeline
  - Remove clip from timeline
  - Trim clip
  - Split clip
  - Move clip (reorder)
  - Adjust clip properties (PiP position, size)
- Undo stack: Maintain last 50 actions
- Visual indicator: Grayed out undo/redo buttons when unavailable

**Implementation:**
- Use history pattern with Zustand
- Each action pushes to history stack
- Undo pops from stack and reverses action
- Clear history on project close

**State Management:**
```typescript
interface HistoryStore {
  past: TimelineState[];
  present: TimelineState;
  future: TimelineState[];
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}
```

**Technical Notes:**
- Store only state diffs to minimize memory
- Debounce rapid actions (e.g., dragging) to avoid polluting history
- Some actions not undoable: Import, Export, Save

---

### 6.2 Auto-Save on Force Quit

**Requirements:**
- Automatically save project state every 2 minutes
- On app force quit (crash, OS kill), preserve last state
- On next app launch, offer to "Restore Previous Session"
- Store auto-save in temp directory (e.g., `~/Library/Application Support/ClipForge/autosave.json`)
- Clear auto-save after successful manual save

**Implementation:**
- Use electron-store for persistent storage
- setInterval to trigger auto-save every 120 seconds
- On app quit event, save current state
- On app launch, check for auto-save file
- If exists and timestamp < 24 hours old, prompt user

**Auto-Save Data:**
```json
{
  "timestamp": "2025-10-27T10:30:00Z",
  "clips": [...],
  "timeline": {...},
  "playhead": 15.5,
  "projectPath": "/path/to/project.clipforge"
}
```

**UI:**
```
┌─────────────────────────────────────┐
│  📋 Restore Previous Session?       │
├─────────────────────────────────────┤
│  ClipForge unexpectedly quit.       │
│  Restore your work from 2 min ago?  │
│                                      │
│  [Restore]  [Discard]                │
└─────────────────────────────────────┘
```

---

### 6.3 Transitions Between Clips

**Requirements:**
- Support basic transitions: Fade, Dissolve, Slide
- Apply transition at clip boundaries (end of Clip A → start of Clip B)
- Transition duration: 0.5s, 1s, 1.5s, 2s (user selectable)
- Visual indicator on timeline showing transition overlap

**Transition Types:**
1. **Fade:** Clip A fades to black, Clip B fades from black
2. **Dissolve (Cross-fade):** Clip A fades out while Clip B fades in
3. **Slide:** Clip B slides in from edge while Clip A slides out

**Implementation Logic:**
- Add both clips as inputs to FFmpeg
- Use `xfade` filter with parameters:
  - transition type: fade, dissolve, slide, etc.
  - duration: transition length in seconds
  - offset: when transition starts (clip1Duration - transitionDuration)
- Map output video stream
- FFmpeg automatically handles blending between clips during transition period

**UI:**
- Right-click between two clips → "Add Transition"
- Dropdown: Fade, Dissolve, Slide
- Duration slider
- Preview transition in preview window

---

### 6.4 Keyboard Shortcuts

**Requirements:**
- Define shortcuts for common actions
- Display shortcut hint on hover over buttons
- Shortcut reference sheet (Help → Keyboard Shortcuts)

**Essential Shortcuts:**
```
Playback:
  Space       - Play/Pause
  J           - Rewind
  K           - Pause
  L           - Fast forward
  ←/→         - Previous/Next frame

Timeline:
  Cmd+Z       - Undo
  Cmd+Shift+Z - Redo
  Cmd+C       - Copy clip
  Cmd+V       - Paste clip
  Cmd+X       - Cut clip
  Delete      - Delete selected clip
  S           - Split clip at playhead
  I           - Mark In point
  O           - Mark Out point

View:
  Cmd++       - Zoom in timeline
  Cmd+-       - Zoom out timeline
  Cmd+0       - Reset zoom

Recording:
  Cmd+R       - Start recording
  Cmd+Shift+R - Stop recording

File Operations:
  Cmd+S       - Save project
  Cmd+E       - Export
  Cmd+I       - Import media
  Cmd+N       - New project
  Cmd+O       - Open project
```

**Additional Menu Bar Enhancements:**
• **Comprehensive Application Menu** - Expand menu bar with all keyboard shortcuts visible in dropdown menus
• **Enhanced File Menu** - New, Open, Save, Export, Import options with keyboard shortcuts
• **Edit Menu** - Undo, Redo, Copy, Paste, Cut, Delete with proper enabled/disabled states
• **Recording Menu** - Start/Stop recording options with visual indicators
• **Help Menu** - Keyboard shortcuts reference and app information

**Implementation:**
- Use hotkeys-js library
- Register shortcuts on app mount
- Unregister on unmount to prevent conflicts
- Allow user customization (stretch within stretch)

---

### 6.5 Text Overlays

**Requirements:**
- Add text overlay to timeline as separate layer
- Text properties:
  - Content (string)
  - Font family (Arial, Helvetica, Times, custom)
  - Font size (12-96px)
  - Color (hex picker)
  - Position (x, y)
  - Duration (start/end time)
- Text animations (optional):
  - Fade in/out
  - Slide in from edge
  - Typewriter effect

**UI:**
- "Add Text" button in toolbar
- Text editor panel:
  - Text input field
  - Font selector dropdown
  - Size slider
  - Color picker
  - Position controls (drag in preview or numeric input)

**Implementation Logic:**
- Use FFmpeg `drawtext` filter with parameters:
  - text: string content
  - fontfile: path to font file
  - fontsize: size in pixels
  - fontcolor: hex color
  - x, y: position coordinates
  - enable: time range expression 'between(t,start,end)'
- Apply filter to video input, render to output

**Timeline Representation:**
- Text overlays appear on separate track (Track 3+)
- Visual: Purple/magenta blocks with "T" icon
- Click to edit text properties

---

## 7. State Management Extensions

### 7.1 New Zustand Stores

**Recording Store:**
- State: isRecording (bool), recordingType (enum), screenSource, webcamSource, duration (number)
- Actions: startRecording(type, sources), stopRecording()
- Used by: RecordingPanel component

**History Store (Undo/Redo):**
- State: past (array of states), present (current state), future (array of states)
- Actions: undo(), redo(), pushState(state), canUndo (computed), canRedo (computed)
- Pattern: Command pattern with state snapshots

**Shortcuts Store:**
- State: shortcuts (Map<keyCombo, handler>)
- Actions: registerShortcut(key, handler), unregisterShortcut(key)
- Used by: Global keyboard handler hook

---

## 8. Performance Requirements

### 8.1 Core Performance Targets (From Assignment)

**Timeline Responsiveness:**
- Timeline UI remains responsive with 10+ clips
- Drag, trim, and split operations complete without lag
- Target: <16ms per frame (60fps) for timeline interactions

**Preview Playback:**
- Preview playback is smooth (30fps minimum)
- Video seeks within 100ms when scrubbing
- Audio remains synchronized with video

**Export Reliability:**
- Export completes without crashes
- Progress updates accurately throughout export
- Target: Export speed at or above realtime (1 min video exports in ≤1 min)

**App Launch:**
- App launch time under 5 seconds on macOS
- Clean startup without errors or warnings

**Memory Stability:**
- No memory leaks during extended editing sessions (test for 15+ minutes)
- Memory usage should remain stable and not grow unbounded
- Target: Typical projects (5-6 clips) use <500MB RAM, larger projects (10+ clips) stay under 1GB

**Export Quality:**
- Exported videos maintain reasonable quality (not bloated)
- File sizes comparable to source videos
- No visual artifacts or compression issues

### 8.2 Additional Targets for PRD2 Features

**Recording Performance:**
- Screen recording maintains 30fps minimum during capture
- Webcam preview shows minimal latency (<100ms)
- Simultaneous recording (screen + webcam) does not drop frames
- Target recording file size: <100MB per minute at 1080p

**Multi-Track Performance:**
- Timeline remains responsive with 2 tracks + multiple clips per track
- Overlay preview updates promptly when adjusting PiP position
- Export with overlays completes reliably

**Feature Overhead:**
- Recording active: Minimize additional memory usage
- Multi-track editing: Each additional track adds minimal overhead
- Undo history: Keep memory footprint reasonable (target <50MB for 50 actions)

**Note:** Specific numeric targets are guidelines, not strict requirements. Focus on maintaining smooth user experience and stability.

---

## 9. Technical Implementation Guidelines

### 9.1 Recording Pipeline

**Flow:**
1. User clicks "Start Recording" → Opens recording panel
2. User selects sources (screen + webcam + audio)
3. User clicks "Start" → IPC to main → Gets source IDs
4. Renderer calls getUserMedia() with sources → Gets MediaStreams
5. MediaRecorder starts → Records to chunks
6. User clicks "Stop" → MediaRecorder stops
7. Chunks combined to Blob → Sent to main process
8. Main saves Blob as video file → Auto-imports to media library

**Key Challenge:** Combining screen + webcam during recording.

**Solution:** Record separately, import as two clips, user arranges on timeline.

### 9.2 Multi-Track Export

**FFmpeg Overlay Filter Logic:**

**Basic overlay (2 tracks):**
- Input: track1.mp4 (base), track2.mp4 (overlay)
- Filter: `[0:v][1:v]overlay=x:y[out]`
- Where x, y are pixel coordinates for overlay position
- Common positions: W-w-10:H-h-10 (bottom-right), 10:10 (top-left)

**Multiple overlays (3+ tracks):**
- Chain overlays sequentially using temp labels
- Example: Track1 + Track2 = tmp1, tmp1 + Track3 = tmp2, tmp2 + Track4 = out
- Each overlay filter references previous temp output

**Implementation Steps:**
1. Add all track clips as FFmpeg inputs
2. Build filter chain array based on number of tracks
3. For each overlay track (2+):
   - Create overlay filter with position from track.position.x/y
   - Use temp label if more tracks follow, final label [out] for last overlay
4. Apply complexFilter with full chain
5. Map output video stream and execute

### 9.3 Undo/Redo Implementation

**Command Pattern:**
- Before any timeline action: Clone current state, push to history.past array
- Execute action: Update timeline state
- On undo: Pop from past, push present to future, restore previous state
- On redo: Pop from future, push present to past, restore future state

**Optimization:** 
- Store state diffs instead of full state copies to reduce memory
- Only store serializable data (no functions, MediaStreams, etc.)
- Limit history depth to 50 actions
- Debounce rapid actions (e.g., dragging) to avoid history pollution

**Actions that trigger history:**
- Add/remove clip from timeline
- Trim clip (in/out points)
- Split clip
- Move/reorder clip
- Change clip properties (position, scale for PiP)

**Actions excluded from history:**
- Playhead movement (scrubbing)
- Zoom level changes
- Import/export operations

---

## 10. Testing & Validation

### 10.1 Recording Tests
1. **Screen Recording:** Start recording, switch windows, stop → Video captures entire session
2. **Webcam Recording:** Start recording, move in frame, stop → Video shows movements clearly
3. **Simultaneous Recording:** Record screen + webcam → Both clips imported to library
4. **Audio Sync:** Record with audio, clap hands → Audio synced with visual clap

### 10.2 Multi-Track Tests
1. **PiP Positioning:** Add webcam to Track 2 → Position in bottom-right → Export → Verify overlay position
2. **Multi-Clip Overlay:** Add 3 clips to Track 1, 2 clips to Track 2 → Export → Verify all clips appear
3. **Track Independence:** Trim clip on Track 1 → Clip on Track 2 unaffected

### 10.3 Undo/Redo Tests
1. Add clip → Undo → Clip removed
2. Add 5 clips → Undo 5 times → Timeline empty
3. Undo 3 times → Redo 2 times → Correct state restored

### 10.4 Keyboard Shortcuts Tests
1. Press Space → Video plays/pauses
2. Press Cmd+Z after adding clip → Clip removed
3. Press S with clip selected → Clip splits at playhead

---

## 11. Build Order (Recommended)

### 11.1 Phase 1: Recording (Critical)
**Tasks:**
1. Implement desktopCapturer wrapper in main process
2. Create RecordingPanel UI (screen/webcam selectors)
3. Implement getUserMedia() for screen + webcam capture
4. Add MediaRecorder logic (start, stop, save)
5. Auto-import recorded clips to media library
6. Test recording workflow end-to-end

**Estimated Effort:** High (recording APIs can be tricky)

### 11.2 Phase 2: Multi-Track Timeline
**Tasks:**
1. Extend timeline canvas to support multiple tracks (Y-axis layering)
2. Add track management UI (add/remove tracks)
3. Implement drag-and-drop to specific tracks
4. Add PiP positioning controls (corner presets + custom)
5. Update preview to show overlay in real-time
6. Implement multi-track FFmpeg export with overlay filter
7. Test with 2-3 tracks and multiple clips

**Estimated Effort:** High (FFmpeg overlay filter complexity)

### 11.3 Phase 3: Export Enhancements
**Tasks:**
1. Add resolution presets (4K, 1440p, 480p, custom)
2. Implement platform-specific presets (YouTube, Instagram, TikTok)
3. Add advanced export settings (bitrate, encoding speed, audio bitrate)
4. Create export queue system
5. Test exports with various resolutions and settings

**Estimated Effort:** Medium

### 11.4 Phase 4: Undo/Redo
**Tasks:**
1. Create HistoryStore with past/present/future arrays
2. Wrap timeline actions to push state to history
3. Implement undo() and redo() functions
4. Add UI buttons for undo/redo with disabled states
5. Register Cmd+Z and Cmd+Shift+Z shortcuts
6. Test with various actions

**Estimated Effort:** Medium

### 11.5 Phase 5: Keyboard Shortcuts
**Tasks:**
1. Install and configure hotkeys-js
2. Create ShortcutsStore with shortcut registry
3. Register all essential shortcuts (20-30 shortcuts)
4. Add keyboard shortcut reference modal (Help menu)
5. Test shortcuts don't conflict with OS shortcuts

**Estimated Effort:** Low-Medium

### 11.6 Phase 6: Auto-Save
**Tasks:**
1. Install electron-store
2. Implement auto-save interval (every 2 minutes)
3. Save state to persistent storage on quit
4. Check for auto-save on launch, prompt user to restore
5. Clear auto-save after manual save
6. Test force quit scenario

**Estimated Effort:** Low

### 11.7 Phase 7: Transitions (Optional)
**Tasks:**
1. Add transition UI (right-click between clips)
2. Implement FFmpeg xfade filter for dissolve/fade
3. Add transition duration selector
4. Preview transitions in preview window
5. Test with multiple transitions in timeline

**Estimated Effort:** Medium

### 11.8 Phase 8: Text Overlays (Optional)
**Tasks:**
1. Create text overlay editor UI
2. Implement FFmpeg drawtext filter
3. Add text to timeline as separate track
4. Allow editing text properties (font, size, color, position)
5. Export with text overlay
6. Test with multiple text overlays

**Estimated Effort:** Medium-High

---

## 12. Critical Path

**Must Have for Full Submission:**
1. Recording (screen + webcam + audio) ✓
2. Multi-track timeline with PiP ✓
3. Enhanced export options ✓
4. Undo/redo ✓

**Should Have (High Priority):**
5. Keyboard shortcuts ✓
6. Auto-save on force quit ✓

**Nice to Have (Lower Priority):**
7. Transitions between clips
8. Text overlays

**Skip if Time Constrained:**
- Advanced export queue
- Custom keyboard shortcut configuration
- Text animation effects

---

## 13. Risk Mitigation

### 13.1 Recording Risks
**Screen capture permissions:** Prompt user clearly; provide instructions if denied (macOS requires explicit permission)  
**Codec compatibility:** Record in webm; convert to mp4 via FFmpeg post-recording  
**Audio/video sync:** Use single MediaStream with both tracks; test extensively

### 13.2 Multi-Track Risks
**FFmpeg complexity:** Start with 2 tracks; expand to 3-4 if time permits  
**Preview performance:** Use lower resolution preview; only render visible frame to avoid lag

### 13.3 Undo/Redo Risks
**Memory usage:** Store state diffs instead of full copies; limit to 50 actions

---

## 14. Success Criteria

**Full Submission Complete When:**
✅ Can record screen, webcam, and audio  
✅ Can create picture-in-picture videos with multi-track timeline  
✅ Can export with platform-specific presets  
✅ Undo/redo works for all timeline actions  
✅ Keyboard shortcuts implemented for common actions  
✅ Auto-save recovers work after force quit  
✅ All PRD1 MVP features still functional  

**Stretch Goals Complete When:**
✅ Transitions between clips work (fade, dissolve)  
✅ Text overlays can be added and edited  

---

## 15. Integration with PRD Part 1

### 15.1 Dependencies
- All PRD1 features must be working before starting PRD2
- Recording features extend media library (auto-import)
- Multi-track extends existing timeline canvas
- Undo/redo wraps existing timeline actions
- Keyboard shortcuts layer on top of existing UI

### 15.2 Architecture Compatibility
- Recording components integrate with existing IPC handlers
- Multi-track uses same Fabric.js canvas, extends Y-axis
- Undo/redo uses existing Zustand stores with history wrapper
- Export enhancements extend existing FFmpeg pipeline

### 15.3 Testing Strategy
- After each PRD2 feature, re-test all PRD1 features to ensure no regressions
- Integration test: Record screen → Import to library → Add to timeline → Trim → Export
- Full workflow test: Record → Edit → Add overlays → Add transitions → Export

---

## 16. Next Steps

After PRD Part 2 features are complete:
1. **Comprehensive Testing:** Test all features together (PRD1 + PRD2)
2. **Performance Optimization:** Profile app, optimize memory usage, improve export speed
3. **Bug Fixes:** Address any issues found during testing
4. **Demo Video:** Record comprehensive demo showing all features
5. **Documentation:** Update README with all features and usage instructions
6. **Packaging:** Build final distributable (.dmg for macOS)

**Optional PRD Part 3: AI Subtitles** can be created after PRD Part 2 is fully complete and tested.

---

**End of PRD Part 2**