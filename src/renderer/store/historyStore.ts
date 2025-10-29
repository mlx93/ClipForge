import { create } from 'zustand';
import { Clip } from '@shared/types';

export interface HistoryState {
  // State snapshots
  past: HistorySnapshot[];
  present: HistorySnapshot | null;
  future: HistorySnapshot[];
  
  // Configuration
  maxHistorySize: number;
  
  // Actions
  pushSnapshot: (snapshot: HistorySnapshot) => void;
  undo: () => HistorySnapshot | undefined;
  redo: () => HistorySnapshot | undefined;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
  
  // Snapshot creation helpers
  createSnapshot: (description: string) => HistorySnapshot;
}

export interface HistorySnapshot {
  id: string;
  timestamp: number;
  description: string;
  timelineState: {
    clips: Clip[];
    playhead: number;
    selectedClipId: string | null;
    totalDuration: number;
    zoom: number;
  };
  mediaLibraryState: {
    clips: Clip[];
  };
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  // Initial state
  past: [],
  present: null,
  future: [],
  maxHistorySize: 50,

  // Actions
  pushSnapshot: (snapshot: HistorySnapshot) => {
    const { past, present, maxHistorySize } = get();
    
    // If we have a present state, move it to past
    if (present) {
      const newPast = [...past, present];
      
      // Limit history size
      if (newPast.length > maxHistorySize) {
        newPast.shift(); // Remove oldest
      }
      
      set({
        past: newPast,
        present: snapshot,
        future: [] // Clear future when new action is performed
      });
    } else {
      // First snapshot
      set({ present: snapshot });
    }
  },

  undo: () => {
    const { past, present, future } = get();
    
    if (past.length === 0) return;
    
    // The current present is the state AFTER the most recent operation
    // To undo, we need to restore the state that existed after the previous operation
    // This is the most recent item in the past array (LIFO - Last In First Out)
    const snapshotToRestore = past[past.length - 1];
    const newPast = past.slice(0, -1);
    
    set({
      past: newPast,
      present: snapshotToRestore,
      future: present ? [present, ...future] : future
    });
    
    return snapshotToRestore;
  },

  redo: () => {
    const { past, present, future } = get();
    
    if (future.length === 0) return;
    
    const nextSnapshot = future[0];
    const newFuture = future.slice(1);
    
    set({
      past: present ? [...past, present] : past,
      present: nextSnapshot,
      future: newFuture
    });
    
    return nextSnapshot;
  },

  canUndo: () => {
    const { past } = get();
    return past.length > 0;
  },

  canRedo: () => {
    const { future } = get();
    return future.length > 0;
  },

  clearHistory: () => {
    set({
      past: [],
      present: null,
      future: []
    });
  },

  // Snapshot creation helpers
  createSnapshot: (description: string): HistorySnapshot => {
    return {
      id: `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      description,
      timelineState: {
        clips: [],
        playhead: 0,
        selectedClipId: null,
        totalDuration: 0,
        zoom: 1
      },
      mediaLibraryState: {
        clips: []
      }
    };
  }
}));

// Helper function to create a snapshot from current stores
export const createSnapshotFromStores = (
  timelineState: any,
  mediaLibraryState: any,
  description: string
): HistorySnapshot => {
  return {
    id: `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    description,
    timelineState: {
      clips: [...timelineState.clips],
      playhead: timelineState.playhead,
      selectedClipId: timelineState.selectedClipId,
      totalDuration: timelineState.totalDuration,
      zoom: timelineState.zoom
    },
    mediaLibraryState: {
      clips: [...mediaLibraryState.clips]
    }
  };
};

// Helper function to apply a snapshot to stores
export const applySnapshotToStores = (
  snapshot: HistorySnapshot,
  timelineStore: any,
  mediaLibraryStore: any
) => {
  // Apply timeline state
  timelineStore.setState({
    clips: [...snapshot.timelineState.clips],
    playhead: snapshot.timelineState.playhead,
    selectedClipId: snapshot.timelineState.selectedClipId,
    totalDuration: snapshot.timelineState.totalDuration,
    zoom: snapshot.timelineState.zoom
  });
  
  // Apply media library state
  mediaLibraryStore.setState({
    clips: [...snapshot.mediaLibraryState.clips]
  });
};
