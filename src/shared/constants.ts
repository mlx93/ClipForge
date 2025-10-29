// Application constants

export const APP_NAME = 'ClipForge';
export const APP_VERSION = '1.2.0';

// Window dimensions
export const WINDOW_WIDTH = 1280;
export const WINDOW_HEIGHT = 720;
export const MIN_WINDOW_WIDTH = 1024;
export const MIN_WINDOW_HEIGHT = 600;

// Timeline configuration
export const TIMELINE_HEIGHT = 120;
export const CLIP_HEIGHT = 80;
export const PLAYHEAD_WIDTH = 2;
export const TIME_MARKER_INTERVAL = 5; // seconds between time markers

// Video preview
export const PREVIEW_WIDTH = 640;
export const PREVIEW_HEIGHT = 360;
export const MIN_PREVIEW_WIDTH = 320;
export const MIN_PREVIEW_HEIGHT = 180;

// File handling
export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
export const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
export const SUPPORTED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.aac', '.m4a'];

// FFmpeg settings
export const FFMPEG_PRESET = 'fast';
export const FFMPEG_CRF = 23; // Constant Rate Factor (lower = better quality)
export const FFMPEG_AUDIO_BITRATE = '128k';

// Memory management
export const MAX_MEMORY_USAGE = 1024 * 1024 * 1024; // 1GB
export const MAX_CONCURRENT_VIDEOS = 3; // Max video elements loaded simultaneously

// UI constants
export const ANIMATION_DURATION = 200; // ms
export const DEBOUNCE_DELAY = 300; // ms

// IPC Channel names
export const IPC_CHANNELS = {
  IMPORT_VIDEOS: 'import-videos',
  EXPORT_TIMELINE: 'export-timeline',
  EXPORT_PROGRESS: 'export-progress',
  EXPORT_COMPLETE: 'export-complete',
  GET_VIDEO_METADATA: 'get-video-metadata',
  TRIM_VIDEO: 'trim-video',
  TRIM_PROGRESS: 'trim-progress',
  SAVE_PROJECT: 'save-project',
  LOAD_PROJECT: 'load-project',
  SHOW_SAVE_DIALOG: 'show-save-dialog',
  SHOW_OPEN_DIALOG: 'show-open-dialog',
  NEW_PROJECT: 'new-project',
  // Recording channels
  GET_RECORDING_SOURCES: 'get-recording-sources',
  START_RECORDING: 'start-recording',
  STOP_RECORDING: 'stop-recording',
  SAVE_RECORDING: 'save-recording'
} as const;

// Error messages
export const ERROR_MESSAGES = {
  UNSUPPORTED_FORMAT: 'Unsupported video format. Please use MP4 or MOV files.',
  FILE_TOO_LARGE: 'File is too large. Maximum size is 2GB.',
  IMPORT_FAILED: 'Failed to import video file.',
  EXPORT_FAILED: 'Failed to export video.',
  FFMPEG_NOT_FOUND: 'FFmpeg not found. Please install FFmpeg.',
  INVALID_FILE: 'Invalid or corrupted video file.',
  EXPORT_CANCELLED: 'Export was cancelled by user.'
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  IMPORT_SUCCESS: 'Video imported successfully',
  EXPORT_SUCCESS: 'Video exported successfully',
  PROJECT_SAVED: 'Project saved successfully',
  PROJECT_LOADED: 'Project loaded successfully'
} as const;
