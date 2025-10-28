# FFmpeg Export Error Fixes - ClipForge

## Problem 1: TypeError: ffmpeg.input is not a function

### Root Cause Analysis

The problem was caused by how Vite handles ESM imports for CommonJS modules when bundling TypeScript code.

**Original Code (BROKEN):**
```typescript
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
```

### Why It Failed

1. **Module Type Mismatch**: `fluent-ffmpeg` is a CommonJS module that exports a constructor function directly (not as `module.exports.default`)

2. **ESM Import Transformation**: When using ESM `import` syntax with TypeScript's `esModuleInterop: true`, Vite attempted to handle the CommonJS interop

3. **Namespace Wrapping Bug**: Vite's `_interopNamespaceDefault` helper created a namespace object by iterating over the function's properties using `for...in`, which:
   - Copied all the function's properties (like `setFfmpegPath`, `ffprobe`, etc.)
   - But lost the callable nature of the function itself
   - Resulted in an object that looked correct but wasn't actually callable

4. **The Failing Code Path**:
   ```javascript
   // Vite's compiled output (BROKEN)
   const ffmpegLib = require("fluent-ffmpeg");
   const ffmpegLib__namespace = _interopNamespaceDefault(ffmpegLib); // Converts function to object!
   const ffmpeg = ffmpegLib__namespace.default || ffmpegLib__namespace; // Gets the object, not the function
   let command = ffmpeg(); // TypeError: ffmpeg is not a function
   ```

### Visual Breakdown

```
fluent-ffmpeg module export:
  Type: Function
  Properties: { setFfmpegPath, setFfprobePath, ffprobe, ... }
  Callable: YES ✓

After _interopNamespaceDefault:
  Type: Object
  Properties: { setFfmpegPath, setFfprobePath, ffprobe, ... }
  Callable: NO ✗  ← THIS IS THE BUG!
```

### Solution 1

Replace ESM import syntax with direct `require()` calls for CommonJS modules that export callable functions.

**Fixed Code:**
```typescript
// Use require-style imports for CommonJS modules that export a callable function
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpeg = require('fluent-ffmpeg');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
```

### Why This Works

1. **Direct CommonJS Require**: Bypasses Vite's ESM interop helpers entirely
2. **Preserved Function Type**: The module is loaded exactly as Node.js loads it—as a callable function
3. **Clean Compilation**: Vite outputs the same `require()` calls in the bundled code
4. **No Namespace Wrapping**: The function remains a function, not an object

---

## Problem 2: FFmpeg Filter Conflict Error

### Error Message
```
ffmpeg exited with code 1: Filtergraph 'scale=...' was specified through the -vf/-af/-filter 
option for output stream 0:0, which is fed from a complex filtergraph.
-vf/-af/-filter and -filter_complex cannot be used together for the same stream.
```

### Root Cause

The code was applying video filters in two conflicting ways:
1. Using `.videoFilters()` for scaling/padding (which generates `-vf` flag)
2. Using `.complexFilter()` for concatenating multiple clips (which generates `-filter_complex` flag)

FFmpeg doesn't allow both `-vf` and `-filter_complex` on the same output stream.

### The Problem Code

**BROKEN:**
```typescript
// Apply scaling filter
if (needsScaling) {
  command = command.videoFilters([scaleFilter]);
}

// Then apply concat filter (CONFLICT!)
if (clips.length > 1) {
  command = command.complexFilter([concatFilter]);
}
```

### Solution 2

Integrate the scaling filter into the complex filter chain when concatenating multiple clips.

**Fixed Code:**
```typescript
// Determine if we need scaling
const needsScaling = settings.resolution.name !== 'Source' && 
                    settings.resolution.width > 0 && 
                    settings.resolution.height > 0;

const scaleFilter = needsScaling 
  ? `scale=${settings.resolution.width}:${settings.resolution.height}:force_original_aspect_ratio=decrease,pad=${settings.resolution.width}:${settings.resolution.height}:(ow-iw)/2:(oh-ih)/2`
  : null;

// Handle multiple clips by concatenating them
if (clips.length > 1) {
  // Create a filter complex for concatenation and optional scaling
  const filterInputs = clips.map((_, index) => `[${index}:v][${index}:a]`).join('');
  const filterConcat = `concat=n=${clips.length}:v=1:a=1[v][a]`;
  
  // Build the complete filter chain
  let filterChain = `${filterInputs}${filterConcat}`;
  
  // If scaling is needed, add it to the filter chain
  if (scaleFilter) {
    filterChain += `;[v]${scaleFilter}[outv]`;
    command = command.complexFilter([filterChain]).outputOptions([
      '-map [outv]',
      '-map [a]'
    ]);
  } else {
    command = command.complexFilter([filterChain]).outputOptions([
      '-map [v]',
      '-map [a]'
    ]);
  }
} else if (scaleFilter) {
  // Single clip with scaling - can use videoFilters
  command = command.videoFilters([scaleFilter]);
}
```

### How It Works

1. **Single Clip**: Uses `.videoFilters()` for scaling (no conflict)
2. **Multiple Clips without Scaling**: Uses `.complexFilter()` for concat only
3. **Multiple Clips with Scaling**: Combines both operations in a single `.complexFilter()` chain:
   - First: Concatenate all clips → `[v][a]`
   - Then: Scale the video output → `[outv]`
   - Finally: Map both streams to output

### FFmpeg Filter Chain Example

For 2 clips with 720p scaling:
```
[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a];[v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[outv]
```

This creates a single filter graph that:
1. Takes video+audio from inputs 0 and 1
2. Concatenates them into intermediate streams `[v]` and `[a]`
3. Scales video stream `[v]` to 720p → final output `[outv]`
4. Audio stream `[a]` passes through unchanged

---

## Files Modified

1. **src/main/ffmpeg.ts** - Main FFmpeg export operations
2. **src/main/fileSystem.ts** - Video metadata extraction

## Verification

The compiled output now correctly shows:
```javascript
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// This now works!
let command = ffmpeg();
command.input('/path/to/video.mp4');
```

## Key Takeaways

### When to Use `require()` vs `import` in TypeScript

**Use `require()` for:**
- CommonJS modules that export a callable function directly
- Modules without a `default` export in their TypeScript types
- When the module's primary export is the function itself (not properties)

**Use `import` for:**
- Pure ESM modules
- CommonJS modules that export objects/classes
- Modules with proper TypeScript type definitions

### FFmpeg Filter Best Practices

1. **Never mix `-vf` and `-filter_complex`** - Choose one approach per output stream
2. **Use complexFilter() for multiple operations** - Combine concat, scale, etc. in one chain
3. **Use videoFilters() only for simple cases** - Single input, single operation
4. **Chain filters with semicolons** - `filter1;filter2;filter3`
5. **Label intermediate streams** - `[v][a]` for clarity and flexibility

### TypeScript Configuration Context

The issue was exacerbated by:
- `"esModuleInterop": true` - Allows default imports from CommonJS
- `"allowSyntheticDefaultImports": true` - Suppresses TypeScript errors
- `"type": "module"` in package.json - Sets default module type

While these settings are helpful for most cases, they can hide incompatibilities with certain CommonJS modules.

## Testing

To verify both fixes work:

1. **Rebuild the project:**
   ```bash
   npm run build
   ```

2. **Test export with single clip:**
   - Import one video clip
   - Select resolution (720p, 1080p, etc.)
   - Export and verify success

3. **Test export with multiple clips:**
   - Import 2+ video clips
   - Add them to timeline
   - Select resolution (or Source)
   - Export and verify clips are concatenated

4. **Test with trim points:**
   - Import clips
   - Apply trim points
   - Export and verify trims are applied

5. **Expected behavior:**
   - No "ffmpeg.input is not a function" errors
   - No filter conflict errors
   - Progress bar updates during export
   - Final video file created correctly

## Additional Notes

- The `fluent-ffmpeg` library is properly bundled as an external dependency
- FFmpeg binaries are correctly included in the electron-builder configuration
- Both fixes apply to development and production builds
- No changes needed to the renderer process or IPC communication
- Filter chains are optimized for performance and compatibility

## Related Documentation

- Vite External Dependencies: https://vitejs.dev/guide/ssr.html#ssr-externals
- TypeScript Module Resolution: https://www.typescriptlang.org/docs/handbook/module-resolution.html
- fluent-ffmpeg Documentation: https://github.com/fluent-ffmpeg/node-fluent-ffmpeg
- FFmpeg Filtering Guide: https://trac.ffmpeg.org/wiki/FilteringGuide


