import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Track, ActiveTab, SleepTimer } from '../types/player';
import { invoke } from '@tauri-apps/api/core';

interface PlayerState {
  tracks: Track[];
  queue: Track[];
  userQueue: Track[];
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
  isRomanizationEnabled: boolean;
  romanizationMode: 'below' | 'replace';
  showAudioSpecs: boolean;
  autoHideLyricsControls: boolean;
  includedDirectories: string[];
  excludedDirectories: string[];

  // Library folder actions
  addIncludedDirectory: (dir: string) => Promise<void>;
  removeIncludedDirectory: (dir: string) => Promise<void>;
  addExcludedDirectory: (dir: string) => Promise<void>;
  removeExcludedDirectory: (dir: string) => Promise<void>;
  rescanConfiguredLibraries: () => Promise<void>;

  // Actions
  setTracks: (tracks: Track[]) => void;
  playTrack: (track: Track, contextTracks?: Track[]) => void;
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
  removeFromUserQueue: (index: number) => void;
  reorderUserQueue: (fromIndex: number, toIndex: number) => void;
  clearUserQueue: () => void;
  clearQueue: () => void;
  setQueue: (queue: Track[]) => void;
  toggleLikeTrack: (trackId: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setSearchQuery: (query: string) => void;
  setShowLyricsFullscreen: (show: boolean) => void;
  setLrclibAutoFetch: (enabled: boolean) => void;
  toggleRomanization: () => void;
  setRomanizationMode: (mode: 'below' | 'replace') => void;
  toggleShowAudioSpecs: () => void;
  toggleAutoHideLyricsControls: () => void;
  
  // Reset & Wipe Action
  wipeDataAndReset: () => Promise<void>;

  // Sleep timer actions
  startSleepTimer: (mode: 'time' | 'tracks', value: number) => void;
  cancelSleepTimer: () => void;
  tickSleepTimerSecond: () => void;
  onTrackFinished: () => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      tracks: [],
      queue: [],
      userQueue: [],
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
      isRomanizationEnabled: true,
      romanizationMode: 'below',
      showAudioSpecs: true,
      autoHideLyricsControls: true,
      includedDirectories: [],
      excludedDirectories: [],

      addIncludedDirectory: async (dir) => {
        const { includedDirectories, rescanConfiguredLibraries } = get();
        if (!includedDirectories.includes(dir)) {
          const updated = [...includedDirectories, dir];
          set({ includedDirectories: updated });
          await rescanConfiguredLibraries();
        }
      },

      removeIncludedDirectory: async (dir) => {
        const { includedDirectories, rescanConfiguredLibraries } = get();
        const updated = includedDirectories.filter((d) => d !== dir);
        set({ includedDirectories: updated });
        await rescanConfiguredLibraries();
      },

      addExcludedDirectory: async (dir) => {
        const { excludedDirectories, rescanConfiguredLibraries } = get();
        if (!excludedDirectories.includes(dir)) {
          const updated = [...excludedDirectories, dir];
          set({ excludedDirectories: updated });
          await rescanConfiguredLibraries();
        }
      },

      removeExcludedDirectory: async (dir) => {
        const { excludedDirectories, rescanConfiguredLibraries } = get();
        const updated = excludedDirectories.filter((d) => d !== dir);
        set({ excludedDirectories: updated });
        await rescanConfiguredLibraries();
      },

      rescanConfiguredLibraries: async () => {
        const { includedDirectories, excludedDirectories, setTracks } = get();
        if (includedDirectories.length === 0) return;
        try {
          if (window.__TAURI_INTERNALS__) {
            const scannedTracks: any = await invoke('scan_libraries', {
              includedDirs: includedDirectories,
              excludedDirs: excludedDirectories,
            });
            if (scannedTracks && Array.isArray(scannedTracks)) {
              setTracks(scannedTracks);
            }
          }
        } catch (e) {
          console.warn('Rescan libraries error:', e);
        }
      },

      // ... rest of implementation stays identical ...
      setTracks: (tracks) => set({ tracks }),

      playTrack: async (track, contextTracks) => {
        let newQueue = contextTracks && contextTracks.length > 0 ? contextTracks : [track];
        let index = newQueue.findIndex((t) => t.id === track.id);
        if (index === -1) {
          newQueue = [track, ...newQueue];
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

      nextTrack: async () => {
        const { userQueue, currentIndex, queue, playIndex, onTrackFinished } = get();
        onTrackFinished();

        // Priority User Queue takes precedence over context queue
        if (userQueue.length > 0) {
          const nextUserTrack = userQueue[0];
          const remainingUserQueue = userQueue.slice(1);
          set({
            userQueue: remainingUserQueue,
            currentTrack: nextUserTrack,
            duration: nextUserTrack.duration_secs,
            currentTime: 0,
            isPlaying: true,
          });
          try {
            await invoke('play_audio', { path: nextUserTrack.path, replayGainDb: nextUserTrack.replay_gain_db || 0 });
          } catch (e) {
            console.warn('Rust play_audio error:', e);
          }
          return;
        }

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
          userQueue: [...state.userQueue, track],
        }));
      },

      playNext: (track) => {
        set((state) => ({
          userQueue: [track, ...state.userQueue],
        }));
      },

      removeFromUserQueue: (index) => {
        set((state) => ({
          userQueue: state.userQueue.filter((_, i) => i !== index),
        }));
      },

      reorderUserQueue: (fromIndex, toIndex) => {
        set((state) => {
          const newUserQueue = [...state.userQueue];
          const [moved] = newUserQueue.splice(fromIndex, 1);
          newUserQueue.splice(toIndex, 0, moved);
          return { userQueue: newUserQueue };
        });
      },

      clearUserQueue: () => set({ userQueue: [] }),

      clearQueue: () => {
        set({ queue: [], userQueue: [], currentIndex: -1, currentTrack: null, isPlaying: false });
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

      setShowLyricsFullscreen: (show) =>
        set((state) => ({
          showLyricsFullscreen: show,
          activeTab: !show && state.activeTab === 'lyrics' ? 'library' : state.activeTab,
        })),

      setLrclibAutoFetch: (enabled) => set({ lrclibAutoFetch: enabled }),

      toggleRomanization: () => set((state) => ({ isRomanizationEnabled: !state.isRomanizationEnabled })),

      setRomanizationMode: (mode) => set({ romanizationMode: mode }),

      toggleShowAudioSpecs: () => set((state) => ({ showAudioSpecs: !state.showAudioSpecs })),

      toggleAutoHideLyricsControls: () => set((state) => ({ autoHideLyricsControls: !state.autoHideLyricsControls })),

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

      wipeDataAndReset: async () => {
        set({
          tracks: [],
          queue: [],
          userQueue: [],
          currentIndex: -1,
          currentTrack: null,
          isPlaying: false,
          currentTime: 0,
          duration: 0,
          likedTrackIds: [],
          includedDirectories: [],
          excludedDirectories: [],
          searchQuery: '',
          sleepTimer: {
            active: false,
            mode: 'time',
            remainingSeconds: 0,
            remainingTracks: 0,
          },
        });
        try {
          if (window.__TAURI_INTERNALS__) {
            await invoke('save_library', { tracks: [] });
            await invoke('pause_audio');
          }
        } catch (e) {
          console.warn('Wipe data error:', e);
        }
      },
    }),
    {
      name: 'prism-music-player-store',
      partialize: (state) => ({
        likedTrackIds: state.likedTrackIds,
        volume: state.volume,
        showAudioSpecs: state.showAudioSpecs,
        isRomanizationEnabled: state.isRomanizationEnabled,
        romanizationMode: state.romanizationMode,
        autoHideLyricsControls: state.autoHideLyricsControls,
        lrclibAutoFetch: state.lrclibAutoFetch,
        includedDirectories: state.includedDirectories,
        excludedDirectories: state.excludedDirectories,
        queue: state.queue,
        userQueue: state.userQueue,
        currentIndex: state.currentIndex,
        currentTrack: state.currentTrack,
      }),
    }
  )
);
