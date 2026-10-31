import { decodeXmlEntities } from '../lyricsParser';
import { cleanArtist, cleanTitle, fetchWithTimeout, parseTimestampToMs } from './providerUtils';
import type { LyricsProvider, LyricsSearchQuery } from './types';

/**
 * Merges NetEase original lyrics and translated lyrics line-by-line based on timestamps.
 */
function mergeNeteaseTranslations(originalLrc: string, translatedLrc: string): string {
  const transMap = new Map<number, string>();
  const transEntries: { timeMs: number; text: string }[] = [];

  for (const tLine of translatedLrc.split(/\r?\n/)) {
    const trimmed = tLine.trim();
    if (!trimmed) continue;
    const timeMatch = trimmed.match(/^\[(\d{1,2}:\d{2}(?:[.:]\d{2,3})?)\](.*)$/);
    if (timeMatch) {
      const ms = parseTimestampToMs(`[${timeMatch[1]}]`);
      const text = timeMatch[2].trim();
      if (ms !== null && text) {
        if (!/^(作词|作曲|编曲|制作|翻译|贡献|Lyricist|Composer|Arranger)/i.test(text)) {
          transMap.set(ms, text);
          transEntries.push({ timeMs: ms, text });
        }
      }
    }
  }

  if (transEntries.length === 0) {
    return originalLrc.trim();
  }

  const mergedLines: string[] = [];

  for (const oLine of originalLrc.split(/\r?\n/)) {
    const trimmed = oLine.trim();
    if (!trimmed) continue;

    const timeMatch = trimmed.match(/^(\[\d{1,2}:\d{2}(?:[.:]\d{2,3})?\])(.*)$/);
    if (!timeMatch) {
      mergedLines.push(trimmed);
      continue;
    }

    const tag = timeMatch[1];
    const text = timeMatch[2].trim();
    const ms = parseTimestampToMs(tag);

    if (ms === null || !text) {
      mergedLines.push(trimmed);
      continue;
    }

    let matchingTrans = transMap.get(ms);
    if (!matchingTrans) {
      const nearest = transEntries.find((entry) => Math.abs(entry.timeMs - ms) <= 250);
      if (nearest) {
        matchingTrans = nearest.text;
      }
    }

    if (matchingTrans && matchingTrans !== text && !text.includes('//')) {
      mergedLines.push(`${tag} ${text} // ${matchingTrans}`);
    } else {
      mergedLines.push(trimmed);
    }
  }

  return mergedLines.join('\n');
}

const NETEASE_BASE_URLS = [
  'https://netease-cloud-music-api-psi-three.vercel.app',
];

/**
 * NetEase Cloud Music Provider (Search + Lyric with CJK translation merging).
 */
export class NeteaseLyricsProvider implements LyricsProvider {
  readonly name = 'NetEase' as const;
  readonly tier = 'Tier 6 (CJK Translations)';
  readonly description = 'Line-synced lyrics & CJK translations merge';
  readonly endpoint = 'netease-cloud-music-api';
  readonly supportsWordSync = false;

  async fetch(query: LyricsSearchQuery): Promise<string | null> {
    const { trackName, artistName, signal } = query;
    if (signal?.aborted) return null;

    const cTitle = cleanTitle(trackName);
    const cArtist = cleanArtist(artistName);
    if (!cTitle) return null;

    for (const baseUrl of NETEASE_BASE_URLS) {
      if (signal?.aborted) return null;
      try {
        const kw = cArtist ? `${cArtist} ${cTitle}`.trim() : cTitle;
        const searchUrl = `${baseUrl}/cloudsearch?keywords=${encodeURIComponent(kw)}`;
        const searchResp = await fetchWithTimeout(
          searchUrl,
          {
            headers: {
              'User-Agent': 'PrismMusicPlayer/1.0.0 (https://github.com/prism-player)',
              Accept: 'application/json',
            },
            signal,
          },
          3000
        );

        if (!searchResp.ok) continue;
        const searchData = await searchResp.json();
        const songs = searchData?.result?.songs || searchData?.songs;
        if (!Array.isArray(songs) || songs.length === 0 || !songs[0]?.id) {
          continue;
        }

        const songId = songs[0].id;
        if (signal?.aborted) return null;

        const lyricUrl = `${baseUrl}/lyric?id=${songId}`;
        const lyricResp = await fetchWithTimeout(
          lyricUrl,
          {
            headers: {
              'User-Agent': 'PrismMusicPlayer/1.0.0 (https://github.com/prism-player)',
              Accept: 'application/json',
            },
            signal,
          },
          3000
        );

        if (!lyricResp.ok) continue;
        const lyricData = await lyricResp.json();

        let rawLrc: string | undefined = lyricData?.lrc?.lyric;
        let rawTlyric: string | undefined = lyricData?.tlyric?.lyric;
        const rawRomalrc: string | undefined = lyricData?.romalrc?.lyric;

        if (!rawLrc || typeof rawLrc !== 'string' || !rawLrc.trim()) {
          continue;
        }

        rawLrc = decodeXmlEntities(rawLrc);
        if (rawTlyric) rawTlyric = decodeXmlEntities(rawTlyric);

        if (!rawTlyric || typeof rawTlyric !== 'string' || !rawTlyric.trim()) {
          if (rawRomalrc && typeof rawRomalrc === 'string' && rawRomalrc.trim()) {
            return mergeNeteaseTranslations(rawLrc, decodeXmlEntities(rawRomalrc));
          }
          return rawLrc.trim();
        }

        return mergeNeteaseTranslations(rawLrc, rawTlyric);
      } catch {
        continue;
      }
    }

    return null;
  }

  async ping(): Promise<'online' | 'offline'> {
    for (const baseUrl of NETEASE_BASE_URLS) {
      try {
        const res = await fetchWithTimeout(
          `${baseUrl}/cloudsearch?keywords=test`,
          { headers: { 'User-Agent': 'PrismMusicPlayer/1.0.0' } },
          3000
        );
        const text = await res.text();
        if (res.status === 200 && !text.includes('DEPLOYMENT_NOT_FOUND')) {
          return 'online';
        }
      } catch {
        // try next
      }
    }
    return 'offline';
  }
}
