import React, { useEffect, useState, Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
import { useTimelineStore } from './store/timelineStore';
import { useExportStore } from './store/exportStore';
import { useMediaLibraryStore } from './store/mediaLibraryStore';
import { useProjectStore } from './store/projectStore';
import { useShortcutsStore } from './store/shortcutsStore';
import { useSessionStore } from './store/sessionStore';
import ImportZone from './components/ImportZone';
import MediaLibrary from './components/MediaLibrary';
import Timeline from './components/Timeline';
import VideoPreview from './components/VideoPreview';
import HistoryControls from './components/HistoryControls';
import SessionRecoveryDialog from './components/SessionRecoveryDialog';
import ShortcutsModal from './components/ShortcutsModal';
import { Clip } from '@shared/types';

// Lazy load components that are not immediately needed
const ExportDialog = lazy(() => import('./components/ExportDialog'));
const ProjectMenu = lazy(() => import('./components/ProjectMenu'));
const RecordingPanel = lazy(() => import('./components/RecordingPanel'));

const App: React.FC = () => {
  const { clips, addClips } = useTimelineStore();
  const { isExporting, showExportDialog, setShowExportDialog } = useExportStore();
  const { clips: mediaLibraryClips, setClips } = useMediaLibraryStore();
  const { setDirty, currentProject, enableAutoSave, isDirty } = useProjectStore();
  const { registerDefaultShortcuts, handleKeyDown } = useShortcutsStore();
  const { hasRecoveryData, loadSession } = useSessionStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showRecordingPanel, setShowRecordingPanel] = useState(false);
  const [showSessionRecovery, setShowSessionRecovery] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const initialLoadRef = React.useRef(true);
  const isSavingRef = React.useRef(false);

  useEffect(() => {
    // Check for session recovery on app start
    if (hasRecoveryData()) {
      setShowSessionRecovery(true);
    }
    
    // Initialize keyboard shortcuts
    registerDefaultShortcuts();
    
    // Set up keyboard event listener
    const handleKeyDownEvent = (event: KeyboardEvent) => {
      handleKeyDown(event);
    };
    
    document.addEventListener('keydown', handleKeyDownEvent);
    
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
      
      // Cleanup keyboard event listener
      document.removeEventListener('keydown', handleKeyDownEvent);
    };
  }, []);

  // Mark project as dirty when timeline changes (but not on initial load or project open)
  useEffect(() => {
    // Skip the first render
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }
    
    // Don't mark dirty if we're currently saving
    if (isSavingRef.current || (window as any).isSavingRef?.current) {
      return;
    }
    
    // Only set dirty if we have a current project
    if (currentProject) {
      setDirty(true);
    }
  }, [clips, setDirty, currentProject]);

  const handleImportFiles = async (filePaths: string[]) => {
    if (filePaths.length === 0) return;

    setIsLoading(true);
    try {
      const response = await window.electronAPI.importVideos({ filePaths });
      
      if (response.success) {
        addClips(response.clips);
        setClips([...mediaLibraryClips, ...response.clips]);
      }
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
      const filePaths = videoFiles.map(file => file.path).filter((path): path is string => path !== undefined);
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
      {/* Toast Notifications */}
      <Toaster 
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1f2937',
            color: '#fff',
            border: '1px solid #374151',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      
      {/* Header */}
      <header 
        className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between" 
        style={{ 
          paddingTop: '20px',
          WebkitAppRegion: 'drag' as any
        }}
      >
        {/* Left Section - File Management */}
        <div className="flex items-center space-x-3" style={{ WebkitAppRegion: 'no-drag' as any }}>
          <Suspense fallback={<div className="text-gray-400 text-sm">Loading...</div>}>
            <ProjectMenu />
          </Suspense>
        </div>
        
        {/* Center Section - App Title and Project */}
        <div className="flex-1 flex justify-center items-center space-x-6">
          {/* App Title */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-1">SimpleCut</h1>
            <span className="text-sm text-gray-300">v2.0.0</span>
          </div>
          
          {/* Project Title Box */}
          {currentProject && (
            <div className="bg-gray-700/50 backdrop-blur-sm rounded-xl px-6 py-3 border border-gray-600/50 shadow-lg">
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-1">Current Project</div>
                <div className="text-xl font-semibold text-white">
                  {currentProject.name}
                  {isDirty && <span className="text-yellow-400 ml-1">*</span>}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Right Section - Action Buttons */}
        <div className="flex items-center space-x-3" style={{ WebkitAppRegion: 'no-drag' as any }}>
          <HistoryControls />
          <button
            onClick={() => setShowShortcuts(true)}
            data-action="shortcuts"
            className="text-gray-300 hover:text-white px-4 py-2 rounded-lg font-medium transition-colors hover:bg-gray-700/50"
            title="Keyboard Shortcuts (F1)"
          >
            Shortcuts
          </button>
          <button
            onClick={() => setShowRecordingPanel(true)}
            data-action="record"
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg hover:shadow-red-600/25"
            title="Record (Shift+R)"
          >
            Record
          </button>
          <button
            onClick={() => setShowExportDialog(true)}
            disabled={clips.length === 0 || isExporting}
            data-action="export"
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-blue-600/25"
            title="Export (Cmd+E)"
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Media Library */}
        <div className="w-96 bg-gray-800 border-r border-gray-700 flex flex-col">
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
          {/* Video Preview - Larger space (increased from flex-1 to allow more room) */}
          <div className="bg-black border-b border-gray-700 flex items-center justify-center" style={{ flex: '1 1 0', minHeight: '500px' }}>
            <VideoPreview />
          </div>

          {/* Timeline - Reduced height and pushed to bottom */}
          <div className="h-48 timeline-container" style={{ width: '100%', minWidth: '100%', flex: '0 0 auto' }}>
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
      <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 text-white">Loading export dialog...</div>
      </div>}>
        <ExportDialog 
          isOpen={showExportDialog} 
          onClose={() => setShowExportDialog(false)} 
        />
      </Suspense>

      {/* Recording Panel */}
      <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">Loading recording panel...</div>
      </div>}>
        <RecordingPanel 
          isOpen={showRecordingPanel} 
          onClose={() => setShowRecordingPanel(false)} 
        />
      </Suspense>

      {/* Session Recovery Dialog */}
      <SessionRecoveryDialog 
        isOpen={showSessionRecovery} 
        onClose={() => setShowSessionRecovery(false)}
        onRecover={() => setShowSessionRecovery(false)}
      />

      {/* Shortcuts Modal */}
      <ShortcutsModal 
        isOpen={showShortcuts} 
        onClose={() => setShowShortcuts(false)} 
      />
    </div>
  );
};

export default App;
