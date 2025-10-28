# ClipForge - Build and Deployment Guide

**Version:** 1.0.0  
**Last Updated:** October 28, 2025

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Setup](#development-setup)
3. [Building for Production](#building-for-production)
4. [Packaging for Distribution](#packaging-for-distribution)
5. [GitHub Releases Setup](#github-releases-setup)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Node.js**: Version 18.0.0 or higher
  ```bash
  node --version  # Should be v18.0.0+
  ```

- **npm**: Version 8.0.0 or higher (comes with Node.js)
  ```bash
  npm --version  # Should be 8.0.0+
  ```

- **Git**: For cloning and version control
  ```bash
  git --version
  ```

### System Requirements

- **macOS**: 10.15 (Catalina) or later for building macOS apps
- **Windows**: Windows 10/11 for building Windows apps
- **RAM**: 8GB minimum, 16GB recommended
- **Disk Space**: 2GB free for dependencies and build artifacts

---

## Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/ClipForge.git
cd ClipForge
```

### 2. Install Dependencies

```bash
npm install
```

This will install:
- Electron and related packages
- React, TypeScript, and frontend dependencies
- FFmpeg binaries via `@ffmpeg-installer/ffmpeg`
- Build tools (Vite, electron-builder)

**Note**: FFmpeg binaries are bundled automatically. No separate FFmpeg installation required.

### 3. Start Development Server

```bash
npm run dev
```

This command:
- Builds main process, preload script, and renderer code
- Launches Electron app in development mode
- Enables Hot Module Replacement (HMR) for fast iteration

**The app will launch automatically.** Any changes to source files will trigger a rebuild.

### 4. Development Scripts

```bash
# Start dev server with HMR
npm run dev

# Build all processes without running
npm run build

# Clean build artifacts
rm -rf dist/
```

---

## Building for Production

### Production Build Process

The build process compiles TypeScript to JavaScript and bundles all assets for production.

```bash
npm run build
```

This executes three sub-commands:

1. **`npm run build:main`** - Compiles main process (Electron, Node.js)
   - Input: `src/main/**/*.ts`
   - Output: `dist/main/index.cjs`

2. **`npm run build:renderer`** - Compiles renderer process (React, UI)
   - Input: `src/renderer/**/*.tsx`
   - Output: `dist/renderer/` (HTML, CSS, JS bundles)

3. **`npm run build:preload`** - Compiles preload script (IPC bridge)
   - Input: `src/preload/preload.ts`
   - Output: `dist/preload/preload.cjs`

### Build Output

```
dist/
├── main/
│   └── index.cjs           # Main process bundle
├── preload/
│   └── preload.cjs         # Preload script bundle
└── renderer/
    ├── index.html          # Entry HTML
    └── assets/             # JS/CSS bundles
```

**Test the build before packaging:**

```bash
# Build production code
npm run build

# Run built code (without packaging)
npx electron .
```

---

## Packaging for Distribution

ClipForge uses `electron-builder` to create native installers for macOS and Windows.

### Package for macOS

```bash
npm run dist:mac
```

**Outputs** (in `release/` folder):
- `ClipForge-1.0.0.dmg` - Intel Mac (x64)
- `ClipForge-1.0.0-arm64.dmg` - Apple Silicon Mac (arm64)
- `ClipForge-1.0.0.dmg.blockmap` - Delta update files
- `latest-mac.yml` - Auto-update metadata

**Universal Binary** (both architectures in one file):
```bash
npm run dist:mac -- --universal
```

### Package for Windows (on macOS/Linux)

```bash
npm run dist:win
```

**Outputs** (in `release/` folder):
- `ClipForge Setup 1.0.0.exe` - Windows installer
- `latest.yml` - Auto-update metadata

**Note**: Cross-platform builds work but may require Wine for code signing.

### Package for All Platforms

```bash
npm run dist
```

Builds for all configured platforms (macOS, Windows).

---

## Distribution Files

### What to Upload to GitHub Releases

After running `npm run dist:mac`, upload these files:

1. **For Users**:
   - `ClipForge-1.0.0.dmg` (Intel Mac)
   - `ClipForge-1.0.0-arm64.dmg` (Apple Silicon Mac)
   - `ClipForge Setup 1.0.0.exe` (Windows)

2. **For Auto-Updates** (optional):
   - `latest-mac.yml`
   - `latest.yml`
   - `*.blockmap` files

### File Sizes (Approximate)

- macOS DMG: ~150-200MB (includes Electron + FFmpeg)
- Windows EXE: ~170-220MB

---

## GitHub Releases Setup

### 1. Create a New Release

1. Go to your repository on GitHub
2. Click **"Releases"** in the right sidebar
3. Click **"Draft a new release"**

### 2. Release Configuration

**Tag version**: `v1.0.0`  
**Release title**: `ClipForge v1.0.0 - MVP Release`  
**Description**:

```markdown
# ClipForge v1.0.0 - MVP Release

Desktop video editor built with Electron, React, and TypeScript.

## 🎉 Features

- ✅ Import MP4, MOV, AVI, MKV, WebM files
- ✅ Timeline editing with visual clips
- ✅ Trim and split functionality
- ✅ Multi-clip export with FFmpeg
- ✅ Project save/load (.clipforge files)
- ✅ Native macOS packaging

## 📥 Downloads

### macOS
- **Apple Silicon (M1/M2/M3)**: Download `ClipForge-1.0.0-arm64.dmg`
- **Intel Mac**: Download `ClipForge-1.0.0.dmg`

### Windows
- Download `ClipForge Setup 1.0.0.exe`

## 🔧 Installation

### macOS Users

**Important**: ClipForge is not code-signed. macOS will show a security warning on first launch.

1. Download the appropriate DMG file
2. Mount the DMG and drag ClipForge to Applications
3. Right-click ClipForge.app → "Open" → "Open" (bypasses Gatekeeper)
4. Or: System Preferences → Security & Privacy → "Open Anyway"

See [README.md](https://github.com/YOUR_USERNAME/ClipForge#first-time-installation-on-macos) for detailed instructions.

### Windows Users

1. Download the .exe installer
2. Run the installer (SmartScreen may warn - click "More info" → "Run anyway")
3. Follow installation prompts

## 📖 Documentation

- [README.md](https://github.com/YOUR_USERNAME/ClipForge/blob/main/README.md) - Usage guide
- [BUILD.md](https://github.com/YOUR_USERNAME/ClipForge/blob/main/BUILD.md) - Build instructions
- [PRD-1-MVP-Foundation.md](https://github.com/YOUR_USERNAME/ClipForge/blob/main/PRD-1-MVP-Foundation.md) - Technical specifications

## 🐛 Known Issues

- Timeline zoom has minor coordinate inconsistencies at extreme zoom levels
- Thumbnail previews show placeholders (real thumbnails coming in Phase 2)

## 🙏 Feedback

Found a bug? [Open an issue](https://github.com/YOUR_USERNAME/ClipForge/issues/new)
```

### 3. Upload Build Artifacts

Drag and drop these files from `release/` folder:
- `ClipForge-1.0.0.dmg`
- `ClipForge-1.0.0-arm64.dmg`
- `ClipForge Setup 1.0.0.exe` (if built)

### 4. Publish Release

Click **"Publish release"** - your app is now available for download!

---

## Troubleshooting

### Build Issues

**Problem**: `npm install` fails with FFmpeg errors

**Solution**:
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

**Problem**: `npm run build` fails with TypeScript errors

**Solution**:
```bash
# Check TypeScript errors
npx tsc --noEmit

# Fix errors in src/ and rebuild
npm run build
```

---

**Problem**: Packaged app won't launch on macOS

**Solution**:
```bash
# Remove quarantine flag
xattr -cr /Applications/ClipForge.app

# Or rebuild with correct entitlements
npm run dist:mac
```

---

### Packaging Issues

**Problem**: `electron-builder` fails with "Cannot find module"

**Solution**: Ensure all dependencies are installed and build is complete:
```bash
npm install
npm run build
npm run dist:mac
```

---

**Problem**: DMG creation fails with "hdiutil: create failed"

**Solution**: Free up disk space (DMG creation requires temp space):
```bash
# Check free space
df -h

# Clean node_modules and rebuild if needed
rm -rf node_modules
npm install
```

---

### Runtime Issues

**Problem**: App crashes on launch

**Solution**: Check console for errors:
```bash
# Run from terminal to see logs
/Applications/ClipForge.app/Contents/MacOS/ClipForge
```

---

**Problem**: FFmpeg not found in packaged app

**Solution**: Verify `electron-builder.json` includes FFmpeg binaries:
```json
{
  "extraFiles": [
    {
      "from": "node_modules/@ffmpeg-installer/darwin-x64",
      "to": "Resources/bin",
      "filter": ["ffmpeg"]
    }
  ]
}
```

---

## Environment Variables

### Optional Build Configuration

```bash
# Disable code signing (for testing)
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run dist:mac

# Build for specific architecture
npm run dist:mac -- --x64        # Intel only
npm run dist:mac -- --arm64      # Apple Silicon only
npm run dist:mac -- --universal  # Both in one file
```

---

## CI/CD Integration (Optional)

### GitHub Actions Example

Create `.github/workflows/build.yml`:

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: macos-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        run: npm run build
      
      - name: Package
        run: npm run dist:mac
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: release-dmg
          path: release/*.dmg
```

---

## Additional Resources

- **Electron Builder Docs**: https://www.electron.build/
- **Vite Docs**: https://vitejs.dev/
- **React Docs**: https://react.dev/

---

**Questions?** Open an issue on GitHub or check the [README.md](./README.md) for more information.

