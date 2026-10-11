import { convertTtmlToLrc, decodeXmlEntities, isTtmlContent } from '../lyricsParser';
import { cleanArtist, cleanTitle, fetchWithTimeout } from './providerUtils';
import type { LyricsProvider, LyricsSearchQuery } from './types';

export interface LrclibResponse {
  id: number;
  name: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

/**
 * LRCLIB Direct Provider (line-synced or plain text fallback).
 */
export class LrclibLyricsProvider implements LyricsProvider {
  readonly name = 'LRCLIB' as const;
  readonly tier = 'Tier 7 (Line-Sync Fallback)';
  readonly description = 'Standard line-synced & plain text lyrics';
  readonly endpoint = 'lrclib.net';
  readonly supportsWordSync = false;

  async fetch(query: LyricsSearchQuery): Promise<string | null> {
    const { trackName, artistName, albumName, durationSecs, signal } = query;
    if (signal?.aborted) return null;

    const cTitle = cleanTitle(trackName);
    const cArtist = cleanArtist(artistName);

    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal?.aborted) return null;
      try {
        const params = new URLSearchParams();
        params.set('track_name', cTitle);
        params.set('artist_name', cArtist);
        if (albumName) params.set('album_name', albumName);
        if (durationSecs && durationSecs > 0) params.set('duration', Math.round(durationSecs).toString());

        const url = `https://lrclib.net/api/get?${params.toString()}`;
        const response = await fetchWithTimeout(
          url,
          {
            headers: {
              'User-Agent': 'PrismMusicPlayer/1.0.0 (https://github.com/prism-player)',
              Accept: 'application/json',
            },
            signal,
          },
          3500
        );

        if (response.status === 429 || response.status === 503) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        if (response.ok) {
          const data: LrclibResponse = await response.json();
          let resLyrics = data?.syncedLyrics || data?.plainLyrics || null;
          if (resLyrics) {
            if (isTtmlContent(resLyrics)) {
              resLyrics = convertTtmlToLrc(resLyrics);
            } else {
              resLyrics = decodeXmlEntities(resLyrics);
            }
            return resLyrics.trim();
          }
        } else {
          const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${cArtist} ${cTitle}`)}`;
          const searchRes = await fetchWithTimeout(
            searchUrl,
            {
              headers: {
                'User-Agent': 'PrismMusicPlayer/1.0.0 (https://github.com/prism-player)',
              },
              signal,
            },
            3500
          );
          if (searchRes.ok) {
            const results: LrclibResponse[] = await searchRes.json();
            if (results && results.length > 0) {
              const match = results.find((r) => r.syncedLyrics) || results.find((r) => r.plainLyrics) || results[0];
              let resLyrics = match.syncedLyrics || match.plainLyrics || null;
              if (resLyrics) {
                if (isTtmlContent(resLyrics)) {
                  resLyrics = convertTtmlToLrc(resLyrics);
                } else {
                  resLyrics = decodeXmlEntities(resLyrics);
                }
                return resLyrics.trim();
              }
            }
          }
        }
        return null;
      } catch {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    }
    return null;
  }

  async ping(): Promise<'online' | 'offline'> {
    try {
      const res = await fetchWithTimeout(
        'https://lrclib.net/api/get?track_name=test&artist_name=test',
        { headers: { 'User-Agent': 'PrismMusicPlayer/1.0.0' } },
        3000
      );
      return res.status === 200 || res.status === 404 ? 'online' : 'offline';
    } catch {
      return 'offline';
    }
  }
}
