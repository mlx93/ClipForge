import React from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useProjectStore } from '../store/projectStore';
import { useTimelineStore } from '../store/timelineStore';
import { useMediaLibraryStore } from '../store/mediaLibraryStore';
import toast from 'react-hot-toast';

interface SessionRecoveryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRecover: () => void;
}

const SessionRecoveryDialog: React.FC<SessionRecoveryDialogProps> = ({ 
  isOpen, 
  onClose, 
  onRecover 
}) => {
  const { sessionData, clearSession } = useSessionStore();
  const { loadProject } = useProjectStore();
  const { clearTimeline, addClips } = useTimelineStore();
  const { setClips } = useMediaLibraryStore();

  const handleRecover = () => {
    if (!sessionData?.project) return;

    try {
      // Load the project
      loadProject(sessionData.project);
      
      // Clear current timeline and add project clips
      clearTimeline();
      if (sessionData.project.timeline.clips.length > 0) {
        addClips(sessionData.project.timeline.clips);
        setClips(sessionData.project.timeline.clips);
      }
      
      // Clear the session data
      clearSession();
      
      toast.success('Session recovered successfully');
      onRecover();
    } catch (error) {
      console.error('Failed to recover session:', error);
      toast.error('Failed to recover session');
    }
  };

  const handleDiscard = () => {
    clearSession();
    onClose();
  };

  if (!isOpen || !sessionData) return null;

  const projectName = sessionData.project?.name || 'Untitled Project';
  const lastModified = new Date(sessionData.timestamp).toLocaleString();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-gray-900">
              Session Recovery
            </h3>
          </div>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            ClipForge detected an unexpected shutdown. Would you like to recover your last session?
          </p>
        </div>
        
        <div className="bg-gray-50 rounded-md p-3 mb-4">
          <div className="text-sm">
            <div className="font-medium text-gray-900">Project: {projectName}</div>
            <div className="text-gray-600">Last modified: {lastModified}</div>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={handleDiscard}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Discard
          </button>
          <button
            onClick={handleRecover}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Recover
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionRecoveryDialog;
