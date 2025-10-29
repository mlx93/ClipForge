import { create } from 'zustand';
import { Clip } from '@shared/types';

interface MediaLibraryState {
  clips: Clip[];
  reorderClips: (fromIndex: number, toIndex: number) => void;
  setClips: (clips: Clip[]) => void;
  addClip: (clip: Clip) => void;
  removeClip: (clipId: string) => void;
}

export const useMediaLibraryStore = create<MediaLibraryState>((set) => ({
  clips: [],
  
  setClips: (clips: Clip[]) => {
    set({ clips });
  },
  
  addClip: (clip: Clip) => {
    set((state) => ({
      clips: [...state.clips, clip]
    }));
  },
  
  reorderClips: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const newClips = Array.from(state.clips);
      const [movedClip] = newClips.splice(fromIndex, 1);
      newClips.splice(toIndex, 0, movedClip);
      return { clips: newClips };
    });
  },

  removeClip: (clipId: string) => {
    set((state) => ({
      clips: state.clips.filter(clip => clip.id !== clipId)
    }));
  },
}));
