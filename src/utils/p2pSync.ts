import { invoke } from '@tauri-apps/api/core';
import { Track } from '../types/player';
import { AndroidTrackDto, PlaybackStateDto, P2pSyncInfo } from '../types/sync';
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
  const queueDtos: AndroidTrackDto[] = (state.userQueue.length > 0 ? state.userQueue : state.queue)
    .slice(0, 50)
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
    queue: queueDtos,
  };

  const frame = {
    type: 'state_sync',
    playbackState,
  };

  try {
    await invoke('broadcast_p2p_frame', {
      frameJson: JSON.stringify(frame),
    });
  } catch (e) {
    console.debug('[P2P Sync] Failed to broadcast state:', e);
  }
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
