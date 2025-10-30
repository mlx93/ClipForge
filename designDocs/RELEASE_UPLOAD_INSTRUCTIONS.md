# GitHub Release Upload Instructions - SimpleCut v2.0.0

**Version**: 2.0.0  
**Date**: December 19, 2024

---

## Step-by-Step Release Upload Process

### 1. Verify DMG Files Exist

Check that the following files exist in the `release/` folder:
- `SimpleCut-2.0.0.dmg` (Intel Mac, ~116MB)
- `SimpleCut-2.0.0-arm64.dmg` (Apple Silicon Mac, ~112MB)
- `SimpleCut-2.0.0.dmg.blockmap` (optional, for auto-updates)
- `SimpleCut-2.0.0-arm64.dmg.blockmap` (optional, for auto-updates)
- `latest-mac.yml` (optional, for auto-updates)

**Verify command**:
```bash
ls -lh release/SimpleCut-2.0.0*.dmg
```

### 2. Create GitHub Release

1. Go to your repository on GitHub: `https://github.com/mlx93/ClipForge`
2. Click **"Releases"** in the right sidebar
3. Click **"Draft a new release"** button

### 3. Release Configuration

**Tag version**: `v2.0.0`  
**Release title**: `SimpleCut v2.0.0 - Complete MVP with Metadata & Crash Recovery`

**Release description** (copy and paste):

```markdown
# SimpleCut v2.0.0 - Complete MVP with Metadata & Crash Recovery

Desktop video editor built with Electron, React, and TypeScript.

## 🎉 New Features in v2.0.0

- ✅ **Media Library Metadata Display**: Duration, resolution, file size, codec, and frame rate for all clips
- ✅ **Crash Recovery**: Automatic session recovery after unexpected shutdowns
- ✅ Screen recording (screen + webcam + audio)
- ✅ Undo/redo functionality (50-action history)
- ✅ Auto-save on force quit
- ✅ Project save/load (.simplecut files)

## 📥 Downloads

### macOS
- **Apple Silicon (M1/M2/M3)**: Download `SimpleCut-2.0.0-arm64.dmg`
- **Intel Mac**: Download `SimpleCut-2.0.0.dmg`

### Windows
- Download `SimpleCut Setup 2.0.0.exe` (if available)

## 🔧 Installation

### macOS Users

**Important**: SimpleCut is not code-signed. macOS will show a security warning on first launch.

1. Download the appropriate DMG file
2. Mount the DMG and drag SimpleCut to Applications
3. Right-click SimpleCut.app → "Open" → "Open" (bypasses Gatekeeper)
4. Or: System Preferences → Security & Privacy → "Open Anyway"

See [README.md](https://github.com/mlx93/ClipForge#first-time-installation-on-macos) for detailed instructions.

### Windows Users

1. Download the .exe installer
2. Run the installer (SmartScreen may warn - click "More info" → "Run anyway")
3. Follow installation prompts

## 📖 Documentation

- [README.md](https://github.com/mlx93/ClipForge/blob/main/README.md) - Usage guide
- [BUILD.md](https://github.com/mlx93/ClipForge/blob/main/BUILD.md) - Build instructions
- [PRD-2-Full-Features.md](https://github.com/mlx93/ClipForge/blob/main/PRD-2-Full-Features.md) - Feature specifications

## 🐛 Known Issues

- Cloud export/sharing is currently mock-only (UI exists, no real API integration)
- Minor video flicker during clip transitions (<16ms, acceptable for MVP)

## 🙏 Feedback

Found a bug? [Open an issue](https://github.com/mlx93/ClipForge/issues/new)
```

### 4. Attach DMG Files

1. Drag and drop these files from `release/` folder:
   - `SimpleCut-2.0.0.dmg` (Intel Mac)
   - `SimpleCut-2.0.0-arm64.dmg` (Apple Silicon Mac)

2. **Optional** (for auto-updates):
   - `SimpleCut-2.0.0.dmg.blockmap`
   - `SimpleCut-2.0.0-arm64.dmg.blockmap`
   - `latest-mac.yml`

### 5. Publish Release

1. Click **"Publish release"** button
2. Wait for GitHub to process the uploads (~1-2 minutes)
3. Verify release appears in Releases page
4. Test download links work correctly

### 6. Verify Release

✅ Check that both DMG files are downloadable  
✅ Verify file sizes match expected (~112-116MB)  
✅ Check that release notes display correctly  
✅ Test that one of the DMG files can be downloaded and opened

---

## Quick Reference

**Release Files Location**: `release/SimpleCut-2.0.0*.dmg`  
**GitHub Release URL**: `https://github.com/mlx93/ClipForge/releases/tag/v2.0.0`  
**Release Tag**: `v2.0.0`

---

## Troubleshooting

**Problem**: DMG files not found in release/
- **Solution**: Run `npm run dist:mac` to rebuild

**Problem**: Upload fails or times out
- **Solution**: Check internet connection, try uploading one file at a time

**Problem**: Release page shows wrong version
- **Solution**: Verify tag is `v2.0.0` and release title matches

