import { stat } from 'fs/promises';
import { extname, basename } from 'path';
import { promisify } from 'util';
// Use require-style imports for CommonJS modules that export a callable function
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpeg = require('fluent-ffmpeg');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
import { Clip, VideoMetadata } from '@shared/types';
import { MAX_FILE_SIZE, ERROR_MESSAGES, SUPPORTED_VIDEO_EXTENSIONS } from '@shared/constants';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const ffprobe = promisify(ffmpeg.ffprobe);

export const importVideos = async (filePaths: string[]): Promise<Clip[]> => {
  const clips: Clip[] = [];

  for (const filePath of filePaths) {
    try {
      // Validate file exists and get basic info
      const stats = await stat(filePath);
      
      // Check file size
      if (stats.size > MAX_FILE_SIZE) {
        throw new Error(ERROR_MESSAGES.FILE_TOO_LARGE);
      }

      // Check file extension
      const ext = extname(filePath).toLowerCase();
      if (!SUPPORTED_VIDEO_EXTENSIONS.includes(ext as any)) {
        throw new Error(ERROR_MESSAGES.UNSUPPORTED_FORMAT);
      }

      // Extract video metadata using FFmpeg
      const metadata = await getVideoMetadata(filePath);
      
      // Create clip object
      const clip: Clip = {
        id: generateClipId(),
        name: basename(filePath, ext),
        path: filePath,
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        frameRate: metadata.frameRate,
        codec: metadata.codec,
        fileSize: stats.size,
        trimStart: 0,
        trimEnd: 0, // 0 means no trim (use full duration)
        thumbnailPath: undefined // Will be generated on demand
      };

      clips.push(clip);
    } catch (error) {
      throw new Error(`${ERROR_MESSAGES.IMPORT_FAILED}: ${filePath}`);
    }
  }

  return clips;
};

export const getVideoMetadata = async (filePath: string): Promise<VideoMetadata> => {
  try {
    const metadata = await ffprobe(filePath) as any;
    
    const videoStream = metadata.streams.find((stream: any) => stream.codec_type === 'video');
    const audioStream = metadata.streams.find((stream: any) => stream.codec_type === 'audio');
    
    if (!videoStream) {
      throw new Error('No video stream found in file');
    }

    return {
      duration: parseFloat(metadata.format.duration) || 0,
      width: videoStream.width || 0,
      height: videoStream.height || 0,
      frameRate: parseFrameRate(videoStream.r_frame_rate) || 30,
      codec: videoStream.codec_name || 'unknown',
      fileSize: parseInt(metadata.format.size) || 0,
      bitrate: parseInt(metadata.format.bit_rate) || 0,
      audioCodec: audioStream?.codec_name,
      audioSampleRate: audioStream?.sample_rate ? parseInt(audioStream.sample_rate) : undefined,
      audioChannels: audioStream?.channels
    };
  } catch (error) {
    throw new Error(ERROR_MESSAGES.INVALID_FILE);
  }
};

export const generateThumbnail = async (clip: Clip, timeOffset: number = 0): Promise<string> => {
  // This will be implemented in Phase 2 when we add media library
  // For now, return empty string
  return '';
};

const parseFrameRate = (frameRate: string): number => {
  if (!frameRate) return 30;
  
  const parts = frameRate.split('/');
  if (parts.length === 2) {
    const numerator = parseFloat(parts[0]);
    const denominator = parseFloat(parts[1]);
    return denominator !== 0 ? numerator / denominator : 30;
  }
  
  return parseFloat(frameRate) || 30;
};

const generateClipId = (): string => {
  return `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
