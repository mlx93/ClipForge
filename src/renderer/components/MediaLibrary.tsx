import React, { useEffect, useState } from 'react';
import { Clip } from '@shared/types';
import { useTimelineStore } from '../store/timelineStore';

interface MediaLibraryProps {
  clips: Clip[];
}

const MediaLibrary: React.FC<MediaLibraryProps> = ({ clips }) => {
  const { removeClip, setSelectedClip, selectedClipId, addClips } = useTimelineStore();
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const generateThumbnail = async (clip: Clip) => {
    try {
      // For now, we'll use a placeholder. In a real implementation,
      // we'd call the main process to generate actual thumbnails
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 64;
      canvas.height = 48;
      
      // Create a gradient background
      const gradient = ctx.createLinearGradient(0, 0, 64, 48);
      gradient.addColorStop(0, '#374151');
      gradient.addColorStop(1, '#1f2937');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 48);
      
      // Add play icon
      ctx.fillStyle = '#6b7280';
      ctx.beginPath();
      ctx.moveTo(20, 12);
      ctx.lineTo(20, 36);
      ctx.lineTo(44, 24);
      ctx.closePath();
      ctx.fill();
      
      // Add duration text
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(formatDuration(clip.duration), 32, 40);
      
      const thumbnailUrl = canvas.toDataURL();
      setThumbnails(prev => ({ ...prev, [clip.id]: thumbnailUrl }));
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
    }
  };

  useEffect(() => {
    clips.forEach(clip => {
      if (!thumbnails[clip.id]) {
        generateThumbnail(clip);
      }
    });
  }, [clips]);

  const handleDragStart = (event: React.DragEvent, clip: Clip) => {
    event.dataTransfer.setData('application/json', JSON.stringify(clip));
    event.dataTransfer.effectAllowed = 'move';
  };

  if (clips.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <p>No videos imported</p>
        <p className="text-sm">Drag & drop or click Import</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="text-sm text-gray-400 mb-3">
        {clips.length} video{clips.length !== 1 ? 's' : ''} imported
      </div>
      
      {clips.map((clip) => (
        <div
          key={clip.id}
          className={`card cursor-pointer transition-all duration-200 hover:bg-gray-700 ${
            selectedClipId === clip.id ? 'ring-2 ring-blue-500 bg-gray-700' : ''
          }`}
          onClick={() => setSelectedClip(clip.id)}
          draggable
          onDragStart={(e) => handleDragStart(e, clip)}
        >
          <div className="flex items-start space-x-3">
            {/* Thumbnail */}
            <div className="w-16 h-12 bg-gray-600 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
              {thumbnails[clip.id] ? (
                <img 
                  src={thumbnails[clip.id]} 
                  alt={clip.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            
            {/* Clip info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-white truncate" title={clip.name}>
                {clip.name}
              </h3>
              <div className="text-sm text-gray-400 space-y-1">
                <div className="flex items-center space-x-2">
                  <span>{formatDuration(clip.duration)}</span>
                  <span>•</span>
                  <span>{clip.width}×{clip.height}</span>
                  <span>•</span>
                  <span>{clip.frameRate}fps</span>
                </div>
                <div className="text-xs text-gray-500">
                  {formatFileSize(clip.fileSize)} • {clip.codec}
                </div>
                {(clip.trimStart > 0 || clip.trimEnd > 0) && (
                  <div className="text-xs text-yellow-400">
                    Trimmed: {formatDuration(clip.trimStart)} - {formatDuration(clip.trimEnd || clip.duration)}
                  </div>
                )}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center space-x-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Add to timeline
                  addClips([clip]);
                }}
                className="text-gray-400 hover:text-blue-400 transition-colors p-1"
                title="Add to timeline"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeClip(clip.id);
                }}
                className="text-gray-400 hover:text-red-400 transition-colors p-1"
                title="Remove clip"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MediaLibrary;
