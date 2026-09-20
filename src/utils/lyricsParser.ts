export interface LyricSyllable {
  timeMs: number;
  durationMs: number;
  text: string;
  romanizedText?: string;
  translatedText?: string;
  hasTrailingSpace?: boolean;
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
  hasExplicitSyllables?: boolean;
  romanized?: string;
  transliteration?: string;
  translation?: string;
}

const TIMESTAMP_REGEX = /\[(\d{1,2}):(\d{2})(?:[.:](\d{2,3}))?\]/g;
const INLINE_TAG_REGEX = /<(\d{1,2}):(\d{2})(?:[.:](\d{2,3}))?>/g;
const OFFSET_REGEX = /\[offset:\s*([+-]?\d+)\s*\]/i;

export function isIdenticalLyricText(a: string, b?: string | null): boolean {
  if (!b) return false;
  const clean = (s: string) => s.normalize('NFKC').trim().toLowerCase().replace(/[\s\p{P}]+/gu, '');
  return clean(a) === clean(b);
}

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
 * Intelligently infers word-by-word timing for standard line-synced lyrics based on
 * word length weighting and musical vocal pacing.
 */
function inferLineSyllables(lineText: string, lineStartMs: number, lineDurMs: number): LyricSyllable[] {
  const words = lineText.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  // Singing usually spans about 88% of line duration, leaving a natural breath before next line
  const singSpanMs = Math.min(Math.max(600, lineDurMs - 200), Math.max(800, lineDurMs * 0.88));

  // Weight words by character count (longer words take longer to sing, minimum weight of 2)
  const weights = words.map((w) => Math.max(2, w.length));
  const totalWeight = weights.reduce((acc, val) => acc + val, 0);

  const syllables: LyricSyllable[] = [];
  let elapsed = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const weight = weights[i];
    const isLast = i === words.length - 1;
    const wordDurMs = isLast
      ? Math.max(150, singSpanMs - elapsed)
      : Math.max(150, Math.round((weight / totalWeight) * singSpanMs));

    syllables.push({
      timeMs: lineStartMs + elapsed,
      durationMs: wordDurMs,
      text: word,
      hasTrailingSpace: !isLast,
    });

    elapsed += wordDurMs;
  }

  return syllables;
}

export function decodeXmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function isTtmlContent(text: string | null | undefined): boolean {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim();
  return (
    t.startsWith('<?xml') ||
    t.startsWith('<tt') ||
    (t.includes('<tt ') && t.includes('xmlns')) ||
    (t.includes('<p ') && t.includes('begin=') && (t.includes('<span') || t.includes('</p>')))
  );
}

export function parseTtmlTime(timeStr: string): number {
  if (!timeStr) return 0;
  timeStr = timeStr.trim();
  const colonParts = timeStr.split(':');
  if (colonParts.length === 3) {
    const h = parseFloat(colonParts[0]) || 0;
    const m = parseFloat(colonParts[1]) || 0;
    const s = parseFloat(colonParts[2]) || 0;
    return Math.round((h * 3600 + m * 60 + s) * 1000);
  } else if (colonParts.length === 2) {
    const m = parseFloat(colonParts[0]) || 0;
    const s = parseFloat(colonParts[1]) || 0;
    return Math.round((m * 60 + s) * 1000);
  } else if (timeStr.endsWith('ms')) {
    return Math.round(parseFloat(timeStr));
  } else if (timeStr.endsWith('s')) {
    return Math.round(parseFloat(timeStr) * 1000);
  } else {
    const num = parseFloat(timeStr);
    return isNaN(num) ? 0 : Math.round(num * 1000);
  }
}

function formatLrcTag(timeMs: number): string {
  const totalSec = Math.floor(timeMs / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  const cs = Math.floor((timeMs % 1000) / 10).toString().padStart(2, '0');
  return `[${m}:${s}.${cs}]`;
}

function formatInlineTag(timeMs: number): string {
  const totalSec = Math.floor(timeMs / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  const cs = Math.floor((timeMs % 1000) / 10).toString().padStart(2, '0');
  return `<${m}:${s}.${cs}>`;
}

export function convertTtmlToLrc(ttmlStr: string): string {
  if (!ttmlStr || typeof ttmlStr !== 'string') return '';
  if (!isTtmlContent(ttmlStr)) return ttmlStr.trim();

  const lines: string[] = [];
  const pRegex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  let pMatch: RegExpExecArray | null;

  while ((pMatch = pRegex.exec(ttmlStr)) !== null) {
    const pAttrs = pMatch[1];
    const pContent = pMatch[2];

    const beginMatch = pAttrs.match(/\bbegin="([^"]+)"/i);
    const lineStartMs = beginMatch ? parseTtmlTime(beginMatch[1]) : 0;
    const lineTag = formatLrcTag(lineStartMs);

    let translationText = '';
    const transMatch = pContent.match(/<span\b[^>]*\bttm:role="translation"[^>]*>([\s\S]*?)<\/span>/i);
    if (transMatch) {
      translationText = decodeXmlEntities(transMatch[1].replace(/<[^>]+>/g, '').trim());
    }

    const spanRegex = /<span\b([^>]*)>([\s\S]*?)<\/span>/gi;
    let spanMatch: RegExpExecArray | null;
    let hasWordSpans = false;
    let lineBody = '';

    while ((spanMatch = spanRegex.exec(pContent)) !== null) {
      const spanAttrs = spanMatch[1];
      if (/ttm:role="translation"/i.test(spanAttrs)) continue;

      const rawSpanText = spanMatch[2].replace(/<[^>]+>/g, '');
      const spanText = decodeXmlEntities(rawSpanText).trim();
      if (!spanText) continue;

      hasWordSpans = true;
      const spanBeginMatch = spanAttrs.match(/\bbegin="([^"]+)"/i);
      const spanStartMs = spanBeginMatch ? parseTtmlTime(spanBeginMatch[1]) : lineStartMs;
      const inlineTag = formatInlineTag(spanStartMs);

      lineBody += `${inlineTag}${spanText} `;
    }

    const transSuffix = translationText ? ` // ${translationText}` : '';

    if (hasWordSpans && lineBody.trim()) {
      lines.push(`${lineTag} ${lineBody.trim()}${transSuffix}`);
    } else {
      const cleanText = decodeXmlEntities(pContent.replace(/<[^>]+>/g, '').trim());
      if (cleanText) {
        lines.push(`${lineTag} ${cleanText}${transSuffix}`);
      }
    }
  }

  if (lines.length === 0) {
    return decodeXmlEntities(ttmlStr.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  }

  return lines.join('\n');
}

const PARSED_LYRICS_CACHE = new Map<string, ParsedLyricLine[]>();
const MAX_PARSED_CACHE_SIZE = 120;

/**
 * Parses raw LRC string (standard, syllable-enhanced, or TTML XML) into rich ParsedLyricLine array.
 */
export function parseRichLyrics(
  rawLrc: string,
  options?: { inferWordSync?: boolean }
): ParsedLyricLine[] {
  if (!rawLrc || !rawLrc.trim()) return [];

  const cacheKey = `${options?.inferWordSync ? 1 : 0}_${rawLrc.length}_${rawLrc.slice(0, 100)}`;
  const cached = PARSED_LYRICS_CACHE.get(cacheKey);
  if (cached) {
    PARSED_LYRICS_CACHE.delete(cacheKey);
    PARSED_LYRICS_CACHE.set(cacheKey, cached);
    return cached;
  }

  const processedLrc = isTtmlContent(rawLrc) ? convertTtmlToLrc(rawLrc) : rawLrc;
  const normalizedLrc = processedLrc.normalize('NFKC');
  const rawLines = normalizedLrc.split(/\r?\n/);
  let offsetMs = 0;

  interface RawExtractedLine {
    timeMs: number;
    text: string;
    translation?: string;
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

    // Split out any inline translation before parsing syllables so translation doesn't leak into the last syllable!
    let primaryBody = body;
    let inlineTrans: string | undefined = undefined;
    const inlineSepMatch = body.match(/^(.*?)(?:\s*\/\/\s*|\s+[\/\|]\s+)(.+)$/);
    if (inlineSepMatch) {
      primaryBody = inlineSepMatch[1].trim();
      const rawTrans = inlineSepMatch[2].replace(INLINE_TAG_REGEX, '').replace(TIMESTAMP_REGEX, '').trim();
      if (rawTrans && !isIdenticalLyricText(primaryBody.replace(INLINE_TAG_REGEX, '').trim(), rawTrans)) {
        inlineTrans = rawTrans;
      }
    }

    // Check if primaryBody has inline syllable timestamps: e.g. <00:12.34> word <00:12.80> word
    const inlineMatches = Array.from(primaryBody.matchAll(INLINE_TAG_REGEX));
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
        const endIndex = nextMatch ? (nextMatch.index ?? primaryBody.length) : primaryBody.length;
        const sylText = primaryBody.slice(startIndex, endIndex);

        if (sylText.trim()) {
          explicitSyllables.push({
            timeMs: sylTime,
            durationMs: Math.max(150, nextTime - sylTime),
            text: sylText.trim(),
            hasTrailingSpace: sylText.endsWith(' ') || sylText.startsWith(' ') || sylText.includes(' '),
          });
        }
      }
    }

    // Clean display text without <tags>
    const cleanText = primaryBody.replace(INLINE_TAG_REGEX, '').trim();
    if (!cleanText && explicitSyllables.length === 0) continue;

    for (const match of lineTimeMatches) {
      const lineTime = parseTimestampMs(match[1], match[2], match[3]) + offsetMs;
      extracted.push({
        timeMs: Math.max(0, lineTime),
        text: cleanText,
        translation: inlineTrans,
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
        let content = t;
        let translation: string | undefined = undefined;
        const sepMatch = t.match(/^(.*?)(?:\s*\/\/\s*|\s+[\/\|]\s+)(.+)$/);
        if (sepMatch) {
          content = sepMatch[1].trim();
          const rawTrans = sepMatch[2].replace(INLINE_TAG_REGEX, '').replace(TIMESTAMP_REGEX, '').trim();
          if (rawTrans && !isIdenticalLyricText(content, rawTrans)) {
            translation = rawTrans;
          }
        }
        unsynced.push({
          id: `unsynced-${idx}`,
          timeMs: -1,
          startSecs: -1,
          durationMs: 0,
          durationSecs: 0,
          content,
          translation,
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
    let next = extracted[i + 1];
    let content = cur.text;
    let translation: string | undefined = cur.translation;

    const hasNonLatin = (str: string) =>
      /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\u0400-\u04ff\uac00-\ud7af]/.test(str);

    // Only treat next line as translation if it's explicitly bilingual (e.g. CJK original + Latin translation)
    // and neither line is an explicit vocal marker like "(Singer)" or "[Chorus]"
    if (!translation) {
      const isBilingualTranslationPair =
        next &&
        Math.abs(next.timeMs - cur.timeMs) <= 150 &&
        next.text.trim() &&
        next.text.trim() !== cur.text.trim() &&
        hasNonLatin(cur.text) &&
        !hasNonLatin(next.text) &&
        !next.text.trim().startsWith('(') &&
        !cur.text.trim().startsWith('(');

      if (isBilingualTranslationPair && next) {
        translation = next.text.trim();
        i++; // consume translated line
        next = extracted[i + 1];
      }
    }

    if (translation && isIdenticalLyricText(content, translation)) {
      translation = undefined;
    }

    const hasExplicit = cur.explicitSyllables.length > 0;
    let durationMs: number;

    if (hasExplicit && cur.explicitSyllables.length > 0) {
      // If line has explicit syllables, duration is defined by the end of the last syllable,
      // allowing overlapping lines to continue singing concurrently even after the next line starts!
      const lastSyl = cur.explicitSyllables[cur.explicitSyllables.length - 1];
      const explicitSpanMs = lastSyl.timeMs + lastSyl.durationMs - cur.timeMs;
      durationMs = Math.max(1200, explicitSpanMs);
    } else {
      const wordsCount = content.trim().split(/\s+/).filter(Boolean).length;
      const estimatedSingMs = Math.max(2000, wordsCount * 450);
      const rawDur = next ? next.timeMs - cur.timeMs : 4000;
      // If next line starts almost immediately (overlapping voice), don't truncate to 0 or 100ms
      durationMs =
        rawDur < 1500 && wordsCount > 2
          ? Math.min(8000, estimatedSingMs)
          : Math.max(1200, rawDur);
    }

    let syllables: LyricSyllable[] = [];
    let hasSyllables = false;

    if (hasExplicit) {
      syllables = cur.explicitSyllables;
      hasSyllables = true;
    } else if (options?.inferWordSync && content.trim()) {
      syllables = inferLineSyllables(content, cur.timeMs, durationMs);
      hasSyllables = syllables.length > 0;
    }

    result.push({
      id: `${i}-${cur.timeMs}`,
      timeMs: cur.timeMs,
      startSecs: cur.timeMs / 1000,
      durationMs,
      durationSecs: durationMs / 1000,
      content,
      syllables,
      hasSyllables,
      hasExplicitSyllables: hasExplicit,
      translation,
    });
  }

  if (PARSED_LYRICS_CACHE.size >= MAX_PARSED_CACHE_SIZE) {
    const oldestKey = PARSED_LYRICS_CACHE.keys().next().value;
    if (oldestKey) PARSED_LYRICS_CACHE.delete(oldestKey);
  }
  PARSED_LYRICS_CACHE.set(cacheKey, result);

  return result;
}

/**
 * Returns true if the lyrics contain native, explicit word-by-word timestamps
 * directly from the LRC file (not just inferred through vocal heuristics).
 */
export function hasExplicitWordSync(lines: ParsedLyricLine[]): boolean {
  return lines.length > 0 && lines[0].startSecs !== -1 && lines.some((l) => Boolean(l.hasExplicitSyllables));
}

/**
 * Returns true if the LRC file contains official or fan dual-language translations
 * (either through alternating bilingual lines or inline separators).
 */
export function hasTranslationInLyrics(lyrics: string | null | undefined): boolean {
  if (!lyrics || typeof lyrics !== 'string') return false;
  // Quick check for common inline delimiters: " // ", " / ", " | "
  if (/\s+\/\/\s+|\s+\/\s+|\s+\|\s+/.test(lyrics)) return true;
  // Deep check using parseRichLyrics
  const parsed = parseRichLyrics(lyrics);
  return parsed.some((line) => Boolean(line.translation));
}
