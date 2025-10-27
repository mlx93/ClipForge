import { create } from 'zustand';
import { Clip, TimelineState } from '@shared/types';

interface TimelineStore extends TimelineState {
  // Actions
  addClips: (clips: Clip[]) => void;
  removeClip: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<Clip>) => void;
  setPlayhead: (time: number) => void;
  setSelectedClip: (clipId: string | null) => void;
  setZoom: (zoom: number) => void;
  reorderClips: (fromIndex: number, toIndex: number) => void;
  trimClip: (clipId: string, trimStart: number, trimEnd: number) => void;
  splitClip: (clipId: string, splitTime: number) => void;
  clearTimeline: () => void;
  
  // Computed values
  getTotalDuration: () => number;
  getClipAtTime: (time: number) => Clip | null;
  getClipsInRange: (startTime: number, endTime: number) => Clip[];
}

export const useTimelineStore = create<TimelineStore>((set, get) => ({
  // Initial state
  clips: [],
  playhead: 0,
  selectedClipId: null,
  totalDuration: 0,
  zoom: 1,

  // Actions
  addClips: (newClips: Clip[]) => {
    console.log('Timeline store: Adding clips:', newClips);
    set((state) => {
      const updatedClips = [...state.clips, ...newClips];
      const totalDuration = updatedClips.reduce((sum, clip) => {
        const duration = clip.trimEnd > 0 ? clip.trimEnd - clip.trimStart : clip.duration - clip.trimStart;
        return sum + duration;
      }, 0);
      
      console.log('Timeline store: Updated clips:', updatedClips.length, 'Total duration:', totalDuration);
      
      return {
        clips: updatedClips,
        totalDuration
      };
    });
  },

  removeClip: (clipId: string) => {
    set((state) => {
      const updatedClips = state.clips.filter(clip => clip.id !== clipId);
      const totalDuration = updatedClips.reduce((sum, clip) => {
        const duration = clip.trimEnd > 0 ? clip.trimEnd - clip.trimStart : clip.duration - clip.trimStart;
        return sum + duration;
      }, 0);
      
      return {
        clips: updatedClips,
        totalDuration,
        selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId
      };
    });
  },

  updateClip: (clipId: string, updates: Partial<Clip>) => {
    set((state) => ({
      clips: state.clips.map(clip => 
        clip.id === clipId ? { ...clip, ...updates } : clip
      )
    }));
  },

  setPlayhead: (time: number) => {
    set({ playhead: Math.max(0, time) });
  },

  setSelectedClip: (clipId: string | null) => {
    set({ selectedClipId: clipId });
  },

  setZoom: (zoom: number) => {
    set({ zoom: Math.max(0.1, Math.min(10, zoom)) });
  },

  reorderClips: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const newClips = [...state.clips];
      const [movedClip] = newClips.splice(fromIndex, 1);
      newClips.splice(toIndex, 0, movedClip);
      
      return { clips: newClips };
    });
  },

  trimClip: (clipId: string, trimStart: number, trimEnd: number) => {
    set((state) => ({
      clips: state.clips.map(clip => 
        clip.id === clipId 
          ? { ...clip, trimStart, trimEnd }
          : clip
      )
    }));
  },

  splitClip: (clipId: string, splitTime: number) => {
    set((state) => {
      const clipIndex = state.clips.findIndex(clip => clip.id === clipId);
      if (clipIndex === -1) return state;

      const originalClip = state.clips[clipIndex];
      const splitOffset = splitTime - originalClip.trimStart;
      
      // Create first clip (up to split point)
      const firstClip: Clip = {
        ...originalClip,
        id: `${originalClip.id}_1`,
        trimEnd: splitTime
      };
      
      // Create second clip (from split point)
      const secondClip: Clip = {
        ...originalClip,
        id: `${originalClip.id}_2`,
        trimStart: splitTime,
        trimEnd: originalClip.trimEnd || originalClip.duration
      };

      const newClips = [...state.clips];
      newClips[clipIndex] = firstClip;
      newClips.splice(clipIndex + 1, 0, secondClip);

      return { clips: newClips };
    });
  },

  clearTimeline: () => {
    set({
      clips: [],
      playhead: 0,
      selectedClipId: null,
      totalDuration: 0
    });
  },

  // Computed values
  getTotalDuration: () => {
    const state = get();
    return state.clips.reduce((sum, clip) => {
      const duration = clip.trimEnd > 0 ? clip.trimEnd - clip.trimStart : clip.duration - clip.trimStart;
      return sum + duration;
    }, 0);
  },

  getClipAtTime: (time: number) => {
    const state = get();
    let currentTime = 0;
    
    for (const clip of state.clips) {
      const clipDuration = clip.trimEnd > 0 ? clip.trimEnd - clip.trimStart : clip.duration - clip.trimStart;
      if (time >= currentTime && time <= currentTime + clipDuration) {
        return clip;
      }
      currentTime += clipDuration;
    }
    
    return null;
  },

  getClipsInRange: (startTime: number, endTime: number) => {
    const state = get();
    const clipsInRange: Clip[] = [];
    let currentTime = 0;
    
    for (const clip of state.clips) {
      const clipDuration = clip.trimEnd > 0 ? clip.trimEnd - clip.trimStart : clip.duration - clip.trimStart;
      const clipEndTime = currentTime + clipDuration;
      
      if (clipEndTime > startTime && currentTime < endTime) {
        clipsInRange.push(clip);
      }
      
      currentTime = clipEndTime;
    }
    
    return clipsInRange;
  }
}));
