import React, { useState } from 'react';
import { useTimelineStore } from '../store/timelineStore';
import { useExportStore } from '../store/exportStore';
import { ExportSettings } from '@shared/types';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const RESOLUTION_OPTIONS = [
  { name: 'Source', width: 0, height: 0 },
  { name: '720p', width: 1280, height: 720 },
  { name: '1080p', width: 1920, height: 1080 },
  { name: '4K', width: 3840, height: 2160 },
];

const ExportDialog: React.FC<ExportDialogProps> = ({ isOpen, onClose }) => {
  const { clips } = useTimelineStore();
  const { isExporting, progress, error, startExport, resetExport } = useExportStore();
  const [settings, setSettings] = useState<ExportSettings>({
    outputPath: '',
    resolution: RESOLUTION_OPTIONS[1], // Default to 720p
  });

  const handleExport = async () => {
    if (!settings.outputPath) {
      alert('Please select an output path');
      return;
    }

    try {
      await startExport(clips, settings);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleFileSelect = async () => {
    try {
      const result = await window.electron.invoke('show-save-dialog', {
        title: 'Export Video',
        defaultPath: 'clipforge-export.mp4',
        filters: [
          { name: 'MP4 Video', extensions: ['mp4'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (!result.canceled && result.filePath) {
        setSettings(prev => ({ ...prev, outputPath: result.filePath }));
      }
    } catch (error) {
      console.error('Failed to select output path:', error);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-96 max-w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Export Video</h2>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="text-gray-400 hover:text-white disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!isExporting ? (
          <div className="space-y-4">
            {/* Project Info */}
            <div className="bg-gray-700 rounded p-3">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Project Info</h3>
              <div className="text-sm text-gray-400 space-y-1">
                <div>Clips: {clips.length}</div>
                <div>Duration: {formatTime(useTimelineStore.getState().totalDuration)}</div>
              </div>
            </div>

            {/* Output Path */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Output Path
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={settings.outputPath}
                  onChange={(e) => setSettings(prev => ({ ...prev, outputPath: e.target.value }))}
                  placeholder="Select output file..."
                  className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleFileSelect}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Browse
                </button>
              </div>
            </div>

            {/* Resolution */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Resolution
              </label>
              <select
                value={settings.resolution.name}
                onChange={(e) => {
                  const selected = RESOLUTION_OPTIONS.find(opt => opt.name === e.target.value);
                  if (selected) {
                    setSettings(prev => ({ ...prev, resolution: selected }));
                  }
                }}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                {RESOLUTION_OPTIONS.map(option => (
                  <option key={option.name} value={option.name}>
                    {option.name} {option.width > 0 && `(${option.width}x${option.height})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Export Button */}
            <div className="flex space-x-3 pt-4">
              <button
                onClick={handleExport}
                disabled={!settings.outputPath || clips.length === 0}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Start Export
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Progress */}
            <div className="text-center">
              <div className="text-lg font-medium text-white mb-2">
                {progress.currentStep}
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <div className="text-sm text-gray-400">
                {progress.progress}%
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
                <div className="font-medium">Export Failed</div>
                <div className="text-sm mt-1">{error}</div>
              </div>
            )}

            {/* Cancel Button */}
            <button
              onClick={() => {
                resetExport();
                onClose();
              }}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              {error ? 'Close' : 'Cancel Export'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportDialog;