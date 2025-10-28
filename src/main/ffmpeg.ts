import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
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
      const input = ffmpeg.input(clip.path);
      
      // Apply trim points if specified
      if (clip.trimStart > 0 || clip.trimEnd > 0) {
        const startTime = clip.trimStart;
        const duration = clip.trimEnd > 0 ? clip.trimEnd - clip.trimStart : undefined;
        
        if (duration) {
          input.inputOptions([`-ss ${startTime}`, `-t ${duration}`]);
        } else {
          input.inputOptions([`-ss ${startTime}`]);
        }
      }
      
      command = command.addInput(input);
    });

    // Configure output
    command
      .outputOptions([
        '-c:v libx264',
        `-preset ${FFMPEG_PRESET}`,
        `-crf ${FFMPEG_CRF}`,
        '-c:a aac',
        `-b:a ${FFMPEG_AUDIO_BITRATE}`,
        '-movflags +faststart', // Optimize for streaming
        '-pix_fmt yuv420p' // Ensure compatibility
      ])
      .output(settings.outputPath);

    // Apply resolution scaling if needed
    if (settings.resolution.name !== 'Source') {
      command = command.videoFilters([
        `scale=${settings.resolution.width}:${settings.resolution.height}:force_original_aspect_ratio=decrease,pad=${settings.resolution.width}:${settings.resolution.height}:(ow-iw)/2:(oh-ih)/2`
      ]);
    }

    // Handle multiple clips by concatenating them
    if (clips.length > 1) {
      // Create a filter complex for concatenation
      const filterInputs = clips.map((_, index) => `[${index}:v][${index}:a]`).join('');
      const filterConcat = `concat=n=${clips.length}:v=1:a=1[outv][outa]`;
      
      command = command.complexFilter([
        `${filterInputs}${filterConcat}`
      ]).outputOptions([
        '-map [outv]',
        '-map [outa]'
      ]);
    }

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
      reject(new Error(`Export failed: ${error.message}`));
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
    
    ffmpeg(inputPath)
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
      .output(outputPath)
      .on('progress', (progress) => {
        if (onProgress) {
          const percent = Math.round(progress.percent || 0);
          onProgress(percent);
        }
      })
      .on('error', (error) => {
        console.error('FFmpeg trim error:', error);
        reject(new Error(`Video trim failed: ${error.message}`));
      })
      .on('end', () => {
        resolve();
      })
      .run();
  });
};
