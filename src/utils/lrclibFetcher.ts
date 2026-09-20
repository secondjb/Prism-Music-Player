import {
  hasTranslationInLyrics,
  isTtmlContent,
  convertTtmlToLrc,
  decodeXmlEntities,
} from './lyricsParser';

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

export interface FetchLyricsResult {
  lyrics: string | null;
  isWordSynced: boolean;
  source: string;
}

export interface DiscoveredLyrics {
  lyrics: string;
  hasWordSync: boolean;
  hasTranslation: boolean;
  isSynced: boolean;
  source: 'Lyrics+' | 'Unison' | 'NetEase' | 'LRCLIB';
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s*[\(\[](feat|ft|with|prod\.)[^\)\]]*[\)\]]/gi, '')
    .replace(/\s*[\(\[](remaster(ed)?|deluxe|bonus|anniversary|live|explicit)[^\)\]]*[\)\]]/gi, '')
    .replace(/\s*-\s*(remaster(ed)?|deluxe|bonus|live).*$/gi, '')
    .trim();
}

function cleanArtist(artist: string): string {
  return artist
    .split(/[,&/]|feat\.|ft\./i)[0]
    .trim();
}

export function isWordSyncedLrc(lyrics: string | null | undefined): boolean {
  if (!lyrics || typeof lyrics !== 'string') return false;
  if (isTtmlContent(lyrics)) {
    return /<span\b[^>]*\bbegin=/i.test(lyrics);
  }
  if (!lyrics.includes('<')) return false;
  return /<\d{1,2}:\d{2}(?:[.:]\d{2,3})?>/.test(lyrics);
}

export function hasLrcTimestamps(lyrics: string | null | undefined): boolean {
  if (!lyrics || typeof lyrics !== 'string') return false;
  if (isTtmlContent(lyrics)) {
    return /<p\b[^>]*\bbegin=/i.test(lyrics);
  }
  return /\[\d{1,2}:\d{2}/.test(lyrics);
}

/**
 * Shared fetch utility with timeout and AbortSignal support
 */
async function fetchWithTimeout(url: string | URL, options?: RequestInit, timeoutMs = 3500): Promise<Response> {
  const controller = new AbortController();
  const parentSignal = options?.signal;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) {
      clearTimeout(timeoutId);
      controller.abort();
    } else {
      parentSignal.addEventListener('abort', onParentAbort);
    }
  }

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }
}

function parseTimestampToMs(tag: string): number | null {
  const match = tag.match(/\[(\d{1,2}):(\d{2})(?:[.:](\d{2,3}))?\]/);
  if (!match) return null;
  const m = parseInt(match[1], 10) || 0;
  const s = parseInt(match[2], 10) || 0;
  let frac = 0;
  if (match[3]) {
    if (match[3].length === 2) frac = parseInt(match[3], 10) * 10;
    else if (match[3].length === 3) frac = parseInt(match[3], 10);
    else if (match[3].length === 1) frac = parseInt(match[3], 10) * 100;
  }
  return m * 60000 + s * 1000 + frac;
}

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

// Shared rate limit coordinator to avoid hammering LyricsPlus when 429 is encountered
let lyricsPlusRateLimitUntil = 0;
// Circuit breaker to avoid hanging on a dead or unreachable server
let lyricsPlusCircuitBrokenUntil = 0;
let lyricsPlusConsecutiveFailures = 0;

export function isLyricsPlusServiceAvailable(): boolean {
  return Date.now() >= lyricsPlusCircuitBrokenUntil;
}

export function resetLyricsPlusCircuitBreaker(): void {
  lyricsPlusCircuitBrokenUntil = 0;
  lyricsPlusConsecutiveFailures = 0;
}

/**
 * Priority 1: Attempt to fetch rich word-by-word / syllable lyrics from LyricsPlus API
 * Includes progressive retry on 429 Too Many Requests and parses syllable timestamps + dual-language translations.
 */
export async function fetchLyricsPlus(
  trackName: string,
  artistName: string,
  albumName?: string,
  durationSecs?: number,
  signal?: AbortSignal
): Promise<string | null> {
  // If circuit is broken (server dead/timed out), bypass immediately
  if (Date.now() < lyricsPlusCircuitBrokenUntil) {
    return null;
  }

  const endpoint = 'https://lyricsplus.prjktla.my.id/v2/lyrics/get';
  const cTitle = cleanTitle(trackName);
  const cArtist = cleanArtist(artistName);

  if (!cTitle || signal?.aborted) return null;

  // Respect active rate limit window across all workers
  const waitMs = lyricsPlusRateLimitUntil - Date.now();
  if (waitMs > 0) {
    await new Promise((r) => setTimeout(r, Math.min(waitMs, 2000)));
    if (signal?.aborted) return null;
  }

  try {
    const url = new URL(endpoint);
    url.searchParams.set('title', cTitle);
    url.searchParams.set('artist', cArtist);
    if (albumName) url.searchParams.set('album', albumName);
    if (durationSecs && durationSecs > 0) url.searchParams.set('duration', Math.round(durationSecs).toString());

    const resp = await fetchWithTimeout(
      url.toString(),
      {
        headers: {
          'User-Agent': 'PrismMusicPlayer/1.0.0 (https://github.com/prism-player)',
          Accept: 'application/json',
        },
        signal,
      },
      3000
    );

    if (resp.status === 429) {
      lyricsPlusRateLimitUntil = Date.now() + 5000;
      return null;
    }

    if (!resp.ok) {
      return null;
    }

    // Success! Reset failure count
    lyricsPlusConsecutiveFailures = 0;

    const data = await resp.json();
    if (!data || !Array.isArray(data.lyrics) || data.lyrics.length === 0) return null;

    // Convert LyricsPlus structure to Enhanced LRC with <mm:ss.xx> inline timestamps and // translations
    const lrcLines: string[] = [];

    for (const line of data.lyrics) {
      const lineMs = typeof line.time === 'number' ? line.time : 0;
      const totalSec = Math.floor(lineMs / 1000);
      const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
      const s = (totalSec % 60).toString().padStart(2, '0');
      const cs = Math.floor((lineMs % 1000) / 10).toString().padStart(2, '0');
      const tag = `[${m}:${s}.${cs}]`;

      const transText = line.translation?.text ? decodeXmlEntities(line.translation.text).trim() : undefined;
      const lineText = line.text ? decodeXmlEntities(line.text).trim() : '';
      const translationSuffix = transText && transText !== lineText ? ` // ${transText}` : '';

      if (Array.isArray(line.syllabus) && line.syllabus.length > 0) {
        let inlineBody = '';
        for (const syl of line.syllabus) {
          const sylMs = typeof syl.time === 'number' ? syl.time : lineMs;
          const sylSec = Math.floor(sylMs / 1000);
          const sm = Math.floor(sylSec / 60).toString().padStart(2, '0');
          const ss = (sylSec % 60).toString().padStart(2, '0');
          const scs = Math.floor((sylMs % 1000) / 10).toString().padStart(2, '0');
          const sylCleanText = decodeXmlEntities(syl.text || '').trim();
          if (sylCleanText) {
            inlineBody += `<${sm}:${ss}.${scs}>${sylCleanText} `;
          }
        }
        if (inlineBody.trim()) {
          lrcLines.push(`${tag} ${inlineBody.trim()}${translationSuffix}`);
        } else if (lineText) {
          lrcLines.push(`${tag} ${lineText}${translationSuffix}`);
        }
      } else if (lineText) {
        lrcLines.push(`${tag} ${lineText}${translationSuffix}`);
      }
    }

    if (lrcLines.length > 0) {
      return lrcLines.join('\n');
    }
    return null;
  } catch {
    lyricsPlusConsecutiveFailures++;
    if (lyricsPlusConsecutiveFailures >= 2) {
      // Break circuit for 5 minutes
      lyricsPlusCircuitBrokenUntil = Date.now() + 5 * 60 * 1000;
    }
    return null;
  }
}

/**
 * Priority 2: Unison API (https://unison.boidu.dev/lyrics)
 * Fetches community-backed synced lyrics, TTML, romanizations, and translations.
 */
export async function fetchUnisonLyrics(
  trackName: string,
  artistName: string,
  albumName?: string,
  durationSecs?: number,
  signal?: AbortSignal
): Promise<string | null> {
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

    // Check if response is JSON or direct XML/LRC
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

/**
 * Priority 3: NetEase Cloud Music (via public proxy)
 * Search endpoint + Lyric endpoint with line-by-line translation merge.
 */
export async function fetchNeteaseLyrics(
  trackName: string,
  artistName: string,
  signal?: AbortSignal
): Promise<string | null> {
  if (signal?.aborted) return null;
  const cTitle = cleanTitle(trackName);
  const cArtist = cleanArtist(artistName);
  if (!cTitle) return null;

  try {
    // 1. Search song ID
    const searchUrl = `https://netease-cloud-music-api-external.vercel.app/search?keywords=${encodeURIComponent(
      `${cArtist} ${cTitle}`.trim()
    )}&type=1`;
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

    if (!searchResp.ok) return null;
    const searchData = await searchResp.json();
    const songs = searchData?.result?.songs || searchData?.songs;
    if (!Array.isArray(songs) || songs.length === 0 || !songs[0]?.id) {
      return null;
    }

    const songId = songs[0].id;
    if (signal?.aborted) return null;

    // 2. Fetch lyrics
    const lyricUrl = `https://netease-cloud-music-api-external.vercel.app/lyric?id=${songId}`;
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

    if (!lyricResp.ok) return null;
    const lyricData = await lyricResp.json();

    let rawLrc: string | undefined = lyricData?.lrc?.lyric;
    let rawTlyric: string | undefined = lyricData?.tlyric?.lyric;
    const rawRomalrc: string | undefined = lyricData?.romalrc?.lyric;

    if (!rawLrc || typeof rawLrc !== 'string' || !rawLrc.trim()) {
      return null;
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
    return null;
  }
}

/**
 * Priority 4: LRCLIB Direct
 */
export async function fetchLrclibDirect(
  trackName: string,
  artistName: string,
  albumName?: string,
  durationSecs?: number,
  signal?: AbortSignal
): Promise<string | null> {
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
        // Fallback search query
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

/**
 * Searches across 4 tiers of lyric APIs in strict cascade order:
 * 1. LyricsPlus (Word-synced & translated)
 * 2. Unison (Synced lyrics, TTML word-sync & romanization)
 * 3. NetEase (Merged original + CJK translations)
 * 4. LRCLIB (Standard line-synced or plain text)
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

  // 1. Priority 1: LyricsPlus
  const lpLrc = await fetchLyricsPlus(trackName, artistName, albumName, durationSecs, signal);
  if (lpLrc) {
    const hasWordSync = isWordSyncedLrc(lpLrc);
    const hasTranslation = hasTranslationInLyrics(lpLrc);
    const isSynced = hasLrcTimestamps(lpLrc);
    if (hasWordSync || hasTranslation || isSynced) {
      return {
        lyrics: lpLrc,
        hasWordSync,
        hasTranslation,
        isSynced,
        source: 'Lyrics+',
      };
    }
  }

  // 2. Priority 2: Unison API (handles TTML word-by-word sync too!)
  const unisonLrc = await fetchUnisonLyrics(trackName, artistName, albumName, durationSecs, signal);
  if (unisonLrc) {
    const hasWordSync = isWordSyncedLrc(unisonLrc);
    const hasTranslation = hasTranslationInLyrics(unisonLrc);
    const isSynced = hasLrcTimestamps(unisonLrc);
    if (hasWordSync || hasTranslation || isSynced || unisonLrc.trim().length > 0) {
      if (!requireWordSync || hasWordSync) {
        return {
          lyrics: unisonLrc,
          hasWordSync,
          hasTranslation,
          isSynced,
          source: 'Unison',
        };
      }
    }
  }

  // If user strictly requested word-sync lyrics and neither Lyrics+ nor Unison had word sync, return null
  if (requireWordSync) {
    return null;
  }

  // 3. Priority 3: NetEase Cloud Music (merged with translations)
  const neteaseLrc = await fetchNeteaseLyrics(trackName, artistName, signal);
  if (neteaseLrc) {
    const hasWordSync = isWordSyncedLrc(neteaseLrc);
    const hasTranslation = hasTranslationInLyrics(neteaseLrc);
    const isSynced = hasLrcTimestamps(neteaseLrc);
    if (hasWordSync || hasTranslation || isSynced || neteaseLrc.trim().length > 0) {
      return {
        lyrics: neteaseLrc,
        hasWordSync,
        hasTranslation,
        isSynced,
        source: 'NetEase',
      };
    }
  }

  // 4. Priority 4: LRCLIB Direct
  const lrclibLrc = await fetchLrclibDirect(trackName, artistName, albumName, durationSecs, signal);
  if (lrclibLrc) {
    const hasWordSync = isWordSyncedLrc(lrclibLrc);
    const hasTranslation = hasTranslationInLyrics(lrclibLrc);
    const isSynced = hasLrcTimestamps(lrclibLrc);
    return {
      lyrics: lrclibLrc,
      hasWordSync,
      hasTranslation,
      isSynced,
      source: 'LRCLIB',
    };
  }

  return null;
}

/**
 * Backward compatibility wrapper for fetching lyrics with full 4-tier cascade support.
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
): Promise<string | null> {
  const res = await searchEnhancedLyrics(trackName, artistName, albumName, durationSecs, signal);
  return res?.lyrics || null;
}
