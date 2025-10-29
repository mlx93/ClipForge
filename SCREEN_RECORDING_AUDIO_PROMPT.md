# Screen Recording Issues - Audio and Save/Load Failures

## Problem Summary
Screen recordings in ClipForge have two critical issues: (1) Audio is not being captured or saved - recordings are silent even when audio is enabled, and the microphone audio fallback code exists but is not being triggered. (2) Recordings fail to load/play after saving - FFmpeg reports successful re-encoding but the resulting MP4 files show "Video Load Error" when the video preview component tries to load them, suggesting corrupted or incomplete files despite FFmpeg claiming success.

## Issue 1: Audio Not Working

### How Audio Works for Camera Recordings (Working)
For camera recordings, audio capture works seamlessly through a single `getUserMedia()` call. In `src/renderer/components/RecordingPanel.tsx` at lines 308-331, when `result.isWebcam` is true, the code calls `navigator.mediaDevices.getUserMedia(result.constraints)` with constraints that include both video and audio properties. The constraints are generated in `src/main/ipc/handlers.ts` at lines 104-115, where standard webcam constraints are created with `{ video: true, audio: true }` when audio is enabled. This single call captures both camera video and microphone audio in one stream, which MediaRecorder can then record directly. The MediaRecorder is initialized at lines 586-637 in `RecordingPanel.tsx` with this combined stream, and audio tracks are automatically included in the recording. Permissions are requested proactively at lines 213-284 before the `getUserMedia()` call, using `window.electronAPI.requestMediaPermissions()` which triggers macOS system permission dialogs through `systemPreferences.askForMediaAccess()` in `src/main/ipc/handlers.ts` lines 360-430.

### How Audio Works for Screen Recordings (Not Working)
For screen recordings, the audio capture mechanism is fundamentally different and more complex. At lines 332-421 in `RecordingPanel.tsx`, when `result.isWebcam` is false, the code uses Electron's `chromeMediaSource` constraints to capture screen/window video. These constraints are generated in `src/main/ipc/handlers.ts` at lines 117-146, where desktop capture constraints include `chromeMediaSource: "desktop"` and `chromeMediaSourceId` pointing to the selected screen/window. The critical difference is that desktop audio capture via `chromeMediaSource` often fails or produces audio tracks that end immediately (as seen in logs: "Desktop audio track 0 ended unexpectedly!"). To address this, there's a microphone audio fallback system at lines 434-563 in `RecordingPanel.tsx` that should proactively add microphone audio tracks to the screen recording stream. This fallback checks if `!result.isWebcam && settings.audioSource` is true, then attempts to call `navigator.mediaDevices.getUserMedia({ audio: true })` separately to get microphone audio tracks, which are then added to the screen stream via `mediaStream.addTrack(track)` before MediaRecorder starts. However, logs show audio tracks ending unexpectedly: "Desktop audio track 0 ended unexpectedly!" and "Microphone audio track ended unexpectedly!" at lines 527 and 536, indicating tracks are being added but then terminated before MediaRecorder can capture them. The WebM file is saved without audio (`hasAudio: false` at line 449 in `handlers.ts`), and FFmpeg re-encodes with silent audio (anullsrc) at lines 540-583.

### Audio Issue Root Causes
The microphone fallback code exists but appears to never execute properly - logs show it never reaches the "Proactively adding microphone audio" message, suggesting either `settings.audioSource` is false, the condition check at line 446 is failing, or an error is occurring silently before the fallback runs. Additionally, even when audio tracks are added, they end immediately before MediaRecorder can capture them, suggesting the audio tracks are being stopped or the stream references are being garbage collected. The permission request at lines 213-284 doesn't proactively request microphone permission for screen recordings (it only requests if `needsMicPermission` is true, which depends on `settings.audioSource`). When `getUserMedia({ audio: true })` fails during screen recording, there's no visible error toast or permission prompt - the error is silently caught at line 513 and only logged to console.

## Issue 2: Save/Load Failure

### How Screen Recording Save Works
When a recording is saved, the flow is: (1) `saveRecording()` in `RecordingPanel.tsx` lines 1085-1167 converts the recording blob to an ArrayBuffer and calls `window.electronAPI.saveRecording(arrayBuffer)`. (2) The IPC handler `SAVE_RECORDING` in `src/main/ipc/handlers.ts` lines 338-718 receives the ArrayBuffer. (3) For WebM files (which screen recordings use), it saves a temporary WebM file at line 430, then uses `ffprobe` at lines 435-444 to detect audio presence. (4) If no audio (`hasAudio: false`), it re-encodes using FFmpeg at lines 540-583 with silent audio source (`anullsrc=channel_layout=stereo:sample_rate=48000`). (5) FFmpeg reports success via the `'end'` event handler at line 562, which resolves the Promise with `{ success: true, filePath: finalMp4Path }`. (6) The clip is added to media library and timeline at lines 1139-1147 in `RecordingPanel.tsx`. (7) When the video preview tries to load the file, it uses `file://${clip.path}` at line 128 in `VideoPreview.tsx`, which triggers an `onError` event handler at line 258 that shows "Video Load Error".

### Save/Load Failure Symptoms
Logs show FFmpeg reports "Successfully re-encoded to MP4 with silent audio" at line 562 in `handlers.ts`, but when the video preview component tries to load the file, it fails with "Video Load Error" shown in `VideoPreview.tsx` at lines 258-264. The error handler sets `videoReadyStateRef.current = 'error'` and displays "Unable to load video. File may be corrupted or unsupported format." This suggests the MP4 file is either corrupted during encoding, incomplete (FFmpeg might be resolving the Promise before encoding completes), or has invalid metadata. The FFmpeg command includes `-movflags +faststart` at line 476 which should make files streamable, but the file might still be invalid. The issue could be timing-related: FFmpeg's `'end'` event fires but the file might not be fully written to disk, or the Promise resolves before the file handle is closed.

### Save/Load Failure Root Causes
The FFmpeg Promise resolves in the `'end'` event handler at line 562, but there's no verification that the output file actually exists and is valid before resolving. The error handler at lines 527-535 and 573-581 catches FFmpeg errors but falls back to returning the WebM file path, which might not be the intended behavior for screen recordings. There's no file size validation or FFprobe verification of the output MP4 file before returning success. The video preview component doesn't have detailed error logging - it only logs the file path at line 259 but doesn't check if the file exists or has valid video streams. The FFmpeg progress callback at line 512 shows "unknown" progress, suggesting FFmpeg might be having issues reporting progress during encoding.

## What Needs Fixing

### Audio Fixes Needed
1. Ensure microphone permissions are requested proactively before attempting screen recording with audio (verify `settings.audioSource` is correctly set to true when audio toggle is enabled)
2. Add proper error handling with user-facing toasts when microphone access fails (currently errors are silently caught at line 513)
3. Ensure the microphone audio fallback code actually executes by adding defensive logging and error handling around the condition check at line 446
4. Investigate why audio tracks end immediately after being added - the `micStreamRef` is maintained at line 468 but tracks still end unexpectedly, suggesting garbage collection or stream stopping issues
5. Verify that audio tracks remain active throughout the recording duration - consider keeping the microphone stream alive during the entire recording session

### Save/Load Fixes Needed
1. Verify FFmpeg output file exists and is valid before resolving Promise - add file existence check and FFprobe verification of output MP4 after encoding completes
2. Add file size validation - ensure output MP4 file size is reasonable (not 0 bytes or suspiciously small)
3. Improve error handling - if FFmpeg reports success but file is invalid, catch and return error instead of silently failing
4. Add detailed error logging in VideoPreview component - log file path, file size, and attempt to verify file integrity before showing error
5. Investigate FFmpeg encoding completion timing - ensure file handle is closed and file is fully written before resolving Promise
6. Consider adding retry logic or file validation step before adding clip to media library - verify file can be loaded before marking save as successful


