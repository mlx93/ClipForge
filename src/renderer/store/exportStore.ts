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
        
        
        // Calculate estimated time remaining based on 2x realtime speed
        let estimatedTimeRemaining = null;
        if (currentProgress > 5) { // Only estimate after 5% to get more accurate data
          const elapsedTime = (Date.now() - startTime) / 1000; // seconds
          const progressDecimal = currentProgress / 100;
          const totalEstimatedTime = elapsedTime / progressDecimal;
          estimatedTimeRemaining = Math.max(0, totalEstimatedTime - elapsedTime);
        } else {
          // For early progress, estimate based on 2x realtime speed
          // Calculate total video duration from clips
          const totalDuration = clips.reduce((sum, clip) => {
            if (clip.trimEnd > 0) return sum + (clip.trimEnd - clip.trimStart);
            return sum + clip.duration;
          }, 0);
          
          // At 2x realtime speed, export takes half the video duration
          const estimatedTotalTime = totalDuration / 2;
          estimatedTimeRemaining = Math.max(0, estimatedTotalTime);
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
      
      // Keep dialog open to show "Share to Cloud" button
      // Dialog will be closed when user clicks "Share to Cloud" or manually closes it
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
