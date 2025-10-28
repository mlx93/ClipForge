// Use require-style imports for CommonJS modules that export a callable function
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpeg = require('fluent-ffmpeg');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { Clip, ExportSettings, ExportProgressUpdate } from '@shared/types';
import { FFMPEG_PRESET, FFMPEG_CRF, FFMPEG_AUDIO_BITRATE } from '@shared/constants';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export const exportTimeline = async (
  clips: Clip[],
  settings: ExportSettings,
  onProgress: (progress: ExportProgressUpdate) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (clips.length === 0) {
      reject(new Error('No clips to export'));
      return;
    }

    // Create output directory if it doesn't exist
    const outputDir = join(settings.outputPath, '..');
    if (!existsSync(outputDir)) {
      mkdir(outputDir, { recursive: true }).catch(reject);
    }

    // Build FFmpeg command
    let command = ffmpeg();

    // Add input files with trim points
    clips.forEach((clip, index) => {
      // Sanitize and quote file path to handle spaces and special characters
      const sanitizedPath = clip.path.replace(/\\/g, '/');
      
      // Apply trim points if specified
      if (clip.trimStart > 0 || clip.trimEnd > 0) {
        const startTime = clip.trimStart;
        const duration = clip.trimEnd > 0 ? clip.trimEnd - clip.trimStart : undefined;
        
        if (duration) {
          command.input(sanitizedPath).inputOptions([`-ss ${startTime}`, `-t ${duration}`]);
        } else {
          command.input(sanitizedPath).inputOptions([`-ss ${startTime}`]);
        }
      } else {
        command.input(sanitizedPath);
      }
    });

    // Configure output
    // Detect format based on output path extension
    const outputFormat = settings.outputPath.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4';
    
    // Determine if we need scaling
    const needsScaling = settings.resolution.name !== 'Source' && 
                        settings.resolution.width > 0 && 
                        settings.resolution.height > 0;
    
    const scaleFilter = needsScaling 
      ? `scale=${settings.resolution.width}:${settings.resolution.height}:force_original_aspect_ratio=decrease,pad=${settings.resolution.width}:${settings.resolution.height}:(ow-iw)/2:(oh-ih)/2`
      : null;

    // Handle multiple clips by concatenating them
    if (clips.length > 1) {
      // Create a filter complex for concatenation and optional scaling
      const filterInputs = clips.map((_, index) => `[${index}:v][${index}:a]`).join('');
      const filterConcat = `concat=n=${clips.length}:v=1:a=1[v][a]`;
      
      // Build the complete filter chain
      let filterChain = `${filterInputs}${filterConcat}`;
      
      // If scaling is needed, add it to the filter chain
      if (scaleFilter) {
        filterChain += `;[v]${scaleFilter}[outv]`;
        command = command.complexFilter([filterChain]).outputOptions([
          '-map [outv]',
          '-map [a]'
        ]);
      } else {
        command = command.complexFilter([filterChain]).outputOptions([
          '-map [v]',
          '-map [a]'
        ]);
      }
    } else if (scaleFilter) {
      // Single clip with scaling - can use videoFilters
      command = command.videoFilters([scaleFilter]);
    }
    
    command
      .outputOptions([
        '-c:v libx264',
        `-preset ${FFMPEG_PRESET}`,
        `-crf ${FFMPEG_CRF}`,
        '-c:a aac',
        `-b:a ${FFMPEG_AUDIO_BITRATE}`,
        '-movflags +faststart', // Optimize for streaming (works for both MP4 and MOV)
        '-pix_fmt yuv420p' // Ensure compatibility
      ])
      .format(outputFormat)
      .output(settings.outputPath);

    // Progress tracking
    command.on('progress', (progress) => {
      const percent = Math.round(progress.percent || 0);
      onProgress({
        progress: percent,
        currentStep: `Encoding video... ${percent}%`
      });
    });

    // Error handling
    command.on('error', (error) => {
      console.error('FFmpeg error:', error);
      
      // Check for disk full error (ENOSPC)
      if (error.message && (error.message.includes('ENOSPC') || error.message.includes('No space left'))) {
        reject(new Error('Export failed: Not enough disk space. Please free up space and try again.'));
      } else {
        reject(new Error(`Export failed: ${error.message}`));
      }
    });

    // Success
    command.on('end', () => {
      onProgress({
        progress: 100,
        currentStep: 'Export complete!'
      });
      resolve(settings.outputPath);
    });

    // Start encoding
    command.run();
  });
};

export const generateThumbnail = async (
  videoPath: string,
  timeOffset: number,
  outputPath: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(timeOffset)
      .frames(1)
      .size('160x90') // Thumbnail size
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (error) => reject(error))
      .run();
  });
};

export const getVideoDuration = async (videoPath: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      
      const duration = parseFloat(metadata.format.duration) || 0;
      resolve(duration);
    });
  });
};

export const trimVideo = async (
  inputPath: string,
  outputPath: string,
  trimStart: number,
  trimEnd: number,
  onProgress?: (progress: number) => void
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const duration = trimEnd - trimStart;
    
    // Sanitize paths to handle spaces and special characters
    const sanitizedInputPath = inputPath.replace(/\\/g, '/');
    const sanitizedOutputPath = outputPath.replace(/\\/g, '/');
    
    ffmpeg(sanitizedInputPath)
      .seekInput(trimStart)
      .duration(duration)
      .outputOptions([
        '-c:v libx264',
        '-c:a aac',
        '-preset fast',
        '-crf 23',
        '-movflags +faststart',
        '-pix_fmt yuv420p'
      ])
      .output(sanitizedOutputPath)
      .on('progress', (progress) => {
        if (onProgress) {
          const percent = Math.round(progress.percent || 0);
          onProgress(percent);
        }
      })
      .on('error', (error) => {
        console.error('FFmpeg trim error:', error);
        
        // Check for disk full error (ENOSPC)
        if (error.message && (error.message.includes('ENOSPC') || error.message.includes('No space left'))) {
          reject(new Error('Video trim failed: Not enough disk space. Please free up space and try again.'));
        } else {
          reject(new Error(`Video trim failed: ${error.message}`));
        }
      })
      .on('end', () => {
        resolve();
      })
      .run();
  });
};
