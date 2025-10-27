import { create } from 'zustand';
import { ExportState, ExportSettings, Clip } from '@shared/types';

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
    set({
      isExporting: true,
      progress: 0,
      currentStep: 'Preparing export...',
      error: null,
      outputPath: null,
      showExportDialog: false
    });

    try {
      // Set up progress listener
      const progressHandler = (progress: { progress: number; currentStep: string }) => {
        set({
          progress: progress.progress,
          currentStep: progress.currentStep
        });
      };

      // Call main process to start export
      const outputPath = await window.electron.invoke('export-timeline', {
        clips,
        settings,
        onProgress: progressHandler
      });

      set({
        isExporting: false,
        progress: 100,
        currentStep: 'Export complete!',
        error: null,
        outputPath
      });
    } catch (error) {
      set({
        isExporting: false,
        progress: 0,
        currentStep: '',
        error: error instanceof Error ? error.message : 'Export failed',
        outputPath: null
      });
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
