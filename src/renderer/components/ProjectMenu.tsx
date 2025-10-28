import React, { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useTimelineStore } from '../store/timelineStore';

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
      defaultPath: '~/Desktop/ClipForge Projects/Untitled.clipforge',
      filters: [
        { name: 'ClipForge Projects', extensions: ['clipforge'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      const projectName = result.filePath.split('/').pop()?.replace('.clipforge', '') || 'Untitled';
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
        { name: 'ClipForge Projects', extensions: ['clipforge'] }
      ],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths?.[0]) {
      setIsLoading(true);
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
      }
    }
  };

  const handleSaveProject = async () => {
    if (!currentProject) {
      await handleSaveAsProject();
      return;
    }

    setIsLoading(true);
    try {
      const success = await saveProject();
      if (!success) {
        alert('Failed to save project');
      }
    } catch (error) {
      alert('Failed to save project: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAsProject = async () => {
    const { electronAPI } = window;
    const result = await electronAPI.showSaveDialog({
      title: 'Save Project As',
      defaultPath: currentProject?.path || '~/Desktop/ClipForge Projects/Untitled.clipforge',
      filters: [
        { name: 'ClipForge Projects', extensions: ['clipforge'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      const projectName = result.filePath.split('/').pop()?.replace('.clipforge', '') || 'Untitled';
      
      // Create new project with the save path
      const timelineState = useTimelineStore.getState();
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
        settings: currentProject?.settings || {
          resolution: { width: 1920, height: 1080, name: '1080p' },
          frameRate: 30,
          audioSampleRate: 44100,
          audioChannels: 2
        }
      };

      setIsLoading(true);
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
      }
    }
  };

  return (
    <div className="flex items-center space-x-2 text-sm">
      <button
        onClick={handleNewProject}
        disabled={isLoading}
        data-menu-action="new-project"
        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded text-xs"
      >
        New
      </button>
      
      <button
        onClick={handleOpenProject}
        disabled={isLoading}
        data-menu-action="open-project"
        className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded text-xs"
      >
        Open
      </button>
      
      <button
        onClick={handleSaveProject}
        disabled={isLoading || !currentProject}
        data-menu-action="save-project"
        className="px-3 py-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded text-xs"
      >
        Save
      </button>
      
      <button
        onClick={handleSaveAsProject}
        disabled={isLoading}
        data-menu-action="save-project-as"
        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded text-xs"
      >
        Save As
      </button>

      {currentProject && (
        <span className="text-gray-400 text-xs ml-2">
          {currentProject.name}{isDirty ? ' *' : ''}
        </span>
      )}
    </div>
  );
};

export default ProjectMenu;
