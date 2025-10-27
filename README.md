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

### Production
Download the latest release from [GitHub Releases](https://github.com/mlx93/ClipForge/releases):
- `ClipForge-1.0.0.dmg` - Intel Mac
- `ClipForge-1.0.0-arm64.dmg` - Apple Silicon Mac

## Usage

1. **Import Videos**: Drag video files into the app or click "Import Videos"
2. **Arrange Timeline**: Drag clips from media library to timeline
3. **Edit Clips**: 
   - Click clips to select them
   - Drag red trim handles to adjust in/out points
   - Press 'S' or click "Split" to split at playhead
4. **Preview**: Use play/pause controls or click timeline to seek
5. **Export**: Click "Export" button, choose settings, and export to MP4

## Technical Stack

- **Desktop**: Electron 28+
- **Frontend**: React 18+ with TypeScript
- **State**: Zustand
- **Styling**: Tailwind CSS
- **Video**: FFmpeg via fluent-ffmpeg
- **Timeline**: Fabric.js canvas
- **Build**: Vite + electron-builder

## Architecture

```
src/
├── main/           # Electron main process
│   ├── index.ts    # App entry point
│   ├── ffmpeg.ts   # Video processing
│   ├── fileSystem.ts # File operations
│   └── ipc/        # IPC handlers
├── renderer/       # React application
│   ├── App.tsx     # Root component
│   ├── components/ # UI components
│   └── store/      # Zustand stores
└── shared/         # Shared types/constants
```

## Development

### Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run dist:mac` - Package for macOS
- `npm run dist:win` - Package for Windows

### Requirements
- Node.js 18+
- FFmpeg (system installation or bundled)
- macOS (primary), Windows (supported)

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Roadmap

- [ ] Screen recording (desktopCapturer API)
- [ ] Advanced timeline features (multi-track, PiP)
- [ ] Project save/load
- [ ] Undo/redo functionality
- [ ] AI-powered features (subtitles, etc.)

---

**ClipForge v1.0.0** - Built with ❤️ for content creators
