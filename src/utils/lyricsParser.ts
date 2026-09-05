export interface LyricSyllable {
  timeMs: number;
  durationMs: number;
  text: string;
}

export interface ParsedLyricLine {
  id: string;
  timeMs: number;
  startSecs: number;
  durationMs: number;
  durationSecs: number;
  content: string;
  syllables: LyricSyllable[];
  hasSyllables: boolean;
  romanized?: string;
  transliteration?: string;
}

const TIMESTAMP_REGEX = /\[(\d{1,2}):(\d{2})(?:[.:](\d{2,3}))?\]/g;
const INLINE_TAG_REGEX = /<(\d{1,2}):(\d{2})(?:[.:](\d{2,3}))?>/g;
const OFFSET_REGEX = /\[offset:\s*([+-]?\d+)\s*\]/i;

function parseTimestampMs(minStr: string, secStr: string, fracStr?: string): number {
  const min = parseInt(minStr, 10) || 0;
  const sec = parseInt(secStr, 10) || 0;
  let frac = 0;
  if (fracStr) {
    if (fracStr.length === 2) frac = parseInt(fracStr, 10) * 10;
    else if (fracStr.length === 3) frac = parseInt(fracStr, 10);
    else if (fracStr.length === 1) frac = parseInt(fracStr, 10) * 100;
  }
  return min * 60 * 1000 + sec * 1000 + frac;
}

/**
 * Parses raw LRC string (standard or syllable-enhanced) into rich ParsedLyricLine array.
 */
export function parseRichLyrics(rawLrc: string): ParsedLyricLine[] {
  if (!rawLrc || !rawLrc.trim()) return [];

  const rawLines = rawLrc.split(/\r?\n/);
  let offsetMs = 0;

  interface RawExtractedLine {
    timeMs: number;
    text: string;
    explicitSyllables: LyricSyllable[];
  }

  const extracted: RawExtractedLine[] = [];

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const offsetMatch = trimmed.match(OFFSET_REGEX);
    if (offsetMatch) {
      offsetMs = parseInt(offsetMatch[1], 10) || 0;
      continue;
    }

    // Check for standard line-level timestamp tags [mm:ss.xx]
    const lineTimeMatches = Array.from(trimmed.matchAll(TIMESTAMP_REGEX));
    if (lineTimeMatches.length === 0) {
      continue;
    }

    // Strip out leading [mm:ss.xx] tags to get remaining line body
    const body = trimmed.replace(TIMESTAMP_REGEX, '').trim();

    // Check if body has inline syllable timestamps: e.g. <00:12.34> word <00:12.80> word
    const inlineMatches = Array.from(body.matchAll(INLINE_TAG_REGEX));
    let explicitSyllables: LyricSyllable[] = [];

    if (inlineMatches.length > 0) {
      // Enhanced LRC with inline timestamps
      for (let i = 0; i < inlineMatches.length; i++) {
        const match = inlineMatches[i];
        const sylTime = parseTimestampMs(match[1], match[2], match[3]) + offsetMs;
        const nextMatch = inlineMatches[i + 1];
        const nextTime = nextMatch
          ? parseTimestampMs(nextMatch[1], nextMatch[2], nextMatch[3]) + offsetMs
          : sylTime + 600;

        const startIndex = (match.index ?? 0) + match[0].length;
        const endIndex = nextMatch ? (nextMatch.index ?? body.length) : body.length;
        const sylText = body.slice(startIndex, endIndex);

        if (sylText.trim()) {
          explicitSyllables.push({
            timeMs: sylTime,
            durationMs: Math.max(150, nextTime - sylTime),
            text: sylText,
          });
        }
      }
    }

    // Clean display text without <tags>
    const cleanText = body.replace(INLINE_TAG_REGEX, '').trim();
    if (!cleanText && explicitSyllables.length === 0) continue;

    for (const match of lineTimeMatches) {
      const lineTime = parseTimestampMs(match[1], match[2], match[3]) + offsetMs;
      extracted.push({
        timeMs: Math.max(0, lineTime),
        text: cleanText,
        explicitSyllables,
      });
    }
  }

  // Sort chronologically
  extracted.sort((a, b) => a.timeMs - b.timeMs);

  // If no timestamped lines found, treat whole text as unsynced
  if (extracted.length === 0) {
    const unsynced: ParsedLyricLine[] = [];
    rawLines.forEach((line, idx) => {
      const t = line.trim();
      if (t) {
        unsynced.push({
          id: `unsynced-${idx}`,
          timeMs: -1,
          startSecs: -1,
          durationMs: 0,
          durationSecs: 0,
          content: t,
          syllables: [],
          hasSyllables: false,
        });
      }
    });
    return unsynced;
  }

  // Build final structured lines with syllable durations
  const result: ParsedLyricLine[] = [];

  for (let i = 0; i < extracted.length; i++) {
    const cur = extracted[i];
    const next = extracted[i + 1];
    const rawDur = next ? next.timeMs - cur.timeMs : 3500;
    const durationMs = Math.min(8000, Math.max(1200, rawDur));

    let syllables: LyricSyllable[] = [];
    const hasExplicit = cur.explicitSyllables.length > 0;

    if (hasExplicit) {
      syllables = cur.explicitSyllables;
    } else {
      // Decompose line into rhythmic word syllables so word-by-word animation and jumping text
      // work seamlessly on ANY synced song!
      const words = cur.text.split(/(\s+)/).filter(Boolean);
      const nonWhitespaceWords = words.filter((w) => w.trim().length > 0);
      const totalChars = nonWhitespaceWords.reduce((sum, w) => sum + w.length, 0) || 1;

      let elapsedInLine = 0;
      for (const token of words) {
        if (!token.trim()) {
          // Keep whitespace attached or separate
          continue;
        }
        const weight = token.length / totalChars;
        const sylDur = Math.max(160, Math.round(durationMs * 0.85 * weight));
        const sylTime = cur.timeMs + elapsedInLine;
        elapsedInLine += sylDur;

        syllables.push({
          timeMs: sylTime,
          durationMs: sylDur,
          text: token,
        });
      }
    }

    result.push({
      id: `${i}-${cur.timeMs}`,
      timeMs: cur.timeMs,
      startSecs: cur.timeMs / 1000,
      durationMs,
      durationSecs: durationMs / 1000,
      content: cur.text,
      syllables,
      hasSyllables: syllables.length > 0,
    });
  }

  return result;
}
