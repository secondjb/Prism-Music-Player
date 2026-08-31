import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Track, ActiveTab, SleepTimer, RepeatMode, Playlist } from '../types/player';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export type TrackColumnId =
  | 'order'
  | 'art'
  | 'title'
  | 'artist'
  | 'album'
  | 'date'
  | 'genre'
  | 'duration'
  | 'favorite'
  | 'playNext'
  | 'addToQueue'
  | 'actions';

export type TrackGridDensity = 'compact' | 'normal' | 'large' | 'extra-large' | 'huge' | 'massive';

interface PlayerState {
  audioAnalysisProgress: { current: number; total: number } | null;
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
  preferOnlineLyrics: boolean;
  isRomanizationEnabled: boolean;
  romanizationMode: 'below' | 'replace';
  showAudioSpecs: boolean;
  showAudioSpecsInLibrary: boolean;
  autoHideLyricsControls: boolean;
  includedDirectories: string[];
  excludedDirectories: string[];
  isScanning: boolean;
  scanStatusMessage: string | null;
  infoModalTrack: Track | null;
  lyricsFontSizePreset: 'normal' | 'balanced' | 'large' | 'maximum' | 'manual';
  lyricsFontSize: number;
  lyricsArtScale: number;
  isStatsCollectionEnabled: boolean;

  // Track Grid View Customization
  visibleTrackColumns: TrackColumnId[];
  trackGridDensity: TrackGridDensity;

  // Shuffle & Repeat
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
  shuffleHistory: number[];
  originalQueue: Track[];

  // Playlists
  playlists: Playlist[];
  activePlaylistId: string | null;

  // Library folder actions
  addIncludedDirectory: (dir: string) => Promise<void>;
  removeIncludedDirectory: (dir: string) => Promise<void>;
  addExcludedDirectory: (dir: string) => Promise<void>;
  removeExcludedDirectory: (dir: string) => Promise<void>;
  rescanConfiguredLibraries: () => Promise<void>;
  analyzeAndIndexAudio: () => Promise<void>;
  setScanStatusMessage: (msg: string | null) => void;

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
  reorderContextQueue: (fromOffset: number, toOffset: number) => void;
  clearUserQueue: () => void;
  clearQueue: () => void;
  setQueue: (queue: Track[]) => void;
  toggleLikeTrack: (trackId: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setSearchQuery: (query: string) => void;
  setShowLyricsFullscreen: (show: boolean) => void;
  setLrclibAutoFetch: (enabled: boolean) => void;
  setPreferOnlineLyrics: (enabled: boolean) => void;
  toggleRomanization: () => void;
  setRomanizationMode: (mode: 'below' | 'replace') => void;
  toggleShowAudioSpecs: () => void;
  toggleShowAudioSpecsInLibrary: () => void;
  setInfoModalTrack: (track: Track | null) => void;
  setLyricsFontSizePreset: (preset: 'normal' | 'balanced' | 'large' | 'maximum' | 'manual') => void;
  setLyricsFontSize: (size: number) => void;
  setLyricsArtScale: (scale: number) => void;
  toggleAutoHideLyricsControls: () => void;
  toggleStatsCollection: () => void;
  setVisibleTrackColumns: (cols: TrackColumnId[]) => void;
  toggleTrackColumn: (col: TrackColumnId) => void;
  setTrackGridDensity: (density: TrackGridDensity) => void;
  columnOrder: TrackColumnId[];
  setColumnOrder: (order: TrackColumnId[]) => void;
  showSubArtistUnderTitle: boolean;
  setShowSubArtistUnderTitle: (show: boolean) => void;

  // Shuffle & Repeat actions
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;

  // Playlist actions
  createPlaylist: (name: string) => void;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  addTrackToPlaylist: (playlistId: string, trackId: string) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  reorderPlaylistTracks: (playlistId: string, fromIdx: number, toIdx: number) => void;
  setActivePlaylistId: (id: string | null) => void;
  playPlaylistNext: (playlistId: string) => void;
  addPlaylistToQueue: (playlistId: string) => void;

  // Reset & Wipe Action
  wipeDataAndReset: () => Promise<void>;

  // Sleep timer actions
  startSleepTimer: (mode: 'time' | 'tracks', value: number) => void;
  cancelSleepTimer: () => void;
  tickSleepTimerSecond: () => void;
  onTrackFinished: () => void;
}

export const normalizePath = (dir: string): string => {
  if (!dir) return '';
  let path = dir.trim();
  try {
    path = decodeURIComponent(path);
  } catch (e) {
    // Ignore decode error
  }
  if (path.includes('primary:')) {
    const relative = path.split('primary:')[1]?.replace(/^\/+/, '') || '';
    return relative ? `/storage/emulated/0/${relative}` : '/storage/emulated/0';
  }
  if (path.includes('raw:')) {
    return path.split('raw:')[1] || path;
  }
  return path;
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      audioAnalysisProgress: null,
      tracks: [],
      queue: [],
      userQueue: [],
      currentIndex: -1,
      currentTrack: null,
      isPlaying: false,
      volume: 0.8,
      currentTime: 0,
      duration: 0,
      activeTab: 'home',
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
      preferOnlineLyrics: false,
      isRomanizationEnabled: true,
      romanizationMode: 'below',
      showAudioSpecs: true,
      showAudioSpecsInLibrary: false,
      autoHideLyricsControls: true,
      includedDirectories: [],
      excludedDirectories: [],
      isScanning: false,
      scanStatusMessage: null,
      infoModalTrack: null,
      lyricsFontSizePreset: 'normal',
      lyricsFontSize: 24,
      lyricsArtScale: 100,
      isStatsCollectionEnabled: false,

      // Track Grid View Customization
      visibleTrackColumns: [
        'order',
        'art',
        'title',
        'artist',
        'album',
        'duration',
        'favorite',
        'playNext',
        'addToQueue',
        'actions',
      ],
      trackGridDensity: 'normal',

      setVisibleTrackColumns: (cols) => set({ visibleTrackColumns: cols }),
      toggleTrackColumn: (col) =>
        set((state) => {
          const exists = state.visibleTrackColumns.includes(col);
          const updated = exists
            ? state.visibleTrackColumns.filter((c) => c !== col)
            : [...state.visibleTrackColumns, col];
          return { visibleTrackColumns: updated };
        }),
      setTrackGridDensity: (density) => set({ trackGridDensity: density }),

      columnOrder: [
        'order',
        'art',
        'title',
        'artist',
        'album',
        'date',
        'genre',
        'duration',
        'favorite',
        'playNext',
        'addToQueue',
        'actions',
      ],
      setColumnOrder: (order) => set({ columnOrder: order }),

      showSubArtistUnderTitle: true,
      setShowSubArtistUnderTitle: (show) => set({ showSubArtistUnderTitle: show }),

      // Shuffle & Repeat
      shuffleEnabled: false,
      repeatMode: 'off',
      shuffleHistory: [],
      originalQueue: [],

      // Playlists
      playlists: [],
      activePlaylistId: null,

      setScanStatusMessage: (msg) => set({ scanStatusMessage: msg }),

      addIncludedDirectory: async (dir) => {
        const normalized = normalizePath(dir);
        const { includedDirectories, rescanConfiguredLibraries } = get();
        if (!includedDirectories.includes(normalized)) {
          const updated = [...includedDirectories, normalized];
          set({ includedDirectories: updated });
          await rescanConfiguredLibraries();
        } else {
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
        const normalized = normalizePath(dir);
        const { excludedDirectories, rescanConfiguredLibraries } = get();
        if (!excludedDirectories.includes(normalized)) {
          const updated = [...excludedDirectories, normalized];
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
        if (includedDirectories.length === 0) {
          set({ isScanning: false, scanStatusMessage: 'No music folders configured yet.' });
          return;
        }

        set({
          isScanning: true,
          scanStatusMessage: `Indexing ${includedDirectories.length} directory path(s)...`,
        });

        try {
          if (window.__TAURI_INTERNALS__) {
            const scannedTracks: Track[] = await invoke('scan_libraries', {
              includedDirs: includedDirectories,
              excludedDirs: excludedDirectories,
            });
            setTracks(scannedTracks);

            if (scannedTracks.length === 0) {
              set({
                isScanning: false,
                scanStatusMessage: `Scan completed: Found 0 audio files. Please ensure your folder contains supported audio files (MP3, FLAC, M4A, WAV, OGG, AAC, AIFF).`,
              });
            } else {
              set({
                isScanning: false,
                scanStatusMessage: `Success! Loaded ${scannedTracks.length} tracks into library.`,
              });
            }

            // Run background audio waveform analysis to detect missing Key & BPM
            const analyzedTracks: Track[] = await invoke('analyze_library_audio');
            setTracks(analyzedTracks);
          } else {
            set({
              isScanning: false,
              scanStatusMessage: 'Running in standard web mode (Tauri filesystem APIs unavailable).',
            });
          }
        } catch (e: any) {
          console.warn('Rescan libraries error:', e);
          set({
            isScanning: false,
            scanStatusMessage: `Folder scan warning: ${e?.message || String(e)}`,
          });
        }
      },

      analyzeAndIndexAudio: async () => {
        try {
          if (window.__TAURI_INTERNALS__) {
            await invoke('analyze_library_audio');
          }
        } catch (e) {
          console.warn('Audio analysis error:', e);
        }
      },

      setTracks: (tracks) => set({ tracks }),

      playTrack: async (track, contextTracks) => {
        const { shuffleEnabled } = get();
        let baseQueue = contextTracks && contextTracks.length > 0 ? [...contextTracks] : [track];
        let index = baseQueue.findIndex((t) => t.id === track.id);
        if (index === -1) {
          baseQueue = [track, ...baseQueue];
          index = 0;
        }

        let newQueue = baseQueue;
        let finalIndex = index;
        let savedOriginal = baseQueue;

        if (shuffleEnabled) {
          const remaining = baseQueue.filter((_, i) => i !== index);
          for (let i = remaining.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
          }
          newQueue = [track, ...remaining];
          finalIndex = 0;
        }

        set({
          originalQueue: savedOriginal,
          queue: newQueue,
          currentIndex: finalIndex,
          currentTrack: track,
          duration: track.duration_secs,
          currentTime: 0,
          isPlaying: true,
        });
        try {
          if (window.__TAURI_INTERNALS__) {
            await invoke('set_volume', { volume: get().volume });
            await invoke('play_audio', { path: track.path, replayGainDb: track.replay_gain_db || 0 });
          }
        } catch (e) {
          console.warn('Rust play_audio error:', e);
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
            if (window.__TAURI_INTERNALS__) {
              await invoke('set_volume', { volume: get().volume });
              await invoke('play_audio', { path: track.path, replayGainDb: track.replay_gain_db || 0 });
            }
          } catch (e) {
            console.warn('Rust play_audio call pending:', e);
          }
        }
      },

      togglePlay: async () => {
        const { isPlaying, currentTrack, currentTime, queue, playIndex } = get();
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
            if (window.__TAURI_INTERNALS__) {
              await invoke('set_volume', { volume: get().volume });
              await invoke('play_audio', {
                path: currentTrack.path,
                replayGainDb: currentTrack.replay_gain_db || 0,
                startPositionSecs: currentTime > 0 ? currentTime : null,
              });
            }
          } else {
            if (window.__TAURI_INTERNALS__) {
              await invoke('pause_audio');
            }
          }
        } catch (e) {
          console.warn('Rust audio toggle call error:', e);
        }
      },

      pause: async () => {
        set({ isPlaying: false });
        try {
          if (window.__TAURI_INTERNALS__) {
            await invoke('pause_audio');
          }
        } catch (e) {
          console.warn('Rust pause_audio error:', e);
        }
      },

      resume: async () => {
        const { currentTrack, queue, playIndex } = get();
        if (!currentTrack) {
          if (queue.length > 0) {
            playIndex(0);
          }
          return;
        }
        set({ isPlaying: true });
        try {
          if (window.__TAURI_INTERNALS__) {
            await invoke('set_volume', { volume: get().volume });
            await invoke('resume_audio');
          }
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
        const { userQueue, currentIndex, queue, repeatMode, playIndex, seek, onTrackFinished } = get();
        onTrackFinished();

        // Repeat One: replay current track
        if (repeatMode === 'one') {
          seek(0);
          set({ isPlaying: true });
          try {
            await invoke('seek_audio', { positionSecs: 0 });
            await invoke('resume_audio');
          } catch (e) {
            console.warn('Rust seek error:', e);
          }
          return;
        }

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

        const nextIdx = currentIndex + 1;
        if (nextIdx >= queue.length) {
          if (repeatMode === 'all') {
            playIndex(0);
          } else {
            // repeatMode === 'off': stop at end
            set({ isPlaying: false });
            try {
              await invoke('pause_audio');
            } catch (e) {
              console.warn('Rust pause error:', e);
            }
          }
        } else {
          playIndex(nextIdx);
        }
      },

      previousTrack: () => {
        const { currentIndex, queue, currentTime, seek, playIndex, shuffleEnabled, shuffleHistory } = get();
        if (currentTime > 3) {
          seek(0);
          return;
        }
        if (queue.length === 0) return;

        if (shuffleEnabled && shuffleHistory.length > 1) {
          // Go back in shuffle history
          const newHistory = [...shuffleHistory];
          newHistory.pop(); // Remove current
          const prevIdx = newHistory[newHistory.length - 1];
          set({ shuffleHistory: newHistory });
          playIndex(prevIdx);
          return;
        }

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
          const finalIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
          newUserQueue.splice(finalIndex, 0, moved);
          return { userQueue: newUserQueue };
        });
      },

      reorderContextQueue: (fromOffset, toOffset) => {
        const { queue, currentIndex } = get();
        const absoluteFrom = currentIndex + 1 + fromOffset;
        const absoluteTo = currentIndex + 1 + toOffset;
        if (
          absoluteFrom < 0 ||
          absoluteFrom >= queue.length ||
          absoluteTo < 0 ||
          absoluteTo >= queue.length
        ) {
          return;
        }
        const updated = [...queue];
        const [moved] = updated.splice(absoluteFrom, 1);
        const finalIndex = absoluteFrom < absoluteTo ? absoluteTo - 1 : absoluteTo;
        updated.splice(finalIndex, 0, moved);
        set({ queue: updated });
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

      setActiveTab: (tab) => set({ activeTab: tab, infoModalTrack: null }),

      setSearchQuery: (query) => set({ searchQuery: query }),

      setShowLyricsFullscreen: (show) =>
        set((state) => ({
          showLyricsFullscreen: show,
          activeTab: !show && state.activeTab === 'lyrics' ? 'library' : state.activeTab,
        })),

      setLrclibAutoFetch: (enabled) => set({ lrclibAutoFetch: enabled }),
      setPreferOnlineLyrics: (enabled) => set({ preferOnlineLyrics: enabled }),

      toggleRomanization: () => set((state) => ({ isRomanizationEnabled: !state.isRomanizationEnabled })),
      setRomanizationMode: (mode) => set({ romanizationMode: mode }),

      toggleShowAudioSpecs: () => set((state) => ({ showAudioSpecs: !state.showAudioSpecs })),

      toggleShowAudioSpecsInLibrary: () =>
        set((state) => ({ showAudioSpecsInLibrary: !state.showAudioSpecsInLibrary })),

      setInfoModalTrack: (track) => set({ infoModalTrack: track }),
      setLyricsFontSizePreset: (preset) => set({ lyricsFontSizePreset: preset }),
      setLyricsFontSize: (size) => set({ lyricsFontSize: size }),
      setLyricsArtScale: (scale) => set({ lyricsArtScale: scale }),

      toggleAutoHideLyricsControls: () => set((state) => ({ autoHideLyricsControls: !state.autoHideLyricsControls })),

      toggleStatsCollection: () => set((state) => ({ isStatsCollectionEnabled: !state.isStatsCollectionEnabled })),

      // Shuffle & Repeat
      toggleShuffle: () =>
        set((state) => {
          const newShuffle = !state.shuffleEnabled;
          if (newShuffle) {
            const currentObj = state.currentTrack;
            const sourceQueue = state.queue.length > 0 ? state.queue : state.tracks;
            const remaining = sourceQueue.filter((t) => t.id !== currentObj?.id);
            for (let i = remaining.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
            }
            const shuffledQueue = currentObj ? [currentObj, ...remaining] : remaining;
            return {
              shuffleEnabled: true,
              originalQueue: [...sourceQueue],
              queue: shuffledQueue,
              currentIndex: 0,
            };
          } else {
            const orig = state.originalQueue.length > 0 ? state.originalQueue : state.queue;
            const restoredIdx = state.currentTrack
              ? orig.findIndex((t) => t.id === state.currentTrack?.id)
              : 0;
            return {
              shuffleEnabled: false,
              queue: orig,
              currentIndex: restoredIdx >= 0 ? restoredIdx : 0,
              originalQueue: [],
            };
          }
        }),

      cycleRepeatMode: () =>
        set((state) => {
          const modes: RepeatMode[] = ['off', 'all', 'one'];
          const currentIdx = modes.indexOf(state.repeatMode);
          const nextMode = modes[(currentIdx + 1) % modes.length];
          return { repeatMode: nextMode };
        }),

      // Playlist actions
      createPlaylist: (name) => {
        const id = `pl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((state) => ({
          playlists: [...state.playlists, { id, name, trackIds: [], createdAt: Date.now() }],
        }));
      },

      deletePlaylist: (id) => {
        set((state) => ({
          playlists: state.playlists.filter((p) => p.id !== id),
          activePlaylistId: state.activePlaylistId === id ? null : state.activePlaylistId,
        }));
      },

      renamePlaylist: (id, name) => {
        set((state) => ({
          playlists: state.playlists.map((p) => (p.id === id ? { ...p, name } : p)),
        }));
      },

      addTrackToPlaylist: (playlistId, trackId) => {
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === playlistId && !p.trackIds.includes(trackId)
              ? { ...p, trackIds: [...p.trackIds, trackId] }
              : p
          ),
        }));
      },

      removeTrackFromPlaylist: (playlistId, trackId) => {
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === playlistId
              ? { ...p, trackIds: p.trackIds.filter((id) => id !== trackId) }
              : p
          ),
        }));
      },

      reorderPlaylistTracks: (playlistId, fromIdx, toIdx) => {
        set((state) => ({
          playlists: state.playlists.map((p) => {
            if (p.id !== playlistId) return p;
            const newTrackIds = [...p.trackIds];
            const [moved] = newTrackIds.splice(fromIdx, 1);
            newTrackIds.splice(toIdx, 0, moved);
            return { ...p, trackIds: newTrackIds };
          }),
        }));
      },

      setActivePlaylistId: (id) => set({ activePlaylistId: id }),

      playPlaylistNext: (playlistId) => {
        const { tracks, playlists, likedTrackIds, currentTrack, playTrack } = get();
        let targetTracks: Track[] = [];
        if (playlistId === '__liked__' || playlistId === 'liked') {
          targetTracks = tracks.filter((t) => likedTrackIds.includes(t.id));
        } else {
          const pl = playlists.find((p) => p.id === playlistId);
          if (pl) {
            targetTracks = pl.trackIds
              .map((tid) => tracks.find((t) => t.id === tid))
              .filter((t): t is Track => Boolean(t));
          }
        }
        if (targetTracks.length === 0) return;

        if (!currentTrack) {
          playTrack(targetTracks[0], targetTracks);
          return;
        }

        const existingIndex = targetTracks.findIndex((t) => t.id === currentTrack.id);
        if (existingIndex !== -1) {
          set({
            queue: targetTracks,
            originalQueue: targetTracks,
            currentIndex: existingIndex,
          });
        } else {
          const newQueue = [currentTrack, ...targetTracks];
          set({
            queue: newQueue,
            originalQueue: newQueue,
            currentIndex: 0,
          });
        }
      },

      addPlaylistToQueue: (playlistId) => {
        const { tracks, playlists, likedTrackIds, currentTrack, playTrack } = get();
        let targetTracks: Track[] = [];
        if (playlistId === '__liked__' || playlistId === 'liked') {
          targetTracks = tracks.filter((t) => likedTrackIds.includes(t.id));
        } else {
          const pl = playlists.find((p) => p.id === playlistId);
          if (pl) {
            targetTracks = pl.trackIds
              .map((tid) => tracks.find((t) => t.id === tid))
              .filter((t): t is Track => Boolean(t));
          }
        }
        if (targetTracks.length === 0) return;

        if (!currentTrack) {
          playTrack(targetTracks[0], targetTracks);
        } else {
          set((state) => ({
            userQueue: [...state.userQueue, ...targetTracks],
          }));
        }
      },

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
          playlists: [],
          activePlaylistId: null,
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
        showAudioSpecsInLibrary: state.showAudioSpecsInLibrary,
        isRomanizationEnabled: state.isRomanizationEnabled,
        romanizationMode: state.romanizationMode,
        autoHideLyricsControls: state.autoHideLyricsControls,
        isStatsCollectionEnabled: state.isStatsCollectionEnabled,
        lrclibAutoFetch: state.lrclibAutoFetch,
        preferOnlineLyrics: state.preferOnlineLyrics,
        lyricsFontSizePreset: state.lyricsFontSizePreset,
        lyricsFontSize: state.lyricsFontSize,
        lyricsArtScale: state.lyricsArtScale,
        includedDirectories: state.includedDirectories,
        excludedDirectories: state.excludedDirectories,
        queue: state.queue,
        userQueue: state.userQueue,
        currentIndex: state.currentIndex,
        currentTrack: state.currentTrack,
        shuffleEnabled: state.shuffleEnabled,
        repeatMode: state.repeatMode,
        playlists: state.playlists,
      }),
    }
  )
);

if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
  listen<{ current: number; total: number; track_id: string; bpm?: number; key?: string }>(
    'audio_analysis_progress',
    (e) => {
      const { current, total, track_id, bpm, key } = e.payload;
      const store = usePlayerStore.getState();
      const updated = store.tracks.map((t) =>
        t.id === track_id
          ? {
              ...t,
              ...(bpm !== undefined ? { bpm } : {}),
              ...(key !== undefined ? { key } : {}),
            }
          : t
      );
      usePlayerStore.setState({
        tracks: updated,
        audioAnalysisProgress: { current, total },
      });
    }
  );

  listen<Track[]>('audio_analysis_completed', (e) => {
    if (Array.isArray(e.payload) && e.payload.length > 0) {
      usePlayerStore.setState({
        tracks: e.payload,
        audioAnalysisProgress: null,
      });
    } else {
      usePlayerStore.setState({ audioAnalysisProgress: null });
    }
  });
}
