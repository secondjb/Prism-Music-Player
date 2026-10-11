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
  source: 'Apple Music' | 'Lyrics+' | 'BetterLyrics' | 'Kugou' | 'Unison' | 'SyncLRC' | 'NetEase' | 'LRCLIB';
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

// Kugou KRC decryption key (same as LastWave / Kugou PC client)
const KUGOU_KRC_KEY = new Uint8Array([
  0x40, 0x47, 0x61, 0x77, 0x5e, 0x32, 0x74, 0x47,
  0x51, 0x36, 0x31, 0x2d, 0xce, 0xd2, 0x6e, 0x69,
]);

/**
 * Apple Music Syllable-synced & TTML Lyrics provider.
 * Uses iTunes Search API to resolve trackId, then queries Paxsenix/Lyrically aggregator for TTML/syllable sync.
 */
export async function fetchAppleMusicLyrics(
  trackName: string,
  artistName: string,
  albumName?: string,
  durationSecs?: number,
  signal?: AbortSignal
): Promise<string | null> {
  if (signal?.aborted) return null;
  const cTitle = cleanTitle(trackName);
  const cArtist = cleanArtist(artistName);
  if (!cTitle) return null;

  try {
    const term = cArtist ? `${cArtist} ${cTitle}` : cTitle;
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=5`;

    const itunesResp = await fetchWithTimeout(
      itunesUrl,
      {
        headers: {
          'User-Agent': 'PrismMusicPlayer/1.0.0 (https://github.com/prism-player)',
          Accept: 'application/json',
        },
        signal,
      },
      3500
    );

    if (!itunesResp.ok) return null;
    const itunesData = await itunesResp.json();
    const results = itunesData?.results;
    if (!Array.isArray(results) || results.length === 0) return null;

    // Find the best matching candidate based on title and duration proximity
    let bestTrack = results[0];
    const targetMs = durationSecs && durationSecs > 0 ? durationSecs * 1000 : null;

    if (results.length > 1) {
      const scored = results.map((r: any) => {
        let score = 0;
        const rName = (r.trackName || '').toLowerCase();
        const rArtist = (r.artistName || '').toLowerCase();
        if (rName.includes(cTitle.toLowerCase()) || cTitle.toLowerCase().includes(rName)) score += 3;
        if (cArtist && (rArtist.includes(cArtist.toLowerCase()) || cArtist.toLowerCase().includes(rArtist))) score += 2;
        if (albumName && r.collectionName && (r.collectionName.toLowerCase().includes(albumName.toLowerCase()) || albumName.toLowerCase().includes(r.collectionName.toLowerCase()))) score += 1;
        if (targetMs && r.trackTimeMillis) {
          const diff = Math.abs(r.trackTimeMillis - targetMs);
          if (diff <= 3000) score += 3;
          else if (diff <= 10000) score += 1;
        }
        return { track: r, score };
      });
      scored.sort((a: any, b: any) => b.score - a.score);
      bestTrack = scored[0].track;
    }

    if (!bestTrack?.trackId) return null;
    if (signal?.aborted) return null;

    // 1. Try TTML endpoint (returns rich word/syllable spans)
    const ttmlUrl = `https://lyrics.paxsenix.org/apple-music/lyrics?id=${bestTrack.trackId}&ttml=true`;
    const ttmlResp = await fetchWithTimeout(
      ttmlUrl,
      {
        headers: {
          'User-Agent': 'LastWave',
          Accept: 'application/json, text/xml, */*',
        },
        signal,
      },
      3500
    );

    if (ttmlResp.ok) {
      let rawTtml = await ttmlResp.text();
      if (rawTtml && rawTtml.trim()) {
        try {
          const parsedJson = JSON.parse(rawTtml);
          if (parsedJson.ttml) rawTtml = parsedJson.ttml;
        } catch {
          // Plain text TTML
        }

        if (isTtmlContent(rawTtml)) {
          const lrc = convertTtmlToLrc(rawTtml);
          if (lrc && lrc.trim()) return lrc.trim();
        }
      }
    }

    // 2. Fallback to v=2 envelope endpoint
    if (signal?.aborted) return null;
    const envUrl = `https://lyrics.paxsenix.org/apple-music/lyrics?id=${bestTrack.trackId}&v=2`;
    const envResp = await fetchWithTimeout(
      envUrl,
      {
        headers: {
          'User-Agent': 'LastWave',
          Accept: 'application/json',
        },
        signal,
      },
      3500
    );

    if (envResp.ok) {
      const envData = await envResp.json();
      if (envData) {
        if (Array.isArray(envData.lyrics) && envData.lyrics.length > 0) {
          const lrcLines: string[] = [];
          for (const line of envData.lyrics) {
            const lineMs = typeof line.timestamp === 'number' ? line.timestamp : 0;
            const totalSec = Math.floor(lineMs / 1000);
            const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
            const s = (totalSec % 60).toString().padStart(2, '0');
            const cs = Math.floor((lineMs % 1000) / 10).toString().padStart(2, '0');
            const tag = `[${m}:${s}.${cs}]`;

            const words = Array.isArray(line.text) && line.text.length > 0
              ? line.text
              : Array.isArray(line.backgroundText) ? line.backgroundText : [];

            if (words.length > 0) {
              let inlineBody = '';
              for (const w of words) {
                const wMs = typeof w.timestamp === 'number' ? w.timestamp : lineMs;
                const wSec = Math.floor(wMs / 1000);
                const sm = Math.floor(wSec / 60).toString().padStart(2, '0');
                const ss = (wSec % 60).toString().padStart(2, '0');
                const scs = Math.floor((wMs % 1000) / 10).toString().padStart(2, '0');
                const text = (w.text || '').trim();
                if (text) {
                  inlineBody += `<${sm}:${ss}.${scs}>${text} `;
                }
              }
              if (inlineBody.trim()) {
                lrcLines.push(`${tag} ${inlineBody.trim()}`);
                continue;
              }
            }
            if (line.text && typeof line.text === 'string' && line.text.trim()) {
              lrcLines.push(`${tag} ${line.text.trim()}`);
            }
          }
          if (lrcLines.length > 0) return lrcLines.join('\n');
        }

        if (typeof envData.lrc === 'string' && envData.lrc.trim()) {
          return envData.lrc.trim();
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * BetterLyrics Word-Sync provider (cached Apple Music & TTML lyrics).
 */
export async function fetchBetterLyrics(
  trackName: string,
  artistName: string,
  albumName?: string,
  durationSecs?: number,
  signal?: AbortSignal
): Promise<string | null> {
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
        // continue
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Kugou Music Syllable-synced Karaoke lyrics (KRC format decryptor).
 */
export async function fetchKugouLyrics(
  trackName: string,
  artistName: string,
  durationSecs?: number,
  signal?: AbortSignal
): Promise<string | null> {
  if (signal?.aborted) return null;
  const cTitle = cleanTitle(trackName);
  const cArtist = cleanArtist(artistName);
  if (!cTitle) return null;

  try {
    const kw = cArtist ? `${cArtist} - ${cTitle}` : cTitle;
    const durParam = durationSecs && durationSecs > 0 ? (Math.round(durationSecs) * 1000).toString() : '';
    const searchUrl = `https://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword=${encodeURIComponent(kw)}${
      durParam ? `&duration=${durParam}` : ''
    }`;

    const searchRes = await fetchWithTimeout(
      searchUrl,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
        signal,
      },
      3500
    );

    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const candidates = searchData?.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) return null;

    // Pick candidate with smallest duration delta if duration was provided
    let best = candidates[0];
    if (durationSecs && durationSecs > 0 && candidates.length > 1) {
      const targetDurationMs = durationSecs * 1000;
      let minDiff = Infinity;
      for (const cand of candidates) {
        if (cand.duration) {
          const diff = Math.abs(cand.duration - targetDurationMs);
          if (diff < minDiff) {
            minDiff = diff;
            best = cand;
          }
        }
      }
    }

    if (!best?.id || !best?.accesskey) return null;
    if (signal?.aborted) return null;

    const dlUrl = `https://lyrics.kugou.com/download?ver=1&client=pc&id=${best.id}&accesskey=${best.accesskey}&fmt=krc&charset=utf8`;
    const dlRes = await fetchWithTimeout(
      dlUrl,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
        signal,
      },
      3500
    );

    if (!dlRes.ok) return null;
    const dlData = await dlRes.json();
    const rawBase64 = dlData?.content;
    if (!rawBase64 || typeof rawBase64 !== 'string') return null;

    // Base64 decode binary content
    const binStr = atob(rawBase64);
    const encBytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      encBytes[i] = binStr.charCodeAt(i);
    }

    // Skip 4-byte header magic ('krc1')
    const body = encBytes.subarray(4);
    const decrypted = new Uint8Array(body.length);
    for (let i = 0; i < body.length; i++) {
      decrypted[i] = body[i] ^ KUGOU_KRC_KEY[i % KUGOU_KRC_KEY.length];
    }

    // Decompress zlib stream using standard browser DecompressionStream
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    writer.write(decrypted);
    writer.close();
    const decompressed = await new Response(ds.readable).text();
    if (!decompressed) return null;

    // Parse KRC format to Enhanced Word-Synced LRC
    const lines = decompressed.split(/\r?\n/);
    let offsetMs = 0;
    const offsetRegex = /^\[offset:\s*([+-]?\d+)\s*\]/i;
    for (const l of lines) {
      const om = l.match(offsetRegex);
      if (om) {
        offsetMs = parseInt(om[1], 10) || 0;
        break;
      }
    }

    const lineRegex = /^\[(\d+),(\d+)\](.*)$/;
    const syllableRegex = /<(\d+),(\d+),\d+>([^<]*)/g;
    const resultLines: string[] = [];

    for (const l of lines) {
      const trimmed = l.trim();
      if (!trimmed) continue;
      const lm = trimmed.match(lineRegex);
      if (!lm) continue;

      const startMs = Math.max(0, parseInt(lm[1], 10) - offsetMs);
      const totalSec = Math.floor(startMs / 1000);
      const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
      const s = (totalSec % 60).toString().padStart(2, '0');
      const cs = Math.floor((startMs % 1000) / 10).toString().padStart(2, '0');
      const lineTag = `[${m}:${s}.${cs}]`;

      let sylBody = '';
      let match: RegExpExecArray | null;
      syllableRegex.lastIndex = 0;
      while ((match = syllableRegex.exec(lm[3])) !== null) {
        const sylRelStart = parseInt(match[1], 10) || 0;
        const sylWord = match[3];
        const sylAbsMs = Math.max(0, startMs + sylRelStart);
        const sylSec = Math.floor(sylAbsMs / 1000);
        const sm = Math.floor(sylSec / 60).toString().padStart(2, '0');
        const ss = (sylSec % 60).toString().padStart(2, '0');
        const scs = Math.floor((sylAbsMs % 1000) / 10).toString().padStart(2, '0');
        sylBody += `<${sm}:${ss}.${scs}>${sylWord} `;
      }

      if (sylBody.trim()) {
        resultLines.push(`${lineTag} ${sylBody.trim()}`);
      } else {
        const plain = lm[3].replace(/<[^>]*>/g, '').trim();
        if (plain) resultLines.push(`${lineTag} ${plain}`);
      }
    }

    return resultLines.length > 0 ? resultLines.join('\n') : null;
  } catch {
    return null;
  }
}

/**
 * Priority: Attempt to fetch rich word-by-word / syllable lyrics from LyricsPlus API
 */
export async function fetchLyricsPlus(
  trackName: string,
  artistName: string,
  albumName?: string,
  durationSecs?: number,
  signal?: AbortSignal
): Promise<string | null> {
  if (Date.now() < lyricsPlusCircuitBrokenUntil) {
    return null;
  }

  const endpoint = 'https://lyricsplus.prjktla.my.id/v2/lyrics/get';
  const cTitle = cleanTitle(trackName);
  const cArtist = cleanArtist(artistName);

  if (!cTitle || signal?.aborted) return null;

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

    lyricsPlusConsecutiveFailures = 0;

    const data = await resp.json();
    if (!data || !Array.isArray(data.lyrics) || data.lyrics.length === 0) return null;

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
 * Priority 3: SyncLRC API (https://github.com/TharukRenuja/SyncLRC)
 * Multi-source karaoke word-sync, TTML, and synced lyrics provider
 */
export async function fetchSyncLrcLyrics(
  trackName: string,
  artistName: string,
  albumName?: string,
  durationSecs?: number,
  signal?: AbortSignal
): Promise<string | null> {
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

/**
 * Priority 4: NetEase Cloud Music (via public proxy)
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
 * Searches across lyric APIs in cascade order:
 * 1. Apple Music (iTunes Search + Paxsenix/Lyrically TTML/Syllables)
 * 2. LyricsPlus (Word-synced & translated)
 * 3. BetterLyrics (TTML word-sync)
 * 4. Kugou (Decrypted KRC karaoke syllable-synced)
 * 5. Unison (Synced lyrics, TTML word-sync & romanization)
 * 6. SyncLRC (Karaoke word-sync & multi-source)
 * 7. NetEase (Merged original + CJK translations)
 * 8. LRCLIB (Standard line-synced or plain text)
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

  // 1. Priority 1: Apple Music (via iTunes + Paxsenix)
  const amLrc = await fetchAppleMusicLyrics(trackName, artistName, albumName, durationSecs, signal);
  if (amLrc) {
    const hasWordSync = isWordSyncedLrc(amLrc);
    const hasTranslation = hasTranslationInLyrics(amLrc);
    const isSynced = hasLrcTimestamps(amLrc);
    if (hasWordSync || hasTranslation || isSynced) {
      if (!requireWordSync || hasWordSync) {
        return {
          lyrics: amLrc,
          hasWordSync,
          hasTranslation,
          isSynced,
          source: 'Apple Music',
        };
      }
    }
  }

  // 2. Priority 2: LyricsPlus
  const lpLrc = await fetchLyricsPlus(trackName, artistName, albumName, durationSecs, signal);
  if (lpLrc) {
    const hasWordSync = isWordSyncedLrc(lpLrc);
    const hasTranslation = hasTranslationInLyrics(lpLrc);
    const isSynced = hasLrcTimestamps(lpLrc);
    if (hasWordSync || hasTranslation || isSynced) {
      if (!requireWordSync || hasWordSync) {
        return {
          lyrics: lpLrc,
          hasWordSync,
          hasTranslation,
          isSynced,
          source: 'Lyrics+',
        };
      }
    }
  }

  // 3. Priority 3: BetterLyrics (TTML)
  const blLrc = await fetchBetterLyrics(trackName, artistName, albumName, durationSecs, signal);
  if (blLrc) {
    const hasWordSync = isWordSyncedLrc(blLrc);
    const hasTranslation = hasTranslationInLyrics(blLrc);
    const isSynced = hasLrcTimestamps(blLrc);
    if (hasWordSync || hasTranslation || isSynced) {
      if (!requireWordSync || hasWordSync) {
        return {
          lyrics: blLrc,
          hasWordSync,
          hasTranslation,
          isSynced,
          source: 'BetterLyrics',
        };
      }
    }
  }

  // 4. Priority 4: Kugou Music (KRC Decryption)
  const kgLrc = await fetchKugouLyrics(trackName, artistName, durationSecs, signal);
  if (kgLrc) {
    const hasWordSync = isWordSyncedLrc(kgLrc);
    const hasTranslation = hasTranslationInLyrics(kgLrc);
    const isSynced = hasLrcTimestamps(kgLrc);
    if (hasWordSync || hasTranslation || isSynced) {
      if (!requireWordSync || hasWordSync) {
        return {
          lyrics: kgLrc,
          hasWordSync,
          hasTranslation,
          isSynced,
          source: 'Kugou',
        };
      }
    }
  }

  // 5. Priority 5: Unison API (handles TTML word-by-word sync too!)
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

  // 6. Priority 6: SyncLRC
  const syncLrc = await fetchSyncLrcLyrics(trackName, artistName, albumName, durationSecs, signal);
  if (syncLrc) {
    const hasWordSync = isWordSyncedLrc(syncLrc);
    const hasTranslation = hasTranslationInLyrics(syncLrc);
    const isSynced = hasLrcTimestamps(syncLrc);
    if (hasWordSync || hasTranslation || isSynced || syncLrc.trim().length > 0) {
      if (!requireWordSync || hasWordSync) {
        return {
          lyrics: syncLrc,
          hasWordSync,
          hasTranslation,
          isSynced,
          source: 'SyncLRC',
        };
      }
    }
  }

  // If user strictly requested word-sync lyrics and none of the rich tiers matched, return null
  if (requireWordSync) {
    return null;
  }

  // 4. Priority 4: NetEase Cloud Music (merged with translations)
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

  // 5. Priority 5: LRCLIB Direct
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
): Promise<string | null> {
  const res = await searchEnhancedLyrics(trackName, artistName, albumName, durationSecs, signal);
  return res?.lyrics || null;
}
