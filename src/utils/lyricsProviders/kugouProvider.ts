import { cleanArtist, cleanTitle, fetchWithTimeout } from './providerUtils';
import type { LyricsProvider, LyricsSearchQuery } from './types';

// Kugou KRC decryption key (same as LastWave / Kugou PC client)
const KUGOU_KRC_KEY = new Uint8Array([
  0x40, 0x47, 0x61, 0x77, 0x5e, 0x32, 0x74, 0x47,
  0x51, 0x36, 0x31, 0x2d, 0xce, 0xd2, 0x6e, 0x69,
]);

/**
 * Kugou Music Syllable-synced Karaoke lyrics (KRC format decryptor).
 */
export class KugouLyricsProvider implements LyricsProvider {
  readonly name = 'Kugou' as const;
  readonly tier = 'Tier 3 (Karaoke KRC)';
  readonly description = 'Direct decrypted KRC word-level karaoke sync';
  readonly endpoint = 'lyrics.kugou.com';
  readonly supportsWordSync = true;

  async fetch(query: LyricsSearchQuery): Promise<string | null> {
    const { trackName, artistName, durationSecs, signal } = query;
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

      let searchRes = await fetchWithTimeout(
        searchUrl,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: 'application/json',
          },
          signal,
        },
        3000
      );

      let candidates: any[] = [];
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (Array.isArray(searchData?.candidates)) {
          candidates = searchData.candidates;
        }
      }

      // If artist - title produced 0 results, retry with title alone without duration constraint
      if (candidates.length === 0 && cArtist) {
        if (signal?.aborted) return null;
        const retryUrl = `https://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword=${encodeURIComponent(cTitle)}`;
        searchRes = await fetchWithTimeout(
          retryUrl,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              Accept: 'application/json',
            },
            signal,
          },
          3000
        );
        if (searchRes.ok) {
          const retryData = await searchRes.json();
          if (Array.isArray(retryData?.candidates)) {
            candidates = retryData.candidates;
          }
        }
      }

      if (candidates.length === 0) return null;

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

  async ping(): Promise<'online' | 'offline'> {
    try {
      const res = await fetchWithTimeout(
        'https://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword=test',
        { headers: { 'User-Agent': 'Mozilla/5.0' } },
        3000
      );
      return res.status === 200 ? 'online' : 'offline';
    } catch {
      return 'offline';
    }
  }
}
