import React, { useEffect, useState } from 'react';
import { Clip } from '@shared/types';
import { useTimelineStore } from '../store/timelineStore';
import { useMediaLibraryStore } from '../store/mediaLibraryStore';
import toast from 'react-hot-toast';

interface MediaLibraryProps {
  clips: Clip[];
}

const MediaLibrary: React.FC<MediaLibraryProps> = ({ clips: propClips }) => {
  const { removeClip: removeFromTimeline, setSelectedClip, selectedClipId, addClips } = useTimelineStore();
  const { removeClip: removeFromLibrary } = useMediaLibraryStore();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [localClips, setLocalClips] = useState<Clip[]>(propClips);
  const [thumbnailPaths, setThumbnailPaths] = useState<Record<string, string>>({});
  const [hoveredClipId, setHoveredClipId] = useState<string | null>(null);
  const [hoverPreviewUrl, setHoverPreviewUrl] = useState<string | null>(null);

  // Update local clips when props change
  React.useEffect(() => {
    setLocalClips(propClips);
  }, [propClips]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  // Generate video preview on hover
  const handleMouseEnter = async (clip: Clip) => {
    setHoveredClipId(clip.id);
    
    // Create temporary video element to capture frame
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      // Seek to 1 second or 10% of duration, whichever is smaller
      const seekTime = Math.min(1, clip.duration * 0.1);
      video.currentTime = seekTime;
    };
    
    video.onseeked = () => {
      // Create canvas to capture frame
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(video, 0, 0, 160, 90);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setHoverPreviewUrl(dataUrl);
      }
    };
    
    video.src = `file://${clip.path}`;
  };

  const handleMouseLeave = () => {
    setHoveredClipId(null);
    setHoverPreviewUrl(null);
  };

  // Generate thumbnails on mount - use proper async pattern
  useEffect(() => {
    const generateThumbnails = async () => {
      for (const clip of localClips) {
        // Skip if thumbnail already generated
        if (thumbnailPaths[clip.id] || clip.thumbnailPath) {
          if (clip.thumbnailPath && !thumbnailPaths[clip.id]) {
            setThumbnailPaths(prev => ({ ...prev, [clip.id]: clip.thumbnailPath! }));
          }
          continue;
        }

        try {
          const result = await window.electronAPI.generateThumbnail(clip.path, clip.id);
          if (result.success && result.thumbnailPath) {
            setThumbnailPaths(prev => ({ ...prev, [clip.id]: result.thumbnailPath! }));
          }
        } catch (error) {
          // Silent fail - thumbnail generation is not critical
          console.warn(`Failed to generate thumbnail for ${clip.name}:`, error);
        }
      }
    };

    generateThumbnails();
  }, [localClips.map(c => c.id).join(',')]); // Only re-run if clip IDs change

  const handleDragStart = (event: React.DragEvent, clip: Clip) => {
    event.dataTransfer.setData('application/json', JSON.stringify(clip));
    event.dataTransfer.effectAllowed = 'move';
    setDraggedIndex(localClips.indexOf(clip));
  };

  const handleDragOver = (event: React.DragEvent, index: number) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (event: React.DragEvent, dropIndex: number) => {
    event.preventDefault();
    
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      const newClips = Array.from(localClips);
      const [movedClip] = newClips.splice(draggedIndex, 1);
      newClips.splice(dropIndex, 0, movedClip);
      setLocalClips(newClips);
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleRemoveFromLibrary = (clip: Clip) => {
    // Get all timeline clips
    const timelineClips = useTimelineStore.getState().clips;
    
    // Find all instances that originated from this library clip
    // Timeline clips have IDs like: ${clip.id}_timeline_${Date.now()}_${random}
    const instancesToRemove = timelineClips.filter(tc => tc.id.startsWith(clip.id));
    
    // Remove all instances from timeline
    instancesToRemove.forEach(tc => removeFromTimeline(tc.id));
    
    // Remove from library
    removeFromLibrary(clip.id);
    
    toast.success(`Removed "${clip.name}" from library${instancesToRemove.length > 0 ? ` and ${instancesToRemove.length} timeline instance(s)` : ''}`);
  };

  if (localClips.length === 0) {
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
      <div className="text-lg font-semibold text-white mb-3 border-b border-gray-700 pb-2">
        Media Library ({localClips.length} clip{localClips.length !== 1 ? 's' : ''})
      </div>
      
      {localClips.map((clip, index) => (
        <div
          key={clip.id}
          className={`card cursor-pointer transition-all duration-200 hover:bg-gray-700 ${
            selectedClipId === clip.id ? 'ring-2 ring-blue-500 bg-gray-700' : ''
          } ${
            draggedIndex === index ? 'opacity-50' : ''
          } ${
            dragOverIndex === index ? 'ring-2 ring-yellow-400 bg-gray-600' : ''
          }`}
          onClick={() => setSelectedClip(clip.id)}
          draggable
          onDragStart={(e) => handleDragStart(e, clip)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          onMouseEnter={() => handleMouseEnter(clip)}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex items-start space-x-3">
            {/* Thumbnail */}
            <div className="w-16 h-12 bg-gray-600 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
              {hoveredClipId === clip.id && hoverPreviewUrl ? (
                <img 
                  src={hoverPreviewUrl}
                  alt={`${clip.name} preview`}
                  className="w-full h-full object-cover"
                />
              ) : (thumbnailPaths[clip.id] || clip.thumbnailPath) ? (
                <img 
                  src={`file://${thumbnailPaths[clip.id] || clip.thumbnailPath}`}
                  alt={clip.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to icon if thumbnail fails to load
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            
            {/* Clip info */}
            <div className="flex-1 min-w-0">
              <h3 
                className="font-medium text-white text-sm leading-tight break-words"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word'
                }}
              >
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
              {/* Add to Timeline */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Add to timeline with unique ID
                  const timelineClip = {
                    ...clip,
                    id: `${clip.id}_timeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                  };
                  
                  // Execute the add operation first
                  addClips([timelineClip]);
                  
                  // Create history snapshot AFTER adding (captures state after operation)
                  if (typeof (window as any).createHistorySnapshot === 'function') {
                    try {
                      (window as any).createHistorySnapshot(`Add "${clip.name}" to timeline`);
                    } catch (error) {
                      console.warn('Failed to create history snapshot:', error);
                    }
                  }
                  
                  toast.success(`Added "${clip.name}" to timeline`);
                }}
                className="text-gray-400 hover:text-blue-400 transition-colors p-1"
                title="Add to timeline"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
              
              {/* Remove from Timeline */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Find timeline instances of this clip
                  const timelineClips = useTimelineStore.getState().clips;
                  const instances = timelineClips.filter(tc => tc.id.startsWith(clip.id));
                  
                  if (instances.length === 0) {
                    toast.error(`"${clip.name}" not on timeline`);
                    return;
                  }
                  
                  // Remove the most recent instance
                  const mostRecent = instances[instances.length - 1];
                  removeFromTimeline(mostRecent.id);
                  toast.success(`Removed "${clip.name}" from timeline`);
                }}
                className="text-gray-400 hover:text-yellow-400 transition-colors p-1"
                title="Remove from timeline"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Remove from Library */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Show confirmation
                  if (window.confirm(`Remove "${clip.name}" from library? This will also remove all timeline instances.`)) {
                    handleRemoveFromLibrary(clip);
                  }
                }}
                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                title="Remove from library (deletes all instances)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
