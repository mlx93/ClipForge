import { create } from 'zustand';
import { ExportState, ExportSettings } from '@shared/types';

interface ExportStore extends ExportState {
  // Actions
  startExport: (settings: ExportSettings) => void;
  updateProgress: (progress: number, currentStep: string) => void;
  completeExport: (outputPath: string) => void;
  failExport: (error: string) => void;
  cancelExport: () => void;
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
  startExport: (settings: ExportSettings) => {
    set({
      isExporting: true,
      progress: 0,
      currentStep: 'Preparing export...',
      error: null,
      outputPath: null,
      showExportDialog: false
    });
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

  setShowExportDialog: (show: boolean) => {
    set({ showExportDialog: show });
  }
}));
