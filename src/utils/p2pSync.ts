import { invoke } from '@tauri-apps/api/core';
import { Track } from '../types/player';
import { AndroidTrackDto, PlaybackStateDto, P2pSyncInfo, SyncPlaylistDto } from '../types/sync';
import { usePlayerStore } from '../store/usePlayerStore';

/**
 * Transforms a desktop Track model to the JSON schema expected by Android SyncFrame / PlaybackState.
 */
export function trackToSyncDto(track: Track | null): AndroidTrackDto | null {
  if (!track) return null;
  const ext = track.path.split('.').pop()?.toUpperCase() || 'MP3';
  const uri = track.path.startsWith('file:')
    ? track.path
    : `file:///${track.path.replace(/\\/g, '/')}`;

  return {
    id: track.id,
    uri,
    title: track.title || 'Unknown Title',
    artist: track.artist || 'Unknown Artist',
    album: track.album || 'Unknown Album',
    durationMs: Math.round((track.duration_secs || 0) * 1000),
    sampleRate: track.sample_rate || 44100,
    bitDepth: track.bit_depth || 16,
    channels: track.channels || 2,
    bitRateKbps: track.bit_rate_kbps || null,
    format: ext,
    artworkUri: track.embedded_art_base64
      ? `data:image/jpeg;base64,${track.embedded_art_base64}`
      : null,
    lyrics: track.unsynced_lyrics || null,
  };
}

let lastBroadcastTime = 0;
let pendingBroadcastTimeout: any = null;

/**
 * Broadcasts arbitrary P2P frame to all connected companion devices.
 */
export async function broadcastP2pFrame(frame: any): Promise<void> {
  if (!window.__TAURI_INTERNALS__) return;
  try {
    await invoke('broadcast_p2p_frame', {
      frameJson: JSON.stringify(frame),
    });
  } catch (e) {
    console.debug('[P2P Sync] Failed to broadcast frame:', e);
  }
}

/**
 * Broadcasts the current player store state to all connected P2P companion clients.
 * Debounced to prevent saturating the LAN network during rapid position updates.
 */
export async function broadcastStateSync(forceImmediate = false): Promise<void> {
  if (!window.__TAURI_INTERNALS__) return;

  const now = performance.now();
  if (!forceImmediate && now - lastBroadcastTime < 200) {
    if (!pendingBroadcastTimeout) {
      pendingBroadcastTimeout = setTimeout(() => {
        pendingBroadcastTimeout = null;
        broadcastStateSync(true);
      }, 200);
    }
    return;
  }

  lastBroadcastTime = now;
  if (pendingBroadcastTimeout) {
    clearTimeout(pendingBroadcastTimeout);
    pendingBroadcastTimeout = null;
  }

  const state = usePlayerStore.getState();
  const userQueueDtos: AndroidTrackDto[] = state.userQueue
    .slice(0, 50)
    .map(trackToSyncDto)
    .filter((t): t is AndroidTrackDto => t !== null);

  const contextQueueDtos: AndroidTrackDto[] = state.queue
    .slice(0, 100)
    .map(trackToSyncDto)
    .filter((t): t is AndroidTrackDto => t !== null);

  const repeatMode: 'OFF' | 'ALL' | 'ONE' =
    state.repeatMode === 'all' ? 'ALL' : state.repeatMode === 'one' ? 'ONE' : 'OFF';

  const playbackState: PlaybackStateDto = {
    currentTrack: trackToSyncDto(state.currentTrack),
    isPlaying: state.isPlaying,
    positionMs: Math.round((state.currentTime || 0) * 1000),
    durationMs: Math.round((state.duration || state.currentTrack?.duration_secs || 0) * 1000),
    isShuffled: state.shuffleEnabled,
    repeatMode,
    volume: state.volume,
    queueIndex: Math.max(0, state.currentIndex),
    activeDeviceId: state.p2pActiveDeviceId || 'desktop',
    queue: contextQueueDtos,
    userQueue: userQueueDtos,
    activePlaylistId: state.activePlaylistId || null,
    lastActionTimestampMs: state.lastActionTimestampMs || Date.now(),
  };

  const frame = {
    type: 'state_sync',
    playbackState,
  };

  await broadcastP2pFrame(frame);
}

export async function broadcastPlaylistsSync(): Promise<void> {
  if (!window.__TAURI_INTERNALS__) return;
  const state = usePlayerStore.getState();
  if (!state.tracks || state.tracks.length === 0) {
    // Local library not loaded yet; avoid sending empty tracks to peers
    return;
  }
  const trackMap = new Map<string, Track>(state.tracks.map((t) => [t.id, t]));

  const playlistDtos: SyncPlaylistDto[] = state.playlists.map((pl) => ({
    id: pl.id,
    name: pl.name,
    createdAt: pl.createdAt,
    customCoverUri: pl.customCoverUri ?? null,
    tracks: (pl.trackIds || [])
      .map((tid) => trackMap.get(tid))
      .filter((t): t is Track => !!t)
      .map((t) => ({
        title: t.title || '',
        artist: t.artist || '',
        filename: (t.path || '').replace(/\\/g, '/').split('/').pop() || '',
      })),
  }));

  await broadcastP2pFrame({
    type: 'playlist_sync',
    playlists: playlistDtos,
  });
}

export async function broadcastLibraryManifest(): Promise<void> {
  if (!window.__TAURI_INTERNALS__) return;
  const state = usePlayerStore.getState();
  if (!state.tracks || state.tracks.length === 0) return;

  const tracks = state.tracks.map((t) => {
    const fn = t.path ? t.path.replace(/\\/g, '/').split('/').pop() || '' : '';
    return {
      filename: fn,
      title: t.title || '',
      artist: t.artist || '',
      sizeBytes: (t as any).size_bytes || 25_000_000,
      durationSecs: t.duration_secs || 0,
    };
  });

  await broadcastP2pFrame({
    type: 'manifest_resp',
    tracks,
  }).catch(console.error);
}

export async function broadcastTrackNotFound(
  trackTitle: string,
  trackArtist: string,
  trackFilename: string
): Promise<void> {
  await broadcastP2pFrame({
    type: 'track_not_found',
    trackTitle,
    trackArtist,
    trackFilename,
  });
}

export async function sendP2pFile(filePath: string, fileId: string): Promise<void> {
  if (!window.__TAURI_INTERNALS__) return;
  await invoke('send_p2p_file', { filePath, fileId });
}

export async function fetchP2pSyncInfo(): Promise<P2pSyncInfo> {
  return await invoke<P2pSyncInfo>('get_p2p_sync_info');
}

export async function regenerateP2pToken(): Promise<P2pSyncInfo> {
  return await invoke<P2pSyncInfo>('regenerate_p2p_pairing_token');
}

export async function sendP2pStatsSync(): Promise<number> {
  return await invoke<number>('send_p2p_stats_sync');
}

export async function setP2pActiveDevice(deviceId: string): Promise<void> {
  await invoke('set_p2p_active_device', { deviceId });
}

export interface AdbReverseResult {
  success: boolean;
  message: string;
  device_found: boolean;
}

export async function setupAdbReverse(): Promise<AdbReverseResult> {
  return await invoke<AdbReverseResult>('setup_adb_reverse');
}

export async function broadcastRoutingSync(
  isDesktopEnabled: boolean,
  isCompanionEnabled: boolean,
  starredDeviceId?: string
): Promise<void> {
  await broadcastP2pFrame({
    type: 'routing_sync',
    isDesktopEnabled,
    isCompanionEnabled,
    starredDeviceId,
  });
}
