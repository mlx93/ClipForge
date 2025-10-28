// Core data types for ClipForge

export interface Clip {
  id: string;
  name: string;
  path: string;
  duration: number; // in seconds
  width: number;
  height: number;
  frameRate: number;
  codec: string;
  fileSize: number; // in bytes
  trimStart: number; // trim start offset in seconds
  trimEnd: number; // trim end offset in seconds (0 = no trim)
  thumbnailPath?: string; // path to generated thumbnail
}

export interface TimelineState {
  clips: Clip[];
  playhead: number; // current time position in seconds
  selectedClipId: string | null;
  totalDuration: number; // total timeline duration
  zoom: number; // timeline zoom level
}

export interface Project {
  name: string;
  path: string;
  created: Date;
  modified: Date;
  timeline: TimelineState;
  settings: ProjectSettings;
}

export interface ProjectState {
  projectPath: string | null;
  isDirty: boolean;
  lastSaved: Date | null;
  settings: ProjectSettings;
}

export interface ProjectSettings {
  resolution: Resolution;
  frameRate: number;
  audioSampleRate: number;
  audioChannels: number;
}

export interface Resolution {
  width: number;
  height: number;
  name: string; // e.g., "720p", "1080p", "Source"
}

export interface ExportSettings {
  outputPath: string;
  resolution: Resolution;
  quality: 'low' | 'medium' | 'high';
  format: 'mp4' | 'mov';
}

export interface ExportState {
  isExporting: boolean;
  progress: number; // 0-100
  currentStep: string;
  error: string | null;
  outputPath: string | null;
}

// IPC Communication Types
export interface ImportVideosRequest {
  filePaths: string[];
}

export interface ImportVideosResponse {
  success: boolean;
  clips: Clip[];
  error?: string;
}

export interface ExportTimelineRequest {
  clips: Clip[];
  settings: ExportSettings;
}

export interface ExportTimelineResponse {
  success: boolean;
  outputPath?: string;
  error?: string;
}

export interface ExportProgressUpdate {
  progress: number;
  currentStep: string;
}

// Video metadata from FFmpeg
export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  frameRate: number;
  codec: string;
  fileSize: number;
  bitrate?: number;
  audioCodec?: string;
  audioSampleRate?: number;
  audioChannels?: number;
}

// Timeline interaction types
export interface TimelineClickEvent {
  time: number;
  x: number;
  y: number;
}

export interface ClipDragEvent {
  clipId: string;
  startTime: number;
  endTime: number;
  newStartTime: number;
}

// Supported file formats
export const SUPPORTED_VIDEO_FORMATS = ['.mp4', '.mov', '.avi', '.mkv', '.webm'] as const;
export type SupportedVideoFormat = typeof SUPPORTED_VIDEO_FORMATS[number];

// Resolution presets
export const RESOLUTION_PRESETS: Resolution[] = [
  { width: 1280, height: 720, name: '720p' },
  { width: 1920, height: 1080, name: '1080p' },
  { width: 2560, height: 1440, name: '1440p' },
  { width: 3840, height: 2160, name: '4K' }
];

// Default project settings
export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  resolution: RESOLUTION_PRESETS[1], // 1080p
  frameRate: 30,
  audioSampleRate: 44100,
  audioChannels: 2
};
