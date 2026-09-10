import KuroshiroPkg from '@sglkc/kuroshiro';
import KuromojiAnalyzerPkg from '@sglkc/kuroshiro-analyzer-kuromoji';
import { transliterate } from 'transliteration';
import { detectScript } from 'lyric-romanizer';
import { LyricSyllable, ParsedLyricLine } from './lyricsParser';

const Kuroshiro = (KuroshiroPkg as any).default || KuroshiroPkg;
const KuromojiAnalyzer = (KuromojiAnalyzerPkg as any).default || KuromojiAnalyzerPkg;

let kuroshiroInstance: any = null;
let kuroshiroPromise: Promise<any> | null = null;

export const KANJI_REGEX = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
export const KANA_REGEX = /[\u3040-\u30ff]/;
export const HANGUL_REGEX = /[\uac00-\ud7af]/;
export const RUBY_REGEX = /<ruby>(.*?)<rp>\(<\/rp><rt>(.*?)<\/rt><rp>\)<\/rp><\/ruby>/g;

export function normalizeLyricsText(text: string): string {
  if (!text) return '';
  return text.normalize('NFKC');
}

export async function getKuroshiro(dictPath: string = '/dict'): Promise<any> {
  if (kuroshiroInstance) return kuroshiroInstance;
  if (!kuroshiroPromise) {
    kuroshiroPromise = (async () => {
      const k = new Kuroshiro();
      const a = new KuromojiAnalyzer({ dictPath });
      await k.init(a);
      kuroshiroInstance = k;
      return k;
    })();
  }
  return kuroshiroPromise;
}

interface RubyPart {
  kanji: string;
  kana: string;
}

function splitRuby(kanji: string, kana: string): RubyPart[] {
  if (kanji.length <= 1) return [{ kanji, kana }];

  // 2-kanji compound with 4-kana reading (e.g. 関係 -> かん・けい, 曖昧 -> あい・まい)
  if (kanji.length === 2 && kana.length === 4) {
    return [
      { kanji: kanji[0], kana: kana.slice(0, 2) },
      { kanji: kanji[1], kana: kana.slice(2) },
    ];
  }

  // 2-kanji compound with 2-kana reading
  if (kanji.length === 2 && kana.length === 2) {
    return [
      { kanji: kanji[0], kana: kana.slice(0, 1) },
      { kanji: kanji[1], kana: kana.slice(1) },
    ];
  }

  // 1-to-1 matching if lengths match
  if (kanji.length === kana.length) {
    return kanji.split('').map((kChar, idx) => ({ kanji: kChar, kana: kana[idx] }));
  }

  return [{ kanji, kana }];
}

export interface RomanizedLineResult {
  romanized: string;
  syllables?: LyricSyllable[];
}

/**
 * Contextually romanizes a Japanese lyric line along with its word-synced syllables.
 * Applies NFKC normalization (converting Kangxi radicals to standard CJK ideographs),
 * generates furigana from the full line to preserve compound and okurigana context,
 * accurately maps readings into individual syllable fragments,
 * and ensures no untranslated kanji ever leak through via transliteration fallback.
 */
export async function romanizeJapaneseLine(
  lineContent: string,
  syllables: LyricSyllable[] = [],
  dictPath: string = '/dict'
): Promise<RomanizedLineResult> {
  const normContent = normalizeLyricsText(lineContent);
  if (!normContent.trim()) {
    return { romanized: normContent, syllables };
  }

  try {
    const k = await getKuroshiro(dictPath);

    // Full line furigana gives contextual readings for all kanji compounds and verbs
    const furi = await k.convert(normContent, { to: 'hiragana', mode: 'furigana' });

    // Extract all ruby replacements (Kanji -> Kana)
    const replacements: RubyPart[] = [];
    let match: RegExpExecArray | null;
    const re = new RegExp(RUBY_REGEX.source, 'g');
    while ((match = re.exec(furi)) !== null) {
      const parts = splitRuby(match[1], match[2]);
      replacements.push(...parts);
    }

    // Full line in kana
    const lineKana = furi.replace(RUBY_REGEX, (_: string, __: string, rt: string) => rt);
    let lineRom = await k.convert(lineKana, { to: 'romaji', mode: 'spaced' });

    // Clean formatting and ensure no raw Kanji remain
    lineRom = lineRom.replace(/\s+/g, ' ').trim();
    if (KANJI_REGEX.test(lineRom)) {
      lineRom = transliterate(lineRom);
    }

    // If there are no syllables, return line romaji
    if (!syllables || syllables.length === 0) {
      return { romanized: lineRom };
    }

    // Map each syllable contextually
    let repIdx = 0;
    const enrichedSyllables = await Promise.all(
      syllables.map(async (syl) => {
        let s = normalizeLyricsText(syl.text);
        // Replace any kanji in this syllable with its contextual kana reading
        while (repIdx < replacements.length && s.includes(replacements[repIdx].kanji)) {
          s = s.replace(replacements[repIdx].kanji, replacements[repIdx].kana);
          repIdx++;
        }

        try {
          let sRom = await k.convert(s, { to: 'romaji', mode: 'spaced' });
          sRom = sRom.replace(/\s+/g, ' ').trim();
          if (KANJI_REGEX.test(sRom)) {
            sRom = transliterate(sRom);
          }
          return {
            ...syl,
            text: normalizeLyricsText(syl.text),
            romanizedText: sRom || undefined,
          };
        } catch {
          const fallback = transliterate(s).trim();
          return {
            ...syl,
            text: normalizeLyricsText(syl.text),
            romanizedText: fallback || undefined,
          };
        }
      })
    );

    return {
      romanized: lineRom,
      syllables: enrichedSyllables,
    };
  } catch (err) {
    console.warn('Japanese romanization error, falling back to transliterate:', err);
    let fallbackRom = transliterate(normContent);
    const fallbackSyllables = syllables.map((syl) => ({
      ...syl,
      text: normalizeLyricsText(syl.text),
      romanizedText: transliterate(normalizeLyricsText(syl.text)).trim() || undefined,
    }));
    return {
      romanized: fallbackRom,
      syllables: fallbackSyllables,
    };
  }
}

/**
 * Enriches any lyric line with accurate romanization for lines and syllables.
 * Automatically chooses the ideal romanizer: contextual Japanese furigana for Japanese lines,
 * dedicated Korean engine for Korean lines, pinyin for Chinese lines, etc.
 */
export async function enrichLineWithRomanization(
  line: ParsedLyricLine,
  trackScript: string,
  romanizer: any
): Promise<ParsedLyricLine> {
  const normContent = normalizeLyricsText(line.content);
  if (!normContent.trim()) {
    return line;
  }

  const lineScript = detectScript([normContent]);
  const hasKana = KANA_REGEX.test(normContent);
  const hasKanji = KANJI_REGEX.test(normContent);
  const hasHangul = HANGUL_REGEX.test(normContent);

  // If the line contains kana, or is kanji in a Japanese track without Hangul, treat as Japanese
  const isJapaneseLine =
    hasKana ||
    lineScript === 'japanese' ||
    (trackScript === 'japanese' && hasKanji && !hasHangul);

  if (isJapaneseLine) {
    const jaResult = await romanizeJapaneseLine(normContent, line.syllables);
    return {
      ...line,
      content: normContent,
      romanized: jaResult.romanized !== normContent ? jaResult.romanized : undefined,
      syllables: jaResult.syllables || line.syllables,
    };
  }

  // Korean / Chinese / Cyrillic / other non-Latin scripts
  const effectiveScript =
    hasHangul || lineScript === 'korean'
      ? 'korean'
      : lineScript === 'other' && trackScript !== 'other' && trackScript !== 'latin'
      ? trackScript
      : lineScript;

  const romOptions =
    effectiveScript && effectiveScript !== 'latin' && effectiveScript !== 'other'
      ? { script: effectiveScript }
      : undefined;

  try {
    let rom = await romanizer.romanizeLine(normContent, romOptions);
    if (KANJI_REGEX.test(rom)) {
      rom = transliterate(rom);
    }

    const romSyllables =
      line.syllables.length > 0
        ? await Promise.all(
            line.syllables.map(async (syl) => {
              const sylNorm = normalizeLyricsText(syl.text);
              try {
                let r = await romanizer.romanizeLine(sylNorm, romOptions);
                if (KANJI_REGEX.test(r)) {
                  r = transliterate(r);
                }
                return {
                  ...syl,
                  text: sylNorm,
                  romanizedText: r !== sylNorm ? r : undefined,
                };
              } catch {
                const fb = transliterate(sylNorm).trim();
                return {
                  ...syl,
                  text: sylNorm,
                  romanizedText: fb !== sylNorm ? fb : undefined,
                };
              }
            })
          )
        : line.syllables;

    return {
      ...line,
      content: normContent,
      romanized: rom !== normContent ? rom : undefined,
      syllables: romSyllables,
    };
  } catch {
    return {
      ...line,
      content: normContent,
    };
  }
}
