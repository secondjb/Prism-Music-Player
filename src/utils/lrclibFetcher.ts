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

/**
 * Attempt to fetch rich word-by-word / syllable lyrics from LyricsPlus API (LastWave-native source)
 */
async function fetchLyricsPlus(
  trackName: string,
  artistName: string,
  albumName?: string,
  durationSecs?: number
): Promise<string | null> {
  const endpoints = [
    'https://lyricsplus.prjktla.my.id/v2/lyrics/get',
    'https://lyricsplus.clashgram.workers.dev/v2/lyrics/get',
  ];

  const cTitle = cleanTitle(trackName);
  const cArtist = cleanArtist(artistName);

  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set('title', cTitle);
      url.searchParams.set('artist', cArtist);
      if (albumName) url.searchParams.set('album', albumName);
      if (durationSecs && durationSecs > 0) url.searchParams.set('duration', Math.round(durationSecs).toString());

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const resp = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'PrismMusicPlayer/1.0.0 (https://github.com/prism-player)',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!resp.ok) continue;
      const data = await resp.json();
      if (!data || !Array.isArray(data.lyrics) || data.lyrics.length === 0) continue;

      // Convert LyricsPlus structure to Enhanced LRC with <mm:ss.xx> inline timestamps
      const lrcLines: string[] = [];

      for (const line of data.lyrics) {
        const lineMs = typeof line.time === 'number' ? line.time : 0;
        const totalSec = Math.floor(lineMs / 1000);
        const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
        const s = (totalSec % 60).toString().padStart(2, '0');
        const cs = Math.floor((lineMs % 1000) / 10).toString().padStart(2, '0');
        const tag = `[${m}:${s}.${cs}]`;

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
          lrcLines.push(`${tag} ${inlineBody.trim()}`);
        } else {
          lrcLines.push(`${tag} ${line.text || ''}`);
        }
      }

      if (lrcLines.length > 0) {
        return lrcLines.join('\n');
      }
    } catch {
      // Continue to next endpoint or fallback
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
  // 1. If preferWordSync, try LyricsPlus word sync first (fast timeout)
  if (preferWordSync) {
    try {
      const wordLrc = await fetchLyricsPlus(trackName, artistName, albumName, durationSecs);
      if (wordLrc && wordLrc.includes('<')) {
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
