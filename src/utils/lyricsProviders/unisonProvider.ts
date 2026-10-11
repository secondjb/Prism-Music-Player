import { convertTtmlToLrc, decodeXmlEntities, isTtmlContent } from '../lyricsParser';
import { cleanArtist, cleanTitle, fetchWithTimeout } from './providerUtils';
import type { LyricsProvider, LyricsSearchQuery } from './types';

/**
 * Unison Community Synced Lyrics & TTML provider.
 */
export class UnisonLyricsProvider implements LyricsProvider {
  readonly name = 'Unison' as const;
  readonly tier = 'Tier 4 (TTML/Synced)';
  readonly description = 'Community TTML word-sync & romanizations';
  readonly endpoint = 'unison.boidu.dev';
  readonly supportsWordSync = true;

  async fetch(query: LyricsSearchQuery): Promise<string | null> {
    const { trackName, artistName, albumName, durationSecs, signal } = query;
    if (signal?.aborted) return null;

    const cTitle = cleanTitle(trackName);
    const cArtist = cleanArtist(artistName);
    if (!cTitle || !cArtist) return null;

    try {
      const url = new URL('https://unison.boidu.dev/lyrics');
      url.searchParams.set('song', cTitle);
      url.searchParams.set('artist', cArtist);
      if (albumName) url.searchParams.set('album', albumName);
      if (durationSecs && durationSecs > 0) {
        url.searchParams.set('duration', Math.round(durationSecs * 1000).toString());
      }

      const resp = await fetchWithTimeout(
        url.toString(),
        {
          headers: {
            'User-Agent': 'PrismMusicPlayer/1.0.0 (https://github.com/prism-player)',
            Accept: 'application/json, text/plain, text/xml',
          },
          signal,
        },
        3500
      );

      if (!resp.ok) return null;

      const rawText = await resp.text();
      if (!rawText || !rawText.trim()) return null;

      let lrcString: string | null = null;

      if (rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
        try {
          const data = JSON.parse(rawText);
          if (data && data.success !== false && !data.error) {
            const direct =
              (typeof data.lrc === 'string' && data.lrc) ||
              (typeof data.ttml === 'string' && data.ttml) ||
              (typeof data.syncedLyrics === 'string' && data.syncedLyrics) ||
              (typeof data.lyrics === 'string' && data.lyrics) ||
              (typeof data.plainLyrics === 'string' && data.plainLyrics) ||
              (typeof data.data?.lrc === 'string' && data.data.lrc) ||
              (typeof data.data?.ttml === 'string' && data.data.ttml) ||
              (typeof data.data?.syncedLyrics === 'string' && data.data.syncedLyrics) ||
              (typeof data.data?.lyrics === 'string' && data.data.lyrics) ||
              (typeof data.data === 'string' && data.data) ||
              null;

            if (direct && direct.trim()) {
              lrcString = direct.trim();
            } else {
              const linesArray = Array.isArray(data.lyrics)
                ? data.lyrics
                : Array.isArray(data.lines)
                ? data.lines
                : Array.isArray(data.data?.lyrics)
                ? data.data.lyrics
                : null;

              if (linesArray && linesArray.length > 0) {
                const lrcLines: string[] = [];
                for (const line of linesArray) {
                  if (typeof line === 'string') {
                    lrcLines.push(line);
                  } else if (typeof line === 'object' && line !== null) {
                    const timeMs =
                      typeof line.time === 'number'
                        ? line.time
                        : typeof line.timeMs === 'number'
                        ? line.timeMs
                        : 0;
                    const totalSec = Math.floor(timeMs / 1000);
                    const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
                    const s = (totalSec % 60).toString().padStart(2, '0');
                    const cs = Math.floor((timeMs % 1000) / 10).toString().padStart(2, '0');
                    const tag = `[${m}:${s}.${cs}]`;
                    const text = decodeXmlEntities((line.text || line.content || '').trim());
                    const trans = decodeXmlEntities((line.translation?.text || line.translation || '').trim());
                    const suffix = trans && trans !== text ? ` // ${trans}` : '';
                    lrcLines.push(`${tag} ${text}${suffix}`);
                  }
                }
                if (lrcLines.length > 0) lrcString = lrcLines.join('\n');
              }
            }
          }
        } catch {
          lrcString = rawText.trim();
        }
      } else {
        lrcString = rawText.trim();
      }

      if (!lrcString) return null;

      if (isTtmlContent(lrcString)) {
        lrcString = convertTtmlToLrc(lrcString);
      } else {
        lrcString = decodeXmlEntities(lrcString);
      }

      return lrcString && lrcString.trim() ? lrcString.trim() : null;
    } catch {
      return null;
    }
  }

  async ping(): Promise<'online' | 'offline'> {
    try {
      const res = await fetchWithTimeout(
        'https://unison.boidu.dev/lyrics?song=test&artist=test',
        { headers: { 'User-Agent': 'PrismMusicPlayer/1.0.0' } },
        3000
      );
      const text = await res.text();
      return text.includes('Lyrics not found') || text.includes('success') || res.status === 200
        ? 'online'
        : 'offline';
    } catch {
      return 'offline';
    }
  }
}
