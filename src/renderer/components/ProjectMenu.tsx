import React, { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useTimelineStore } from '../store/timelineStore';
import { useMediaLibraryStore } from '../store/mediaLibraryStore';

const ProjectMenu: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { 
    currentProject, 
    isDirty, 
    newProject, 
    loadProject, 
    saveProject, 
    setDirty 
  } = useProjectStore();

  const handleNewProject = async () => {
    if (isDirty && currentProject) {
      const shouldSave = window.confirm('You have unsaved changes. Do you want to save the current project?');
      if (shouldSave) {
        await handleSaveProject();
      }
    }

    const { electronAPI } = window;
    const result = await electronAPI.showSaveDialog({
      title: 'Create New Project',
      defaultPath: '~/Desktop/SimpleCut Projects/Untitled.simplecut',
      filters: [
        { name: 'SimpleCut Projects', extensions: ['simplecut'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      const projectName = result.filePath.split('/').pop()?.replace('.simplecut', '') || 'Untitled';
      newProject(projectName, result.filePath);
      
      // Clear timeline
      useTimelineStore.getState().clearTimeline();
      setDirty(false);
    }
  };

  const handleOpenProject = async () => {
    if (isDirty && currentProject) {
      const shouldSave = window.confirm('You have unsaved changes. Do you want to save the current project?');
      if (shouldSave) {
        await handleSaveProject();
      }
    }

    const { electronAPI } = window;
    const result = await electronAPI.showOpenDialog({
      title: 'Open Project',
      filters: [
        { name: 'SimpleCut Projects', extensions: ['simplecut'] }
      ],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths?.[0]) {
      setIsLoading(true);
      // Set saving flag to prevent dirty flag from being set during open
      (window as any).isSavingRef = { current: true };
      try {
        const loadResult = await electronAPI.loadProject(result.filePaths[0]);
        if (loadResult.success && loadResult.project) {
          loadProject(loadResult.project);
        } else {
          alert('Failed to load project: ' + (loadResult.error || 'Unknown error'));
        }
      } catch (error) {
        alert('Failed to load project: ' + (error instanceof Error ? error.message : 'Unknown error'));
      } finally {
        setIsLoading(false);
        // Clear saving flag after open completes
        setTimeout(() => {
          (window as any).isSavingRef = { current: false };
        }, 200);
      }
    }
  };

  const handleSaveProject = async () => {
    if (!currentProject) {
      await handleSaveAsProject();
      return;
    }

    setIsLoading(true);
    // Set saving flag to prevent dirty flag from being set during save
    (window as any).isSavingRef = { current: true };
    try {
      const success = await saveProject();
      if (!success) {
        alert('Failed to save project');
      }
    } catch (error) {
      alert('Failed to save project: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
      // Clear saving flag after save completes
      setTimeout(() => {
        (window as any).isSavingRef = { current: false };
      }, 200);
    }
  };

  const handleSaveAsProject = async () => {
    const { electronAPI } = window;
    const result = await electronAPI.showSaveDialog({
      title: 'Save Project As',
      defaultPath: currentProject?.path || '~/Desktop/SimpleCut Projects/Untitled.simplecut',
      filters: [
        { name: 'SimpleCut Projects', extensions: ['simplecut'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      const projectName = result.filePath.split('/').pop()?.replace('.simplecut', '') || 'Untitled';
      
      // Create new project with the save path
      const timelineState = useTimelineStore.getState();
      const mediaLibraryState = useMediaLibraryStore.getState();
      const newProjectData = {
        name: projectName,
        path: result.filePath,
        created: new Date(),
        modified: new Date(),
        timeline: {
          clips: timelineState.clips,
          playhead: timelineState.playhead,
          selectedClipId: timelineState.selectedClipId,
          totalDuration: timelineState.totalDuration,
          zoom: timelineState.zoom
        },
        mediaLibrary: mediaLibraryState.clips,
        settings: currentProject?.settings || {
          resolution: { width: 1920, height: 1080, name: '1080p' },
          frameRate: 30,
          audioSampleRate: 44100,
          audioChannels: 2
        }
      };

      setIsLoading(true);
      // Set saving flag to prevent dirty flag from being set during save as
      (window as any).isSavingRef = { current: true };
      try {
        const saveResult = await electronAPI.saveProject(newProjectData);
        if (saveResult.success) {
          loadProject(newProjectData);
        } else {
          alert('Failed to save project: ' + (saveResult.error || 'Unknown error'));
        }
      } catch (error) {
        alert('Failed to save project: ' + (error instanceof Error ? error.message : 'Unknown error'));
      } finally {
        setIsLoading(false);
        // Clear saving flag after save as completes
        setTimeout(() => {
          (window as any).isSavingRef = { current: false };
        }, 200);
      }
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={handleNewProject}
        disabled={isLoading}
        data-menu-action="new-project"
        className="px-4 py-2 bg-blue-600/90 hover:bg-blue-600 disabled:bg-gray-600/50 text-white rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-blue-600/25 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        New
      </button>
      
      <button
        onClick={handleOpenProject}
        disabled={isLoading}
        data-menu-action="open-project"
        className="px-4 py-2 bg-green-600/90 hover:bg-green-600 disabled:bg-gray-600/50 text-white rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-green-600/25 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Open
      </button>
      
      <button
        onClick={handleSaveProject}
        disabled={isLoading || !currentProject}
        data-menu-action="save-project"
        data-action="save"
        className="px-4 py-2 bg-orange-600/90 hover:bg-orange-600 disabled:bg-gray-600/50 text-white rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-orange-600/25 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Save
      </button>
      
      <button
        onClick={handleSaveAsProject}
        disabled={isLoading}
        data-menu-action="save-project-as"
        className="px-4 py-2 bg-purple-600/90 hover:bg-purple-600 disabled:bg-gray-600/50 text-white rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-purple-600/25 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Save As
      </button>
    </div>
  );
};

export default ProjectMenu;
