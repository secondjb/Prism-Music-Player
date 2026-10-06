import { ParsedLyricLine, isIdenticalLyricText } from './lyricsParser';

export interface CalculateBalancedFontSizeOptions {
  lines: ParsedLyricLine[];
  availWidth: number;
  targetHeight: number;
  isTranslationEnabled?: boolean;
  translationMode?: string;
  isRomanizationEnabled?: boolean;
  romanizationMode?: string;
  minCandidate?: number;
  maxCandidate?: number;
  defaultFallback?: number;
}

/**
 * Shared dynamic font size calculation for the 'balanced' lyrics typography preset.
 * Calibrated so that exactly 3 lines (current line + 1 line before & after) fit cleanly
 * inside the available viewport without active-line text clipping or awkward wraps.
 */
export function calculateBalancedFontSize({
  lines,
  availWidth,
  targetHeight,
  isTranslationEnabled = false,
  translationMode = 'below',
  isRomanizationEnabled = false,
  romanizationMode = 'below',
  minCandidate = 22,
  maxCandidate = 56,
  defaultFallback,
}: CalculateBalancedFontSizeOptions): number {
  const validLines = lines.filter((l) => l.content && l.content.trim().length > 0);
  if (validLines.length === 0) {
    return defaultFallback ?? Math.max(minCandidate, Math.min(maxCandidate, Math.round(targetHeight * 0.12)));
  }

  const getEffectiveText = (l: ParsedLyricLine) => {
    if (
      isTranslationEnabled &&
      translationMode === 'replace' &&
      l.translation &&
      !isIdenticalLyricText(l.content, l.translation)
    ) {
      return l.translation.trim();
    }
    if (isRomanizationEnabled && romanizationMode === 'replace' && l.romanized) {
      return l.romanized.trim();
    }
    return l.content.trim();
  };

  const normWidths = validLines
    .map((l) => {
      const text = getEffectiveText(l);
      let w = 0;
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (
          (code >= 0x4e00 && code <= 0x9fff) ||
          (code >= 0x3040 && code <= 0x30ff) ||
          (code >= 0xac00 && code <= 0xd7af)
        ) {
          w += 0.95;
        } else {
          w += 0.54;
        }
      }
      return Math.max(1, w);
    })
    .sort((a, b) => a - b);

  const repNormWidth = normWidths[Math.min(normWidths.length - 1, Math.floor(normWidths.length * 0.9))];
  const medianNormWidth = normWidths[Math.floor(normWidths.length * 0.5)];

  const hasTrans =
    isTranslationEnabled &&
    translationMode === 'below' &&
    validLines.some((l) => l.translation && !isIdenticalLyricText(l.content, l.translation));
  const hasRom =
    isRomanizationEnabled &&
    romanizationMode === 'below' &&
    validLines.some((l) => l.romanized);
  const subLineCount = (hasTrans ? 1 : 0) + (hasRom ? 1 : 0);

  const maxCandidateSize = Math.max(minCandidate, maxCandidate);
  let bestSize = minCandidate;

  for (let candidateF = maxCandidateSize; candidateF >= minCandidate; candidateF--) {
    const activeWrappedLines = Math.max(1, Math.ceil((repNormWidth * candidateF) / availWidth));
    const inactiveWrappedLines = Math.max(1, Math.ceil((medianNormWidth * candidateF) / availWidth));

    const activeHeight =
      activeWrappedLines * (candidateF * 1.35) +
      24 +
      subLineCount * (Math.max(12, candidateF * 0.45) * 1.3 + 8);
    const inactiveHeight = 2 * (inactiveWrappedLines * (candidateF * 1.35) + 24);
    const gapsHeight = 48;

    const totalRequiredHeight = activeHeight + inactiveHeight + gapsHeight;

    if (totalRequiredHeight <= targetHeight && activeWrappedLines <= 2) {
      bestSize = candidateF;
      break;
    }
  }

  if (bestSize === minCandidate) {
    for (let candidateF = maxCandidateSize; candidateF >= minCandidate; candidateF--) {
      const activeWrappedLines = Math.max(1, Math.ceil((repNormWidth * candidateF) / availWidth));
      const inactiveWrappedLines = Math.max(1, Math.ceil((medianNormWidth * candidateF) / availWidth));
      const activeHeight = activeWrappedLines * (candidateF * 1.35) + 24;
      const inactiveHeight = 2 * (inactiveWrappedLines * (candidateF * 1.35) + 24);
      if (activeHeight + inactiveHeight + 48 <= targetHeight) {
        bestSize = candidateF;
        break;
      }
    }
  }

  return bestSize;
}
