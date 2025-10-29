import { ipcMain, BrowserWindow, dialog, app } from 'electron';
import { 
  ImportVideosRequest, 
  ImportVideosResponse, 
  ExportTimelineRequest, 
  ExportTimelineResponse,
  ExportProgressUpdate,
  Project
} from '@shared/types';
import { importVideos } from '../fileSystem';
import { exportTimeline, trimVideo, generateThumbnail } from '../ffmpeg';
import { IPC_CHANNELS } from '@shared/constants';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

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

  // Check if file exists handler
  ipcMain.handle('check-file-exists', async (_, filePath: string) => {
    try {
      const fs = await import('fs/promises');
      await fs.access(filePath);
      return { exists: true };
    } catch (error) {
      return { exists: false };
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

  // Generate thumbnail handler
  ipcMain.handle('generate-thumbnail', async (_, { videoPath, clipId }: { videoPath: string; clipId: string }) => {
    try {
      // Create thumbnails directory in user data folder
      const userDataPath = app.getPath('userData');
      const thumbnailsDir = join(userDataPath, 'thumbnails');
      
      // Ensure thumbnails directory exists
      if (!existsSync(thumbnailsDir)) {
        await mkdir(thumbnailsDir, { recursive: true });
      }
      
      // Generate thumbnail path
      const thumbnailPath = join(thumbnailsDir, `${clipId}.jpg`);
      
      // Check if thumbnail already exists
      if (existsSync(thumbnailPath)) {
        return { success: true, thumbnailPath };
      }
      
      // Generate thumbnail at 1 second mark (or 0 if video is shorter)
      const timeOffset = 1.0;
      await generateThumbnail(videoPath, timeOffset, thumbnailPath);
      
      return { success: true, thumbnailPath };
    } catch (error) {
      console.error('Generate thumbnail error:', error);
      // Don't fail the import if thumbnail generation fails
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate thumbnail' 
      };
    }
  });

  // Recording handlers
  ipcMain.handle('get-recording-sources', async () => {
    try {
      const { desktopCapturer } = require('electron');
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window']
      });
      
      const recordingSources = sources.map((source: any) => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
        type: source.id.startsWith('screen') ? 'screen' : 'window'
      }));
      
      return { success: true, sources: recordingSources };
    } catch (error) {
      console.error('Get recording sources error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get recording sources' 
      };
    }
  });

  ipcMain.handle('start-recording', async (_, { videoSourceId, audioEnabled, resolution, frameRate }: {
    videoSourceId: string;
    audioEnabled: boolean;
    resolution: { width: number; height: number };
    frameRate: number;
  }) => {
    try {
      const { desktopCapturer } = require('electron');
      
      // Get the video source
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window']
      });
      const source = sources.find((s: any) => s.id === videoSourceId);
      
      if (!source) {
        throw new Error('Video source not found');
      }
      
      // Create constraints for getUserMedia
      const constraints: any = {
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
            minWidth: resolution.width,
            maxWidth: resolution.width,
            minHeight: resolution.height,
            maxHeight: resolution.height,
            minFrameRate: frameRate,
            maxFrameRate: frameRate
          }
        }
      };
      
      if (audioEnabled) {
        constraints.audio = {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id
          }
        };
      }
      
      return { success: true, constraints };
    } catch (error) {
      console.error('Start recording error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to start recording' 
      };
    }
  });
};
