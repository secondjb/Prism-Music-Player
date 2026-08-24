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

export async function fetchLrclibLyrics(
  trackName: string,
  artistName: string,
  albumName?: string,
  durationSecs?: number
): Promise<string | null> {
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
      // Try search endpoint if exact get fails
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${artistName} ${trackName}`)}`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'PrismMusicPlayer/1.0.0 (https://github.com/prism-player)',
        },
      });
      if (searchRes.ok) {
        const results: LrclibResponse[] = await searchRes.json();
        if (results && results.length > 0) {
          const match = results.find((r) => r.syncedLyrics || r.plainLyrics) || results[0];
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
