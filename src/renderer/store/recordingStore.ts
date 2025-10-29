import { create } from 'zustand';

export interface RecordingSource {
  id: string;
  name: string;
  thumbnail: string;
  type: 'screen' | 'window' | 'webcam';
}

export interface RecordingSettings {
  videoSource: RecordingSource | null;
  audioSource: boolean;
  resolution: { width: number; height: number };
  frameRate: number;
  quality: 'high' | 'medium' | 'low';
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  availableSources: RecordingSource[];
  settings: RecordingSettings;
  recordingBlob: Blob | null;
  recordingUrl: string | null;
  
  // Actions
  setRecording: (isRecording: boolean) => void;
  setPaused: (isPaused: boolean) => void;
  setRecordingTime: (time: number | ((prev: number) => number)) => void;
  setAvailableSources: (sources: RecordingSource[]) => void;
  updateSettings: (settings: Partial<RecordingSettings>) => void;
  setRecordingBlob: (blob: Blob | null) => void;
  setRecordingUrl: (url: string | null) => void;
  resetRecording: () => void;
  
  // Computed
  getFormattedTime: () => string;
  isReadyToRecord: () => boolean;
}

export const useRecordingStore = create<RecordingState>((set, get) => ({
  // Initial state
  isRecording: false,
  isPaused: false,
  recordingTime: 0,
  availableSources: [],
  settings: {
    videoSource: null,
    audioSource: true,
    resolution: { width: 1920, height: 1080 },
    frameRate: 30,
    quality: 'high'
  },
  recordingBlob: null,
  recordingUrl: null,

  // Actions
  setRecording: (isRecording: boolean) => {
    console.log('[Recording Store] setRecording called with:', isRecording);
    console.log('[Recording Store] setRecording stack trace:', new Error().stack);
    console.log('[Recording Store] Current state before change:', { 
      isRecording: get().isRecording, 
      isPaused: get().isPaused,
      recordingTime: get().recordingTime 
    });
    set({ isRecording });
    if (isRecording) {
      // When starting recording, ensure not paused
      set({ isPaused: false });
    } else {
      // Only reset paused state when stopping, keep recordingTime for display
      set({ isPaused: false });
    }
    console.log('[Recording Store] State after change:', { 
      isRecording: get().isRecording, 
      isPaused: get().isPaused,
      recordingTime: get().recordingTime 
    });
  },

  setPaused: (isPaused: boolean) => {
    set({ isPaused });
  },

  setRecordingTime: (time: number | ((prev: number) => number)) => {
    if (typeof time === 'function') {
      set((state) => {
        const newTime = time(state.recordingTime);
        console.log('[Recording Store] Updating time:', state.recordingTime, '->', newTime);
        return { recordingTime: newTime };
      });
    } else {
      console.log('[Recording Store] Setting time to:', time);
      set({ recordingTime: time });
    }
  },

  setAvailableSources: (sources: RecordingSource[]) => {
    set({ availableSources: sources });
  },

  updateSettings: (newSettings: Partial<RecordingSettings>) => {
    console.log('[Recording Store] Updating settings:', newSettings);
    set((state) => {
      const updatedSettings = { ...state.settings, ...newSettings };
      console.log('[Recording Store] New settings:', updatedSettings);
      return { settings: updatedSettings };
    });
  },

  setRecordingBlob: (blob: Blob | null) => {
    set({ recordingBlob: blob });
    if (blob) {
      const url = URL.createObjectURL(blob);
      set({ recordingUrl: url });
    } else {
      set({ recordingUrl: null });
    }
  },

  setRecordingUrl: (url: string | null) => {
    set({ recordingUrl: url });
  },

  resetRecording: () => {
    const { recordingUrl } = get();
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
    }
    set({
      isRecording: false,
      isPaused: false,
      recordingTime: 0,
      recordingBlob: null,
      recordingUrl: null
    });
  },

  // Computed
  getFormattedTime: () => {
    const { recordingTime } = get();
    const minutes = Math.floor(recordingTime / 60);
    const seconds = Math.floor(recordingTime % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  },

  isReadyToRecord: () => {
    const { settings } = get();
    return settings.videoSource !== null;
  }
}));
