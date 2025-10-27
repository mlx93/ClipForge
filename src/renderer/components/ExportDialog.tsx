import React, { useState, useEffect } from 'react';
import { useTimelineStore } from '../store/timelineStore';
import { useExportStore } from '../store/exportStore';
import { ExportSettings, RESOLUTION_PRESETS } from '@shared/types';

interface ExportDialogProps {
  onClose: () => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ onClose }) => {
  const { clips, getTotalDuration } = useTimelineStore();
  const { isExporting, progress, currentStep, startExport, updateProgress, completeExport, failExport } = useExportStore();
  
  const [settings, setSettings] = useState<ExportSettings>({
    outputPath: '',
    resolution: RESOLUTION_PRESETS[1], // 1080p
    quality: 'high',
    format: 'mp4'
  });

  const [showFileDialog, setShowFileDialog] = useState(false);

  useEffect(() => {
    // Set up export progress listener
    const handleProgress = (progressData: { progress: number; currentStep: string }) => {
      updateProgress(progressData.progress, progressData.currentStep);
    };

    const handleComplete = (outputPath: string) => {
      completeExport(outputPath);
    };

    window.electronAPI.onExportProgress(handleProgress);
    window.electronAPI.onExportComplete(handleComplete);

    return () => {
      window.electronAPI.removeAllListeners('export-progress');
      window.electronAPI.removeAllListeners('export-complete');
    };
  }, [updateProgress, completeExport]);

  const handleExport = async () => {
    if (!settings.outputPath || clips.length === 0) return;

    try {
      startExport(settings);
      
      const response = await window.electronAPI.exportTimeline({
        clips,
        settings
      });

      if (response.success) {
        completeExport(response.outputPath!);
      } else {
        failExport(response.error || 'Export failed');
      }
    } catch (error) {
      failExport(error instanceof Error ? error.message : 'Export failed');
    }
  };

  const handleFileSelect = () => {
    // This will be handled by the main process file dialog
    setShowFileDialog(true);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isExporting) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 w-96">
          <h3 className="text-lg font-semibold mb-4">Exporting Video</h3>
          
          <div className="space-y-4">
            <div className="text-sm text-gray-400">
              {currentStep}
            </div>
            
            <div className="w-full bg-gray-600 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            <div className="text-sm text-gray-400 text-center">
              {progress}%
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-96">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Export Video</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Project info */}
          <div className="text-sm text-gray-400">
            <div>Duration: {formatDuration(getTotalDuration())}</div>
            <div>Clips: {clips.length}</div>
          </div>

          {/* Output path */}
          <div>
            <label className="block text-sm font-medium mb-2">Output File</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={settings.outputPath}
                onChange={(e) => setSettings({ ...settings, outputPath: e.target.value })}
                placeholder="Choose output location..."
                className="flex-1 input-field"
              />
              <button
                onClick={handleFileSelect}
                className="btn-secondary"
              >
                Browse
              </button>
            </div>
          </div>

          {/* Resolution */}
          <div>
            <label className="block text-sm font-medium mb-2">Resolution</label>
            <select
              value={settings.resolution.name}
              onChange={(e) => {
                const resolution = RESOLUTION_PRESETS.find(r => r.name === e.target.value);
                if (resolution) {
                  setSettings({ ...settings, resolution });
                }
              }}
              className="w-full input-field"
            >
              {RESOLUTION_PRESETS.map((res) => (
                <option key={res.name} value={res.name}>
                  {res.name} ({res.width}×{res.height})
                </option>
              ))}
            </select>
          </div>

          {/* Quality */}
          <div>
            <label className="block text-sm font-medium mb-2">Quality</label>
            <select
              value={settings.quality}
              onChange={(e) => setSettings({ ...settings, quality: e.target.value as any })}
              className="w-full input-field"
            >
              <option value="low">Low (faster export)</option>
              <option value="medium">Medium (balanced)</option>
              <option value="high">High (better quality)</option>
            </select>
          </div>

          {/* Format */}
          <div>
            <label className="block text-sm font-medium mb-2">Format</label>
            <select
              value={settings.format}
              onChange={(e) => setSettings({ ...settings, format: e.target.value as any })}
              className="w-full input-field"
            >
              <option value="mp4">MP4 (recommended)</option>
              <option value="mov">MOV</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={!settings.outputPath || clips.length === 0}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
