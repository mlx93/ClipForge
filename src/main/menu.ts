import { Menu, MenuItemConstructorOptions, app, shell, BrowserWindow } from 'electron';

export const createApplicationMenu = (mainWindow: BrowserWindow): Menu => {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'SimpleCut',
      submenu: [
        {
          label: 'About SimpleCut',
          role: 'about'
        },
        { type: 'separator' },
        {
          label: 'Services',
          role: 'services',
          submenu: []
        },
        { type: 'separator' },
        {
          label: 'Hide SimpleCut',
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          role: 'hideOthers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'Command+N',
          click: () => {
            // Send event to renderer to create new project
            mainWindow?.webContents.send('menu-new-project');
          }
        },
        {
          label: 'Open Project',
          accelerator: 'Command+O',
          click: () => {
            // Send event to renderer to open project
            mainWindow?.webContents.send('menu-open-project');
          }
        },
        {
          label: 'Save Project',
          accelerator: 'Command+S',
          click: () => {
            // Send event to renderer to save project
            mainWindow?.webContents.send('menu-save-project');
          }
        },
        {
          label: 'Save Project As...',
          accelerator: 'Command+Shift+S',
          click: () => {
            // Send event to renderer to save project as
            mainWindow?.webContents.send('menu-save-project-as');
          }
        },
        { type: 'separator' },
        {
          label: 'Import Videos',
          accelerator: 'Command+I',
          click: () => {
            // Send event to renderer to import videos
            mainWindow?.webContents.send('menu-import-videos');
          }
        },
        { type: 'separator' },
        {
          label: 'Export Video',
          accelerator: 'Command+E',
          click: () => {
            // Send event to renderer to export video
            mainWindow?.webContents.send('menu-export-video');
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'Command+Z',
          role: 'undo'
        },
        {
          label: 'Redo',
          accelerator: 'Command+Shift+Z',
          role: 'redo'
        },
        { type: 'separator' },
        {
          label: 'Cut',
          accelerator: 'Command+X',
          role: 'cut'
        },
        {
          label: 'Copy',
          accelerator: 'Command+C',
          role: 'copy'
        },
        {
          label: 'Paste',
          accelerator: 'Command+V',
          role: 'paste'
        },
        { type: 'separator' },
        {
          label: 'Select All',
          accelerator: 'Command+A',
          click: () => {
            // Send event to renderer to select all clips
            mainWindow?.webContents.send('menu-select-all');
          }
        }
      ]
    },
    {
      label: 'Timeline',
      submenu: [
        {
          label: 'Play/Pause',
          accelerator: 'Space',
          click: () => {
            // Send event to renderer to toggle play/pause
            mainWindow?.webContents.send('menu-play-pause');
          }
        },
        {
          label: 'Stop',
          accelerator: 'Escape',
          click: () => {
            // Send event to renderer to stop playback
            mainWindow?.webContents.send('menu-stop');
          }
        },
        { type: 'separator' },
        {
          label: 'Go to Start',
          accelerator: 'Home',
          click: () => {
            // Send event to renderer to go to start
            mainWindow?.webContents.send('menu-go-to-start');
          }
        },
        {
          label: 'Go to End',
          accelerator: 'End',
          click: () => {
            // Send event to renderer to go to end
            mainWindow?.webContents.send('menu-go-to-end');
          }
        },
        {
          label: 'Seek Backward',
          accelerator: 'Left',
          click: () => {
            // Send event to renderer to seek backward
            mainWindow?.webContents.send('menu-seek-backward');
          }
        },
        {
          label: 'Seek Forward',
          accelerator: 'Right',
          click: () => {
            // Send event to renderer to seek forward
            mainWindow?.webContents.send('menu-seek-forward');
          }
        },
        { type: 'separator' },
        {
          label: 'Split at Playhead',
          accelerator: 'S',
          click: () => {
            // Send event to renderer to split clip
            mainWindow?.webContents.send('menu-split-clip');
          }
        },
        {
          label: 'Move Clip Left',
          accelerator: '[',
          click: () => {
            // Send event to renderer to move clip left
            mainWindow?.webContents.send('menu-move-clip-left');
          }
        },
        {
          label: 'Move Clip Right',
          accelerator: ']',
          click: () => {
            // Send event to renderer to move clip right
            mainWindow?.webContents.send('menu-move-clip-right');
          }
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'Command+Plus',
          click: () => {
            // Send event to renderer to zoom in
            mainWindow?.webContents.send('menu-zoom-in');
          }
        },
        {
          label: 'Zoom Out',
          accelerator: 'Command+-',
          click: () => {
            // Send event to renderer to zoom out
            mainWindow?.webContents.send('menu-zoom-out');
          }
        },
        {
          label: 'Reset Zoom',
          accelerator: 'Command+0',
          click: () => {
            // Send event to renderer to reset zoom
            mainWindow?.webContents.send('menu-zoom-reset');
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'Command+R',
          role: 'reload'
        },
        {
          label: 'Force Reload',
          accelerator: 'Command+Shift+R',
          role: 'forceReload'
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          role: 'toggleDevTools'
        },
        { type: 'separator' },
        {
          label: 'Actual Size',
          accelerator: 'Command+0',
          role: 'resetZoom'
        },
        {
          label: 'Zoom In',
          accelerator: 'Command+Plus',
          role: 'zoomIn'
        },
        {
          label: 'Zoom Out',
          accelerator: 'Command+-',
          role: 'zoomOut'
        },
        { type: 'separator' },
        {
          label: 'Toggle Fullscreen',
          accelerator: 'Command+Control+F',
          role: 'togglefullscreen'
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'Command+M',
          role: 'minimize'
        },
        {
          label: 'Close',
          accelerator: 'Command+W',
          role: 'close'
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click: () => {
            shell.openExternal('https://github.com/mlx93/SimpleCut');
          }
        },
        {
          label: 'Keyboard Shortcuts',
          click: () => {
            // Send event to renderer to show shortcuts
            mainWindow?.webContents.send('menu-show-shortcuts');
          }
        }
      ]
    }
  ];

  return Menu.buildFromTemplate(template);
};
