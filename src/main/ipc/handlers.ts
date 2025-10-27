import { ipcMain, BrowserWindow } from 'electron';
import { 
  ImportVideosRequest, 
  ImportVideosResponse, 
  ExportTimelineRequest, 
  ExportTimelineResponse,
  ExportProgressUpdate 
} from '@shared/types';
import { importVideos } from '../fileSystem';
import { exportTimeline } from '../ffmpeg';
import { IPC_CHANNELS } from '@shared/constants';

export const setupIpcHandlers = (mainWindow: BrowserWindow): void => {
  // Import videos handler
  ipcMain.handle(IPC_CHANNELS.IMPORT_VIDEOS, async (_, request: ImportVideosRequest): Promise<ImportVideosResponse> => {
    try {
      const clips = await importVideos(request.filePaths);
      return {
        success: true,
        clips
      };
    } catch (error) {
      console.error('Import videos error:', error);
      return {
        success: false,
        clips: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Export timeline handler
  ipcMain.handle(IPC_CHANNELS.EXPORT_TIMELINE, async (_, request: ExportTimelineRequest): Promise<ExportTimelineResponse> => {
    try {
      const outputPath = await exportTimeline(request.clips, request.settings, (progress: ExportProgressUpdate) => {
        // Send progress updates to renderer
        mainWindow.webContents.send(IPC_CHANNELS.EXPORT_PROGRESS, progress);
      });
      
      return {
        success: true,
        outputPath
      };
    } catch (error) {
      console.error('Export timeline error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed'
      };
    }
  });

  // Get video metadata handler
  ipcMain.handle(IPC_CHANNELS.GET_VIDEO_METADATA, async (_, filePath: string) => {
    try {
      const metadata = await importVideos([filePath]);
      return {
        success: true,
        metadata: metadata[0]
      };
    } catch (error) {
      console.error('Get metadata error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get metadata'
      };
    }
  });
};
