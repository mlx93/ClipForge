# System Patterns & Architecture

## Architecture Overview
ClipForge follows Electron's multi-process architecture with clear separation between main (Node.js) and renderer (React) processes.

## Recent Architecture Improvements (Last 4 Commits)

### Text Rendering Architecture ✅
- **Zoom Independence**: Text elements use inverse zoom transform
- **Pattern**: `zoomX: 1/zoom, zoomY: 1/zoom` for all text objects
- **Benefits**: Text remains readable at all zoom levels
- **Implementation**: Applied to time grid labels, clip titles, duration text

### Bundle Architecture (b0df0b3)
- **Code Splitting**: Manual chunks for vendor libraries and features
- **Lazy Loading**: Components load on-demand (ExportDialog, ProjectMenu)
- **Chunk Strategy**: 
  - Vendor: React (141kB), Fabric.js (310kB), Zustand (3.6kB)
  - Features: Timeline (14kB), Video (9kB), Export (9kB), Project (5kB)
  - Main: Core app logic (9kB)

### Performance Patterns
- **Suspense Boundaries**: Graceful loading states for lazy components
- **Viewport Transform**: Zoom implemented via Fabric.js viewport (not coordinate multiplication)
- **Memory Management**: Stream-based video processing, file paths over data storage
- **Drag State Management**: `isDraggingRef` prevents canvas re-renders during trim operations
- **Text Zoom Independence**: Inverse transform keeps text readable at all zoom levels

## Process Architecture
```
┌─────────────────────┐
│  Electron Main      │
│  (Node.js)          │
│  - File System      │
│  - FFmpeg           │
│  - IPC Handlers     │
└──────────┬──────────┘
           │ IPC
┌──────────▼──────────┐
│  Electron Renderer  │
│  (React)            │
│  - UI Components    │
│  - Zustand Stores   │
│  - Timeline Canvas  │
└─────────────────────┘
```

## Key Patterns

### 1. State Management (Zustand)
- **Timeline Store**: Clips, playhead, selection, zoom
- **Export Store**: Progress, status, settings
- **Media Library Store**: Imported clips list
- **Recording Store**: Recording state, sources, settings (NEW)
- **History Store**: Undo/redo with command pattern (NEW)
- **Shortcuts Store**: Keyboard shortcut management (NEW)
- **Session Store**: Auto-save and session recovery (NEW)
- Pattern: Centralized state with actions

### 2. IPC Communication
- **Preload Script**: Secure API bridge (`window.electron`)
- **Main Process**: Handles file system, FFmpeg operations, recording
- **Renderer**: Calls IPC methods for async operations
- **Recording Channels**: get-recording-sources, start-recording, stop-recording (NEW)
- Pattern: Request/response with typed channels

### 3. Component Architecture
```
App (Root)
├── ImportZone (drag & drop)
├── MediaLibrary (clip list)
├── VideoPreview (HTML5 player)
├── Timeline (Fabric.js canvas)
├── ExportDialog (modal)
├── RecordingPanel (screen/webcam recording) (NEW)
├── HistoryControls (undo/redo buttons) (NEW)
├── ShortcutsModal (help reference) (NEW)
├── SessionRecoveryDialog (crash recovery) (NEW)
└── CloudExport (sharing interface) (NEW)
```

### 4. Timeline Canvas Pattern
- **Fabric.js**: Interactive canvas for timeline
- **useLayoutEffect**: DOM measurements before paint
- **Zustand-first**: State drives render, not events
- Pattern: Declarative canvas rendering

### 5. Video Processing Pattern ⚠️ CRITICAL - DO NOT MODIFY
- **Stream-based**: Store file paths, not video data
- **FFmpeg Wrapper**: fluent-ffmpeg for encoding
- **Progress Events**: IPC for real-time progress
- Pattern: Async with progress callbacks

**CRITICAL IMPLEMENTATION NOTES:**
This export logic is essential for app functionality. DO NOT modify without understanding these requirements:

1. **Module Import Pattern (REQUIRED)**:
   ```typescript
   // CORRECT - Use require() for fluent-ffmpeg
   const ffmpeg = require('fluent-ffmpeg');
   const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
   
   // WRONG - ESM imports break with Vite's namespace wrapper
   import ffmpeg from 'fluent-ffmpeg';  // ❌ DO NOT USE
   ```
   - **Why**: fluent-ffmpeg exports a callable function directly (CommonJS)
   - **Problem**: Vite's `_interopNamespaceDefault` converts function to non-callable object
   - **Result**: TypeError: ffmpeg.input is not a function
   - **Files**: src/main/ffmpeg.ts, src/main/fileSystem.ts
   - **Documentation**: See FFMPEG_EXPORT_FIX.md for full analysis

2. **Filter Chain Architecture (REQUIRED)**:
   ```typescript
   // Multiple clips: Use complexFilter for BOTH concat and scale
   if (clips.length > 1) {
     let filterChain = `${inputs}concat=n=${n}:v=1:a=1[v][a]`;
     if (scaleFilter) {
       filterChain += `;[v]${scaleFilter}[outv]`;  // Integrated scaling
     }
     command.complexFilter([filterChain]);
   } 
   // Single clip: Can use videoFilters
   else if (scaleFilter) {
     command.videoFilters([scaleFilter]);
   }
   ```
   - **Why**: FFmpeg doesn't allow mixing -vf and -filter_complex on same stream
   - **Problem**: Using videoFilters() after complexFilter() causes FFmpeg error
   - **Solution**: Integrate all filters into single complexFilter chain
   - **Files**: src/main/ffmpeg.ts (exportTimeline function)

3. **Export Pipeline Order**:
   - Add inputs with trim points
   - Build filter chain (concat + scale if needed)
   - Apply codec settings
   - Set output format and path
   - Attach progress/error handlers
   - Run command

**Testing Requirements**:
- Single clip export (with/without scaling)
- Multi-clip export (with/without scaling)
- Trim points applied correctly
- All resolution options work (Source, 720p, 1080p, 4K)

## Critical Design Decisions

### Why Zustand over Redux?
- Lighter weight, less boilerplate
- Excellent TypeScript support
- Simpler mental model
- Perfect for this app's complexity

### Why Fabric.js for Timeline?
- Canvas-based for performance
- Rich object manipulation API
- Click/drag interactions built-in
- Better than custom SVG solution

### Why Preload Script?
- Security: Context isolation
- Type safety: Exposed API contract
- Clean abstraction: No direct IPC in renderer

### Memory Management
- **Streaming**: FFmpeg processes files, not memory
- **Paths over Data**: Store file paths, not video buffers
- **Efficient Rendering**: Canvas with minimal re-renders

## Data Flow
1. User imports video → Main process validates
2. Main extracts metadata → Sends to renderer
3. Renderer updates Zustand → UI updates
4. User edits timeline → Store updates
5. User exports → Main process runs FFmpeg
6. Progress updates → Renderer via IPC events

## PRD-2 Patterns (NEW)

### 1. Recording System Pattern
- **DesktopCapturer API**: Main process lists screen/window sources
- **getUserMedia**: Renderer process captures media streams
- **MediaRecorder API**: Records combined streams to WebM
- **Auto-Import**: Recorded clips automatically added to media library
- Pattern: Main process enumeration → Renderer capture → Auto-import

### 2. Undo/Redo Pattern (Command Pattern)
- **State Snapshots**: Store complete state before each action
- **History Stack**: Past (undo), Present (current), Future (redo)
- **Action Wrapping**: Wrap timeline actions to push state to history
- **Memory Management**: 50-action limit with state diffs
- Pattern: Before action → Push state → Execute action → Update present

### 3. Keyboard Shortcuts Pattern
- **Global Listener**: Single keydown listener in App component
- **Data-Action Attributes**: Buttons marked with data-action for programmatic triggering
- **Store Registration**: Shortcuts registered in shortcutsStore
- **Modal Integration**: F1 help modal with categorized shortcuts
- Pattern: Global listener → Store lookup → Action execution

### 4. Auto-Save Pattern
- **Timer-Based**: setInterval triggers every 2 minutes
- **Session Persistence**: localStorage for crash recovery
- **State Integration**: Auto-save triggers on project changes
- **Recovery Dialog**: Startup check for session data
- Pattern: Timer → Check dirty state → Save → Store session

### 5. Cloud Export Pattern
- **Post-Export Integration**: Triggered after successful local export
- **Multi-Platform**: Support for multiple sharing services
- **Progress Tracking**: Upload progress with user feedback
- **Link Generation**: Shareable links with clipboard integration
- Pattern: Export complete → Show cloud options → Upload → Generate link

## Known Patterns
- **Canvas Re-rendering**: Only when clips/selection changes, not playhead
- **Video Sync**: Bidirectional between video player and timeline
- **Trim Workflow**: Preview → Apply pattern (not destructive until confirmed)

