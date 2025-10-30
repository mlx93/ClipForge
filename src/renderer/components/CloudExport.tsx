import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useGoogleDriveStore } from '../store/googleDriveStore';

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
  const {
    isAuthenticated,
    isUploading,
    uploadProgress,
    lastShareUrl,
    authInProgress,
    checkAuth,
    signIn,
    signOut,
    uploadFile,
    resetUploadState
  } = useGoogleDriveStore();
  
  const [selectedPlatform, setSelectedPlatform] = useState<'gdrive'>('gdrive');
  
  // Handle authorization code from browser redirect
  const handleAuthCode = async (code: string) => {
    try {
      // Call the handleOAuthCallback function from the store
      const response = await window.electronAPI?.googleDriveHandleCallback?.(code);
      if (response?.success) {
        await checkAuth();
        toast.success('Successfully authenticated with Google Drive!');
      } else {
        toast.error('Authentication failed. Please try again.');
      }
    } catch (error) {
      console.error('[CloudExport] Error handling auth code:', error);
      toast.error('Failed to process authorization code');
    }
  };
  
  // Check auth status when component opens
  useEffect(() => {
    if (isOpen && selectedPlatform === 'gdrive') {
      checkAuth();
    }
  }, [isOpen, selectedPlatform, checkAuth]);
  
  // Reset upload state when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetUploadState();
    }
  }, [isOpen, resetUploadState]);

  const platforms = [
    { id: 'gdrive', name: 'Google Drive', icon: '☁️', description: 'Save to Google Drive' }
    // Other platforms (YouTube, Vimeo, Dropbox) disabled for now
    // { id: 'youtube', name: 'YouTube', icon: '🎥', description: 'Upload to YouTube' },
    // { id: 'vimeo', name: 'Vimeo', icon: '🎬', description: 'Upload to Vimeo' },
    // { id: 'dropbox', name: 'Dropbox', icon: '📁', description: 'Save to Dropbox' },
  ];

  const handleUpload = async () => {
    if (!videoPath) {
      toast.error('No video file selected');
      return;
    }

    // Handle Google Drive upload
    if (selectedPlatform === 'gdrive') {
      if (!isAuthenticated) {
        toast.error('Please sign in to Google Drive first');
        return;
      }

      try {
        await uploadFile(videoPath, videoName);
      } catch (error) {
        console.error('Upload failed:', error);
      }
      return;
    }

    // Mock upload for other platforms (YouTube, Vimeo, Dropbox)
    // Note: These are mock implementations - actual API integration not implemented
    toast('Mock upload - platform integration not yet implemented', { icon: 'ℹ️' });
  };

  const handleCopyLink = () => {
    if (lastShareUrl) {
      navigator.clipboard.writeText(lastShareUrl);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleOpenLink = () => {
    if (lastShareUrl) {
      window.open(lastShareUrl, '_blank');
    }
  };
  
  // Determine if we should show success state
  const shareUrl = lastShareUrl || null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Share to Google Drive</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {!lastShareUrl ? (
          <>
            {/* Platform Info */}
            <div className="mb-6">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-2xl mb-1">☁️</div>
                <div className="text-sm font-medium text-gray-900">
                  Google Drive
                </div>
                <div className="text-xs text-gray-600">
                  Upload your video to Google Drive and get a shareable link
                </div>
              </div>
            </div>

            {/* Google Drive Authentication */}
            {selectedPlatform === 'gdrive' && !isAuthenticated && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-gray-700 mb-3">
                  Please sign in to Google Drive to upload your video. Your browser will open for authentication.
                </p>
                <p className="text-xs text-gray-600 mb-3">
                  After signing in, Google will redirect you to a "Can't connect" page. Copy the authorization code from the URL (the part after "code=") and paste it below.
                </p>
                <input
                  type="text"
                  id="auth-code-input"
                  placeholder="Paste authorization code here (looks like: 4/0Ab32j92Tas...)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3"
                  onPaste={async (e) => {
                    const code = e.clipboardData.getData('text').trim();
                    if (code && window.electronAPI) {
                      // Try to handle the code automatically
                      if (code.includes('code=')) {
                        const url = new URL(code);
                        const authCode = url.searchParams.get('code');
                        if (authCode) {
                          handleAuthCode(authCode);
                          return;
                        }
                      }
                    }
                  }}
                />
                <button
                  onClick={signIn}
                  disabled={authInProgress}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mb-2"
                >
                  {authInProgress ? 'Authenticating...' : 'Sign in with Google Drive'}
                </button>
                <button
                  onClick={async () => {
                    const input = document.getElementById('auth-code-input') as HTMLInputElement;
                    const code = input.value.trim();
                    if (code) {
                      await handleAuthCode(code);
                    }
                  }}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  Submit Code
                </button>
              </div>
            )}

            {/* Google Drive Sign Out */}
            {selectedPlatform === 'gdrive' && isAuthenticated && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-800 mb-1">
                      Signed in to Google Drive
                    </p>
                    <p className="text-xs text-green-600">
                      Upload your video to get a shareable link
                    </p>
                  </div>
                  <button
                    onClick={signOut}
                    className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}

            {/* Video Info */}
            <div className="mb-6 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Video to upload:</div>
              <div className="font-medium text-gray-900 truncate">{videoName}</div>
            </div>

            {/* Upload Progress */}
            {(isUploading || uploadProgress > 0) && (
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
                disabled={isUploading || authInProgress || (selectedPlatform === 'gdrive' && !isAuthenticated) || !videoPath}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Uploading...' : 'Upload to Google Drive'}
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
                  value={shareUrl || ''}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md text-sm text-black"
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
