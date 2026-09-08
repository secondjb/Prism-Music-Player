/**
 * Translation service for lyrics with dual-language detection and syllable alignment.
 */
import { LyricSyllable, ParsedLyricLine } from './lyricsParser';

const translationCache = new Map<string, string>();

/**
 * Checks if a string contains non-Latin scripts (CJK, Cyrillic, Arabic, etc.)
 */
export function hasNonLatinCharacters(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff]/.test(
    text
  );
}

/**
 * Translates a single line of text using free translation API with in-memory caching.
 */
export async function translateText(
  text: string,
  targetLang: string = 'en',
  signal?: AbortSignal
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const cacheKey = `${targetLang}:${trimmed}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      trimmed
    )}&langpair=autodetect|${targetLang}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);

    let resp: Response;
    try {
      resp = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
    }

    if (resp.ok) {
      const data = await resp.json();
      if (data?.responseData?.translatedText) {
        const result = String(data.responseData.translatedText).trim();
        // Ignore if returned text is identical or error message
        if (
          result &&
          !result.includes('MYMEMORY WARNING') &&
          !result.includes('QUERY LENGTH LIMIT EXCEEDED')
        ) {
          translationCache.set(cacheKey, result);
          return result;
        }
      }
    }
  } catch {
    // Network / abort error
  }

  return trimmed;
}

/**
 * Aligns words of a translated line across the syllable timestamps of the original line.
 * This enables word-by-word karaoke synchronization for the translation underneath!
 */
export function alignTranslationToSyllables(
  syllables: LyricSyllable[],
  translatedText: string
): LyricSyllable[] {
  if (!syllables || syllables.length === 0 || !translatedText) {
    return syllables || [];
  }

  const words = translatedText.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return syllables;

  return syllables.map((syl, i) => {
    const wordIndex = Math.min(
      words.length - 1,
      Math.floor((i / syllables.length) * words.length)
    );
    return {
      ...syl,
      translatedText: words[wordIndex],
    };
  });
}

/**
 * Translates an entire set of parsed lyric lines.
 * First uses any dual-language translation already extracted from the LRC,
 * and if missing, queries the translation service with concurrency.
 */
export async function translateLyricLines(
  lines: ParsedLyricLine[],
  targetLang: string = 'en',
  signal?: AbortSignal
): Promise<ParsedLyricLine[]> {
  if (!lines || lines.length === 0) return [];

  // Parallel queue for line translations
  const results = await Promise.all(
    lines.map(async (line) => {
      if (signal?.aborted) return line;

      let translation = line.translation;

      // If line does not have an embedded dual-language translation and contains foreign text, translate it
      if (!translation && hasNonLatinCharacters(line.content)) {
        translation = await translateText(line.content, targetLang, signal);
        if (translation === line.content) {
          translation = undefined;
        }
      }

      // If translation exists and line has syllables, align translation words to syllables
      let syllables = line.syllables;
      if (translation && syllables.length > 0) {
        syllables = alignTranslationToSyllables(syllables, translation);
      }

      return {
        ...line,
        translation,
        syllables,
      };
    })
  );

  return results;
}
