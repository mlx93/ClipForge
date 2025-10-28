import { create } from 'zustand';
import toast from 'react-hot-toast';
import { ExportState, ExportSettings, Clip } from '@shared/types';
import { IPC_CHANNELS } from '@shared/constants';

interface ExportStore extends ExportState {
  // Actions
  startExport: (clips: Clip[], settings: ExportSettings) => Promise<void>;
  updateProgress: (progress: number, currentStep: string) => void;
  completeExport: (outputPath: string) => void;
  failExport: (error: string) => void;
  cancelExport: () => void;
  resetExport: () => void;
  setShowExportDialog: (show: boolean) => void;
  
  // State
  showExportDialog: boolean;
}

export const useExportStore = create<ExportStore>((set, get) => ({
  // Initial state
  isExporting: false,
  progress: 0,
  currentStep: '',
  error: null,
  outputPath: null,
  showExportDialog: false,
  estimatedTimeRemaining: null,
  exportStartTime: null,

  // Actions
  startExport: async (clips: Clip[], settings: ExportSettings) => {
    // Prevent concurrent exports
    const currentState = get();
    if (currentState.isExporting) {
      toast.error('Export already in progress. Please wait for it to complete.');
      return;
    }
    
    const startTime = Date.now();
    set({
      isExporting: true,
      progress: 0,
      currentStep: 'Preparing export...',
      error: null,
      outputPath: null,
      exportStartTime: startTime,
      estimatedTimeRemaining: null
    });

    try {
      // Set up progress listener for IPC events
      const handleProgress = (progress: { progress: number; currentStep: string }) => {
        const currentProgress = Math.round(progress.progress);
        
        console.log('[Renderer] Received progress update:', currentProgress + '%'); // Debug log
        
        // Calculate estimated time remaining
        let estimatedTimeRemaining = null;
        if (currentProgress > 5) { // Only estimate after 5% to get more accurate data
          const elapsedTime = (Date.now() - startTime) / 1000; // seconds
          const progressDecimal = currentProgress / 100;
          const totalEstimatedTime = elapsedTime / progressDecimal;
          estimatedTimeRemaining = Math.max(0, totalEstimatedTime - elapsedTime);
        }
        
        set({
          progress: currentProgress,
          currentStep: progress.currentStep,
          estimatedTimeRemaining
        });
      };

      // Listen for progress updates from main process
      window.electronAPI.onExportProgress(handleProgress);

      // Call main process to start export
      const result = await window.electronAPI.exportTimeline({
        clips,
        settings
      });

      // Remove progress listener
      window.electronAPI.removeAllListeners(IPC_CHANNELS.EXPORT_PROGRESS);

      if (!result.success) {
        throw new Error(result.error || 'Export failed');
      }

      const outputPath = result.outputPath;

      set({
        isExporting: false,
        progress: 100,
        currentStep: 'Export complete!',
        error: null,
        outputPath,
        estimatedTimeRemaining: 0
      });
      
      toast.success(`Export complete! Saved to ${outputPath?.split('/').pop() || 'file'}`);
      
      // Close dialog immediately when export completes
      set({ showExportDialog: false });
      
      // Reset export state after a short delay
      setTimeout(() => {
        set({
          progress: 0,
          currentStep: '',
          exportStartTime: null,
          estimatedTimeRemaining: null
        });
      }, 500);
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      
      set({
        isExporting: false,
        progress: 0,
        currentStep: '',
        error: errorMessage,
        outputPath: null,
        estimatedTimeRemaining: null,
        exportStartTime: null
      });
      
      toast.error(errorMessage);
    }
  },

  updateProgress: (progress: number, currentStep: string) => {
    set({
      progress: Math.max(0, Math.min(100, progress)),
      currentStep
    });
  },

  completeExport: (outputPath: string) => {
    set({
      isExporting: false,
      progress: 100,
      currentStep: 'Export complete!',
      error: null,
      outputPath
    });
  },

  failExport: (error: string) => {
    set({
      isExporting: false,
      progress: 0,
      currentStep: '',
      error,
      outputPath: null
    });
  },

  cancelExport: () => {
    set({
      isExporting: false,
      progress: 0,
      currentStep: '',
      error: 'Export cancelled by user',
      outputPath: null
    });
  },

  resetExport: () => {
    set({
      isExporting: false,
      progress: 0,
      currentStep: '',
      error: null,
      outputPath: null,
      estimatedTimeRemaining: null,
      exportStartTime: null
    });
  },

  setShowExportDialog: (show: boolean) => {
    set({ showExportDialog: show });
  }
}));
