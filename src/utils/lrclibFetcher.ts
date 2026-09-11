import { hasTranslationInLyrics } from './lyricsParser';

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
  source: 'Lyrics+' | 'LRCLIB';
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
  if (!lyrics || !lyrics.includes('<')) return false;
  return /<\d{1,2}:\d{2}(?:[.:]\d{2,3})?>/.test(lyrics);
}

export function hasLrcTimestamps(lyrics: string | null | undefined): boolean {
  if (!lyrics) return false;
  return /\[\d{1,2}:\d{2}/.test(lyrics);
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
 * Attempt to fetch rich word-by-word / syllable lyrics from LyricsPlus API (LastWave-native source)
 * Includes progressive retry on 429 Too Many Requests and parses syllable timestamps + dual-language translations.
 */
async function fetchLyricsPlus(
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

  if (signal?.aborted) return null;

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const onParentAbort = () => controller.abort();
    signal?.addEventListener('abort', onParentAbort);

    let resp: Response;
    try {
      resp = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'PrismMusicPlayer/1.0.0 (https://github.com/prism-player)',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onParentAbort);
    }

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

      const transText = line.translation?.text?.trim();
      const translationSuffix = transText && transText !== line.text?.trim() ? ` // ${transText}` : '';

      if (Array.isArray(line.syllabus) && line.syllabus.length > 0) {
        let inlineBody = '';
        for (const syl of line.syllabus) {
          const sylMs = typeof syl.time === 'number' ? syl.time : lineMs;
          const sylSec = Math.floor(sylMs / 1000);
          const sm = Math.floor(sylSec / 60).toString().padStart(2, '0');
          const ss = (sylSec % 60).toString().padStart(2, '0');
          const scs = Math.floor((sylMs % 1000) / 10).toString().padStart(2, '0');
          inlineBody += `<${sm}:${ss}.${scs}>${syl.text} `;
        }
        lrcLines.push(`${tag} ${inlineBody.trim()}${translationSuffix}`);
      } else {
        lrcLines.push(`${tag} ${(line.text || '').trim()}${translationSuffix}`);
      }
    }

    if (lrcLines.length > 0) {
      return lrcLines.join('\n');
    }
    return null;
  } catch {
    // Network failure / timeout
    lyricsPlusConsecutiveFailures++;
    if (lyricsPlusConsecutiveFailures >= 2) {
      // Break circuit for 5 minutes
      lyricsPlusCircuitBrokenUntil = Date.now() + 5 * 60 * 1000;
    }
    return null;
  }
}

async function fetchLrclibDirect(
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);
      const onParentAbort = () => controller.abort();
      signal?.addEventListener('abort', onParentAbort);

      const url = `https://lrclib.net/api/get?${params.toString()}`;
      let response: Response;
      try {
        response = await fetch(url, {
          headers: {
            'User-Agent': 'PrismMusicPlayer/1.0.0 (https://github.com/prism-player)',
            Accept: 'application/json',
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onParentAbort);
      }

      if (response.status === 429 || response.status === 503) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      if (response.ok) {
        const data: LrclibResponse = await response.json();
        if (data?.syncedLyrics) return data.syncedLyrics;
        if (data?.plainLyrics) return data.plainLyrics;
      } else {
        // Fallback search
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${cArtist} ${cTitle}`)}`;
        const searchRes = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'PrismMusicPlayer/1.0.0 (https://github.com/prism-player)',
          },
          signal,
        });
        if (searchRes.ok) {
          const results: LrclibResponse[] = await searchRes.json();
          if (results && results.length > 0) {
            const match = results.find((r) => r.syncedLyrics) || results.find((r) => r.plainLyrics) || results[0];
            return match.syncedLyrics || match.plainLyrics || null;
          }
        }
      }
      return null;
    } catch {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
  return null;
}

export async function fetchLrclibLyrics(
  trackName: string,
  artistName: string,
  albumName?: string,
  durationSecs?: number,
  preferWordSync: boolean = false
): Promise<string | null> {
  // 1. If preferWordSync, try LyricsPlus word sync first
  if (preferWordSync) {
    try {
      const wordLrc = await fetchLyricsPlus(trackName, artistName, albumName, durationSecs);
      if (wordLrc && isWordSyncedLrc(wordLrc)) {
        return wordLrc;
      }
    } catch {
      // Fallback to LRCLIB
    }
  }

  // 2. Query LRCLIB
  try {
    const params = new URLSearchParams();
    params.set('track_name', trackName);
    params.set('artist_name', artistName);
    if (albumName) params.set('album_name', albumName);
    if (durationSecs && durationSecs > 0) params.set('duration', Math.round(durationSecs).toString());

    const url = `https://lrclib.net/api/get?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PrismMusicPlayer/1.0.0 (https://github.com/prism-player)',
      },
    });

    if (!response.ok) {
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanArtist(artistName)} ${cleanTitle(trackName)}`)}`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'PrismMusicPlayer/1.0.0 (https://github.com/prism-player)',
        },
      });
      if (searchRes.ok) {
        const results: LrclibResponse[] = await searchRes.json();
        if (results && results.length > 0) {
          const match = results.find((r) => r.syncedLyrics) || results.find((r) => r.plainLyrics) || results[0];
          return match.syncedLyrics || match.plainLyrics || null;
        }
      }
      return null;
    }

    const data: LrclibResponse = await response.json();
    return data.syncedLyrics || data.plainLyrics || null;
  } catch (e) {
    console.warn('LRCLIB fetch error:', e);
    return null;
  }
}

/**
 * Searches across LyricsPlus and LRCLIB to find the highest-tier lyrics available:
 * 1. Word-synced + translated (LyricsPlus)
 * 2. Word-synced (LyricsPlus)
 * 3. Translated synced (LyricsPlus / LRCLIB)
 * 4. Synced lyrics (LRCLIB)
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

  // 1. Try LyricsPlus first for rich word sync & translation
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

  // If user strictly requested word-sync lyrics, don't fall back to line-synced LRCLIB
  if (requireWordSync) {
    return null;
  }

  // 2. Fallback to LRCLIB
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
