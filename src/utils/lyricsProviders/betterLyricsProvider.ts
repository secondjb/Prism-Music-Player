import { convertTtmlToLrc, isTtmlContent } from '../lyricsParser';
import { cleanArtist, cleanTitle, fetchWithTimeout } from './providerUtils';
import type { LyricsProvider, LyricsSearchQuery } from './types';

/**
 * BetterLyrics Word-Sync provider (cached Apple Music & TTML lyrics).
 */
export class BetterLyricsProvider implements LyricsProvider {
  readonly name = 'BetterLyrics' as const;
  readonly tier = 'Tier 2 (TTML Word-Sync)';
  readonly description = 'Cached TTML syllable-synced lyrics';
  readonly endpoint = 'lyrics-api.boidu.dev';
  readonly supportsWordSync = true;

  async fetch(query: LyricsSearchQuery): Promise<string | null> {
    const { trackName, artistName, albumName, durationSecs, signal } = query;
    if (signal?.aborted) return null;

    const cTitle = cleanTitle(trackName);
    const cArtist = cleanArtist(artistName);
    if (!cTitle) return null;

    try {
      const params = new URLSearchParams();
      params.set('s', cTitle);
      params.set('a', cArtist);
      if (durationSecs && durationSecs > 0) params.set('d', Math.round(durationSecs).toString());
      if (albumName) params.set('al', albumName);

      const endpoints = [
        `https://lyrics-api.boidu.dev/getLyrics?${params.toString()}`,
        `https://lyrics-api.boidu.dev/ttml/getLyrics?${params.toString()}`,
      ];

      for (const ep of endpoints) {
        if (signal?.aborted) return null;
        try {
          const res = await fetchWithTimeout(
            ep,
            {
              headers: {
                'User-Agent': 'LastWave-Android/1.0 (https://github.com/clash-projects/lastwave)',
                Accept: 'application/json',
              },
              signal,
            },
            3000
          );

          if (!res.ok) continue;
          const data = await res.json();
          const rawTtml = data?.ttml || data?.lyrics || null;
          if (rawTtml && isTtmlContent(rawTtml)) {
            const lrc = convertTtmlToLrc(rawTtml);
            if (lrc && lrc.trim()) return lrc.trim();
          }
        } catch {
          // continue to next endpoint
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async ping(): Promise<'online' | 'offline'> {
    try {
      const res = await fetchWithTimeout(
        'https://lyrics-api.boidu.dev/getLyrics?s=test&a=test',
        { headers: { 'User-Agent': 'PrismMusicPlayer/1.0.0' } },
        3000
      );
      return res.status === 200 || res.status === 401 || res.status === 404 ? 'online' : 'offline';
    } catch {
      return 'offline';
    }
  }
}
