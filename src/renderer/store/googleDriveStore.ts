import { create } from 'zustand';
import toast from 'react-hot-toast';
import { shell } from 'electron';

interface GoogleDriveStore {
  isAuthenticated: boolean;
  isUploading: boolean;
  uploadProgress: number;
  lastShareUrl: string | null;
  authInProgress: boolean;
  
  // Actions
  checkAuth: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  uploadFile: (filePath: string, fileName: string) => Promise<void>;
  resetUploadState: () => void;
}

export const useGoogleDriveStore = create<GoogleDriveStore>((set, get) => ({
  isAuthenticated: false,
  isUploading: false,
  uploadProgress: 0,
  lastShareUrl: null,
  authInProgress: false,

  checkAuth: async () => {
    try {
      if (!window.electronAPI?.googleDriveCheckAuth) {
        console.warn('[Google Drive Store] googleDriveCheckAuth not available');
        return;
      }
      
      const result = await window.electronAPI.googleDriveCheckAuth();
      set({ isAuthenticated: result.authenticated });
    } catch (error) {
      console.error('[Google Drive Store] Check auth error:', error);
      set({ isAuthenticated: false });
    }
  },

  signIn: async () => {
    try {
      set({ authInProgress: true });
      
      if (!window.electronAPI?.googleDriveInitiateAuth) {
        toast.error('Google Drive authentication not available');
        return;
      }
      
      const result = await window.electronAPI.googleDriveInitiateAuth();
      
      if (!result.success || !result.authUrl) {
        toast.error(result.error || 'Failed to initiate authentication');
        return;
      }
      
      // OAuth now opens in external browser
      toast('Please complete authentication in your browser', { icon: '🌐', duration: 5000 });
      
      // Listen for auth success/failure from main process
      const cleanup = () => {
        if (window.electronAPI.removeAllListeners) {
          window.electronAPI.removeAllListeners('google-drive-auth-success');
          window.electronAPI.removeAllListeners('google-drive-auth-error');
        }
      };
      
      // Listen for auth success (will be triggered manually after user enters code)
      window.electronAPI.on?.('google-drive-auth-success', async () => {
        cleanup();
        await get().checkAuth();
        set({ authInProgress: false });
        toast.success('Successfully authenticated with Google Drive!');
      });
      
      // Listen for auth error
      window.electronAPI.on?.('google-drive-auth-error', (error) => {
        cleanup();
        set({ authInProgress: false });
        toast.error(`Authentication failed: ${error}`);
      });
      
    } catch (error) {
      console.error('[Google Drive Store] Sign in error:', error);
      set({ authInProgress: false });
      toast.error('Authentication failed. Please try again.');
    }
  },

  signOut: async () => {
    try {
      if (!window.electronAPI?.googleDriveSignOut) {
        toast.error('Google Drive sign out not available');
        return;
      }
      
      const result = await window.electronAPI.googleDriveSignOut();
      
      if (result.success) {
        set({ 
          isAuthenticated: false, 
          lastShareUrl: null,
          uploadProgress: 0,
          isUploading: false
        });
        toast.success('Signed out from Google Drive');
      } else {
        toast.error(result.error || 'Failed to sign out');
      }
    } catch (error) {
      console.error('[Google Drive Store] Sign out error:', error);
      toast.error('Failed to sign out');
    }
  },

  uploadFile: async (filePath: string, fileName: string) => {
    try {
      set({ isUploading: true, uploadProgress: 0 });
      
      if (!window.electronAPI?.googleDriveUpload) {
        throw new Error('Google Drive upload not available');
      }
      
      // Set up progress listener
      if (window.electronAPI.onGoogleDriveProgress) {
        window.electronAPI.onGoogleDriveProgress((progress) => {
          set({ uploadProgress: progress.progress });
        });
      }
      
      const result = await window.electronAPI.googleDriveUpload(filePath, fileName);
      
      if (result.success && result.shareUrl) {
        set({ 
          lastShareUrl: result.shareUrl,
          uploadProgress: 100,
          isUploading: false
        });
        toast.success('Video uploaded to Google Drive successfully!');
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('[Google Drive Store] Upload error:', error);
      set({ 
        isUploading: false, 
        uploadProgress: 0 
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Upload failed. Please try again.';
      toast.error(errorMessage);
      throw error;
    }
  },

  resetUploadState: () => {
    set({ 
      uploadProgress: 0, 
      lastShareUrl: null,
      isUploading: false 
    });
  }
}));

