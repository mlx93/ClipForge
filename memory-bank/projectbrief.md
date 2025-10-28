# ClipForge - Project Brief

## Overview
ClipForge is a native desktop video editor for macOS built with Electron, React, and TypeScript. It provides professional-grade video editing capabilities with a modern, intuitive interface.

## Core Goals
- **Native Performance**: Desktop application with native macOS integration
- **Modern Tech Stack**: Electron 28+, React 18+, TypeScript for type safety
- **Professional UX**: Clean, intuitive interface following macOS design patterns
- **Video Editing**: Trim, split, concatenate, and export video clips
- **Real-time Preview**: HTML5 video player synced with timeline

## Key Features (MVP - Phase 1)
1. **Video Import**: Drag & drop or file picker (MP4, MOV, AVI, MKV, WebM)
2. **Timeline Editing**: Fabric.js canvas with visual clip representation
3. **Trim & Split**: Adjust clip in/out points, split clips at playhead
4. **Video Preview**: HTML5 player with playback controls
5. **Export**: FFmpeg-based MP4 export with resolution options
6. **Native Packaging**: DMG distribution via electron-builder

## Technical Stack
- **Framework**: Electron 28+ (main + renderer processes)
- **UI**: React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **State**: Zustand for lightweight state management
- **Video Processing**: fluent-ffmpeg + @ffmpeg-installer/ffmpeg
- **Timeline Canvas**: Fabric.js for interactive timeline
- **Build**: Vite for fast HMR and optimized builds
- **Packaging**: electron-builder for native macOS apps

## Project Structure
```
src/
├── main/           # Electron main process (Node.js)
│   ├── index.ts    # App lifecycle
│   ├── ffmpeg.ts   # Video processing
│   ├── fileSystem.ts  # File operations
│   └── ipc/        # IPC handlers
├── renderer/       # React application (browser)
│   ├── App.tsx     # Root component
│   ├── components/ # UI components
│   └── store/      # Zustand stores
└── shared/         # Shared types & constants
```

## Development Status
- ✅ Phase 1-6: Core functionality implemented
- ✅ Phase 7: Packaging complete
- 🔄 Polish: UI/UX improvements in progress
- ⏳ Future: PRD-2 features (advanced editing, effects)

## Success Criteria
1. Import videos and display on timeline
2. Trim clips by adjusting start/end points
3. Split clips at playhead position
4. Preview video with synced timeline playhead
5. Export final video with FFmpeg
6. Package as native macOS DMG

