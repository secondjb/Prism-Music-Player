import { isTtmlContent } from '../lyricsParser';

/**
 * Strips common clutter from track titles (e.g. "feat. X", "Remastered", "Live")
 */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s*[\(\[](feat|ft|with|prod\.)[^\)\]]*[\)\]]/gi, '')
    .replace(/\s*[\(\[](remaster(ed)?|deluxe|bonus|anniversary|live|explicit)[^\)\]]*[\)\]]/gi, '')
    .replace(/\s*-\s*(remaster(ed)?|deluxe|bonus|live).*$/gi, '')
    .trim();
}

/**
 * Cleans artist name to primary artist for searching
 */
export function cleanArtist(artist: string): string {
  return artist
    .split(/[,&/]|feat\.|ft\./i)[0]
    .trim();
}

/**
 * Checks if a lyric string contains word/syllable timing tags (<mm:ss.xx> or TTML span begin)
 */
export function isWordSyncedLrc(lyrics: string | null | undefined): boolean {
  if (!lyrics || typeof lyrics !== 'string') return false;
  if (isTtmlContent(lyrics)) {
    return /<span\b[^>]*\bbegin=/i.test(lyrics);
  }
  if (!lyrics.includes('<')) return false;
  return /<\d{1,2}:\d{2}(?:[.:]\d{2,3})?>/.test(lyrics);
}

/**
 * Checks if a lyric string contains line-level timestamps ([mm:ss.xx] or TTML p begin)
 */
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
export async function fetchWithTimeout(
  url: string | URL,
  options?: RequestInit,
  timeoutMs = 3500
): Promise<Response> {
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

/**
 * Parses timestamp string [mm:ss.xx] into milliseconds
 */
export function parseTimestampToMs(tag: string): number | null {
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
