import { convertTtmlToLrc, decodeXmlEntities, isTtmlContent } from '../lyricsParser';
import { cleanArtist, cleanTitle, fetchWithTimeout } from './providerUtils';
import type { LyricsProvider, LyricsSearchQuery } from './types';

/**
 * SyncLRC multi-source karaoke and synced lyrics provider.
 */
export class SyncLrcLyricsProvider implements LyricsProvider {
  readonly name = 'SyncLRC' as const;
  readonly tier = 'Tier 5 (Karaoke Multi-Source)';
  readonly description = 'Multi-source karaoke word-sync & synced lyrics';
  readonly endpoint = 'synclrc.tharuk.pro';
  readonly supportsWordSync = true;

  async fetch(query: LyricsSearchQuery): Promise<string | null> {
    const { trackName, artistName, albumName, durationSecs, signal } = query;
    if (signal?.aborted) return null;

    const cTitle = cleanTitle(trackName);
    const cArtist = cleanArtist(artistName);
    if (!cTitle) return null;

    const params = new URLSearchParams();
    params.set('track', cTitle);
    params.set('artist', cArtist);
    if (albumName) params.set('album', albumName);
    if (durationSecs && durationSecs > 0) params.set('duration', Math.round(durationSecs).toString());

    const endpoints = [
      `https://synclrc.tharuk.pro/api/v1/lyrics?${params.toString()}`,
      `https://synclrc.workers.dev/api/lyrics?${params.toString()}`,
    ];

    for (const ep of endpoints) {
      if (signal?.aborted) return null;
      try {
        const res = await fetchWithTimeout(
          ep,
          {
            headers: {
              'User-Agent': 'PrismMusicPlayer/1.0.0 (https://github.com/prism-player)',
              Accept: 'application/json, text/plain',
            },
            signal,
          },
          3000
        );

        if (!res.ok) continue;
        const data = await res.json();
        if (!data) continue;

        const raw =
          (typeof data.karaoke === 'string' && data.karaoke) ||
          (typeof data.synced === 'string' && data.synced) ||
          (typeof data.ttml === 'string' && data.ttml) ||
          (typeof data.lrc === 'string' && data.lrc) ||
          (typeof data.plain === 'string' && data.plain) ||
          (typeof data.lyrics === 'string' && data.lyrics) ||
          null;

        if (raw && raw.trim()) {
          if (isTtmlContent(raw)) {
            return convertTtmlToLrc(raw);
          }
          return decodeXmlEntities(raw.trim());
        }
      } catch {
        // Continue to next endpoint
      }
    }

    return null;
  }

  async ping(): Promise<'online' | 'offline'> {
    try {
      const res = await fetchWithTimeout(
        'https://synclrc.tharuk.pro/api/v1/lyrics?track=test&artist=test',
        { headers: { 'User-Agent': 'PrismMusicPlayer/1.0.0' } },
        3000
      );
      return res.status === 200 || res.status === 404 ? 'online' : 'offline';
    } catch {
      return 'offline';
    }
  }
}
