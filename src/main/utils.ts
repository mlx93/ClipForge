import { app } from 'electron';
import { join } from 'path';

export const isDev = (): boolean => {
  return process.env.NODE_ENV === 'development' || !app.isPackaged;
};

export const getAppPath = (): string => {
  return isDev() ? app.getAppPath() : process.resourcesPath;
};

export const getAssetPath = (filename: string): string => {
  return join(getAppPath(), 'assets', filename);
};

export const getUserDataPath = (): string => {
  return app.getPath('userData');
};

export const getTempPath = (): string => {
  return app.getPath('temp');
};
