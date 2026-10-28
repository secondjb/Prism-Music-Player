export interface P2pSyncInfo {
  is_running: boolean;
  host: string;
  port: number;
  token: string;
  pairing_uri: string;
  raw_pairing_string: string;
  device_name: string;
  connected_clients: number;
  active_device_id: string;
}

export interface AndroidTrackDto {
  id: string;
  uri: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  sampleRate: number;
  bitDepth: number;
  channels: number;
  bitRateKbps: number | null;
  format: string;
  artworkUri: string | null;
  lyrics: string | null;
}

export interface PlaybackStateDto {
  currentTrack: AndroidTrackDto | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  isShuffled: boolean;
  repeatMode: 'OFF' | 'ALL' | 'ONE';
  volume: number;
  queueIndex: number;
  activeDeviceId: string;
  queue: AndroidTrackDto[];
  userQueue?: AndroidTrackDto[];
  activePlaylistId?: string | null;
  lastActionTimestampMs?: number;
}

export interface SyncTrackKeyDto {
  title: string;
  artist: string;
  filename: string;
}

export interface SyncPlaylistDto {
  id: string;
  name: string;
  tracks: SyncTrackKeyDto[];
  createdAt?: number;
  updatedAt?: number;
}

export interface SyncCommandPayload {
  action:
    | 'PLAY'
    | 'PAUSE'
    | 'TOGGLE_PLAY_PAUSE'
    | 'SEEK'
    | 'SKIP_NEXT'
    | 'SKIP_PREVIOUS'
    | 'SET_VOLUME'
    | 'TOGGLE_SHUFFLE'
    | 'SET_REPEAT'
    | 'RESHUFFLE_UPCOMING';
  seekPositionMs?: number | null;
  volume?: number | null;
  repeatMode?: 'OFF' | 'ALL' | 'ONE' | null;
}

export interface SyncListeningEventDto {
  song_title: string;
  artist_name: string;
  album_name: string | null;
  genre: string | null;
  duration_ms: number;
  played_at: string;
}
