import { create } from 'zustand';
import { Track, ActiveTab, SleepTimer } from '../types/player';
import { invoke } from '@tauri-apps/api/core';

interface PlayerState {
  tracks: Track[];
  queue: Track[];
  currentIndex: number;
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  activeTab: ActiveTab;
  searchQuery: string;
  likedTrackIds: string[];
  sleepTimer: SleepTimer;
  showLyricsFullscreen: boolean;
  isQueueOpen: boolean;
  lrclibAutoFetch: boolean;
  romanizationMode: 'none' | 'romaji' | 'pinyin' | 'aromanize';

  // Actions
  setTracks: (tracks: Track[]) => void;
  playTrack: (track: Track) => void;
  playIndex: (index: number) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  addToQueue: (track: Track) => void;
  playNext: (track: Track) => void;
  clearQueue: () => void;
  setQueue: (queue: Track[]) => void;
  toggleLikeTrack: (trackId: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setSearchQuery: (query: string) => void;
  setShowLyricsFullscreen: (show: boolean) => void;
  setLrclibAutoFetch: (enabled: boolean) => void;
  setRomanizationMode: (mode: 'none' | 'romaji' | 'pinyin' | 'aromanize') => void;
  
  // Sleep timer actions
  startSleepTimer: (mode: 'time' | 'tracks', value: number) => void;
  cancelSleepTimer: () => void;
  tickSleepTimerSecond: () => void;
  onTrackFinished: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  tracks: [],
  queue: [],
  currentIndex: -1,
  currentTrack: null,
  isPlaying: false,
  volume: 0.8,
  currentTime: 0,
  duration: 0,
  activeTab: 'library',
  searchQuery: '',
  likedTrackIds: [],
  sleepTimer: {
    active: false,
    mode: 'time',
    remainingSeconds: 0,
    remainingTracks: 0,
  },
  showLyricsFullscreen: false,
  isQueueOpen: false,
  lrclibAutoFetch: true,
  romanizationMode: 'romaji',

  setTracks: (tracks) => set({ tracks }),

  playTrack: async (track) => {
    const { queue } = get();
    let index = queue.findIndex((t) => t.id === track.id);
    let newQueue = queue;
    if (index === -1) {
      newQueue = [track, ...queue];
      index = 0;
    }
    set({
      queue: newQueue,
      currentIndex: index,
      currentTrack: track,
      duration: track.duration_secs,
      currentTime: 0,
      isPlaying: true,
    });
    try {
      await invoke('play_audio', { path: track.path, replayGainDb: track.replay_gain_db || 0 });
    } catch (e) {
      console.warn('Rust play_audio call pending implementation:', e);
    }
  },

  playIndex: async (index) => {
    const { queue } = get();
    if (index >= 0 && index < queue.length) {
      const track = queue[index];
      set({
        currentIndex: index,
        currentTrack: track,
        duration: track.duration_secs,
        currentTime: 0,
        isPlaying: true,
      });
      try {
        await invoke('play_audio', { path: track.path, replayGainDb: track.replay_gain_db || 0 });
      } catch (e) {
        console.warn('Rust play_audio call pending:', e);
      }
    }
  },

  togglePlay: async () => {
    const { isPlaying, currentTrack, queue, playIndex } = get();
    if (!currentTrack) {
      if (queue.length > 0) {
        playIndex(0);
      }
      return;
    }
    const newPlayingState = !isPlaying;
    set({ isPlaying: newPlayingState });
    try {
      if (newPlayingState) {
        await invoke('resume_audio');
      } else {
        await invoke('pause_audio');
      }
    } catch (e) {
      console.warn('Rust audio toggle call error:', e);
    }
  },

  pause: async () => {
    set({ isPlaying: false });
    try {
      await invoke('pause_audio');
    } catch (e) {
      console.warn('Rust pause_audio error:', e);
    }
  },

  resume: async () => {
    set({ isPlaying: true });
    try {
      await invoke('resume_audio');
    } catch (e) {
      console.warn('Rust resume_audio error:', e);
    }
  },

  seek: async (seconds) => {
    set({ currentTime: seconds });
    try {
      await invoke('seek_audio', { positionSecs: seconds });
    } catch (e) {
      console.warn('Rust seek_audio error:', e);
    }
  },

  setVolume: async (vol) => {
    const clamped = Math.max(0, Math.min(1, vol));
    set({ volume: clamped });
    try {
      await invoke('set_volume', { volume: clamped });
    } catch (e) {
      console.warn('Rust set_volume error:', e);
    }
  },

  nextTrack: () => {
    const { currentIndex, queue, playIndex, onTrackFinished } = get();
    onTrackFinished();
    if (queue.length === 0) return;
    const nextIdx = (currentIndex + 1) % queue.length;
    playIndex(nextIdx);
  },

  previousTrack: () => {
    const { currentIndex, queue, currentTime, seek, playIndex } = get();
    if (currentTime > 3) {
      seek(0);
      return;
    }
    if (queue.length === 0) return;
    const prevIdx = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;
    playIndex(prevIdx);
  },

  addToQueue: (track) => {
    set((state) => ({
      queue: [...state.queue, track],
    }));
  },

  playNext: (track) => {
    set((state) => {
      const nextIndex = state.currentIndex + 1;
      const newQueue = [...state.queue];
      newQueue.splice(nextIndex, 0, track);
      return { queue: newQueue };
    });
  },

  clearQueue: () => {
    set({ queue: [], currentIndex: -1, currentTrack: null, isPlaying: false });
  },

  setQueue: (newQueue) => set({ queue: newQueue }),

  toggleLikeTrack: (trackId) => {
    set((state) => {
      const liked = state.likedTrackIds.includes(trackId);
      const newLiked = liked
        ? state.likedTrackIds.filter((id) => id !== trackId)
        : [...state.likedTrackIds, trackId];
      return { likedTrackIds: newLiked };
    });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setShowLyricsFullscreen: (show) => set({ showLyricsFullscreen: show }),

  setLrclibAutoFetch: (enabled) => set({ lrclibAutoFetch: enabled }),

  setRomanizationMode: (mode) => set({ romanizationMode: mode }),

  startSleepTimer: (mode, value) => {
    if (mode === 'time') {
      set({
        sleepTimer: {
          active: true,
          mode: 'time',
          remainingSeconds: value * 60,
          remainingTracks: 0,
        },
      });
    } else {
      set({
        sleepTimer: {
          active: true,
          mode: 'tracks',
          remainingSeconds: 0,
          remainingTracks: value,
        },
      });
    }
  },

  cancelSleepTimer: () => {
    set({
      sleepTimer: {
        active: false,
        mode: 'time',
        remainingSeconds: 0,
        remainingTracks: 0,
      },
    });
  },

  tickSleepTimerSecond: () => {
    const { sleepTimer, pause } = get();
    if (!sleepTimer.active || sleepTimer.mode !== 'time') return;
    if (sleepTimer.remainingSeconds <= 1) {
      pause();
      set({
        sleepTimer: {
          active: false,
          mode: 'time',
          remainingSeconds: 0,
          remainingTracks: 0,
        },
      });
    } else {
      set({
        sleepTimer: {
          ...sleepTimer,
          remainingSeconds: sleepTimer.remainingSeconds - 1,
        },
      });
    }
  },

  onTrackFinished: () => {
    const { sleepTimer, pause } = get();
    if (!sleepTimer.active || sleepTimer.mode !== 'tracks') return;
    if (sleepTimer.remainingTracks <= 1) {
      pause();
      set({
        sleepTimer: {
          active: false,
          mode: 'tracks',
          remainingSeconds: 0,
          remainingTracks: 0,
        },
      });
    } else {
      set({
        sleepTimer: {
          ...sleepTimer,
          remainingTracks: sleepTimer.remainingTracks - 1,
        },
      });
    }
  },
}));
