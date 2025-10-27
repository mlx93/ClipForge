import { contextBridge, ipcRenderer } from 'electron';
import { 
  ImportVideosRequest, 
  ImportVideosResponse, 
  ExportTimelineRequest, 
  ExportTimelineResponse,
  VideoMetadata 
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

  // Listen for events from main process
  onImportVideos: (callback: (filePaths: string[]) => void) => 
    ipcRenderer.on('import-videos', (_, filePaths) => callback(filePaths)),

  onTriggerExport: (callback: () => void) => 
    ipcRenderer.on('trigger-export', callback),

  onExportProgress: (callback: (progress: { progress: number; currentStep: string }) => void) => 
    ipcRenderer.on(IPC_CHANNELS.EXPORT_PROGRESS, (_, progress) => callback(progress)),

  onExportComplete: (callback: (outputPath: string) => void) => 
    ipcRenderer.on(IPC_CHANNELS.EXPORT_COMPLETE, (_, outputPath) => callback(outputPath)),

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
      onImportVideos: (callback: (filePaths: string[]) => void) => void;
      onTriggerExport: (callback: () => void) => void;
      onExportProgress: (callback: (progress: { progress: number; currentStep: string }) => void) => void;
      onExportComplete: (callback: (outputPath: string) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
