/**
 * Types and interfaces for lyrics providers in Prism Music Player.
 */

export interface LyricsSearchQuery {
  trackName: string;
  artistName: string;
  albumName?: string;
  durationSecs?: number;
  signal?: AbortSignal;
}

export type LyricProviderSource =
  | 'Apple Music'
  | 'BetterLyrics'
  | 'Kugou'
  | 'Unison'
  | 'SyncLRC'
  | 'NetEase'
  | 'LRCLIB';

export interface DiscoveredLyrics {
  lyrics: string;
  hasWordSync: boolean;
  hasTranslation: boolean;
  isSynced: boolean;
  source: LyricProviderSource;
}

export interface FetchLyricsResult {
  lyrics: string | null;
  isWordSynced: boolean;
  source: string;
}

export interface LyricsProvider {
  /** Display name of the provider */
  readonly name: LyricProviderSource;
  /** High-level capability info for UI settings and health dashboard */
  readonly tier: string;
  readonly description: string;
  readonly endpoint: string;
  /** Whether the provider provides syllable or word-level synchronization */
  readonly supportsWordSync: boolean;
  /** Fetch lyrics string from this provider */
  fetch(query: LyricsSearchQuery): Promise<string | null>;
  /** Check if the service is alive/online */
  ping(): Promise<'online' | 'offline'>;
}
