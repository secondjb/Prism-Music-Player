import { hasTranslationInLyrics } from '../lyricsParser';
import { AppleMusicLyricsProvider } from './appleMusicProvider';
import { BetterLyricsProvider } from './betterLyricsProvider';
import { KugouLyricsProvider } from './kugouProvider';
import { LrclibLyricsProvider } from './lrclibProvider';
import { NeteaseLyricsProvider } from './neteaseProvider';
import { hasLrcTimestamps, isWordSyncedLrc } from './providerUtils';
import type { DiscoveredLyrics, LyricsProvider, LyricsSearchQuery } from './types';
import { UnisonLyricsProvider } from './unisonProvider';

export * from './types';
export * from './providerUtils';
export { AppleMusicLyricsProvider } from './appleMusicProvider';
export { BetterLyricsProvider } from './betterLyricsProvider';
export { KugouLyricsProvider } from './kugouProvider';
export { UnisonLyricsProvider } from './unisonProvider';
export { SyncLrcLyricsProvider } from './syncLrcProvider';
export { NeteaseLyricsProvider } from './neteaseProvider';
export { LrclibLyricsProvider } from './lrclibProvider';

/**
 * Singleton instances of all registered lyric providers in cascade order.
 */
export const LYRIC_PROVIDERS: readonly LyricsProvider[] = [
  new AppleMusicLyricsProvider(),
  new KugouLyricsProvider(),
  new BetterLyricsProvider(),
  new UnisonLyricsProvider(),
  new NeteaseLyricsProvider(),
  new LrclibLyricsProvider(),
];

/**
 * Searches across lyric APIs in cascade order using the registered modular providers.
 */
export async function searchEnhancedLyrics(
  trackName: string,
  artistName: string,
  albumName?: string,
  durationSecs?: number,
  signal?: AbortSignal,
  requireWordSync?: boolean
): Promise<DiscoveredLyrics | null> {
  if (signal?.aborted) return null;
  if (!trackName || !trackName.trim()) return null;

  const query: LyricsSearchQuery = {
    trackName,
    artistName,
    albumName,
    durationSecs,
    signal,
  };

  for (const provider of LYRIC_PROVIDERS) {
    if (signal?.aborted) return null;

    // If caller specifically requested word-sync only, skip providers that can never produce it
    if (requireWordSync && !provider.supportsWordSync) {
      continue;
    }

    try {
      const rawLyrics = await provider.fetch(query);
      if (!rawLyrics || !rawLyrics.trim()) continue;

      const hasWordSync = isWordSyncedLrc(rawLyrics);
      const hasTranslation = hasTranslationInLyrics(rawLyrics);
      const isSynced = hasLrcTimestamps(rawLyrics);

      if (hasWordSync || hasTranslation || isSynced || rawLyrics.trim().length > 0) {
        if (!requireWordSync || hasWordSync) {
          return {
            lyrics: rawLyrics.trim(),
            hasWordSync,
            hasTranslation,
            isSynced,
            source: provider.name,
          };
        }
      }
    } catch {
      // Continue to next provider in cascade
    }
  }

  return null;
}

/**
 * Backward compatibility wrapper for fetching lyrics with cascade support.
 */
export async function fetchLrclibLyrics(
  trackName: string,
  artistName: string,
  albumName?: string,
  durationSecs?: number,
  preferWordSync: boolean = false
): Promise<string | null> {
  const res = await searchEnhancedLyrics(
    trackName,
    artistName,
    albumName,
    durationSecs,
    undefined,
    preferWordSync && false
  );
  return res?.lyrics || null;
}

/**
 * Backward compatibility wrapper for searchEnhancedLyrics.
 */
export async function searchWordSyncedLyrics(
  trackName: string,
  artistName: string,
  albumName?: string,
  durationSecs?: number,
  signal?: AbortSignal
): Promise<DiscoveredLyrics | null> {
  return searchEnhancedLyrics(trackName, artistName, albumName, durationSecs, signal, true);
}
