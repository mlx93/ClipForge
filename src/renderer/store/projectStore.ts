import { create } from 'zustand';
import { Project, ProjectSettings, DEFAULT_PROJECT_SETTINGS } from '@shared/types';
import { useTimelineStore } from './timelineStore';
import { useSessionStore } from './sessionStore';

interface ProjectStore {
  // State
  currentProject: Project | null;
  isDirty: boolean;
  lastSaved: Date | null;
  autoSaveEnabled: boolean;
  autoSaveInterval: number; // in milliseconds
  autoSaveTimer: NodeJS.Timeout | null;
  
  // Actions
  newProject: (name: string, path: string) => void;
  loadProject: (project: Project) => void;
  saveProject: () => Promise<boolean>;
  setDirty: (dirty: boolean) => void;
  updateSettings: (settings: Partial<ProjectSettings>) => void;
  
  // Auto-save actions
  enableAutoSave: () => void;
  disableAutoSave: () => void;
  setAutoSaveInterval: (interval: number) => void;
  autoSave: () => Promise<void>;
  
  // Getters
  getProjectData: () => Project | null;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  // Initial state
  currentProject: null,
  isDirty: false,
  lastSaved: null,
  autoSaveEnabled: true,
  autoSaveInterval: 2 * 60 * 1000, // 2 minutes in milliseconds
  autoSaveTimer: null,

  // Actions
  newProject: (name: string, path: string) => {
    const now = new Date();
    const timelineState = useTimelineStore.getState();
    
    const project: Project = {
      name,
      path,
      created: now,
      modified: now,
      timeline: {
        clips: timelineState.clips,
        playhead: timelineState.playhead,
        selectedClipId: timelineState.selectedClipId,
        totalDuration: timelineState.totalDuration,
        zoom: timelineState.zoom
      },
      settings: DEFAULT_PROJECT_SETTINGS
    };

    set({
      currentProject: project,
      isDirty: false,
      lastSaved: null
    });
    
    // Enable auto-save for new project
    get().enableAutoSave();
    
    // Save session for recovery
    useSessionStore.getState().saveSession(project);
  },

  loadProject: (project: Project) => {
    // First, set the project state before updating timeline
    // This prevents timeline updates from marking the project as dirty
    set({
      currentProject: project,
      isDirty: false,
      lastSaved: project.modified
    });

    // Then update timeline store with project data
    useTimelineStore.getState().clearTimeline();
    
    if (project.timeline.clips.length > 0) {
      // Create history snapshot before loading project clips
      if ((window as any).createHistorySnapshot) {
        (window as any).createHistorySnapshot(`Load project with ${project.timeline.clips.length} clips`);
      }
      
      useTimelineStore.getState().addClips(project.timeline.clips);
    }
    
    useTimelineStore.getState().setPlayhead(project.timeline.playhead);
    
    if (project.timeline.selectedClipId) {
      useTimelineStore.getState().setSelectedClip(project.timeline.selectedClipId);
    }
    
    useTimelineStore.getState().setZoom(project.timeline.zoom);
    
    // Enable auto-save for loaded project
    get().enableAutoSave();
    
    // Save session for recovery
    useSessionStore.getState().saveSession(project);
  },

  saveProject: async () => {
    const { currentProject } = get();
    if (!currentProject) return false;

    try {
      // Get current timeline state
      const timelineState = useTimelineStore.getState();
      
      // Update project with current timeline state
      const updatedProject: Project = {
        ...currentProject,
        modified: new Date(),
        timeline: {
          clips: timelineState.clips,
          playhead: timelineState.playhead,
          selectedClipId: timelineState.selectedClipId,
          totalDuration: timelineState.totalDuration,
          zoom: timelineState.zoom
        }
      };

      // Save via IPC
      const { electronAPI } = window;
      const result = await electronAPI.saveProject(updatedProject);

      if (result.success) {
        set({
          currentProject: updatedProject,
          isDirty: false,
          lastSaved: updatedProject.modified
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to save project:', error);
      return false;
    }
  },

  setDirty: (dirty: boolean) => {
    set({ isDirty: dirty });
  },

  updateSettings: (settings: Partial<ProjectSettings>) => {
    const { currentProject } = get();
    if (!currentProject) return;

    set({
      currentProject: {
        ...currentProject,
        settings: { ...currentProject.settings, ...settings },
        modified: new Date()
      },
      isDirty: true
    });
  },

  getProjectData: () => {
    const { currentProject } = get();
    if (!currentProject) return null;

    // Get current timeline state
    const timelineState = useTimelineStore.getState();
    
    return {
      ...currentProject,
      modified: new Date(),
      timeline: {
        clips: timelineState.clips,
        playhead: timelineState.playhead,
        selectedClipId: timelineState.selectedClipId,
        totalDuration: timelineState.totalDuration,
        zoom: timelineState.zoom
      }
    };
  },

  // Auto-save actions
  enableAutoSave: () => {
    const { autoSaveEnabled, autoSaveInterval, currentProject } = get();
    
    if (autoSaveEnabled || !currentProject) return;
    
    set({ autoSaveEnabled: true });
    
    // Start auto-save timer
    const timer = setInterval(() => {
      get().autoSave();
    }, autoSaveInterval);
    
    set({ autoSaveTimer: timer });
  },

  disableAutoSave: () => {
    const { autoSaveTimer } = get();
    
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
    }
    
    set({ 
      autoSaveEnabled: false,
      autoSaveTimer: null 
    });
  },

  setAutoSaveInterval: (interval: number) => {
    const { autoSaveEnabled, autoSaveTimer } = get();
    
    set({ autoSaveInterval: interval });
    
    // Restart timer if auto-save is enabled
    if (autoSaveEnabled && autoSaveTimer) {
      clearInterval(autoSaveTimer);
      const newTimer = setInterval(() => {
        get().autoSave();
      }, interval);
      set({ autoSaveTimer: newTimer });
    }
  },

  autoSave: async () => {
    const { currentProject, isDirty, autoSaveEnabled } = get();
    
    if (!autoSaveEnabled || !currentProject || !isDirty) return;
    
    try {
      console.log('Auto-saving project...');
      const success = await get().saveProject();
      
      if (success) {
        console.log('Auto-save completed successfully');
      } else {
        console.warn('Auto-save failed');
      }
    } catch (error) {
      console.error('Auto-save error:', error);
    }
  }
}));
