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
  return new Promise(async (resolve, reject) => {
    if (clips.length === 0) {
      reject(new Error('No clips to export'));
      return;
    }

    // Create output directory if it doesn't exist
    const outputDir = join(settings.outputPath, '..');
    if (!existsSync(outputDir)) {
      mkdir(outputDir, { recursive: true }).catch(reject);
    }

    // Check which clips have audio streams
    const clipsWithAudio: boolean[] = [];
    for (const clip of clips) {
      try {
        const metadata = await new Promise<any>((resolve, reject) => {
          ffmpeg.ffprobe(clip.path, (err: any, data: any) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        
        const hasAudio = metadata.streams.some((stream: any) => stream.codec_type === 'audio');
        clipsWithAudio.push(hasAudio);
        
        if (!hasAudio) {
          console.log(`[FFmpeg Export] Clip ${clip.path} has no audio stream, will generate silent audio`);
        }
      } catch (error) {
        console.warn(`[FFmpeg Export] Could not check audio for ${clip.path}, assuming no audio:`, error);
        clipsWithAudio.push(false);
      }
    }

    // Calculate total duration for progress tracking
    const totalDuration = clips.reduce((sum, clip) => {
      if (clip.trimEnd > 0) {
        return sum + (clip.trimEnd - clip.trimStart);
      }
      return sum + clip.duration;
    }, 0);
    
    console.log('[FFmpeg Export] Total duration:', totalDuration, 'seconds');

    // Detect output format early (needed for logging)
    const outputFormat = settings.outputPath.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4';

    // Build FFmpeg command
    let command = ffmpeg();

    // Track which input index corresponds to silent audio for each clip
    const silentAudioInputIndices: Map<number, number> = new Map();
    let nextInputIndex = clips.length; // Start after all video inputs

    // Add input files with trim points
    clips.forEach((clip, index) => {
      // Sanitize and quote file path to handle spaces and special characters
      const sanitizedPath = clip.path.replace(/\\/g, '/');
      
      // Detect input format for logging/debugging
      const inputExt = clip.path.toLowerCase().split('.').pop() || '';
      const isWebM = inputExt === 'webm';
      
      if (isWebM) {
        console.log(`[FFmpeg Export] Detected WebM input: ${clip.path}, will be transcoded to ${outputFormat}`);
      }
      
      // Build input options for trimming
      const inputOptions: string[] = [];
      
      // Apply trim points if specified
      if (clip.trimStart > 0 || clip.trimEnd > 0) {
        const startTime = clip.trimStart;
        const duration = clip.trimEnd > 0 ? clip.trimEnd - clip.trimStart : undefined;
        
        if (duration) {
          inputOptions.push(`-ss ${startTime}`, `-t ${duration}`);
        } else {
          inputOptions.push(`-ss ${startTime}`);
        }
      }
      
      // Add input with options
      if (inputOptions.length > 0) {
        command.input(sanitizedPath).inputOptions(inputOptions);
      } else {
        command.input(sanitizedPath);
      }
      
      // If clip has no audio, generate silent audio track
      if (!clipsWithAudio[index]) {
        // Calculate the actual duration we need for this clip
        let clipDuration: number;
        if (clip.trimEnd > 0) {
          // Trimmed clip: use trimmed duration
          clipDuration = clip.trimEnd - clip.trimStart;
        } else if (clip.trimStart > 0) {
          // Only start trimmed: use remaining duration
          clipDuration = clip.duration - clip.trimStart;
        } else {
          // No trimming: use full duration
          clipDuration = clip.duration;
        }
        
        console.log(`[FFmpeg Export] Generating silent audio for clip ${index}, duration: ${clipDuration}s`);
        
        // Generate silent audio using anullsrc filter
        // Note: anullsrc generates infinite silent audio, so we use -t to limit duration
        command.input('anullsrc=channel_layout=stereo:sample_rate=48000')
          .inputOptions(['-f', 'lavfi', '-t', Math.max(0.1, clipDuration).toFixed(3)]);
        
        silentAudioInputIndices.set(index, nextInputIndex);
        console.log(`[FFmpeg Export] Silent audio for clip ${index} will be at input index ${nextInputIndex}`);
        nextInputIndex++;
      }
    });

    // Configure output
    
    // Target frame rate for normalization (prevents frame duplication issues)
    const targetFrameRate = 30;
    
    // Determine if we need scaling
    const needsScaling = settings.resolution.name !== 'Source' && 
                        settings.resolution.width > 0 && 
                        settings.resolution.height > 0;
    
    const scaleFilter = needsScaling 
      ? `scale=${settings.resolution.width}:${settings.resolution.height}:force_original_aspect_ratio=decrease,pad=${settings.resolution.width}:${settings.resolution.height}:(ow-iw)/2:(oh-ih)/2`
      : null;

    // Handle multiple clips by concatenating them
    if (clips.length > 1) {
      // Build normalization filters for each input
      // Normalize video to target frame rate and audio to 48kHz
      const normalizationFilters: string[] = [];
      const normalizedVideoLabels: string[] = [];
      const normalizedAudioLabels: string[] = [];
      
      clips.forEach((clip, index) => {
        const videoLabel = `v${index}`;
        const audioLabel = `a${index}`;
        
        // Normalize video frame rate to prevent duplication
        normalizationFilters.push(`[${index}:v]fps=${targetFrameRate}[${videoLabel}]`);
        normalizedVideoLabels.push(`[${videoLabel}]`);
        
        // Normalize audio sample rate for consistency
        if (clipsWithAudio[index]) {
          normalizationFilters.push(`[${index}:a]aresample=48000:async=1[${audioLabel}]`);
          normalizedAudioLabels.push(`[${audioLabel}]`);
        } else {
          // Use silent audio we generated (already at 48kHz)
          const silentAudioIndex = silentAudioInputIndices.get(index);
          if (silentAudioIndex !== undefined) {
            normalizedAudioLabels.push(`[${silentAudioIndex}:a]`);
          } else {
            // Fallback: shouldn't happen
            console.warn(`[FFmpeg Export] No silent audio index found for clip ${index}, using video audio`);
            normalizationFilters.push(`[${index}:a]aresample=48000:async=1[${audioLabel}]`);
            normalizedAudioLabels.push(`[${audioLabel}]`);
          }
        }
      });
      
      // Build concat filter inputs: [v0][a0][v1][a1]...
      const concatInputs: string[] = [];
      clips.forEach((_, index) => {
        concatInputs.push(normalizedVideoLabels[index]);
        concatInputs.push(normalizedAudioLabels[index]);
      });
      
      const filterConcat = `concat=n=${clips.length}:v=1:a=1[vconcat][aconcat]`;
      
      // Build the complete filter chain: normalize → concat → scale (if needed)
      let filterChain = normalizationFilters.join(';') + ';' + concatInputs.join('') + filterConcat;
      
      if (scaleFilter) {
        filterChain += `;[vconcat]${scaleFilter}[outv]`;
        command = command.complexFilter([filterChain]).outputOptions([
          '-map [outv]',
          '-map [aconcat]'
        ]);
      } else {
        command = command.complexFilter([filterChain]).outputOptions([
          '-map [vconcat]',
          '-map [aconcat]'
        ]);
      }
      
      console.log('[FFmpeg Export] Filter chain:', filterChain);
      console.log('[FFmpeg Export] Clips with audio:', clipsWithAudio);
      console.log('[FFmpeg Export] Silent audio indices:', Array.from(silentAudioInputIndices.entries()));
    } else {
      // Single clip - normalize frame rate
      const hasAudio = clipsWithAudio[0];
      const singleClipFilters: string[] = [];
      
      // Normalize video frame rate
      singleClipFilters.push(`[0:v]fps=${targetFrameRate}[vnorm]`);
      
      if (hasAudio) {
        // Normalize audio sample rate
        singleClipFilters.push(`[0:a]aresample=48000:async=1[anorm]`);
        
        if (scaleFilter) {
          singleClipFilters.push(`[vnorm]${scaleFilter}[outv]`);
          command = command.complexFilter([singleClipFilters.join(';')]).outputOptions([
            '-map [outv]',
            '-map [anorm]'
          ]);
        } else {
          command = command.complexFilter([singleClipFilters.join(';')]).outputOptions([
            '-map [vnorm]',
            '-map [anorm]'
          ]);
        }
      } else {
        // No audio - use silent audio we generated
        const silentAudioIndex = silentAudioInputIndices.get(0);
        if (silentAudioIndex !== undefined) {
          if (scaleFilter) {
            singleClipFilters.push(`[vnorm]${scaleFilter}[outv]`);
            command = command.complexFilter([singleClipFilters.join(';')]).outputOptions([
              '-map [outv]',
              `-map ${silentAudioIndex}:a`
            ]);
          } else {
            command = command.complexFilter([singleClipFilters.join(';')]).outputOptions([
              '-map [vnorm]',
              `-map ${silentAudioIndex}:a`
            ]);
          }
        } else {
          // Fallback: generate silent audio on the fly
          const clip = clips[0];
          const clipDuration = clip.trimEnd > 0 
            ? clip.trimEnd - clip.trimStart 
            : (clip.duration - clip.trimStart);
          
          command.input('anullsrc=channel_layout=stereo:sample_rate=48000')
            .inputOptions(['-f', 'lavfi', '-t', clipDuration.toString()]);
          
          if (scaleFilter) {
            singleClipFilters.push(`[vnorm]${scaleFilter}[outv]`);
            command = command.complexFilter([singleClipFilters.join(';')]).outputOptions([
              '-map [outv]',
              '-map 1:a'
            ]);
          } else {
            command = command.complexFilter([singleClipFilters.join(';')]).outputOptions([
              '-map [vnorm]',
              '-map 1:a'
            ]);
          }
        }
      }
    }
    
    command
      .outputOptions([
        '-c:v libx264',
        `-preset ${FFMPEG_PRESET}`,
        `-crf ${FFMPEG_CRF}`,
        '-c:a aac',
        `-b:a ${FFMPEG_AUDIO_BITRATE}`,
        '-vsync 2', // Constant frame rate - prevents frame duplication
        '-movflags +faststart', // Optimize for streaming (works for both MP4 and MOV)
        '-pix_fmt yuv420p' // Ensure compatibility
      ])
      .format(outputFormat)
      .output(settings.outputPath);

    // Progress tracking
    command.on('progress', (progress: any) => {
      // FFmpeg doesn't always report percent correctly with complex filters
      // Calculate it manually from timemark and total duration
      let percent = 0;
      
      if (progress.timemark && totalDuration > 0) {
        // Parse timemark (format: "00:00:10.50")
        const timemarkParts = progress.timemark.split(':');
        if (timemarkParts.length >= 3) {
          const hours = parseFloat(timemarkParts[0]);
          const minutes = parseFloat(timemarkParts[1]);
          const seconds = parseFloat(timemarkParts[2]);
          const currentTime = hours * 3600 + minutes * 60 + seconds;
          percent = Math.min(99, Math.round((currentTime / totalDuration) * 100));
        }
      } else if (progress.percent) {
        // Fallback to FFmpeg's percent if available
        percent = Math.round(progress.percent);
      }
      
      console.log('[FFmpeg Progress] timemark:', progress.timemark, 'calculated:', percent + '%');
      
      onProgress({
        progress: percent,
        currentStep: `Encoding video... ${percent}%`
      });
    });

    // Start event
    command.on('start', (commandLine: any) => {
      console.log('[FFmpeg] Started export');
      console.log('[FFmpeg] Command:', commandLine);
      onProgress({
        progress: 1,
        currentStep: 'Starting FFmpeg...'
      });
    });

    // Error handling
    command.on('error', (error: any) => {
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
    command
      .on('stderr', (stderrLine: string) => {
        console.log('[FFmpeg stderr]', stderrLine);
      })
      .run();
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
      .on('error', (error: any) => reject(error))
      .run();
  });
};

export const getVideoDuration = async (videoPath: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err: any, metadata: any) => {
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
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const duration = trimEnd - trimStart;
    
    // Sanitize paths to handle spaces and special characters
    const sanitizedInputPath = inputPath.replace(/\\/g, '/');
    
    // Detect input format and handle WebM conversion
    const inputExt = inputPath.toLowerCase().split('.').pop() || '';
    const outputExt = outputPath.toLowerCase().split('.').pop() || '';
    const isWebM = inputExt === 'webm';
    
    // If input is WebM, convert to MP4 (more compatible with our codecs)
    let finalOutputPath = outputPath.replace(/\\/g, '/');
    if (isWebM && outputExt === 'webm') {
      // Change extension to .mp4
      finalOutputPath = outputPath.replace(/\.webm$/i, '.mp4');
      console.log('[FFmpeg Trim] Converting WebM to MP4:', { inputPath, originalOutput: outputPath, finalOutput: finalOutputPath });
    }
    
    const command = ffmpeg(sanitizedInputPath)
      .seekInput(trimStart)
      .duration(duration)
      .outputOptions([
        '-c:v libx264',
        '-c:a aac',
        '-preset fast',
        '-crf 23',
        '-movflags +faststart',
        '-pix_fmt yuv420p'
      ]);
    
    // Explicitly set format to mp4 if converting from WebM
    if (isWebM && outputExt === 'webm') {
      command.format('mp4');
    }
    
    command
      .output(finalOutputPath)
      .on('progress', (progress: any) => {
        if (onProgress) {
          const percent = Math.round(progress.percent || 0);
          onProgress(percent);
        }
      })
      .on('error', (error: any) => {
        console.error('FFmpeg trim error:', error);
        
        // Check for disk full error (ENOSPC)
        if (error.message && (error.message.includes('ENOSPC') || error.message.includes('No space left'))) {
          reject(new Error('Video trim failed: Not enough disk space. Please free up space and try again.'));
        } else {
          reject(new Error(`Video trim failed: ${error.message}`));
        }
      })
      .on('end', () => {
        resolve(finalOutputPath);
      })
      .run();
  });
};
