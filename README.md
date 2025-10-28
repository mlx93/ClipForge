# ClipForge

A production-grade desktop video editor for macOS built with Electron, React, and TypeScript.

## Features

### ✅ Core Video Editing
- **Import Videos**: Drag & drop or file picker for MP4, MOV, AVI, MKV, WebM
- **Timeline Editor**: Fabric.js-based timeline with visual clips and playhead
- **Video Preview**: HTML5 video player synced with timeline
- **Trim & Split**: Visual trim handles and split functionality
- **Export**: FFmpeg-based multi-clip export with progress tracking

### ✅ User Experience
- **Native macOS App**: Electron-based with native file dialogs
- **Keyboard Shortcuts**: Space (play/pause), Arrow keys (seek), S (split)
- **Responsive UI**: Tailwind CSS with dark theme
- **Memory Efficient**: Stream-based processing, file path storage

## Installation

### Development
```bash
# Clone repository
git clone https://github.com/mlx93/ClipForge.git
cd ClipForge

# Install dependencies
npm install

# Start development server
npm run dev
```

### Production (macOS)

Download the latest release from [GitHub Releases](https://github.com/mlx93/ClipForge/releases):
- `ClipForge-1.0.0.dmg` - Intel Mac
- `ClipForge-1.0.0-arm64.dmg` - Apple Silicon Mac

#### First-Time Installation on macOS

**Important:** ClipForge is not code-signed with an Apple Developer ID. macOS Gatekeeper will show a security warning on first launch.

**To install and run ClipForge:**

1. **Download** the appropriate DMG file for your Mac
2. **Mount** the DMG by double-clicking it
3. **Drag** ClipForge.app to your Applications folder
4. **First Launch** - macOS will block the app:
   - You'll see: *"ClipForge.app can't be opened because it is from an unidentified developer"*
   
5. **Bypass Gatekeeper** (choose either method):

   **Method 1 (Recommended):**
   - Go to **System Preferences** → **Security & Privacy** → **General** tab
   - You'll see a message: *"ClipForge.app was blocked from use"*
   - Click **"Open Anyway"**
   - Click **"Open"** in the confirmation dialog
   
   **Method 2:**
   - Right-click (or Control-click) on **ClipForge.app** in Applications
   - Select **"Open"** from the context menu
   - Click **"Open"** in the dialog that appears

6. **Grant Permissions** (if prompted):
   - Allow file access when importing/exporting videos
   - FFmpeg is bundled with the app - no separate installation needed

**After first launch**, ClipForge will open normally like any other app.

#### Troubleshooting

- **"ClipForge is damaged"**: macOS quarantine flag is set. Open Terminal and run:
  ```bash
  xattr -cr /Applications/ClipForge.app
  ```
- **Export fails**: Ensure you have sufficient disk space for video export
- **Videos won't import**: Check that files are supported formats (MP4, MOV, AVI, MKV, WebM)

## Usage

### Basic Workflow

1. **Import Videos**: Drag video files into the app or click "Import Videos"
2. **Arrange Timeline**: Drag clips from media library to timeline
3. **Edit Clips**: 
   - Click clips to select them
   - Drag red trim handles to adjust in/out points
   - Press 'S' or click "Split" to split at playhead
4. **Preview**: Use play/pause controls or click timeline to seek
5. **Export**: Click "Export" button, choose settings, and export to MP4/MOV

### Project Files (`.clipforge`)

ClipForge saves your editing sessions as `.clipforge` project files. These files store:
- All imported clips and their timeline positions
- Trim points and edits for each clip
- Playhead position and zoom level
- Project settings

**Important:** `.clipforge` files can only be opened within ClipForge:

1. **Saving a Project:**
   - Click **"Save"** or **"Save As"** in the top menu
   - Choose a location and filename
   - The file will be saved with a `.clipforge` extension

2. **Opening a Project:**
   - **DO NOT** double-click the `.clipforge` file in Finder (macOS will show an error)
   - Instead, launch **ClipForge** first
   - Click **"Open"** in the top menu
   - Navigate to your `.clipforge` file and select it
   - Your project will load with all clips and edits restored

**Why can't I double-click `.clipforge` files?**  
`.clipforge` is a custom file format that macOS doesn't recognize. You must open these files from within the ClipForge application using File → Open.

**Alternative:** If you want to save your edited video as a standard video file (MP4/MOV) that can be played anywhere, use the **"Export"** button instead of "Save".

## Technical Stack

### Core Technologies
- **Desktop Framework**: Electron 28+ - Multi-process architecture for native macOS/Windows apps with web technologies
- **Frontend**: React 18+ with TypeScript - Component-based UI with strict type safety
- **State Management**: Zustand - Lightweight, performant state management with minimal boilerplate
- **Styling**: Tailwind CSS - Utility-first CSS framework for rapid UI development
- **Build Tool**: Vite - Fast HMR and optimized production builds with code splitting

### Media Processing
- **Video Processing**: FFmpeg via fluent-ffmpeg - Industry-standard video encoding and manipulation
- **Video Player**: HTML5 `<video>` element - Native browser video playback with low overhead
- **Timeline UI**: Fabric.js - HTML5 Canvas library for interactive, performant timeline rendering
- **File Handling**: Electron IPC - Secure communication between main (Node.js) and renderer (React) processes

### Key Design Decisions
- **Stream-Based Processing**: Videos processed via FFmpeg streams, not loaded into memory (supports GB+ projects)
- **File Path Storage**: Store references to video files on disk, not video data in state (memory efficient)
- **Canvas Timeline**: Fabric.js provides 60fps interactions with dozens of clips without DOM overhead
- **Type Safety**: Full TypeScript coverage with strict mode prevents runtime errors

## Architecture

### Application Structure

```
ClipForge/
├── src/
│   ├── main/                    # Electron Main Process (Node.js)
│   │   ├── index.ts            # App lifecycle, window management
│   │   ├── ffmpeg.ts           # Video encoding, export, trim operations
│   │   ├── fileSystem.ts       # Video import, metadata extraction
│   │   ├── ipc/handlers.ts     # IPC communication with renderer
│   │   └── menu.ts             # Native application menu
│   ├── renderer/                # Renderer Process (React/Browser)
│   │   ├── App.tsx             # Root component, import handlers
│   │   ├── components/
│   │   │   ├── Timeline.tsx    # Fabric.js timeline editor
│   │   │   ├── VideoPreview.tsx # HTML5 video player
│   │   │   ├── MediaLibrary.tsx # Imported clips panel
│   │   │   ├── ExportDialog.tsx # Export settings modal
│   │   │   └── ProjectMenu.tsx  # Save/load UI
│   │   ├── store/
│   │   │   ├── timelineStore.ts # Timeline state (clips, playhead, zoom)
│   │   │   ├── exportStore.ts   # Export progress, settings
│   │   │   ├── projectStore.ts  # Project save/load state
│   │   │   └── mediaLibraryStore.ts # Imported clips library
│   │   └── utils/              # Shared utilities
│   ├── preload/
│   │   └── preload.ts          # Secure IPC bridge (contextBridge)
│   └── shared/
│       ├── types.ts            # Shared TypeScript interfaces
│       └── constants.ts        # Shared constants, IPC channels
├── docs/                        # Technical documentation
├── memory-bank/                 # Project memory/context files
└── release/                     # Built app packages (DMG, EXE)
```

### Process Architecture

**Main Process (Node.js)**
- Manages application lifecycle and native window
- Executes FFmpeg for video processing (encoding, trimming, metadata)
- Handles file system operations (import, export, project save/load)
- Communicates with renderer via IPC handlers
- No direct DOM access (security boundary)

**Renderer Process (React + Browser)**
- Renders UI and handles user interactions
- Manages application state via Zustand stores
- Displays video preview (HTML5 `<video>` element)
- Renders interactive timeline (Fabric.js canvas)
- Communicates with main process via secure `electronAPI` bridge

**Preload Script (Context Bridge)**
- Exposes safe IPC methods to renderer via `contextBridge`
- Prevents renderer from accessing Node.js APIs directly
- Type-safe API: `window.electronAPI.importVideos()`, etc.

### Data Flow

1. **Import**: User drags video → Main validates/extracts metadata → Renderer updates Zustand state → Timeline re-renders
2. **Edit**: User drags clip → Zustand state updates → Canvas re-renders via Fabric.js → Video preview syncs
3. **Export**: User clicks export → Renderer calls IPC → Main invokes FFmpeg → Progress sent via IPC → UI updates

### Memory Management

- **File References**: Store video file paths, not actual video data (supports GB+ projects on 8GB RAM systems)
- **Stream Processing**: FFmpeg processes videos as streams, not loading entire files into memory
- **Canvas Optimization**: Fabric.js renders only visible timeline region, not entire project
- **Lazy Loading**: Video frames loaded on-demand by HTML5 `<video>` element

For detailed technical documentation, see the [`docs/`](./docs/) folder ([Documentation Index](./docs/DOCUMENTATION_INDEX.md)).

## Development

### Quick Start

```bash
# Clone and install
git clone https://github.com/YOUR_USERNAME/ClipForge.git
cd ClipForge
npm install

# Start development
npm run dev
```

### Build Scripts
- `npm run dev` - Start development server with HMR
- `npm run build` - Build for production
- `npm run dist:mac` - Package for macOS (DMG)
- `npm run dist:win` - Package for Windows (EXE)
- `npm run dist` - Package for all platforms

### Requirements
- Node.js 18+
- FFmpeg (bundled automatically via @ffmpeg-installer)
- macOS 10.15+ (for building macOS apps)
- Windows 10+ (for building Windows apps)

**For detailed build instructions, packaging, and troubleshooting, see [BUILD.md](./BUILD.md).**

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Roadmap

### ✅ MVP Complete (v1.0.0)
- ✅ Video import (drag & drop, file picker)
- ✅ Timeline editing with Fabric.js
- ✅ Trim and split functionality
- ✅ Multi-clip export with FFmpeg
- ✅ Project save/load (.clipforge files)
- ✅ Native macOS packaging (DMG)

### 🚀 Planned Features (Post-MVP)
- [ ] **Phase 2 Polish**:
  - [ ] Real thumbnail generation (FFmpeg-based)
  - [ ] Visual trim indicators (show trimmed regions)
  - [ ] Enhanced timeline zoom
  - [ ] Media library improvements

- [ ] **PRD-2 Features**:
  - [ ] Screen recording (desktopCapturer API)
  - [ ] Webcam recording
  - [ ] Advanced timeline (multi-track, PiP)
  - [ ] Transitions and effects
  - [ ] Undo/redo functionality

- [ ] **PRD-3 Features**:
  - [ ] AI-powered subtitles
  - [ ] Auto-captions with OpenAI/Whisper
  - [ ] Timeline text overlays

See [PRD-2-Full-Features.md](./PRD-2-Full-Features.md) and [PRD-3-AI-Captions.md](./PRD-3-AI-Captions.md) for detailed specifications.

---

**ClipForge v1.0.0** - Built with ❤️ for content creators
