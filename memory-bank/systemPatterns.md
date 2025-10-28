# System Patterns & Architecture

## Architecture Overview
ClipForge follows Electron's multi-process architecture with clear separation between main (Node.js) and renderer (React) processes.

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

