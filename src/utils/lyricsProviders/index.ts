import { hasTranslationInLyrics } from '../lyricsParser';
import { AppleMusicLyricsProvider } from './appleMusicProvider';
import { BetterLyricsProvider } from './betterLyricsProvider';
import { KugouLyricsProvider } from './kugouProvider';
import { LrclibLyricsProvider } from './lrclibProvider';
import { NeteaseLyricsProvider } from './neteaseProvider';
import { hasLrcTimestamps, isWordSyncedLrc, cleanTitle, cleanArtist } from './providerUtils';
import type { DiscoveredLyrics, LyricsProvider, LyricsSearchQuery, ProviderStrategy, SearchLyricsOptions } from './types';
import { UnisonLyricsProvider } from './unisonProvider';

export * from './types';
export * from './providerUtils';
export {
  AppleMusicLyricsProvider,
  getAppleMusicCooldownRemaining,
  resetAppleMusicCooldown,
  isAppleMusicRateLimited,
} from './appleMusicProvider';
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

export interface LyricSearchResultItem {
  provider: string;
  lyrics: string;
  isSynced: boolean;
  hasWordSync: boolean;
  hasTranslation: boolean;
  sampleLine?: string;
}

/**
 * Searches across all registered lyric APIs in cascade order using the modular providers.
 * Supports configurable strategy ('patient-fallback', 'apple-only', 'fast-cascade')
 * and automatic cleaned-query fallback if initial lookup returns null.
 */
export async function searchEnhancedLyrics(
  trackName: string,
  artistName: string,
  albumName?: string,
  durationSecs?: number,
  signalOrOptions?: AbortSignal | SearchLyricsOptions,
  requireWordSyncArg?: boolean,
  extraOptions?: SearchLyricsOptions
): Promise<DiscoveredLyrics | null> {
  if (!trackName || !trackName.trim()) return null;

  let signal: AbortSignal | undefined;
  let requireWordSync = false;
  let strategy: ProviderStrategy = 'patient-fallback';
  let waitForRateLimit = true;
  let onRateLimitWait: ((remainingSecs: number, providerName: string) => void) | undefined;

  if (signalOrOptions instanceof AbortSignal) {
    signal = signalOrOptions;
    requireWordSync = Boolean(requireWordSyncArg);
    if (extraOptions) {
      if (extraOptions.strategy) strategy = extraOptions.strategy;
      if (extraOptions.waitForRateLimit !== undefined) waitForRateLimit = extraOptions.waitForRateLimit;
      if (extraOptions.onRateLimitWait) onRateLimitWait = extraOptions.onRateLimitWait;
    }
  } else if (signalOrOptions && typeof signalOrOptions === 'object') {
    signal = signalOrOptions.signal;
    requireWordSync = Boolean(signalOrOptions.requireWordSync);
    if (signalOrOptions.strategy) strategy = signalOrOptions.strategy;
    if (signalOrOptions.waitForRateLimit !== undefined) waitForRateLimit = signalOrOptions.waitForRateLimit;
    if (signalOrOptions.onRateLimitWait) onRateLimitWait = signalOrOptions.onRateLimitWait;
  } else {
    requireWordSync = Boolean(requireWordSyncArg);
    if (extraOptions) {
      if (extraOptions.strategy) strategy = extraOptions.strategy;
      if (extraOptions.waitForRateLimit !== undefined) waitForRateLimit = extraOptions.waitForRateLimit;
      if (extraOptions.onRateLimitWait) onRateLimitWait = extraOptions.onRateLimitWait;
    }
  }

  if (signal?.aborted) return null;

  if (strategy === 'fast-cascade') {
    waitForRateLimit = false;
  }

  const executeCascade = async (tName: string, aName: string): Promise<DiscoveredLyrics | null> => {
    const query: LyricsSearchQuery = {
      trackName: tName,
      artistName: aName,
      albumName,
      durationSecs,
      signal,
      waitForRateLimit,
      onRateLimitWait,
    };

    const providersToQuery =
      strategy === 'apple-only'
        ? LYRIC_PROVIDERS.filter((p) => p.name === 'Apple Music')
        : LYRIC_PROVIDERS;

    for (const provider of providersToQuery) {
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
  };

  // 1. Initial attempt with current track title & artist
  const result = await executeCascade(trackName, artistName);
  if (result || signal?.aborted) return result;

  // 2. Cleaned query fallback if title or artist had formatting/clutter
  const cleanedT = cleanTitle(trackName);
  const cleanedA = cleanArtist(artistName);
  if (cleanedT !== trackName || cleanedA !== artistName) {
    if (cleanedT && cleanedT.trim()) {
      const cleanedResult = await executeCascade(cleanedT, cleanedA);
      if (cleanedResult || signal?.aborted) return cleanedResult;
    }
  }

  // 3. Fallback without artist if title is distinctive (>= 4 chars) and initial attempts failed
  if (cleanedT && cleanedT.length >= 4 && cleanedA) {
    const titleOnlyResult = await executeCascade(cleanedT, '');
    if (titleOnlyResult) return titleOnlyResult;
  }

  return null;
}

/**
 * Queries all available providers in parallel to collect multiple lyric sources for user selection.
 */
export async function searchAllLyricSources(
  trackName: string,
  artistName: string,
  albumName?: string,
  durationSecs?: number,
  signal?: AbortSignal
): Promise<LyricSearchResultItem[]> {
  if (!trackName || !trackName.trim()) return [];

  const query: LyricsSearchQuery = {
    trackName,
    artistName,
    albumName,
    durationSecs,
    signal,
    waitForRateLimit: false,
  };

  const tasks = LYRIC_PROVIDERS.map(async (provider): Promise<LyricSearchResultItem | null> => {
    if (signal?.aborted) return null;
    try {
      const raw = await provider.fetch(query);
      if (!raw || !raw.trim()) return null;

      const hasWordSync = isWordSyncedLrc(raw);
      const isSynced = hasLrcTimestamps(raw);
      const hasTranslation = hasTranslationInLyrics(raw);

      // Extract a representative non-empty sample line for UI preview
      const lines = raw.split(/\r?\n/).map((l) => l.replace(/\[\d{1,2}:\d{2}[^\]]*\]/g, '').replace(/<\d{1,2}:\d{2}[^>]*>/g, '').trim()).filter((l) => l.length > 2 && !/^(作词|作曲|by:|ti:|ar:|al:)/i.test(l));
      const sampleLine = lines.slice(0, 2).join(' / ') || undefined;

      return {
        provider: provider.name,
        lyrics: raw.trim(),
        isSynced,
        hasWordSync,
        hasTranslation,
        sampleLine,
      };
    } catch {
      return null;
    }
  });

  const settled = await Promise.allSettled(tasks);
  const results: LyricSearchResultItem[] = [];
  for (const item of settled) {
    if (item.status === 'fulfilled' && item.value) {
      results.push(item.value);
    }
  }

  return results;
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
    {
      strategy: 'fast-cascade',
      waitForRateLimit: false,
    },
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
