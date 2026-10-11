import { convertTtmlToLrc, isTtmlContent } from '../lyricsParser';
import { cleanArtist, cleanTitle, fetchWithTimeout } from './providerUtils';
import type { LyricsProvider, LyricsSearchQuery } from './types';

// Circuit breaker to avoid hammering iTunes when Akamai/Apple applies rate limiting (403/429)
let itunesCircuitBrokenUntil = 0;

/**
 * Apple Music Syllable-synced & TTML Lyrics provider.
 * Uses iTunes Search API to resolve trackId, then queries Paxsenix/Lyrically aggregator for TTML/syllable sync.
 */
export class AppleMusicLyricsProvider implements LyricsProvider {
  readonly name = 'Apple Music' as const;
  readonly tier = 'Tier 1 (Apple TTML)';
  readonly description = 'iTunes Search + Paxsenix word/syllable TTML (<mm:ss.xx>)';
  readonly endpoint = 'itunes.apple.com + lyrics.paxsenix.org';
  readonly supportsWordSync = true;

  async fetch(query: LyricsSearchQuery): Promise<string | null> {
    const { trackName, artistName, albumName, durationSecs, signal } = query;
    if (signal?.aborted) return null;
    if (Date.now() < itunesCircuitBrokenUntil) return null;

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
        3000
      );

      if (itunesResp.status === 403 || itunesResp.status === 429) {
        // Back off for 60 seconds if Apple rate limits the IP so subsequent songs can immediately hit Kugou/LRCLIB
        itunesCircuitBrokenUntil = Date.now() + 60 * 1000;
        return null;
      }

      if (!itunesResp.ok) return null;
      const itunesData = await itunesResp.json();
      const results = itunesData?.results;
      if (!Array.isArray(results) || results.length === 0) return null;

      // Find the best matching candidate based on title, artist, and duration proximity
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

  async ping(): Promise<'online' | 'offline'> {
    try {
      const res = await fetchWithTimeout(
        'https://itunes.apple.com/search?term=test&media=music&limit=1',
        { headers: { 'User-Agent': 'PrismMusicPlayer/1.0.0' } },
        3000
      );
      return res.status === 200 ? 'online' : 'offline';
    } catch {
      return 'offline';
    }
  }
}
