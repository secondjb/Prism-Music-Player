export interface Track {
  id: string;
  path: string;
  title: string;
  artist: string;
  album: string;
  duration_secs: number;
  sample_rate: number;
  bit_depth: number;
  channels: number;
  bit_rate_kbps?: number | null;
  replay_gain_db?: number | null;
  replay_gain_peak?: number | null;
  replay_gain_album_db?: number | null;
  replay_gain_album_peak?: number | null;
  embedded_art_base64?: string | null;
  unsynced_lyrics?: string | null;
  genre?: string | null;
  year?: number | null;
  date?: string | null;
  key?: string | null;
  bpm?: number | null;
  missing_since?: number | null;
}

export interface LibraryChunkResponse {
  tracks: Track[];
  chunk_index: number;
  total_chunks: number;
  total_tracks: number;
  is_last: boolean;
}

export interface RefreshLibraryResult {
  tracks: Track[];
  added_count: number;
  missing_count: number;
  restored_count: number;
  removed_count: number;
  total_count: number;
}

export interface AudioDeviceInfo {
  name: string;
  is_default: boolean;
  is_active: boolean;
  default_sample_rate: number;
  default_channels: number;
  default_format: string;
  min_sample_rate: number;
  max_sample_rate: number;
  supported_channels: number[];
  supported_formats: string[];
}

export interface AudioOutputDetails {
  devices: AudioDeviceInfo[];
  active_device_name: string;
  active_sample_rate: number;
  active_channels: number;
  active_format: string;
  is_playing: boolean;
}

export interface AudioAnalysisResult {
  bpm: number | null;
  key: string | null;
}

export interface AudioAnalysisProgress {
  current: number;
  total: number;
  track_id: string;
  bpm?: number | null;
  key?: string | null;
}

export interface TurboAnalysisProgressPayload {
  path: string;
  bpm: number | null;
  key: string | null;
}

export interface TrackLoudnessResult {
  path: string;
  replay_gain_db: number | null;
  replay_gain_peak: number | null;
  error: string | null;
}

export interface ReplayGainProgressPayload {
  current: number;
  total: number;
  path: string;
  replay_gain_db: number | null;
  replay_gain_peak: number | null;
  error: string | null;
  is_finished: boolean;
}

export interface FilterParams {
  artist?: string | null;
  genre?: string | null;
  min_year?: number | null;
  max_year?: number | null;
  decades?: string[] | null;
  min_bitrate_kbps?: number | null;
  max_bitrate_kbps?: number | null;
  sample_rate?: number | null;
  sample_rates?: number[] | null;
  key?: string | null;
  min_bpm?: number | null;
  max_bpm?: number | null;
  query?: string | null;
  lyrics_types?: string[] | null;
  lyrics_match_mode?: string | null;
}

export type ActiveTab =
  | 'home'
  | 'search'
  | 'library'
  | 'playlists'
  | 'liked'
  | 'albums'
  | 'artists'
  | 'folders'
  | 'lyrics'
  | 'settings'
  | 'filter'
  | 'stats'
  | 'artistView'
  | 'albumView';

export type BackgroundType =
  | 'dynamic_glow'
  | 'album_art_blur'
  | 'album_art_color'
  | 'custom_photo'
  | 'solid_color'
  | 'amoled_black';
export type LyricsLayoutMode = 'split' | 'centered';
export type LyricsArtSize = 'compact' | 'expanded';

export type RepeatMode = 'off' | 'all' | 'one';

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

export interface SleepTimer {
  active: boolean;
  mode: 'time' | 'tracks';
  remainingSeconds: number;
  remainingTracks: number;
}
