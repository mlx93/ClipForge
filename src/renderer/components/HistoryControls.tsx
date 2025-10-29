import React from 'react';
import { useHistoryStore } from '../store/historyStore';
import { useTimelineStore } from '../store/timelineStore';
import { useMediaLibraryStore } from '../store/mediaLibraryStore';
import { createSnapshotFromStores, applySnapshotToStores } from '../store/historyStore';
import toast from 'react-hot-toast';

const HistoryControls: React.FC = () => {
  const {
    canUndo,
    canRedo,
    undo,
    redo,
    pushSnapshot
  } = useHistoryStore();

  const timelineState = useTimelineStore();
  const mediaLibraryState = useMediaLibraryStore();

  const handleUndo = () => {
    // Get the current present snapshot (the operation we're about to undo)
    const currentPresent = useHistoryStore.getState().present;
    const operationDescription = currentPresent?.description || 'last operation';
    
    const snapshot = undo();
    if (snapshot) {
      applySnapshotToStores(snapshot, useTimelineStore, useMediaLibraryStore);
      toast.success(`Undid: ${operationDescription}`);
    }
  };

  const handleRedo = () => {
    // Get the future snapshot (the operation we're about to redo)
    const futureSnapshots = useHistoryStore.getState().future;
    const operationDescription = futureSnapshots[0]?.description || 'last operation';
    
    const snapshot = redo();
    if (snapshot) {
      applySnapshotToStores(snapshot, useTimelineStore, useMediaLibraryStore);
      toast.success(`Redid: ${operationDescription}`);
    }
  };

  // Helper function to create and push a snapshot
  const createSnapshot = (description: string) => {
    // Get fresh state directly from stores, not from React hooks
    const freshTimelineState = useTimelineStore.getState();
    const freshMediaLibraryState = useMediaLibraryStore.getState();
    
    const snapshot = createSnapshotFromStores(
      freshTimelineState,
      freshMediaLibraryState,
      description
    );
    
    pushSnapshot(snapshot);
  };

  // Expose createSnapshot for use by other components
  React.useEffect(() => {
    // Make createSnapshot available globally for other components to use
    (window as any).createHistorySnapshot = createSnapshot;
  }, [timelineState, mediaLibraryState]);


  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={handleUndo}
        disabled={!canUndo()}
        data-action="undo"
        className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Undo (Cmd+U)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
        <span>Undo</span>
      </button>
      
      <button
        onClick={handleRedo}
        disabled={!canRedo()}
        data-action="redo"
        className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Redo (Cmd+R)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
        </svg>
        <span>Redo</span>
      </button>
    </div>
  );
};

export default HistoryControls;
