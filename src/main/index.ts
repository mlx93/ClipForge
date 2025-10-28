import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron';
import { join } from 'path';
import { isDev } from './utils';
import { setupIpcHandlers } from './ipc/handlers';
import { createApplicationMenu } from './menu';

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;

// Export function to get main window (for menu callbacks)
export const getMainWindow = (): BrowserWindow | null => mainWindow;

const createWindow = (): void => {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: join(__dirname, '../preload/preload.cjs')
    },
    titleBarStyle: 'hidden',
    show: false, // Don't show until ready
    icon: join(__dirname, '../../assets/icon.png')
  });

  // Load the app
  if (isDev()) {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    // DevTools closed by default - user can open with Cmd+Option+I
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
};

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();
  setupIpcHandlers(mainWindow!);
  
  // Set up application menu
  const menu = createApplicationMenu(mainWindow!);
  Menu.setApplicationMenu(menu);

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.on('new-window', (event) => {
    event.preventDefault();
  });
});

