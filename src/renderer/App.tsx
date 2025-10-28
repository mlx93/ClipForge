import React, { useEffect, useState } from 'react';
import { useTimelineStore } from './store/timelineStore';
import { useExportStore } from './store/exportStore';
import { useMediaLibraryStore } from './store/mediaLibraryStore';
import { useProjectStore } from './store/projectStore';
import ImportZone from './components/ImportZone';
import MediaLibrary from './components/MediaLibrary';
import Timeline from './components/Timeline';
import VideoPreview from './components/VideoPreview';
import ExportDialog from './components/ExportDialog';
import ProjectMenu from './components/ProjectMenu';
import { Clip } from '@shared/types';

const App: React.FC = () => {
  const { clips, addClips } = useTimelineStore();
  const { isExporting, showExportDialog, setShowExportDialog } = useExportStore();
  const { clips: mediaLibraryClips, setClips } = useMediaLibraryStore();
  const { setDirty } = useProjectStore();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Set up IPC listeners
    const handleImportVideos = (filePaths: string[]) => {
      handleImportFiles(filePaths);
    };

    const handleTriggerExport = () => {
      setShowExportDialog(true);
    };

    // Menu event handlers
    const handleMenuNewProject = () => {
      // Trigger new project from ProjectMenu
      const newProjectButton = document.querySelector('[data-menu-action="new-project"]') as HTMLButtonElement;
      newProjectButton?.click();
    };

    const handleMenuOpenProject = () => {
      // Trigger open project from ProjectMenu
      const openProjectButton = document.querySelector('[data-menu-action="open-project"]') as HTMLButtonElement;
      openProjectButton?.click();
    };

    const handleMenuSaveProject = () => {
      // Trigger save project from ProjectMenu
      const saveProjectButton = document.querySelector('[data-menu-action="save-project"]') as HTMLButtonElement;
      saveProjectButton?.click();
    };

    const handleMenuSaveProjectAs = () => {
      // Trigger save as project from ProjectMenu
      const saveAsProjectButton = document.querySelector('[data-menu-action="save-project-as"]') as HTMLButtonElement;
      saveAsProjectButton?.click();
    };

    const handleMenuImportVideos = () => {
      // Trigger import videos
      const importButton = document.querySelector('[data-menu-action="import-videos"]') as HTMLButtonElement;
      importButton?.click();
    };

    const handleMenuExportVideo = () => {
      setShowExportDialog(true);
    };

    // Register IPC listeners
    window.electronAPI.onImportVideos(handleImportVideos);
    window.electronAPI.onTriggerExport(handleTriggerExport);

    // Register menu event listeners
    window.electronAPI.on('menu-new-project', handleMenuNewProject);
    window.electronAPI.on('menu-open-project', handleMenuOpenProject);
    window.electronAPI.on('menu-save-project', handleMenuSaveProject);
    window.electronAPI.on('menu-save-project-as', handleMenuSaveProjectAs);
    window.electronAPI.on('menu-import-videos', handleMenuImportVideos);
    window.electronAPI.on('menu-export-video', handleMenuExportVideo);

    // Cleanup listeners on unmount
    return () => {
      window.electronAPI.removeAllListeners('import-videos');
      window.electronAPI.removeAllListeners('trigger-export');
      window.electronAPI.removeAllListeners('menu-new-project');
      window.electronAPI.removeAllListeners('menu-open-project');
      window.electronAPI.removeAllListeners('menu-save-project');
      window.electronAPI.removeAllListeners('menu-save-project-as');
      window.electronAPI.removeAllListeners('menu-import-videos');
      window.electronAPI.removeAllListeners('menu-export-video');
    };
  }, []);

  // Mark project as dirty when timeline changes
  useEffect(() => {
    setDirty(true);
  }, [clips, setDirty]);

  const handleImportFiles = async (filePaths: string[]) => {
    if (filePaths.length === 0) return;

    setIsLoading(true);
    try {
      const response = await window.electronAPI.importVideos({ filePaths });
      
      if (response.success) {
        addClips(response.clips);
        setClips([...mediaLibraryClips, ...response.clips]);
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
        
        <div className="flex items-center space-x-4" style={{ WebkitAppRegion: 'no-drag' }}>
          <ProjectMenu />
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
            <MediaLibrary clips={mediaLibraryClips} />
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
