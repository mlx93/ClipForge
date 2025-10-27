import React, { useEffect, useState } from 'react';
import { useTimelineStore } from './store/timelineStore';
import { useExportStore } from './store/exportStore';
import ImportZone from './components/ImportZone';
import MediaLibrary from './components/MediaLibrary';
import Timeline from './components/Timeline';
import VideoPreview from './components/VideoPreview';
import ExportDialog from './components/ExportDialog';
import { Clip } from '@shared/types';

const App: React.FC = () => {
  const { clips, addClips } = useTimelineStore();
  const { isExporting, showExportDialog, setShowExportDialog } = useExportStore();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Set up IPC listeners
    const handleImportVideos = (filePaths: string[]) => {
      handleImportFiles(filePaths);
    };

    const handleTriggerExport = () => {
      setShowExportDialog(true);
    };

    // Register IPC listeners
    window.electronAPI.onImportVideos(handleImportVideos);
    window.electronAPI.onTriggerExport(handleTriggerExport);

    // Cleanup listeners on unmount
    return () => {
      window.electronAPI.removeAllListeners('import-videos');
      window.electronAPI.removeAllListeners('trigger-export');
    };
  }, []);

  const handleImportFiles = async (filePaths: string[]) => {
    if (filePaths.length === 0) return;

    setIsLoading(true);
    try {
      const response = await window.electronAPI.importVideos({ filePaths });
      
      if (response.success) {
        addClips(response.clips);
        console.log(`Imported ${response.clips.length} video(s)`);
      } else {
        console.error('Import failed:', response.error);
        // TODO: Show error notification
      }
    } catch (error) {
      console.error('Import error:', error);
      // TODO: Show error notification
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const files = Array.from(event.dataTransfer.files);
    const videoFiles = files.filter(file => 
      file.type.startsWith('video/') || 
      ['.mp4', '.mov', '.avi', '.mkv', '.webm'].some(ext => 
        file.name.toLowerCase().endsWith(ext)
      )
    );
    
    if (videoFiles.length > 0) {
      const filePaths = videoFiles.map(file => file.path);
      handleImportFiles(filePaths);
    }
  };

  const handleFileDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div 
      className="h-screen bg-gray-900 text-white flex flex-col"
      onDrop={handleFileDrop}
      onDragOver={handleFileDragOver}
    >
      {/* Header */}
      <header 
        className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between" 
        style={{ 
          paddingTop: '20px',
          WebkitAppRegion: 'drag'
        }}
      >
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-white">ClipForge</h1>
          <span className="text-sm text-gray-400">v1.0.0</span>
        </div>
        
        <div className="flex items-center space-x-2" style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            onClick={() => setShowExportDialog(true)}
            disabled={clips.length === 0 || isExporting}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Media Library */}
        <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold mb-3">Media Library</h2>
            <ImportZone onImport={handleImportFiles} />
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <MediaLibrary clips={clips} />
          </div>
        </div>

        {/* Center Panel - Timeline and Preview */}
        <div className="flex-1 flex flex-col" style={{ width: '100%', minWidth: 0 }}>
          {/* Video Preview - Larger space */}
          <div className="flex-1 bg-black border-b border-gray-700 flex items-center justify-center min-h-[400px]">
            <VideoPreview />
          </div>

          {/* Timeline - Fixed height to ensure full width */}
          <div className="h-80 timeline-container" style={{ width: '100%', minWidth: '100%', flex: '0 0 auto' }}>
            <Timeline />
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 flex items-center space-x-3">
            <div className="spinner"></div>
            <span>Importing videos...</span>
          </div>
        </div>
      )}

      {/* Export Dialog */}
      <ExportDialog 
        isOpen={showExportDialog} 
        onClose={() => setShowExportDialog(false)} 
      />
    </div>
  );
};

export default App;
