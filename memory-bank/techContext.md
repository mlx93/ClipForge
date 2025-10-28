# Technical Context

## Dependencies

### Core
- **electron**: ^32.0.0 (desktop framework)
- **react**: ^18.3.1 (UI library)
- **react-dom**: ^18.3.1
- **typescript**: ^5.7.3 (type safety)
- **zustand**: ^5.0.2 (state management)

### Styling
- **tailwindcss**: ^3.4.17 (utility-first CSS)
- **postcss**: ^8.4.49
- **autoprefixer**: ^10.4.20
- **@radix-ui/react-dialog**: ^1.1.3 (UI components)

### Video Processing
- **fluent-ffmpeg**: ^2.1.3 (FFmpeg wrapper)
- **@ffmpeg-installer/ffmpeg**: ^1.1.0 (bundled FFmpeg)

### Build Tools
- **vite**: ^5.4.21 (build tool)
- **@vitejs/plugin-react**: ^4.3.4
- **electron-builder**: ^25.1.8 (packaging)

### Timeline
- **fabric**: ^6.4.3 (canvas library)

### Development
- **@types/node**: ^22.10.7
- **@types/react**: ^18.3.18
- **eslint**: ^9.18.0
- **electron-builder**: ^25.1.8

## Build Configuration

### Vite Configs
- **vite.main.config.ts**: Main process bundling
- **vite.renderer.config.ts**: React app bundling
- **vite.preload.config.ts**: Preload script bundling

### Key Settings
- **main**: `dist/main/index.cjs` (CommonJS output)
- **renderer**: React with HMR
- **preload**: CommonJS for Node.js context
- **type**: `"module"` in package.json

## Runtime Requirements
- **Node.js**: v22.18.0+
- **System FFmpeg**: 8.0+ (for local testing)
- **macOS**: 10.13+ (for packaging)

## Development Setup
```bash
npm install
npm run dev          # Start dev mode
npm run build        # Production build
npm run package      # Create DMG
```

## Build Process
1. **Main Process**: Vite bundles main/index.ts → dist/main/index.cjs
2. **Renderer**: Vite bundles renderer → dist/renderer/
3. **Preload**: Vite bundles preload → dist/preload/preload.cjs
4. **Package**: electron-builder creates DMG

## File Structure
```
src/
├── main/              # Main process (Node.js)
│   ├── index.ts       # App entry
│   ├── ffmpeg.ts      # Video processing
│   ├── fileSystem.ts  # File operations
│   └── ipc/handlers.ts  # IPC handlers
├── renderer/          # Renderer process (React)
│   ├── App.tsx        # Root component
│   ├── components/    # UI components
│   ├── store/         # Zustand stores
│   └── main.tsx       # Entry point
├── preload/           # Preload script
│   └── preload.ts     # IPC bridge
└── shared/            # Shared code
    ├── types.ts       # Type definitions
    └── constants.ts   # Constants
```

## IPC Channels
- `import-videos`: Import video files
- `export-timeline`: Export video
- `export-progress`: Progress updates
- `get-video-metadata`: Extract metadata
- `save-project`: Save project file
- `load-project`: Load project file
- `show-save-dialog`: Native save dialog

## Configuration Files
- **tsconfig.json**: Root TypeScript config
- **tsconfig.main.json**: Main process config
- **tsconfig.renderer.json**: Renderer config
- **electron-builder.json**: Packaging config
- **tailwind.config.js**: Tailwind CSS config

