import { ipcMain, BrowserWindow, dialog } from 'electron';
import { 
  ImportVideosRequest, 
  ImportVideosResponse, 
  ExportTimelineRequest, 
  ExportTimelineResponse,
  ExportProgressUpdate,
  Project
} from '@shared/types';
import { importVideos } from '../fileSystem';
import { exportTimeline, trimVideo } from '../ffmpeg';
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

  // Trim video handler
  ipcMain.handle(IPC_CHANNELS.TRIM_VIDEO, async (_, { inputPath, outputPath, trimStart, trimEnd }: { inputPath: string; outputPath: string; trimStart: number; trimEnd: number }) => {
    try {
      await trimVideo(inputPath, outputPath, trimStart, trimEnd, (progress) => {
        // Send progress updates to renderer
        mainWindow.webContents.send(IPC_CHANNELS.TRIM_PROGRESS, { progress, currentStep: `Trimming video... ${progress}%` });
      });
      
      return {
        success: true,
        outputPath
      };
    } catch (error) {
      console.error('Trim video error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Video trim failed'
      };
    }
  });

  // Delete file handler
  ipcMain.handle('delete-file', async (_, filePath: string) => {
    try {
      const fs = await import('fs/promises');
      await fs.unlink(filePath);
      return { success: true };
    } catch (error) {
      console.error('Delete file error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete file' 
      };
    }
  });

  // Show save dialog handler
  ipcMain.handle(IPC_CHANNELS.SHOW_SAVE_DIALOG, async (_, options: any) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, options);
      return result;
    } catch (error) {
      console.error('Save dialog error:', error);
      return { canceled: true };
    }
  });

  // Show open dialog handler
  ipcMain.handle(IPC_CHANNELS.SHOW_OPEN_DIALOG, async (_, options: any) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, options);
      return result;
    } catch (error) {
      console.error('Open dialog error:', error);
      return { canceled: true };
    }
  });

  // Save project handler
  ipcMain.handle(IPC_CHANNELS.SAVE_PROJECT, async (_, { project }: { project: Project }) => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Ensure directory exists
      const projectDir = path.dirname(project.path);
      await fs.mkdir(projectDir, { recursive: true });
      
      // Write project file
      await fs.writeFile(project.path, JSON.stringify(project, null, 2));
      
      return { success: true };
    } catch (error) {
      console.error('Save project error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save project' 
      };
    }
  });

  // Load project handler
  ipcMain.handle(IPC_CHANNELS.LOAD_PROJECT, async (_, filePath: string) => {
    try {
      const fs = await import('fs/promises');
      const data = await fs.readFile(filePath, 'utf-8');
      const project: Project = JSON.parse(data);
      
      // Convert date strings back to Date objects
      project.created = new Date(project.created);
      project.modified = new Date(project.modified);
      
      return { success: true, project };
    } catch (error) {
      console.error('Load project error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to load project' 
      };
    }
  });
};
