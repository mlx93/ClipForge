import { create } from 'zustand';

export interface Shortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  description: string;
  action: () => void;
}

export interface ShortcutsState {
  shortcuts: Map<string, Shortcut>;
  isEnabled: boolean;
  
  // Actions
  registerShortcut: (shortcut: Shortcut) => void;
  unregisterShortcut: (key: string) => void;
  enableShortcuts: () => void;
  disableShortcuts: () => void;
  handleKeyDown: (event: KeyboardEvent) => void;
  
  // Predefined shortcuts
  registerDefaultShortcuts: () => void;
}

export const useShortcutsStore = create<ShortcutsState>((set, get) => ({
  shortcuts: new Map(),
  isEnabled: true,

  registerShortcut: (shortcut: Shortcut) => {
    const { shortcuts } = get();
    const key = shortcut.key.toLowerCase();
    shortcuts.set(key, shortcut);
    set({ shortcuts: new Map(shortcuts) });
  },

  unregisterShortcut: (key: string) => {
    const { shortcuts } = get();
    shortcuts.delete(key.toLowerCase());
    set({ shortcuts: new Map(shortcuts) });
  },

  enableShortcuts: () => {
    set({ isEnabled: true });
  },

  disableShortcuts: () => {
    set({ isEnabled: false });
  },

  handleKeyDown: (event: KeyboardEvent) => {
    const { shortcuts, isEnabled } = get();
    
    if (!isEnabled) return;
    
    const key = event.key.toLowerCase();
    const shortcut = shortcuts.get(key);
    
    if (!shortcut) return;
    
    // Check modifier keys
    const ctrlMatch = !!shortcut.ctrlKey === event.ctrlKey;
    const shiftMatch = !!shortcut.shiftKey === event.shiftKey;
    const altMatch = !!shortcut.altKey === event.altKey;
    const metaMatch = !!shortcut.metaKey === event.metaKey;
    
    if (ctrlMatch && shiftMatch && altMatch && metaMatch) {
      event.preventDefault();
      shortcut.action();
    }
  },

  registerDefaultShortcuts: () => {
    const { registerShortcut } = get();
    
    // Undo/Redo shortcuts
    registerShortcut({
      key: 'u',
      metaKey: true,
      description: 'Undo last action',
      action: () => {
        const undoButton = document.querySelector('[data-action="undo"]') as HTMLButtonElement;
        undoButton?.click();
      }
    });
    
    registerShortcut({
      key: 'r',
      metaKey: true,
      description: 'Redo last action',
      action: () => {
        const redoButton = document.querySelector('[data-action="redo"]') as HTMLButtonElement;
        redoButton?.click();
      }
    });
    
    // Timeline shortcuts
    registerShortcut({
      key: 's',
      description: 'Split clip at playhead',
      action: () => {
        const splitButton = document.querySelector('[data-action="split"]') as HTMLButtonElement;
        splitButton?.click();
      }
    });
    
    registerShortcut({
      key: 'Delete',
      description: 'Delete selected clip',
      action: () => {
        const deleteButton = document.querySelector('[data-action="delete"]') as HTMLButtonElement;
        deleteButton?.click();
      }
    });
    
    registerShortcut({
      key: 'Backspace',
      description: 'Delete selected clip',
      action: () => {
        const deleteButton = document.querySelector('[data-action="delete"]') as HTMLButtonElement;
        deleteButton?.click();
      }
    });
    
    // Playback shortcuts
    registerShortcut({
      key: ' ',
      description: 'Play/Pause video',
      action: () => {
        const playButton = document.querySelector('[data-action="play-pause"]') as HTMLButtonElement;
        playButton?.click();
      }
    });
    
    
    // Arrow key shortcuts - 5 second movement
    registerShortcut({
      key: 'ArrowLeft',
      description: 'Move playhead left 5 seconds',
      action: () => {
        const leftButton = document.querySelector('[data-action="left"]') as HTMLButtonElement;
        leftButton?.click();
      }
    });
    
    registerShortcut({
      key: 'ArrowRight',
      description: 'Move playhead right 5 seconds',
      action: () => {
        const rightButton = document.querySelector('[data-action="right"]') as HTMLButtonElement;
        rightButton?.click();
      }
    });
    
    // Shift + Arrow key shortcuts - 1 second movement
    registerShortcut({
      key: 'ArrowLeft',
      shiftKey: true,
      description: 'Move playhead left 1 second',
      action: () => {
        const leftButton = document.querySelector('[data-action="left-1sec"]') as HTMLButtonElement;
        leftButton?.click();
      }
    });
    
    registerShortcut({
      key: 'ArrowRight',
      shiftKey: true,
      description: 'Move playhead right 1 second',
      action: () => {
        const rightButton = document.querySelector('[data-action="right-1sec"]') as HTMLButtonElement;
        rightButton?.click();
      }
    });
    
    // Export shortcut
    registerShortcut({
      key: 'e',
      metaKey: true,
      description: 'Export video',
      action: () => {
        const exportButton = document.querySelector('[data-action="export"]') as HTMLButtonElement;
        exportButton?.click();
      }
    });
    
    // Save shortcut
    registerShortcut({
      key: 's',
      metaKey: true,
      description: 'Save project',
      action: () => {
        const saveButton = document.querySelector('[data-action="save"]') as HTMLButtonElement;
        saveButton?.click();
      }
    });
    
    
    // Shortcuts modal shortcut
    registerShortcut({
      key: 'F1',
      description: 'Show keyboard shortcuts',
      action: () => {
        const shortcutsButton = document.querySelector('[data-action="shortcuts"]') as HTMLButtonElement;
        shortcutsButton?.click();
      }
    });
  }
}));
