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
  embedded_art_base64?: string | null;
  unsynced_lyrics?: string | null;
}

export type ActiveTab = 'library' | 'playlists' | 'liked' | 'albums' | 'folders' | 'lyrics' | 'settings';

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
