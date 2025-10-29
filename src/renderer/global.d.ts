// Global type declarations for ClipForge renderer process

import { 
  ImportVideosRequest, 
  ImportVideosResponse, 
  ExportTimelineRequest, 
  ExportTimelineResponse,
  VideoMetadata,
  Project
} from '@shared/types';

declare global {
  interface Window {
    electronAPI: {
      // Import videos
      importVideos: (request: ImportVideosRequest) => Promise<ImportVideosResponse>;

      // Export timeline
      exportTimeline: (request: ExportTimelineRequest) => Promise<ExportTimelineResponse>;

      // Get video metadata
      getVideoMetadata: (filePath: string) => Promise<{ success: boolean; metadata?: VideoMetadata; error?: string }>;

      // Trim video
      trimVideo: (inputPath: string, outputPath: string, trimStart: number, trimEnd: number) => Promise<{ success: boolean; outputPath?: string; error?: string }>;

      // Delete file
      deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;

      // Check if file exists
      checkFileExists: (filePath: string) => Promise<{ exists: boolean }>;

      // Generate thumbnail
      generateThumbnail: (videoPath: string, clipId: string) => Promise<{ success: boolean; thumbnailPath?: string; error?: string }>;

      // Project operations
      saveProject: (project: Project) => Promise<{ success: boolean; error?: string }>;
      loadProject: (filePath: string) => Promise<{ success: boolean; project?: Project; error?: string }>;
      showSaveDialog: (options: any) => Promise<{ canceled: boolean; filePath?: string }>;
      showOpenDialog: (options: any) => Promise<{ canceled: boolean; filePaths?: string[] }>;

      // Listen for events from main process
      onImportVideos: (callback: (filePaths: string[]) => void) => void;
      onTriggerExport: (callback: () => void) => void;
      onExportProgress: (callback: (progress: { progress: number; currentStep: string }) => void) => void;
      onExportComplete: (callback: (outputPath: string) => void) => void;
      onTrimProgress: (callback: (progress: { progress: number; currentStep: string }) => void) => void;

      // Event listeners
      on: (channel: string, callback: (...args: any[]) => void) => void;

      // Remove listeners
      removeAllListeners: (channel: string) => void;
    };
  }

  // Extend File interface for Electron's file path property
  interface File {
    path?: string;
  }
}

// CSS type extensions for webkit properties
declare module 'csstype' {
  interface Properties {
    WebkitAppRegion?: 'drag' | 'no-drag';
  }
}

export {};

