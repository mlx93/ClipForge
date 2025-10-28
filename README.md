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
