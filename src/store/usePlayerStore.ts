import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Track, ActiveTab, SleepTimer, RepeatMode, Playlist, RefreshLibraryResult, BackgroundType, LyricsLayoutMode, LyricsArtSize } from '../types/player';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { fetchLatestRelease, UpdateCheckResult } from '../utils/updateChecker';

export type TrackColumnId =
  | 'order'
  | 'art'
  | 'title'
  | 'artist'
  | 'album'
  | 'date'
  | 'genre'
  | 'duration'
  | 'bitrate'
  | 'sampleRate'
  | 'bitDepth'
  | 'favorite'
  | 'addToQueue'
  | 'playNext'
  | 'addToPlaylist'
  | 'actions';

export type TrackGridDensity = 'compact' | 'normal' | 'large' | 'extra-large' | 'huge' | 'massive';

export type ReplayGainMode = 'track' | 'album' | 'off';

export function getEffectiveReplayGain(
  track?: Track | null,
  mode: ReplayGainMode = 'track',
  allTracks?: Track[]
): number {
  if (!track || mode === 'off') return 0;

  // If track object lacks replay gain properties, attempt lookup in allTracks
  let effectiveTrack = track;
  if (
    effectiveTrack.replay_gain_db == null &&
    effectiveTrack.replay_gain_album_db == null &&
    allTracks &&
    allTracks.length > 0
  ) {
    const found = allTracks.find((t) => t.id === track.id || t.path === track.path);
    if (found) effectiveTrack = found;
  }

  if (mode === 'album') {
    if (typeof effectiveTrack.replay_gain_album_db === 'number') return effectiveTrack.replay_gain_album_db;
    if (typeof effectiveTrack.replay_gain_db === 'number') return effectiveTrack.replay_gain_db;
    return 0;
  }
  return typeof effectiveTrack.replay_gain_db === 'number' ? effectiveTrack.replay_gain_db : 0;
}

export function getLinkedChainTracks(
  trackId: string,
  linkedTracks: Record<string, string[]> = {},
  allTracks: Track[] = []
): Track[] {
  if (!trackId) return [];
  const trackMap = new Map<string, Track>();
  allTracks.forEach((t) => trackMap.set(t.id, t));

  const targetTrack = trackMap.get(trackId);
  if (!targetTrack) return [];

  // Build predecessor lookup
  const predMap = new Map<string, string>();
  for (const [src, targets] of Object.entries(linkedTracks)) {
    if (Array.isArray(targets)) {
      for (const tgt of targets) {
        if (!predMap.has(tgt)) {
          predMap.set(tgt, src);
        }
      }
    }
  }

  // Walk backwards to find head
  let headId = trackId;
  const backVisited = new Set<string>([headId]);
  while (predMap.has(headId)) {
    const parentId = predMap.get(headId)!;
    if (backVisited.has(parentId)) break; // cycle guard
    backVisited.add(parentId);
    headId = parentId;
  }

  // Walk forwards from head
  const chain: Track[] = [];
  const fwdVisited = new Set<string>();
  let currId: string | undefined = headId;

  while (currId && !fwdVisited.has(currId)) {
    fwdVisited.add(currId);
    const trk = trackMap.get(currId);
    if (trk) {
      chain.push(trk);
    }
    const nextList: string[] = (currId ? linkedTracks[currId] : []) || [];
    let nextId: string | undefined = undefined;
    for (const nid of nextList) {
      if (!fwdVisited.has(nid) && trackMap.has(nid)) {
        nextId = nid;
        break;
      }
    }
    currId = nextId;
  }

  return chain.length > 0 ? chain : [targetTrack];
}

export function clusterQueueWithLinks(tracks: Track[], linkedTracks: Record<string, string[]> = {}): Track[] {
  if (!tracks || tracks.length === 0) return [];
  const trackIdSet = new Set(tracks.map((t) => t.id));
  const trackMap = new Map<string, Track>();
  tracks.forEach((t) => trackMap.set(t.id, t));

  // Determine which tracks in this queue have an incoming link from another track in the queue
  const hasIncomingLink = new Set<string>();
  for (const [srcId, targetIds] of Object.entries(linkedTracks)) {
    if (trackIdSet.has(srcId)) {
      for (const tgtId of targetIds) {
        if (trackIdSet.has(tgtId)) {
          hasIncomingLink.add(tgtId);
        }
      }
    }
  }

  const result: Track[] = [];
  const added = new Set<string>();

  for (const t of tracks) {
    if (added.has(t.id)) continue;

    // If this track has an incoming link from another track in the queue that hasn't been added yet,
    // skip it for now - it will be pulled right after its parent!
    if (hasIncomingLink.has(t.id)) {
      continue;
    }

    // Traverse chain starting at t
    let curr: Track | undefined = t;
    while (curr && !added.has(curr.id)) {
      result.push(curr);
      added.add(curr.id);

      const nextIds = linkedTracks[curr.id] || [];
      let nextTrack: Track | undefined = undefined;
      for (const nid of nextIds) {
        if (trackIdSet.has(nid) && !added.has(nid)) {
          nextTrack = trackMap.get(nid);
          break;
        }
      }
      curr = nextTrack;
    }
  }

  // Fallback pass to add any remaining tracks (e.g. isolated cycles)
  for (const t of tracks) {
    if (!added.has(t.id)) {
      result.push(t);
      added.add(t.id);
    }
  }

  return result;
}

export function groupLinkedTracks(tracks: Track[], linkedTracks: Record<string, string[]> = {}): Track[][] {
  const clustered = clusterQueueWithLinks(tracks, linkedTracks);
  const clusters: Track[][] = [];
  const processed = new Set<string>();
  const trackMap = new Map<string, Track>();
  clustered.forEach((t) => trackMap.set(t.id, t));

  for (const t of clustered) {
    if (processed.has(t.id)) continue;
    const cluster: Track[] = [t];
    processed.add(t.id);

    let currId = t.id;
    while (linkedTracks[currId] && linkedTracks[currId].length > 0) {
      let nextFound = false;
      for (const nextId of linkedTracks[currId]) {
        if (!processed.has(nextId) && trackMap.has(nextId)) {
          cluster.push(trackMap.get(nextId)!);
          processed.add(nextId);
          currId = nextId;
          nextFound = true;
          break;
        }
      }
      if (!nextFound) break;
    }
    clusters.push(cluster);
  }
  return clusters;
}

export function shuffleLinkedClusters(clusters: Track[][], currentTrackId?: string): Track[] {
  let currentCluster: Track[] | null = null;
  const remainingClusters: Track[][] = [];

  for (const cluster of clusters) {
    if (currentTrackId && cluster.some((t) => t.id === currentTrackId)) {
      currentCluster = cluster;
    } else {
      remainingClusters.push(cluster);
    }
  }

  for (let i = remainingClusters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remainingClusters[i], remainingClusters[j]] = [remainingClusters[j], remainingClusters[i]];
  }

  const finalClusters = currentCluster ? [currentCluster, ...remainingClusters] : remainingClusters;
  return finalClusters.flat();
}

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
  lastSeekTime?: number;
  lastSeekTarget?: number;
  duration: number;
  activeTab: ActiveTab;
  searchQuery: string;
  crossfadeDuration: number;
  setCrossfadeDuration: (dur: number) => void;
  isGaplessEnabled: boolean;
  toggleGaplessEnabled: () => void;
  replayGainMode: ReplayGainMode;
  setReplayGainMode: (mode: ReplayGainMode) => void;
  backgroundType: BackgroundType;
  customBgPath: string | null;
  customBgColor: string;
  bgBlurAmount: number;
  bgDimOpacity: number;
  setBackgroundType: (type: BackgroundType) => void;
  setCustomBgPath: (path: string | null) => void;
  setCustomBgColor: (color: string) => void;
  setBgBlurAmount: (blur: number) => void;
  setBgDimOpacity: (opacity: number) => void;
  lyricsLayoutMode: LyricsLayoutMode;
  setLyricsLayoutMode: (mode: LyricsLayoutMode) => void;
  lyricsArtSize: LyricsArtSize;
  setLyricsArtSize: (size: LyricsArtSize) => void;
  linkedTracks: Record<string, string[]>;
  linkTracks: (primaryId: string, nextId: string) => void;
  removeLink: (sourceId: string, targetId: string) => void;
  reverseLinkOrder: (trackAId: string, trackBId: string) => void;
  unlinkTrack: (trackId: string) => void;
  isTrackLinked: (trackId: string) => boolean;
  reorderLinkedChain: (orderedTrackIds: string[]) => void;
  addTrackToChain: (
    anchorTrackId: string,
    newTrackId: string,
    position?: 'start' | 'end' | 'before' | 'after'
  ) => void;
  removeTrackFromChain: (trackId: string) => void;
  reverseChain: (trackId: string) => void;
  unlinkChain: (trackId: string) => void;
  playLinkedSuite: (trackId: string) => void;
  linkModalTrack: Track | null;
  setLinkModalTrack: (track: Track | null) => void;
  likedTrackIds: string[];
  sleepTimer: SleepTimer;
  showLyricsFullscreen: boolean;
  isQueueOpen: boolean;
  lrclibAutoFetch: boolean;
  preferOnlineLyrics: boolean;
  isRomanizationEnabled: boolean;
  romanizationMode: 'below' | 'replace';
  isTranslationEnabled: boolean;
  translationMode: 'below' | 'replace';
  targetTranslationLanguage: string;
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
  lyricsFontFamily: string;
  lyricsAnimationStyle:
    | 'apple_fluid'
    | 'karaoke_pulse'
    | 'kinetic_slide'
    | 'cinematic_blur'
    | 'lossless_glow'
    | 'card_pop'
    | 'apple_zoom'
    | 'minimal_wave';
  isWavySeekbarEnabled: boolean;
  autoEmbedLyrics: boolean;
  preferWordSyncedLyrics: boolean;
  inferWordSyncedLyrics: boolean;
  toggleInferWordSyncedLyrics: () => void;
  isStatsCollectionEnabled: boolean;
  showDemoStats: boolean;
  anonymizeStats: boolean;

  // App Updates
  autoCheckUpdates: boolean;
  latestUpdateResult: UpdateCheckResult | null;
  isCheckingUpdate: boolean;
  toggleAutoCheckUpdates: () => void;
  checkAppUpdate: (manual?: boolean) => Promise<UpdateCheckResult | null>;

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

  // Track Multi-Selection
  selectedTrackIds: string[];
  lastSelectedTrackId: string | null;
  setSelectedTrackIds: (ids: string[]) => void;
  selectSingleTrack: (trackId: string) => void;
  toggleSelectTrack: (trackId: string) => void;
  selectTrackRange: (targetTrackId: string, currentTrackList: Track[], isAdditive?: boolean) => void;
  selectAllTracks: (tracks: Track[]) => void;
  clearSelection: () => void;

  // Batch actions
  addTracksToQueue: (tracks: Track[]) => void;
  playNextTracks: (tracks: Track[]) => void;
  likeMultipleTracks: (trackIds: string[], like: boolean) => void;
  removeTracksFromPlaylist: (playlistId: string, trackIds: string[]) => void;

  // Library folder actions
  addIncludedDirectory: (dir: string) => Promise<void>;
  removeIncludedDirectory: (dir: string) => Promise<void>;
  addExcludedDirectory: (dir: string) => Promise<void>;
  removeExcludedDirectory: (dir: string) => Promise<void>;
  rescanConfiguredLibraries: () => Promise<void>;
  refreshConfiguredLibraries: () => Promise<RefreshLibraryResult | null>;
  purgeMissingTracks: () => Promise<void>;
  isRefreshingLibrary: boolean;
  lastRefreshResult: RefreshLibraryResult | null;
  analyzeAndIndexAudio: () => Promise<void>;
  clearAudioAnalysis: () => Promise<void>;
  setScanStatusMessage: (msg: string | null) => void;
  isScanningReplayGain: boolean;
  replayGainScanProgress: { current: number; total: number; path: string; isFinished?: boolean } | null;
  startReplayGainScan: (options?: { untaggedOnly?: boolean; writeToFiles?: boolean }) => Promise<void>;
  cancelReplayGainScan: () => Promise<void>;
  setReplayGainScanProgress: (progress: { current: number; total: number; path: string; isFinished?: boolean } | null) => void;
  updateTrackReplayGain: (path: string, gain_db?: number | null, peak?: number | null) => void;

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
  replayCurrentTrack: () => Promise<void>;
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
  toggleTranslation: () => void;
  setTranslationMode: (mode: 'below' | 'replace') => void;
  setTargetTranslationLanguage: (lang: string) => void;
  toggleShowAudioSpecs: () => void;
  toggleShowAudioSpecsInLibrary: () => void;
  setInfoModalTrack: (track: Track | null) => void;
  setLyricsFontSizePreset: (preset: 'normal' | 'balanced' | 'large' | 'maximum' | 'manual') => void;
  setLyricsFontSize: (size: number) => void;
  setLyricsArtScale: (scale: number) => void;
  setLyricsFontFamily: (font: string) => void;
  setLyricsAnimationStyle: (
    style:
      | 'apple_fluid'
      | 'karaoke_pulse'
      | 'kinetic_slide'
      | 'cinematic_blur'
      | 'lossless_glow'
      | 'card_pop'
      | 'apple_zoom'
      | 'minimal_wave'
  ) => void;
  toggleWavySeekbar: () => void;
  toggleAutoEmbedLyrics: () => void;
  togglePreferWordSyncedLyrics: () => void;
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
  addTracksToPlaylist: (playlistId: string, trackIds: string[]) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  reorderPlaylistTracks: (playlistId: string, fromIdx: number, toIdx: number) => void;
  setActivePlaylistId: (id: string | null) => void;
  playPlaylistNext: (playlistId: string) => void;
  addPlaylistToQueue: (playlistId: string) => void;
  generateDemoPlaylists: () => void;
  toggleShowDemoStats: () => void;
  toggleAnonymizeStats: () => void;

  // Reset & Wipe Action
  wipeDataAndReset: () => Promise<void>;

  // Sleep timer actions
  startSleepTimer: (mode: 'time' | 'tracks', value: number) => void;
  cancelSleepTimer: () => void;
  tickSleepTimerSecond: () => void;
  onTrackFinished: () => void;

  selectedArtist: string | null;
  selectedAlbum: string | null;
  navigateToArtist: (artist: string) => void;
  navigateToAlbum: (album: string) => void;
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

let lastVolumeInvokeTime = 0;
let pendingVolumeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingVolumeVal: number | null = null;

const sendThrottledVolume = (vol: number) => {
  const now = performance.now();
  pendingVolumeVal = vol;
  if (now - lastVolumeInvokeTime >= 16) {
    lastVolumeInvokeTime = now;
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      invoke('set_volume', { volume: vol }).catch(() => {});
    }
  } else if (!pendingVolumeTimer) {
    pendingVolumeTimer = setTimeout(() => {
      pendingVolumeTimer = null;
      lastVolumeInvokeTime = performance.now();
      if (pendingVolumeVal !== null && typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
        invoke('set_volume', { volume: pendingVolumeVal }).catch(() => {});
      }
    }, 16);
  }
};

/**
 * Strip heavy binary and string payloads (unsynced_lyrics and embedded_art_base64)
 * before serializing to localStorage to prevent exceeding the browser's 5MB origin quota.
 */
export const sanitizeTrackForStorage = (t: Track | null | undefined): Track | null => {
  if (!t) return null as any;
  const { unsynced_lyrics, embedded_art_base64, ...rest } = t;
  return rest as Track;
};

const safeLocalStorage = {
  getItem: (name: string): string | null => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      console.warn(`[usePlayerStore] Failed to save '${name}' to localStorage (quota exceeded or disabled):`, e);
    }
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name);
    } catch {}
  },
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
      lastSeekTime: 0,
      lastSeekTarget: 0,
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
      isTranslationEnabled: true,
      translationMode: 'below',
      targetTranslationLanguage: 'en',
      showAudioSpecs: true,
      showAudioSpecsInLibrary: false,
      autoHideLyricsControls: true,
      includedDirectories: [],
      excludedDirectories: [],
      isScanning: false,
      isRefreshingLibrary: false,
      lastRefreshResult: null,
      scanStatusMessage: null,
      infoModalTrack: null,
      lyricsFontSizePreset: 'normal',
      lyricsFontSize: 24,
      lyricsArtScale: 100,
      lyricsFontFamily: 'system-ui, -apple-system, sans-serif',
      lyricsAnimationStyle: 'minimal_wave',
      isWavySeekbarEnabled: false,
      autoEmbedLyrics: false,
      preferWordSyncedLyrics: true,
      inferWordSyncedLyrics: false,
      isStatsCollectionEnabled: false,
      showDemoStats: false,
      anonymizeStats: false,

      crossfadeDuration: 0,
      setCrossfadeDuration: (dur) => set({ crossfadeDuration: Math.max(0, Math.min(10, dur)) }),
      isGaplessEnabled: true,
      toggleGaplessEnabled: () => set((state) => ({ isGaplessEnabled: !state.isGaplessEnabled })),
      replayGainMode: 'track',
      setReplayGainMode: (mode) => {
        set({ replayGainMode: mode });
        const { currentTrack, tracks, isPlaying } = get();
        if (currentTrack && isPlaying && window.__TAURI_INTERNALS__) {
          const gain = getEffectiveReplayGain(currentTrack, mode, tracks);
          invoke('set_replay_gain', { gainDb: gain }).catch(() => {});
        }
      },
      isScanningReplayGain: false,
      replayGainScanProgress: null,

      backgroundType: 'dynamic_glow',
      customBgPath: null,
      customBgColor: '#0f172a',
      bgBlurAmount: 20,
      bgDimOpacity: 0.6,
      setBackgroundType: (type) => set({ backgroundType: type }),
      setCustomBgPath: (path) => set({ customBgPath: path }),
      setCustomBgColor: (color) => set({ customBgColor: color }),
      setBgBlurAmount: (blur) => set({ bgBlurAmount: Math.max(0, Math.min(100, blur)) }),
      setBgDimOpacity: (opacity) => set({ bgDimOpacity: Math.max(0, Math.min(1, opacity)) }),

      lyricsLayoutMode: 'centered',
      setLyricsLayoutMode: (mode) => set({ lyricsLayoutMode: mode }),
      lyricsArtSize: 'compact',
      setLyricsArtSize: (size) => set({ lyricsArtSize: size }),

      linkedTracks: {},
      linkModalTrack: null,
      setLinkModalTrack: (track) => set({ linkModalTrack: track }),
      linkTracks: (primaryId, nextId) =>
        set((state) => {
          if (primaryId === nextId) return state;
          const existing = state.linkedTracks[primaryId] || [];
          if (existing.includes(nextId)) return state;
          return {
            linkedTracks: {
              ...state.linkedTracks,
              [primaryId]: [...existing, nextId],
            },
          };
        }),
      removeLink: (sourceId, targetId) =>
        set((state) => {
          const newLinks = { ...state.linkedTracks };
          if (newLinks[sourceId]) {
            newLinks[sourceId] = newLinks[sourceId].filter((id) => id !== targetId);
            if (newLinks[sourceId].length === 0) delete newLinks[sourceId];
          }
          return { linkedTracks: newLinks };
        }),
      reverseLinkOrder: (trackAId, trackBId) =>
        set((state) => {
          const newLinks = { ...state.linkedTracks };
          if (newLinks[trackAId]?.includes(trackBId)) {
            newLinks[trackAId] = newLinks[trackAId].filter((id) => id !== trackBId);
            if (newLinks[trackAId].length === 0) delete newLinks[trackAId];
            newLinks[trackBId] = [...(newLinks[trackBId] || []), trackAId];
          } else if (newLinks[trackBId]?.includes(trackAId)) {
            newLinks[trackBId] = newLinks[trackBId].filter((id) => id !== trackAId);
            if (newLinks[trackBId].length === 0) delete newLinks[trackBId];
            newLinks[trackAId] = [...(newLinks[trackAId] || []), trackBId];
          }
          return { linkedTracks: newLinks };
        }),
      unlinkTrack: (trackId) =>
        set((state) => {
          const newLinks = { ...state.linkedTracks };
          delete newLinks[trackId];
          Object.keys(newLinks).forEach((k) => {
            newLinks[k] = newLinks[k].filter((id) => id !== trackId);
            if (newLinks[k].length === 0) delete newLinks[k];
          });
          return { linkedTracks: newLinks };
        }),
      isTrackLinked: (trackId) => {
        const { linkedTracks } = get();
        if (linkedTracks[trackId] && linkedTracks[trackId].length > 0) return true;
        return Object.values(linkedTracks).some((targets) => targets.includes(trackId));
      },

      reorderLinkedChain: (orderedTrackIds) =>
        set((state) => {
          if (!orderedTrackIds || orderedTrackIds.length < 2) return state;
          const chainSet = new Set(orderedTrackIds);
          const newLinks: Record<string, string[]> = {};

          // Copy existing links that don't involve internal connections inside this chain
          for (const [src, targets] of Object.entries(state.linkedTracks)) {
            if (chainSet.has(src)) {
              const remaining = targets.filter((t) => !chainSet.has(t));
              if (remaining.length > 0) {
                newLinks[src] = remaining;
              }
            } else {
              newLinks[src] = [...targets];
            }
          }

          // Build sequential links: 0 -> 1 -> 2 -> ... -> n-1
          for (let i = 0; i < orderedTrackIds.length - 1; i++) {
            const fromId = orderedTrackIds[i];
            const toId = orderedTrackIds[i + 1];
            const existing = newLinks[fromId] || [];
            if (!existing.includes(toId)) {
              newLinks[fromId] = [toId, ...existing.filter((id) => id !== toId)];
            }
          }

          return { linkedTracks: newLinks };
        }),

      addTrackToChain: (anchorTrackId, newTrackId, position = 'end') => {
        const { tracks, linkedTracks, reorderLinkedChain } = get();
        if (anchorTrackId === newTrackId) return;
        const currentChain = getLinkedChainTracks(anchorTrackId, linkedTracks, tracks);
        const currentIds = currentChain.map((t) => t.id).filter((id) => id !== newTrackId);

        let newIds: string[];
        if (position === 'start') {
          newIds = [newTrackId, ...currentIds];
        } else if (position === 'before') {
          const anchorIdx = currentIds.indexOf(anchorTrackId);
          if (anchorIdx === -1) {
            newIds = [newTrackId, ...currentIds];
          } else {
            newIds = [...currentIds.slice(0, anchorIdx), newTrackId, ...currentIds.slice(anchorIdx)];
          }
        } else if (position === 'after') {
          const anchorIdx = currentIds.indexOf(anchorTrackId);
          if (anchorIdx === -1) {
            newIds = [...currentIds, newTrackId];
          } else {
            newIds = [...currentIds.slice(0, anchorIdx + 1), newTrackId, ...currentIds.slice(anchorIdx + 1)];
          }
        } else {
          // 'end'
          newIds = [...currentIds, newTrackId];
        }

        reorderLinkedChain(newIds);
      },

      removeTrackFromChain: (trackId) => {
        const { tracks, linkedTracks, reorderLinkedChain, unlinkTrack } = get();
        const currentChain = getLinkedChainTracks(trackId, linkedTracks, tracks);
        if (currentChain.length <= 2) {
          unlinkTrack(trackId);
          return;
        }
        const remainingIds = currentChain.map((t) => t.id).filter((id) => id !== trackId);
        reorderLinkedChain(remainingIds);
      },

      reverseChain: (trackId) => {
        const { tracks, linkedTracks, reorderLinkedChain } = get();
        const currentChain = getLinkedChainTracks(trackId, linkedTracks, tracks);
        if (currentChain.length < 2) return;
        const reversedIds = [...currentChain.map((t) => t.id)].reverse();
        reorderLinkedChain(reversedIds);
      },

      unlinkChain: (trackId) => {
        const { tracks, linkedTracks, unlinkTrack } = get();
        const currentChain = getLinkedChainTracks(trackId, linkedTracks, tracks);
        currentChain.forEach((t) => unlinkTrack(t.id));
      },

      playLinkedSuite: (trackId) => {
        const { tracks, linkedTracks, playTrack } = get();
        const currentChain = getLinkedChainTracks(trackId, linkedTracks, tracks);
        if (currentChain.length > 0) {
          playTrack(currentChain[0], currentChain);
        }
      },

      selectedArtist: null,
      selectedAlbum: null,
      navigateToArtist: (artist) => set({ selectedArtist: artist, activeTab: 'artistView', infoModalTrack: null }),
      navigateToAlbum: (album) => set({ selectedAlbum: album, activeTab: 'albumView', infoModalTrack: null }),

      // Track Grid View Customization
      visibleTrackColumns: [
        'order',
        'art',
        'title',
        'album',
        'artist',
        'duration',
        'favorite',
        'addToQueue',
        'playNext',
        'addToPlaylist',
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
        'album',
        'artist',
        'date',
        'genre',
        'duration',
        'favorite',
        'addToQueue',
        'playNext',
        'addToPlaylist',
        'actions',
      ],
      setColumnOrder: (order) => set({ columnOrder: order }),

      showSubArtistUnderTitle: true,
      setShowSubArtistUnderTitle: (show) => set({ showSubArtistUnderTitle: show }),

      // App Updates
      autoCheckUpdates: true,
      latestUpdateResult: null,
      isCheckingUpdate: false,
      toggleAutoCheckUpdates: () =>
        set((state) => ({ autoCheckUpdates: !state.autoCheckUpdates })),
      checkAppUpdate: async (_manual = false) => {
        set({ isCheckingUpdate: true });
        try {
          const result = await fetchLatestRelease();
          set({ latestUpdateResult: result, isCheckingUpdate: false });
          return result;
        } catch (e) {
          set({ isCheckingUpdate: false });
          return null;
        }
      },

      // Shuffle & Repeat
      shuffleEnabled: false,
      repeatMode: 'off',
      shuffleHistory: [],
      originalQueue: [],

      // Playlists
      playlists: [],
      activePlaylistId: null,

      // Track Multi-Selection
      selectedTrackIds: [],
      lastSelectedTrackId: null,

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
            const paths = scannedTracks.map((t) => t.path);
            await invoke('analyze_library_audio', { paths });
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

      refreshConfiguredLibraries: async () => {
        const { includedDirectories, excludedDirectories, setTracks } = get();
        if (includedDirectories.length === 0) {
          set({
            isRefreshingLibrary: false,
            scanStatusMessage: 'No music folders configured yet to refresh.',
          });
          return null;
        }

        set({
          isRefreshingLibrary: true,
          scanStatusMessage: 'Checking included directories for new or missing tracks...',
        });

        try {
          if (window.__TAURI_INTERNALS__) {
            const res: RefreshLibraryResult = await invoke('refresh_libraries', {
              includedDirs: includedDirectories,
              excludedDirs: excludedDirectories,
            });

            setTracks(res.tracks);
            set({
              isRefreshingLibrary: false,
              lastRefreshResult: res,
              scanStatusMessage: `Refresh complete: +${res.added_count} new song(s) indexed (Key & BPM detected), ${res.missing_count} missing, ${res.removed_count} purged.`,
            });
            return res;
          } else {
            set({
              isRefreshingLibrary: false,
              scanStatusMessage: 'Refresh unavailable in standard web browser mode.',
            });
            return null;
          }
        } catch (e: any) {
          console.warn('Refresh libraries error:', e);
          set({
            isRefreshingLibrary: false,
            scanStatusMessage: `Refresh warning: ${e?.message || String(e)}`,
          });
          return null;
        }
      },

      purgeMissingTracks: async () => {
        try {
          if (window.__TAURI_INTERNALS__) {
            const res: RefreshLibraryResult = await invoke('purge_missing_tracks');
            get().setTracks(res.tracks);
            set({
              lastRefreshResult: res,
              scanStatusMessage: `Purged ${res.removed_count} missing track(s) from library.`,
            });
          } else {
            const filtered = get().tracks.filter((t) => !t.missing_since);
            get().setTracks(filtered);
          }
        } catch (e: any) {
          console.warn('Purge missing error:', e);
        }
      },

      analyzeAndIndexAudio: async () => {
        try {
          if (window.__TAURI_INTERNALS__) {
            const paths = get().tracks.map((t) => t.path);
            await invoke('analyze_library_audio', { paths });
          }
        } catch (e) {
          console.warn('Audio analysis error:', e);
        }
      },

      clearAudioAnalysis: async () => {
        try {
          if (window.__TAURI_INTERNALS__) {
            const updatedTracks: Track[] = await invoke('clear_library_audio_analysis');
            set({ tracks: updatedTracks });
          } else {
            const reset = get().tracks.map((t) => ({ ...t, bpm: undefined, key: undefined }));
            set({ tracks: reset });
          }
        } catch (e) {
          console.warn('Clear audio analysis error:', e);
        }
      },

      setReplayGainScanProgress: (progress) => set({ replayGainScanProgress: progress }),

      updateTrackReplayGain: (path, gain_db, peak) => {
        set((state) => {
          const enrich = (t: Track) =>
            t.path === path ? { ...t, replay_gain_db: gain_db, replay_gain_peak: peak } : t;
          const updatedTracks = state.tracks.map(enrich);
          const updatedCurrent =
            state.currentTrack?.path === path
              ? { ...state.currentTrack, replay_gain_db: gain_db, replay_gain_peak: peak }
              : state.currentTrack;
          const updatedQueue = state.queue.map(enrich);
          const updatedUserQueue = state.userQueue.map(enrich);

          if (state.currentTrack?.path === path && state.isPlaying && window.__TAURI_INTERNALS__) {
            const gain = getEffectiveReplayGain(updatedCurrent, state.replayGainMode, updatedTracks);
            invoke('set_replay_gain', { gainDb: gain }).catch(() => {});
          }

          return {
            tracks: updatedTracks,
            currentTrack: updatedCurrent,
            queue: updatedQueue,
            userQueue: updatedUserQueue,
          };
        });
      },

      startReplayGainScan: async (options = {}) => {
        const { untaggedOnly = true, writeToFiles = false } = options;
        const allTracks = get().tracks;
        const targetTracks = untaggedOnly
          ? allTracks.filter((t) => t.replay_gain_db == null)
          : allTracks;

        if (targetTracks.length === 0) {
          set({ isScanningReplayGain: false, replayGainScanProgress: null });
          return;
        }

        const paths = targetTracks.map((t) => t.path);
        set({
          isScanningReplayGain: true,
          replayGainScanProgress: { current: 0, total: paths.length, path: paths[0] },
        });

        try {
          if (window.__TAURI_INTERNALS__) {
            const results: Array<{
              path: string;
              replay_gain_db: number | null;
              replay_gain_peak: number | null;
              error: string | null;
            }> = await invoke('scan_replaygain_batch', {
              trackPaths: paths,
              writeToFiles: Boolean(writeToFiles),
            });

            const resultMap = new Map<string, { gain: number | null; peak: number | null }>();
            results.forEach((r) => {
              if (r.replay_gain_db != null) {
                resultMap.set(r.path, { gain: r.replay_gain_db, peak: r.replay_gain_peak });
              }
            });

            set((state) => {
              const enrich = (t: Track) => {
                const res = resultMap.get(t.path);
                return res ? { ...t, replay_gain_db: res.gain, replay_gain_peak: res.peak } : t;
              };
              const updatedTracks = state.tracks.map(enrich);
              const updatedCurrent = state.currentTrack ? enrich(state.currentTrack) : state.currentTrack;
              const updatedQueue = state.queue.map(enrich);
              const updatedUserQueue = state.userQueue.map(enrich);

              if (updatedCurrent && state.isPlaying && window.__TAURI_INTERNALS__) {
                const gain = getEffectiveReplayGain(updatedCurrent, state.replayGainMode, updatedTracks);
                invoke('set_replay_gain', { gainDb: gain }).catch(() => {});
              }

              return {
                tracks: updatedTracks,
                currentTrack: updatedCurrent,
                queue: updatedQueue,
                userQueue: updatedUserQueue,
              };
            });

            await invoke('save_library', { tracks: get().tracks });
          }
        } catch (e) {
          console.warn('ReplayGain batch scan error:', e);
        } finally {
          set({ isScanningReplayGain: false, replayGainScanProgress: null });
        }
      },

      cancelReplayGainScan: async () => {
        try {
          if (window.__TAURI_INTERNALS__) {
            await invoke('cancel_replaygain_scan');
          }
        } catch (e) {
          console.warn('Cancel ReplayGain scan error:', e);
        } finally {
          set({ isScanningReplayGain: false, replayGainScanProgress: null });
        }
      },

      setTracks: (tracks) => set({ tracks: Array.isArray(tracks) ? tracks : [] }),

      playTrack: async (track, contextTracks) => {
        try {
          const { shuffleEnabled, linkedTracks } = get();
          let baseQueue = contextTracks && contextTracks.length > 0 ? [...contextTracks] : [track];
          if (!baseQueue.some((t) => t.id === track.id)) {
            baseQueue = [track, ...baseQueue];
          }

          // Cluster linked tracks so linked pairs always appear consecutive in queue
          const clusteredQueue = clusterQueueWithLinks(baseQueue, linkedTracks);
          let index = clusteredQueue.findIndex((t) => t.id === track.id);
          if (index === -1) index = 0;

          let newQueue = clusteredQueue;
          let finalIndex = index;
          let savedOriginal = clusteredQueue;

          if (shuffleEnabled) {
            const clusters = groupLinkedTracks(clusteredQueue, linkedTracks);
            newQueue = shuffleLinkedClusters(clusters, track.id);
            finalIndex = newQueue.findIndex((t) => t.id === track.id);
            if (finalIndex === -1) finalIndex = 0;
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
        } catch (e) {
          console.warn('Error setting queue in playTrack:', e);
          set({
            currentTrack: track,
            duration: track.duration_secs,
            currentTime: 0,
            isPlaying: true,
          });
        }

        try {
          if (window.__TAURI_INTERNALS__) {
            await invoke('set_volume', { volume: get().volume });
            await invoke('play_audio', {
              path: track.path,
              replayGainDb: getEffectiveReplayGain(track, get().replayGainMode, get().tracks),
              crossfadeSecs: get().crossfadeDuration > 0 ? get().crossfadeDuration : null,
            });
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
              await invoke('play_audio', {
                path: track.path,
                replayGainDb: getEffectiveReplayGain(track, get().replayGainMode, get().tracks),
                crossfadeSecs: get().crossfadeDuration > 0 ? get().crossfadeDuration : null,
              });
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
                replayGainDb: getEffectiveReplayGain(currentTrack, get().replayGainMode, get().tracks),
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
        const { currentTrack, queue, playIndex, currentTime, duration, tracks, replayGainMode } = get();
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
            const dur = currentTrack.duration_secs || duration || 0;
            if (dur > 0 && currentTime >= dur - 0.5) {
              set({ currentTime: 0 });
              await invoke('play_audio', {
                path: currentTrack.path,
                replayGainDb: getEffectiveReplayGain(currentTrack, replayGainMode, tracks),
              });
            } else {
              await invoke('resume_audio');
            }
          }
        } catch (e) {
          console.warn('Rust resume_audio error:', e);
        }
      },

      replayCurrentTrack: async () => {
        const { currentTrack, tracks, replayGainMode, crossfadeDuration, onTrackFinished, volume } = get();
        if (!currentTrack) return;
        onTrackFinished();
        set({
          currentTime: 0,
          duration: currentTrack.duration_secs || 0,
          isPlaying: true,
        });
        try {
          if (window.__TAURI_INTERNALS__) {
            await invoke('set_volume', { volume });
            await invoke('play_audio', {
              path: currentTrack.path,
              replayGainDb: getEffectiveReplayGain(currentTrack, replayGainMode, tracks),
              crossfadeSecs: crossfadeDuration > 0 ? crossfadeDuration : null,
            });
          }
        } catch (e) {
          console.warn('Rust play_audio replay error:', e);
        }
      },

      seek: async (seconds) => {
        const now = performance.now();
        set({
          currentTime: seconds,
          lastSeekTime: now,
          lastSeekTarget: seconds,
        });
        try {
          await invoke('seek_audio', { positionSecs: seconds });
        } catch (e) {
          console.warn('Rust seek_audio error:', e);
        }
      },

      setVolume: (vol) => {
        const clamped = Math.max(0, Math.min(1, vol));
        set({ volume: clamped });
        sendThrottledVolume(clamped);
      },

      nextTrack: async () => {
        const { userQueue, currentIndex, queue, repeatMode, playIndex, onTrackFinished } = get();
        onTrackFinished();

        if (repeatMode === 'one') {
          set({ repeatMode: 'all' });
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
            await invoke('play_audio', {
              path: nextUserTrack.path,
              replayGainDb: getEffectiveReplayGain(nextUserTrack, get().replayGainMode, get().tracks),
              crossfadeSecs: get().crossfadeDuration > 0 ? get().crossfadeDuration : null,
            });
          } catch (e) {
            console.warn('Rust play_audio error:', e);
          }
          return;
        }

        if (queue.length === 0) return;

        const effectiveRepeatMode = repeatMode === 'one' ? 'all' : repeatMode;
        const nextIdx = currentIndex + 1;
        if (nextIdx >= queue.length) {
          if (effectiveRepeatMode === 'all') {
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
        const { currentIndex, queue, currentTime, seek, playIndex, shuffleEnabled, shuffleHistory, repeatMode } = get();
        if (currentTime > 3) {
          seek(0);
          return;
        }
        if (repeatMode === 'one') {
          set({ repeatMode: 'all' });
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

          if (state.activePlaylistId === '__liked__' || state.activePlaylistId === 'liked') {
            if (liked) {
              // Unliking while in liked playlist
              const newOriginalQueue = state.originalQueue.filter((t) => t.id !== trackId);
              const removeIdx = state.queue.findIndex((t) => t.id === trackId);
              const newQueue = state.queue.filter((t) => t.id !== trackId);
              let newCurrentIndex = state.currentIndex;
              if (removeIdx !== -1) {
                if (removeIdx < state.currentIndex) {
                  newCurrentIndex = Math.max(0, state.currentIndex - 1);
                } else if (removeIdx === state.currentIndex) {
                  newCurrentIndex = Math.min(newCurrentIndex, Math.max(0, newQueue.length - 1));
                }
              }
              return {
                likedTrackIds: newLiked,
                originalQueue: newOriginalQueue,
                queue: newQueue,
                currentIndex: newCurrentIndex,
              };
            } else {
              // Liking a track while in liked playlist
              const addedTrack = state.tracks.find((t) => t.id === trackId);
              if (addedTrack) {
                const newOriginalQueue = [...state.originalQueue, addedTrack];
                const newQueue = [...state.queue];
                if (state.shuffleEnabled) {
                  const minIdx = Math.max(0, state.currentIndex + 1);
                  const insertIdx = minIdx + Math.floor(Math.random() * (newQueue.length - minIdx + 1));
                  newQueue.splice(insertIdx, 0, addedTrack);
                } else {
                  newQueue.push(addedTrack);
                }
                return {
                  likedTrackIds: newLiked,
                  originalQueue: newOriginalQueue,
                  queue: newQueue,
                };
              }
            }
          }

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

      toggleTranslation: () => set((state) => ({ isTranslationEnabled: !state.isTranslationEnabled })),
      setTranslationMode: (mode) => set({ translationMode: mode }),
      setTargetTranslationLanguage: (lang) => set({ targetTranslationLanguage: lang }),

      toggleShowAudioSpecs: () => set((state) => ({ showAudioSpecs: !state.showAudioSpecs })),

      toggleShowAudioSpecsInLibrary: () =>
        set((state) => ({ showAudioSpecsInLibrary: !state.showAudioSpecsInLibrary })),

      setInfoModalTrack: (track) => set({ infoModalTrack: track }),
      setLyricsFontSizePreset: (preset) => set({ lyricsFontSizePreset: preset }),
      setLyricsFontSize: (size) => set({ lyricsFontSize: size }),
      setLyricsArtScale: (scale) => set({ lyricsArtScale: scale }),
      setLyricsFontFamily: (font) => set({ lyricsFontFamily: font }),
      setLyricsAnimationStyle: (style) => set({ lyricsAnimationStyle: style }),
      toggleWavySeekbar: () => set((state) => ({ isWavySeekbarEnabled: !state.isWavySeekbarEnabled })),
      toggleAutoEmbedLyrics: () => set((state) => ({ autoEmbedLyrics: !state.autoEmbedLyrics })),
      togglePreferWordSyncedLyrics: () => set((state) => ({ preferWordSyncedLyrics: !state.preferWordSyncedLyrics })),
      toggleInferWordSyncedLyrics: () => set((state) => ({ inferWordSyncedLyrics: !state.inferWordSyncedLyrics })),

      toggleAutoHideLyricsControls: () => set((state) => ({ autoHideLyricsControls: !state.autoHideLyricsControls })),

      toggleStatsCollection: () => set((state) => ({ isStatsCollectionEnabled: !state.isStatsCollectionEnabled })),

      // Shuffle & Repeat
      toggleShuffle: () =>
        set((state) => {
          const newShuffle = !state.shuffleEnabled;
          if (newShuffle) {
            const currentObj = state.currentTrack;
            const sourceQueue = state.queue.length > 0 ? state.queue : state.tracks;
            const clusters = groupLinkedTracks(sourceQueue, state.linkedTracks);
            const shuffledQueue = shuffleLinkedClusters(clusters, currentObj?.id);
            const newCurrentIndex = currentObj
              ? Math.max(0, shuffledQueue.findIndex((t) => t.id === currentObj.id))
              : 0;
            return {
              shuffleEnabled: true,
              originalQueue: [...sourceQueue],
              queue: shuffledQueue,
              currentIndex: newCurrentIndex,
            };
          } else {
            const rawOrig = state.originalQueue.length > 0 ? state.originalQueue : state.queue;
            const orig = clusterQueueWithLinks(rawOrig, state.linkedTracks);
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
        set((state) => {
          const playlist = state.playlists.find((p) => p.id === playlistId);
          if (!playlist || playlist.trackIds.includes(trackId)) {
            return state;
          }
          const updatedPlaylists = state.playlists.map((p) =>
            p.id === playlistId ? { ...p, trackIds: [...p.trackIds, trackId] } : p
          );

          if (state.activePlaylistId === playlistId) {
            const addedTrack = state.tracks.find((t) => t.id === trackId);
            if (addedTrack) {
              const newOriginal = [...state.originalQueue, addedTrack];
              const newQueue = [...state.queue];
              if (state.shuffleEnabled) {
                const minIdx = Math.max(0, state.currentIndex + 1);
                const insertIdx = minIdx + Math.floor(Math.random() * (newQueue.length - minIdx + 1));
                newQueue.splice(insertIdx, 0, addedTrack);
              } else {
                newQueue.push(addedTrack);
              }
              return {
                playlists: updatedPlaylists,
                originalQueue: newOriginal,
                queue: newQueue,
              };
            }
          }

          return { playlists: updatedPlaylists };
        });
      },

      addTracksToPlaylist: (playlistId, trackIds) => {
        set((state) => {
          const playlist = state.playlists.find((p) => p.id === playlistId);
          if (!playlist) return state;
          const toAdd = trackIds.filter((tid) => !playlist.trackIds.includes(tid));
          if (toAdd.length === 0) return state;

          const updatedPlaylists = state.playlists.map((p) =>
            p.id === playlistId ? { ...p, trackIds: [...p.trackIds, ...toAdd] } : p
          );

          if (state.activePlaylistId === playlistId) {
            const addedTracks = toAdd
              .map((tid) => state.tracks.find((t) => t.id === tid))
              .filter((t): t is Track => Boolean(t));

            if (addedTracks.length > 0) {
              const newOriginal = [...state.originalQueue, ...addedTracks];
              const newQueue = [...state.queue];
              if (state.shuffleEnabled) {
                const shuffledAdded = [...addedTracks];
                for (let i = shuffledAdded.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [shuffledAdded[i], shuffledAdded[j]] = [shuffledAdded[j], shuffledAdded[i]];
                }
                const minIdx = Math.max(0, state.currentIndex + 1);
                const insertIdx = minIdx + Math.floor(Math.random() * (newQueue.length - minIdx + 1));
                newQueue.splice(insertIdx, 0, ...shuffledAdded);
              } else {
                newQueue.push(...addedTracks);
              }
              return {
                playlists: updatedPlaylists,
                originalQueue: newOriginal,
                queue: newQueue,
              };
            }
          }

          return { playlists: updatedPlaylists };
        });
      },

      removeTrackFromPlaylist: (playlistId, trackId) => {
        set((state) => {
          const updatedPlaylists = state.playlists.map((p) =>
            p.id === playlistId
              ? { ...p, trackIds: p.trackIds.filter((id) => id !== trackId) }
              : p
          );

          if (state.activePlaylistId === playlistId) {
            const newOriginalQueue = state.originalQueue.filter((t) => t.id !== trackId);
            const removeIdx = state.queue.findIndex((t) => t.id === trackId);
            const newQueue = state.queue.filter((t) => t.id !== trackId);
            let newCurrentIndex = state.currentIndex;
            if (removeIdx !== -1) {
              if (removeIdx < state.currentIndex) {
                newCurrentIndex = Math.max(0, state.currentIndex - 1);
              } else if (removeIdx === state.currentIndex) {
                newCurrentIndex = Math.min(newCurrentIndex, Math.max(0, newQueue.length - 1));
              }
            }
            return {
              playlists: updatedPlaylists,
              originalQueue: newOriginalQueue,
              queue: newQueue,
              currentIndex: newCurrentIndex,
            };
          }

          return { playlists: updatedPlaylists };
        });
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

      // Track Multi-Selection actions
      setSelectedTrackIds: (ids) => set({ selectedTrackIds: ids }),

      selectSingleTrack: (trackId) =>
        set({ selectedTrackIds: [trackId], lastSelectedTrackId: trackId }),

      toggleSelectTrack: (trackId) =>
        set((state) => {
          const isSelected = state.selectedTrackIds.includes(trackId);
          const next = isSelected
            ? state.selectedTrackIds.filter((id) => id !== trackId)
            : [...state.selectedTrackIds, trackId];
          return { selectedTrackIds: next, lastSelectedTrackId: trackId };
        }),

      selectTrackRange: (targetTrackId, currentTrackList, isAdditive = false) =>
        set((state) => {
          if (!currentTrackList || currentTrackList.length === 0) return state;
          const targetIdx = currentTrackList.findIndex((t) => t.id === targetTrackId);
          if (targetIdx === -1) return state;

          let anchorIdx = 0;
          if (state.lastSelectedTrackId) {
            const foundAnchor = currentTrackList.findIndex((t) => t.id === state.lastSelectedTrackId);
            if (foundAnchor !== -1) {
              anchorIdx = foundAnchor;
            }
          }

          const start = Math.min(anchorIdx, targetIdx);
          const end = Math.max(anchorIdx, targetIdx);
          const rangeIds = currentTrackList.slice(start, end + 1).map((t) => t.id);

          if (isAdditive) {
            const combined = Array.from(new Set([...state.selectedTrackIds, ...rangeIds]));
            return { selectedTrackIds: combined };
          }

          return {
            selectedTrackIds: rangeIds,
            lastSelectedTrackId: state.lastSelectedTrackId || currentTrackList[anchorIdx]?.id || targetTrackId,
          };
        }),

      selectAllTracks: (tracks) =>
        set({
          selectedTrackIds: tracks.map((t) => t.id),
          lastSelectedTrackId: tracks.length > 0 ? tracks[0].id : null,
        }),

      clearSelection: () => set({ selectedTrackIds: [], lastSelectedTrackId: null }),

      // Batch actions
      addTracksToQueue: (tracks) =>
        set((state) => ({
          userQueue: [...state.userQueue, ...tracks],
        })),

      playNextTracks: (tracks) =>
        set((state) => ({
          userQueue: [...tracks, ...state.userQueue],
        })),

      likeMultipleTracks: (trackIds, like) =>
        set((state) => {
          const currentSet = new Set(state.likedTrackIds);
          if (like) {
            trackIds.forEach((id) => currentSet.add(id));
          } else {
            trackIds.forEach((id) => currentSet.delete(id));
          }
          return { likedTrackIds: Array.from(currentSet) };
        }),

      removeTracksFromPlaylist: (playlistId, trackIds) =>
        set((state) => {
          const removeSet = new Set(trackIds);
          const updatedPlaylists = state.playlists.map((p) =>
            p.id === playlistId
              ? { ...p, trackIds: p.trackIds.filter((id) => !removeSet.has(id)) }
              : p
          );

          if (state.activePlaylistId === playlistId) {
            const newOriginalQueue = state.originalQueue.filter((t) => !removeSet.has(t.id));
            const newQueue = state.queue.filter((t) => !removeSet.has(t.id));
            const newCurrentIndex = state.currentTrack && removeSet.has(state.currentTrack.id)
              ? Math.min(state.currentIndex, Math.max(0, newQueue.length - 1))
              : state.currentIndex;

            return {
              playlists: updatedPlaylists,
              originalQueue: newOriginalQueue,
              queue: newQueue,
              currentIndex: newCurrentIndex,
            };
          }

          return { playlists: updatedPlaylists };
        }),

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

      toggleShowDemoStats: () => set((state) => ({ showDemoStats: !state.showDemoStats })),

      toggleAnonymizeStats: () => set((state) => ({ anonymizeStats: !state.anonymizeStats })),

      generateDemoPlaylists: () => {
        const { tracks, playlists } = get();
        const demoThemes = [
          { name: '🌙 Midnight Synthwave', desc: 'Retrowave, synthpop & night driving' },
          { name: '⚡ High-Energy Flow', desc: 'Uptempo electronic & workout beats' },
          { name: '☕ Lo-Fi Chill & Focus', desc: 'Mellow ambient & study vibes' },
          { name: '✨ Audiophile Mastercuts', desc: 'Lossless hi-res acoustic & orchestral references' },
        ];
        const newPlaylists = [...playlists];
        demoThemes.forEach((theme, idx) => {
          if (!newPlaylists.some((p) => p.name === theme.name)) {
            let trackIds: string[] = [];
            if (tracks.length > 0) {
              const start = (idx * 3) % tracks.length;
              const count = Math.min(6, tracks.length);
              const slice = tracks.slice(start, start + count);
              trackIds = slice.length > 0 ? slice.map((t) => t.id) : tracks.slice(0, 4).map((t) => t.id);
            }
            newPlaylists.push({
              id: `pl-demo-${Date.now()}-${idx}`,
              name: theme.name,
              trackIds,
              createdAt: Date.now() - (idx + 1) * 86400000 * 2,
            });
          }
        });
        set({ playlists: newPlaylists });
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
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        likedTrackIds: state.likedTrackIds,
        volume: state.volume,
        showAudioSpecs: state.showAudioSpecs,
        showAudioSpecsInLibrary: state.showAudioSpecsInLibrary,
        isRomanizationEnabled: state.isRomanizationEnabled,
        romanizationMode: state.romanizationMode,
        isTranslationEnabled: state.isTranslationEnabled,
        translationMode: state.translationMode,
        targetTranslationLanguage: state.targetTranslationLanguage,
        autoHideLyricsControls: state.autoHideLyricsControls,
        isStatsCollectionEnabled: state.isStatsCollectionEnabled,
        showDemoStats: state.showDemoStats,
        anonymizeStats: state.anonymizeStats,
        autoCheckUpdates: state.autoCheckUpdates,
        lrclibAutoFetch: state.lrclibAutoFetch,
        preferOnlineLyrics: state.preferOnlineLyrics,
        lyricsFontSizePreset: state.lyricsFontSizePreset,
        lyricsFontSize: state.lyricsFontSize,
        lyricsArtScale: state.lyricsArtScale,
        lyricsFontFamily: state.lyricsFontFamily,
        lyricsAnimationStyle: state.lyricsAnimationStyle,
        isWavySeekbarEnabled: state.isWavySeekbarEnabled,
        autoEmbedLyrics: state.autoEmbedLyrics,
        preferWordSyncedLyrics: state.preferWordSyncedLyrics,
        inferWordSyncedLyrics: state.inferWordSyncedLyrics,
        includedDirectories: state.includedDirectories,
        excludedDirectories: state.excludedDirectories,
        queue: Array.isArray(state.queue) ? (state.queue.map(sanitizeTrackForStorage) as Track[]) : [],
        userQueue: Array.isArray(state.userQueue) ? (state.userQueue.map(sanitizeTrackForStorage) as Track[]) : [],
        currentIndex: state.currentIndex,
        currentTrack: sanitizeTrackForStorage(state.currentTrack),
        shuffleEnabled: state.shuffleEnabled,
        repeatMode: state.repeatMode,
        playlists: state.playlists,
        crossfadeDuration: state.crossfadeDuration,
        isGaplessEnabled: state.isGaplessEnabled,
        replayGainMode: state.replayGainMode,
        backgroundType: state.backgroundType,
        customBgPath: state.customBgPath,
        customBgColor: state.customBgColor,
        bgBlurAmount: state.bgBlurAmount,
        bgDimOpacity: state.bgDimOpacity,
        lyricsLayoutMode: state.lyricsLayoutMode,
        lyricsArtSize: state.lyricsArtSize,
        linkedTracks: state.linkedTracks,
        visibleTrackColumns: state.visibleTrackColumns,
        trackGridDensity: state.trackGridDensity,
        columnOrder: state.columnOrder,
        showSubArtistUnderTitle: state.showSubArtistUnderTitle,
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
      const currentTracks = Array.isArray(store.tracks) ? store.tracks : [];
      const updated = currentTracks.map((t) =>
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
