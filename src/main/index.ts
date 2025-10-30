import { app, BrowserWindow, Menu, dialog, ipcMain, session } from 'electron';
import { join } from 'path';
import { isDev } from './utils';
import { setupIpcHandlers } from './ipc/handlers';
import { createApplicationMenu } from './menu';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

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
  
  // Set up permission request handler for media access
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // Always allow media-related permissions - we'll handle denial gracefully
    if (permission === 'media') {
      console.log('[Permissions] Requesting permission:', permission);
      callback(true); // Grant permission
    } else {
      callback(false); // Deny other permissions
    }
  });
  
  // Set up permission check handler
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    // Allow media-related permissions
    if (permission === 'media') {
      return true;
    }
    return false;
  });
  
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
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});

