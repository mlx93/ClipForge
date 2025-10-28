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

export const useExportStore = create<ExportStore>((set) => ({
  // Initial state
  isExporting: false,
  progress: 0,
  currentStep: '',
  error: null,
  outputPath: null,
  showExportDialog: false,

  // Actions
  startExport: async (clips: Clip[], settings: ExportSettings) => {
    // Prevent concurrent exports
    const currentState = useExportStore.getState();
    if (currentState.isExporting) {
      toast.error('Export already in progress. Please wait for it to complete.');
      return;
    }
    
    set({
      isExporting: true,
      progress: 0,
      currentStep: 'Preparing export...',
      error: null,
      outputPath: null
    });

    try {
      // Set up progress listener for IPC events
      const handleProgress = (_: any, progress: { progress: number; currentStep: string }) => {
        set({
          progress: Math.round(progress.progress),
          currentStep: progress.currentStep
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
        outputPath
      });
      
      toast.success(`Export complete! Saved to ${outputPath.split('/').pop()}`);
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      
      set({
        isExporting: false,
        progress: 0,
        currentStep: '',
        error: errorMessage,
        outputPath: null
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
      outputPath: null
    });
  },

  setShowExportDialog: (show: boolean) => {
    set({ showExportDialog: show });
  }
}));
