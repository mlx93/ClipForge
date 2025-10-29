import { create } from 'zustand';
import { Project } from '@shared/types';

export interface SessionData {
  project: Project | null;
  timestamp: number;
  appVersion: string;
}

export interface SessionStore {
  // State
  sessionData: SessionData | null;
  isRecovering: boolean;
  
  // Actions
  saveSession: (project: Project) => void;
  loadSession: () => SessionData | null;
  clearSession: () => void;
  hasRecoveryData: () => boolean;
  isSessionValid: (maxAge: number) => boolean;
}

const SESSION_KEY = 'clipforge-session';
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export const useSessionStore = create<SessionStore>((set, get) => ({
  // Initial state
  sessionData: null,
  isRecovering: false,

  // Actions
  saveSession: (project: Project) => {
    const sessionData: SessionData = {
      project,
      timestamp: Date.now(),
      appVersion: '1.0.0'
    };
    
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
      set({ sessionData });
      console.log('Session saved successfully');
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  },

  loadSession: () => {
    try {
      const sessionJson = localStorage.getItem(SESSION_KEY);
      if (!sessionJson) return null;
      
      const sessionData: SessionData = JSON.parse(sessionJson);
      
      // Convert date strings back to Date objects
      if (sessionData.project) {
        sessionData.project.created = new Date(sessionData.project.created);
        sessionData.project.modified = new Date(sessionData.project.modified);
      }
      
      set({ sessionData });
      return sessionData;
    } catch (error) {
      console.error('Failed to load session:', error);
      return null;
    }
  },

  clearSession: () => {
    try {
      localStorage.removeItem(SESSION_KEY);
      set({ sessionData: null });
      console.log('Session cleared');
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  },

  hasRecoveryData: () => {
    const { sessionData } = get();
    return sessionData !== null && get().isSessionValid(SESSION_MAX_AGE);
  },

  isSessionValid: (maxAge: number) => {
    const { sessionData } = get();
    if (!sessionData) return false;
    
    const now = Date.now();
    const age = now - sessionData.timestamp;
    
    return age < maxAge;
  }
}));
