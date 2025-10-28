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
- Pattern: Centralized state with actions

### 2. IPC Communication
- **Preload Script**: Secure API bridge (`window.electron`)
- **Main Process**: Handles file system, FFmpeg operations
- **Renderer**: Calls IPC methods for async operations
- Pattern: Request/response with typed channels

### 3. Component Architecture
```
App (Root)
├── ImportZone (drag & drop)
├── MediaLibrary (clip list)
├── VideoPreview (HTML5 player)
├── Timeline (Fabric.js canvas)
└── ExportDialog (modal)
```

### 4. Timeline Canvas Pattern
- **Fabric.js**: Interactive canvas for timeline
- **useLayoutEffect**: DOM measurements before paint
- **Zustand-first**: State drives render, not events
- Pattern: Declarative canvas rendering

### 5. Video Processing Pattern
- **Stream-based**: Store file paths, not video data
- **FFmpeg Wrapper**: fluent-ffmpeg for encoding
- **Progress Events**: IPC for real-time progress
- Pattern: Async with progress callbacks

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

## Known Patterns
- **Canvas Re-rendering**: Only when clips/selection changes, not playhead
- **Video Sync**: Bidirectional between video player and timeline
- **Trim Workflow**: Preview → Apply pattern (not destructive until confirmed)

