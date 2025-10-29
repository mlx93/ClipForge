import { ipcMain, BrowserWindow, dialog, app, shell } from 'electron';
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
      const actualOutputPath = await trimVideo(inputPath, outputPath, trimStart, trimEnd, (progress) => {
        // Send progress updates to renderer
        mainWindow.webContents.send(IPC_CHANNELS.TRIM_PROGRESS, { progress, currentStep: `Trimming video... ${progress}%` });
      });
      
      return {
        success: true,
        outputPath: actualOutputPath
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



  // Get recording sources handler
  ipcMain.handle(IPC_CHANNELS.GET_RECORDING_SOURCES, async () => {
    try {
      const { desktopCapturer } = require('electron');
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 150, height: 150 }
      });
      
      // Map desktop capture sources
      const desktopSources = sources.map((source: any) => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
        type: source.id.startsWith('screen') ? 'screen' : 'window'
      }));
      
      // Add webcam option (will use getUserMedia with video: true)
      const webcamSource = {
        id: 'webcam',
        name: 'Camera',
        thumbnail: 'data:image/svg+xml;base64,' + Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>'
        ).toString('base64'),
        type: 'webcam'
      };
      
      return {
        success: true,
        sources: [webcamSource, ...desktopSources] // Put webcam first
      };
    } catch (error) {
      console.error('Error getting recording sources:', error);
      return {
        success: false,
        sources: [],
        error: error instanceof Error ? error.message : 'Failed to get recording sources'
      };
    }
  });

  // Start recording handler
  ipcMain.handle(IPC_CHANNELS.START_RECORDING, async (_, params) => {
    try {
      const { videoSourceId, audioEnabled, resolution, frameRate } = params;
      
      // Check if this is a webcam recording
      if (videoSourceId === 'webcam') {
        // Use standard getUserMedia constraints for webcam
        const constraints: any = {
          video: {
            width: { ideal: resolution.width },
            height: { ideal: resolution.height },
            frameRate: { ideal: frameRate }
          }
        };

        if (audioEnabled) {
          constraints.audio = true;
        }

        return {
          success: true,
          constraints,
          isWebcam: true
        };
      } else {
        // Use desktop capturer for screen/window recording
        // Electron requires chromeMediaSource constraints wrapped in 'mandatory'
        // This is the correct format for Electron desktop capture
        const constraints: any = {
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: videoSourceId
            },
            optional: [
              { minWidth: resolution.width },
              { maxWidth: resolution.width },
              { minHeight: resolution.height },
              { maxHeight: resolution.height },
              { minFrameRate: frameRate },
              { maxFrameRate: frameRate }
            ]
          }
        };

        if (audioEnabled) {
          constraints.audio = {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: videoSourceId
            }
          };
        }

        console.log('[Recording Handler] Generated constraints for screen recording:', JSON.stringify(constraints, null, 2));
        console.log('[Recording Handler] Video source ID:', videoSourceId);

        return {
          success: true,
          constraints,
          isWebcam: false
        };
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start recording'
      };
    }
  });

  // Save recording handler
  ipcMain.handle(IPC_CHANNELS.SAVE_RECORDING, async (_, arrayBuffer) => {
    try {
      const { writeFile } = require('fs/promises');
      const { join } = require('path');
      const { app } = require('electron');
      const ffmpeg = require('fluent-ffmpeg');
      const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
      
      // Set FFmpeg path
      ffmpeg.setFfmpegPath(ffmpegInstaller.path);
      
      // Create recordings directory if it doesn't exist
      const recordingsDir = join(app.getPath('userData'), 'recordings');
      await mkdir(recordingsDir, { recursive: true });
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Detect if the blob is already MP4 by checking the first bytes
      // MP4 files start with specific box signatures
      const uint8Array = new Uint8Array(arrayBuffer);
      const isMP4 = uint8Array.length >= 8 && 
        (uint8Array[4] === 0x66 && uint8Array[5] === 0x74 && uint8Array[6] === 0x79 && uint8Array[7] === 0x70) || // ftyp box
        (uint8Array[0] === 0x00 && uint8Array[1] === 0x00 && uint8Array[2] === 0x00 && uint8Array[3] === 0x18); // MP4 box size
      
      if (isMP4) {
        // Already MP4 - save directly, but still check/verify audio
        console.log('[Recording Handler] Recording is already MP4 format');
        const finalMp4Path = join(recordingsDir, `recording-${timestamp}.mp4`);
        await writeFile(finalMp4Path, Buffer.from(arrayBuffer));
        
        // Verify audio with ffprobe
        const hasAudio = await new Promise<boolean>((resolve) => {
          ffmpeg.ffprobe(finalMp4Path, (err: any, metadata: any) => {
            if (err) {
              console.warn('[Recording Handler] Could not probe MP4 file:', err);
              resolve(false);
              return;
            }
            
            const audioStream = metadata.streams?.some((stream: any) => stream.codec_type === 'audio');
            console.log('[Recording Handler] MP4 file has audio:', audioStream);
            resolve(audioStream);
          });
        });
        
        if (!hasAudio) {
          // MP4 file has no audio - re-encode to add silent audio
          console.log('[Recording Handler] MP4 has no audio, re-encoding to add silent audio');
          const tempMp4Path = join(recordingsDir, `recording-${timestamp}-temp.mp4`);
          await writeFile(tempMp4Path, Buffer.from(arrayBuffer));
          
          return new Promise((resolve) => {
            ffmpeg(tempMp4Path)
              .input('anullsrc=channel_layout=stereo:sample_rate=48000')
              .inputOptions(['-f', 'lavfi'])
              .outputOptions([
                '-c:v copy', // Copy video stream (no re-encoding)
                '-c:a aac',
                '-b:a 128k',
                '-shortest',
                '-movflags +faststart'
              ])
              .output(finalMp4Path)
              .on('end', () => {
                console.log('[Recording Handler] Successfully added silent audio to MP4');
                require('fs/promises').unlink(tempMp4Path).catch(() => {});
                resolve({
                  success: true,
                  filePath: finalMp4Path
                });
              })
              .on('error', (err: any) => {
                console.error('[Recording Handler] Re-encoding error:', err);
                // Return original MP4 if re-encoding fails
                resolve({
                  success: true,
                  filePath: finalMp4Path
                });
              })
              .run();
          });
        }
        
        return {
          success: true,
          filePath: finalMp4Path
        };
      }
      
      // WebM format - save temporarily and re-encode to MP4
      const tempWebmPath = join(recordingsDir, `recording-${timestamp}.webm`);
      await writeFile(tempWebmPath, Buffer.from(arrayBuffer));
      
      console.log('[Recording Handler] Saved temporary WebM file:', tempWebmPath);
      
      // Probe the video file to get its properties
      const videoMetadata = await new Promise<any>((resolve, reject) => {
        ffmpeg.ffprobe(tempWebmPath, (err: any, metadata: any) => {
          if (err) {
            console.warn('[Recording Handler] Could not probe WebM file:', err);
            reject(err);
            return;
          }
          resolve(metadata);
        });
      });
      
      // Extract video stream info
      const videoStream = videoMetadata.streams?.find((s: any) => s.codec_type === 'video');
      const audioStream = videoMetadata.streams?.find((s: any) => s.codec_type === 'audio');
      const hasAudio = !!audioStream;
      
      console.log('[Recording Handler] WebM file has audio:', hasAudio);
      console.log('[Recording Handler] Video stream info:', {
        width: videoStream?.width,
        height: videoStream?.height,
        codec: videoStream?.codec_name,
        pixelFormat: videoStream?.pix_fmt,
        framerate: videoStream?.r_frame_rate
      });
      
      if (!videoStream) {
        throw new Error('No video stream found in WebM file');
      }
      
      // Re-encode to MP4 with audio preservation
      const finalMp4Path = join(recordingsDir, `recording-${timestamp}.mp4`);
      
      return new Promise((resolve, reject) => {
        let command = ffmpeg(tempWebmPath);
        
        // Set video codec and ensure compatibility
        const outputOptions: string[] = [
          '-c:v libx264',
          '-preset medium',
          '-crf 23',
          '-pix_fmt yuv420p', // Ensure YUV420P for compatibility
          '-movflags +faststart'
        ];
        
        // Add explicit video filter if dimensions are odd (H.264 requires even dimensions)
        // IMPORTANT: Build filter chain properly - scale filter must come before other operations
        let videoFilter = '';
        if (videoStream.width && videoStream.height) {
          const width = videoStream.width;
          const height = videoStream.height;
          
          // H.264 requires even dimensions - fix if odd
          if (width % 2 !== 0 || height % 2 !== 0) {
            const evenWidth = Math.floor(width / 2) * 2;
            const evenHeight = Math.floor(height / 2) * 2;
            videoFilter = `scale=${evenWidth}:${evenHeight}`;
            console.log('[Recording Handler] Adjusting dimensions to even values:', { original: { width, height }, adjusted: { evenWidth, evenHeight } });
          }
        }
        
        if (hasAudio) {
          // Preserve audio if present - explicitly map video and audio streams
          if (videoFilter) {
            outputOptions.push(`-vf ${videoFilter}`);
          }
          outputOptions.push(
            '-c:a aac',
            '-b:a 128k',
            '-map 0:v:0', // Map first video stream
            '-map 0:a:0'  // Map first audio stream
          );
          command
            .outputOptions(outputOptions)
            .output(finalMp4Path)
            .on('start', (commandLine: string) => {
              console.log('[Recording Handler] FFmpeg command:', commandLine);
            })
            .on('progress', (progress: any) => {
              console.log('[Recording Handler] FFmpeg progress:', progress.percent || 'unknown');
            })
            .on('end', () => {
              console.log('[Recording Handler] Successfully re-encoded to MP4 with audio');
              // Delete temporary WebM file
              require('fs/promises').unlink(tempWebmPath).catch((err: any) => {
                console.warn('[Recording Handler] Could not delete temp WebM file:', err);
              });
              
              resolve({
                success: true,
                filePath: finalMp4Path
              });
            })
            .on('error', (err: any) => {
              console.error('[Recording Handler] FFmpeg re-encoding error:', err);
              console.error('[Recording Handler] FFmpeg error message:', err.message);
              console.error('[Recording Handler] FFmpeg stderr:', err);
              // Fallback: return WebM file if re-encoding fails
              resolve({
                success: true,
                filePath: tempWebmPath
              });
            })
            .run();
        } else {
          // No audio - just re-encode video, add silent audio
          if (videoFilter) {
            outputOptions.push(`-vf ${videoFilter}`);
          }
          command
            .input('anullsrc=channel_layout=stereo:sample_rate=48000')
            .inputOptions(['-f', 'lavfi'])
            .outputOptions([
              ...outputOptions,
              '-c:a aac',
              '-b:a 128k',
              '-shortest',
              '-map 0:v:0', // Map video from first input (WebM)
              '-map 1:a:0'  // Map audio from second input (silent audio)
            ])
            .output(finalMp4Path)
            .on('start', (commandLine: string) => {
              console.log('[Recording Handler] FFmpeg command:', commandLine);
            })
            .on('progress', (progress: any) => {
              console.log('[Recording Handler] FFmpeg progress:', progress.percent || 'unknown');
            })
            .on('end', () => {
              console.log('[Recording Handler] Successfully re-encoded to MP4 with silent audio');
              // Delete temporary WebM file
              require('fs/promises').unlink(tempWebmPath).catch((err: any) => {
                console.warn('[Recording Handler] Could not delete temp WebM file:', err);
              });
              
              resolve({
                success: true,
                filePath: finalMp4Path
              });
            })
            .on('error', (err: any) => {
              console.error('[Recording Handler] FFmpeg re-encoding error:', err);
              console.error('[Recording Handler] FFmpeg error message:', err.message);
              console.error('[Recording Handler] FFmpeg stderr:', err);
              // Fallback: return WebM file if re-encoding fails
              resolve({
                success: true,
                filePath: tempWebmPath
              });
            })
            .run();
        }
      });
    } catch (error) {
      console.error('Error saving recording:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save recording'
      };
    }
  });
  
  // Request media permissions handler
  ipcMain.handle(IPC_CHANNELS.REQUEST_MEDIA_PERMISSIONS, async (_, { mic, camera }: { mic?: boolean; camera?: boolean }) => {
    try {
      const permissions: string[] = [];
      if (mic) permissions.push('microphone');
      if (camera) permissions.push('camera');
      
      // On macOS, request system permissions
      if (process.platform === 'darwin') {
        const { systemPreferences } = require('electron');
        
        const results: { [key: string]: string } = {};
        const granted: { [key: string]: boolean } = {
          microphone: false,
          camera: false
        };
        
        // Request microphone permission if needed
        if (mic) {
          const currentStatus = systemPreferences.getMediaAccessStatus('microphone');
          console.log('[Permissions] Microphone current status:', currentStatus);
          
          if (currentStatus === 'granted') {
            results.microphone = 'granted';
            granted.microphone = true;
          } else if (currentStatus === 'denied') {
            results.microphone = 'denied';
            granted.microphone = false;
          } else {
            // Not determined - request permission
            console.log('[Permissions] Requesting microphone access...');
            try {
              const micGranted = await systemPreferences.askForMediaAccess('microphone');
              results.microphone = micGranted ? 'granted' : 'denied';
              granted.microphone = micGranted;
              console.log('[Permissions] Microphone access granted:', micGranted);
            } catch (err) {
              console.error('[Permissions] Error requesting microphone access:', err);
              results.microphone = 'error';
              granted.microphone = false;
            }
          }
        }
        
        // Request camera permission if needed
        if (camera) {
          const currentStatus = systemPreferences.getMediaAccessStatus('camera');
          console.log('[Permissions] Camera current status:', currentStatus);
          
          if (currentStatus === 'granted') {
            results.camera = 'granted';
            granted.camera = true;
          } else if (currentStatus === 'denied') {
            results.camera = 'denied';
            granted.camera = false;
          } else {
            // Not determined - request permission
            console.log('[Permissions] Requesting camera access...');
            try {
              const camGranted = await systemPreferences.askForMediaAccess('camera');
              results.camera = camGranted ? 'granted' : 'denied';
              granted.camera = camGranted;
              console.log('[Permissions] Camera access granted:', camGranted);
            } catch (err) {
              console.error('[Permissions] Error requesting camera access:', err);
              results.camera = 'error';
              granted.camera = false;
            }
          }
        }
        
        // Check if any permissions are denied or had errors
        const denied: string[] = [];
        const needsGrant: string[] = [];
        
        if (mic) {
          if (results.microphone === 'denied' || results.microphone === 'error') {
            denied.push('microphone');
          } else if (results.microphone !== 'granted') {
            needsGrant.push('microphone');
          }
        }
        
        if (camera) {
          if (results.camera === 'denied' || results.camera === 'error') {
            denied.push('camera');
          } else if (results.camera !== 'granted') {
            needsGrant.push('camera');
          }
        }
        
        return {
          success: denied.length === 0 && needsGrant.length === 0 && (mic ? granted.microphone : true) && (camera ? granted.camera : true),
          granted: {
            microphone: granted.microphone,
            camera: granted.camera
          },
          status: results,
          denied,
          needsGrant,
          platform: 'darwin'
        };
      }
      
      // For other platforms, just return success
      // Permissions will be requested when getUserMedia is called
      return {
        success: true,
        granted: {
          microphone: mic || false,
          camera: camera || false
        },
        platform: process.platform
      };
    } catch (error) {
      console.error('[Permissions] Error checking permissions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check permissions'
      };
    }
  });
};
