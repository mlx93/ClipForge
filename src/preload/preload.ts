import { contextBridge, ipcRenderer } from 'electron';
import { 
  ImportVideosRequest, 
  ImportVideosResponse, 
  ExportTimelineRequest, 
  ExportTimelineResponse,
  VideoMetadata,
  Project
} from '@shared/types';
import { IPC_CHANNELS } from '@shared/constants';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Import videos
  importVideos: (request: ImportVideosRequest): Promise<ImportVideosResponse> => 
    ipcRenderer.invoke(IPC_CHANNELS.IMPORT_VIDEOS, request),

  // Export timeline
  exportTimeline: (request: ExportTimelineRequest): Promise<ExportTimelineResponse> => 
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_TIMELINE, request),

  // Get video metadata
  getVideoMetadata: (filePath: string): Promise<{ success: boolean; metadata?: VideoMetadata; error?: string }> => 
    ipcRenderer.invoke(IPC_CHANNELS.GET_VIDEO_METADATA, filePath),

  // Trim video
  trimVideo: (inputPath: string, outputPath: string, trimStart: number, trimEnd: number): Promise<{ success: boolean; outputPath?: string; error?: string }> => 
    ipcRenderer.invoke(IPC_CHANNELS.TRIM_VIDEO, { inputPath, outputPath, trimStart, trimEnd }),

  // Delete file
  deleteFile: (filePath: string): Promise<{ success: boolean; error?: string }> => 
    ipcRenderer.invoke('delete-file', filePath),

  // Check if file exists
  checkFileExists: (filePath: string): Promise<{ exists: boolean }> => 
    ipcRenderer.invoke('check-file-exists', filePath),

  // Generate thumbnail
  generateThumbnail: (videoPath: string, clipId: string): Promise<{ success: boolean; thumbnailPath?: string; error?: string }> => 
    ipcRenderer.invoke('generate-thumbnail', { videoPath, clipId }),

  // Project operations
  saveProject: (project: Project): Promise<{ success: boolean; error?: string }> => 
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_PROJECT, { project }),

  loadProject: (filePath: string): Promise<{ success: boolean; project?: Project; error?: string }> => 
    ipcRenderer.invoke(IPC_CHANNELS.LOAD_PROJECT, filePath),

  showSaveDialog: (options: any): Promise<{ canceled: boolean; filePath?: string }> => 
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_SAVE_DIALOG, options),

  showOpenDialog: (options: any): Promise<{ canceled: boolean; filePaths?: string[] }> => 
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_OPEN_DIALOG, options),

  // Listen for events from main process
  onImportVideos: (callback: (filePaths: string[]) => void) => 
    ipcRenderer.on('import-videos', (_, filePaths) => callback(filePaths)),

  onTriggerExport: (callback: () => void) => 
    ipcRenderer.on('trigger-export', callback),

  onExportProgress: (callback: (progress: { progress: number; currentStep: string }) => void) => 
    ipcRenderer.on(IPC_CHANNELS.EXPORT_PROGRESS, (_, progress) => callback(progress)),

  onExportComplete: (callback: (outputPath: string) => void) => 
    ipcRenderer.on(IPC_CHANNELS.EXPORT_COMPLETE, (_, outputPath) => callback(outputPath)),

  onTrimProgress: (callback: (progress: { progress: number; currentStep: string }) => void) => 
    ipcRenderer.on(IPC_CHANNELS.TRIM_PROGRESS, (_, progress) => callback(progress)),

  // Event listeners
  on: (channel: string, callback: (...args: any[]) => void) => 
    ipcRenderer.on(channel, callback),

  // Remove listeners
  removeAllListeners: (channel: string) => 
    ipcRenderer.removeAllListeners(channel)
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      importVideos: (request: ImportVideosRequest) => Promise<ImportVideosResponse>;
      exportTimeline: (request: ExportTimelineRequest) => Promise<ExportTimelineResponse>;
      getVideoMetadata: (filePath: string) => Promise<{ success: boolean; metadata?: VideoMetadata; error?: string }>;
      trimVideo: (inputPath: string, outputPath: string, trimStart: number, trimEnd: number) => Promise<{ success: boolean; outputPath?: string; error?: string }>;
      deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      checkFileExists: (filePath: string) => Promise<{ exists: boolean }>;
      saveProject: (project: Project) => Promise<{ success: boolean; error?: string }>;
      loadProject: (filePath: string) => Promise<{ success: boolean; project?: Project; error?: string }>;
      showSaveDialog: (options: any) => Promise<{ canceled: boolean; filePath?: string }>;
      showOpenDialog: (options: any) => Promise<{ canceled: boolean; filePaths?: string[] }>;
      onImportVideos: (callback: (filePaths: string[]) => void) => void;
      onTriggerExport: (callback: () => void) => void;
      onExportProgress: (callback: (progress: { progress: number; currentStep: string }) => void) => void;
      onExportComplete: (callback: (outputPath: string) => void) => void;
      onTrimProgress: (callback: (progress: { progress: number; currentStep: string }) => void) => void;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
