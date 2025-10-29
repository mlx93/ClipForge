import React, { useState } from 'react';
import toast from 'react-hot-toast';

interface CloudExportProps {
  isOpen: boolean;
  onClose: () => void;
  videoPath: string;
  videoName: string;
}

const CloudExport: React.FC<CloudExportProps> = ({ 
  isOpen, 
  onClose, 
  videoPath, 
  videoName 
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<'youtube' | 'vimeo' | 'dropbox' | 'gdrive'>('youtube');

  const platforms = [
    { id: 'youtube', name: 'YouTube', icon: '🎥', description: 'Upload to YouTube' },
    { id: 'vimeo', name: 'Vimeo', icon: '🎬', description: 'Upload to Vimeo' },
    { id: 'dropbox', name: 'Dropbox', icon: '📁', description: 'Save to Dropbox' },
    { id: 'gdrive', name: 'Google Drive', icon: '☁️', description: 'Save to Google Drive' }
  ];

  const handleUpload = async () => {
    if (!videoPath) {
      toast.error('No video file selected');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 10;
        });
      }, 500);

      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Generate mock share URL
      const mockUrl = `https://${selectedPlatform}.com/watch?v=${Math.random().toString(36).substr(2, 9)}`;
      setShareUrl(mockUrl);
      setUploadProgress(100);

      clearInterval(progressInterval);
      toast.success(`Video uploaded to ${platforms.find(p => p.id === selectedPlatform)?.name} successfully!`);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleOpenLink = () => {
    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Share Video</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {!shareUrl ? (
          <>
            {/* Platform Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Choose Platform
              </label>
              <div className="grid grid-cols-2 gap-3">
                {platforms.map((platform) => (
                  <button
                    key={platform.id}
                    onClick={() => setSelectedPlatform(platform.id as any)}
                    className={`p-3 border rounded-lg text-left transition-colors ${
                      selectedPlatform === platform.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="text-2xl mb-1">{platform.icon}</div>
                    <div className="text-sm font-medium text-gray-900">
                      {platform.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {platform.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Video Info */}
            <div className="mb-6 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Video to upload:</div>
              <div className="font-medium text-gray-900 truncate">{videoName}</div>
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="mb-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Uploading...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Upload Button */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Success State */}
            <div className="text-center mb-6">
              <div className="text-4xl mb-4">✅</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Upload Complete!
              </h3>
              <p className="text-sm text-gray-600">
                Your video has been uploaded to {platforms.find(p => p.id === selectedPlatform)?.name}
              </p>
            </div>

            {/* Share URL */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Share Link
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md text-sm"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-200 text-sm"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
              <button
                onClick={handleOpenLink}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                Open Link
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CloudExport;
