import React, { useMemo } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { ParsedLyricLine, LyricSyllable, isIdenticalLyricText } from '../../utils/lyricsParser';

interface SyllableItem {
  syl: LyricSyllable;
  sIdx: number;
}

interface WordGroup {
  wordIndex: number;
  syllables: SyllableItem[];
  hasTrailingSpace: boolean;
}

const renderSyllableTransWords = (
  transWords: string[],
  wordDur: number,
  line: ParsedLyricLine,
  currentTimeMs: number,
  isPast: boolean,
  lyricsAnimationStyle: string
) => {
  return transWords.map((word, wIdx) => {
    const sylStart = line.timeMs + wIdx * wordDur;
    const sylEnd = sylStart + wordDur;
    const isSylActive = currentTimeMs >= 0 && currentTimeMs >= sylStart && currentTimeMs < sylEnd;
    const isSylPast = isPast || (currentTimeMs >= 0 && currentTimeMs >= sylEnd);

    let sylLift = 0;
    let sylScale = 1;

    if (isSylActive) {
      switch (lyricsAnimationStyle) {
        case 'karaoke_pulse':
          sylLift = -4;
          sylScale = 1.15;
          break;
        case 'card_pop':
        case 'apple_zoom':
          sylLift = -3.5;
          sylScale = 1.12;
          break;
        case 'apple_fluid':
        case 'lossless_glow':
          sylLift = -2.5;
          sylScale = 1.09;
          break;
        case 'kinetic_slide':
          sylLift = -2;
          sylScale = 1.07;
          break;
        case 'cinematic_blur':
          sylLift = -1.5;
          sylScale = 1.05;
          break;
        case 'minimal_wave':
        default:
          sylLift = 0;
          sylScale = 1.02;
          break;
      }
    }

    return (
      <span
        key={`${line.id}-trans-syl-${wIdx}`}
        className={`inline-block whitespace-nowrap transition-all duration-200 ease-out mr-[0.28em] ${
          isSylActive ? 'drop-shadow-md' : ''
        }`}
        style={{
          transform: `translate3d(0, ${sylLift}px, 0) scale(${sylScale})`,
          willChange: isSylActive ? 'transform' : undefined,
          position: isSylActive ? 'relative' : undefined,
          zIndex: isSylActive ? 35 : undefined,
          opacity: isSylActive ? 1 : isPast ? 0.45 : isSylPast ? 0.9 : 0.45,
          color: isSylActive
            ? '#ffffff'
            : isPast
            ? 'rgba(255, 255, 255, 0.45)'
            : isSylPast
            ? 'rgba(255, 255, 255, 0.90)'
            : 'rgba(255, 255, 255, 0.45)',
          ...(isSylActive && lyricsAnimationStyle === 'lossless_glow'
            ? {
                textShadow:
                  '0 0 12px var(--color-stop-1, #6366f1), 0 0 24px var(--color-stop-2, #818cf8)',
              }
            : undefined),
        }}
      >
        {word}
      </span>
    );
  });
};

const renderSyllableGroups = (
  wordGroups: WordGroup[],
  line: ParsedLyricLine,
  currentTimeMs: number,
  isPast: boolean,
  lyricsAnimationStyle: string,
  useRomText = false
) => {
  return wordGroups.map((group) => (
    <span
      key={`${line.id}-word-${group.wordIndex}`}
      className={`inline-flex items-baseline whitespace-nowrap overflow-visible relative ${
        group.hasTrailingSpace ? 'mr-[0.28em]' : ''
      }`}
    >
      {group.syllables.map(({ syl, sIdx }) => {
        const sylStart = syl.timeMs;
        const sylEnd = syl.timeMs + syl.durationMs;
        const isSylActive = currentTimeMs >= 0 && currentTimeMs >= sylStart && currentTimeMs < sylEnd;
        const isSylPast = isPast || (currentTimeMs >= 0 && currentTimeMs >= sylEnd);

        let sylLift = 0;
        let sylScale = 1;

        if (isSylActive) {
          switch (lyricsAnimationStyle) {
            case 'karaoke_pulse':
              sylLift = -4;
              sylScale = 1.15;
              break;
            case 'card_pop':
            case 'apple_zoom':
              sylLift = -3.5;
              sylScale = 1.12;
              break;
            case 'apple_fluid':
            case 'lossless_glow':
              sylLift = -2.5;
              sylScale = 1.09;
              break;
            case 'kinetic_slide':
              sylLift = -2;
              sylScale = 1.07;
              break;
            case 'cinematic_blur':
              sylLift = -1.5;
              sylScale = 1.05;
              break;
            case 'minimal_wave':
            default:
              sylLift = 0;
              sylScale = 1.02;
              break;
          }
        }

        return (
          <span
            key={`${line.id}-syl-${sIdx}`}
            className={`inline-block transition-all duration-200 ease-out ${
              isSylActive ? 'drop-shadow-md' : ''
            }`}
            style={{
              transform: `translate3d(0, ${sylLift}px, 0) scale(${sylScale})`,
              willChange: isSylActive ? 'transform' : undefined,
              position: isSylActive ? 'relative' : undefined,
              zIndex: isSylActive ? 35 : undefined,
              opacity: isSylActive ? 1 : isPast ? 0.45 : isSylPast ? 0.9 : 0.45,
              color: isSylActive
                ? '#ffffff'
                : isPast
                ? 'rgba(255, 255, 255, 0.45)'
                : isSylPast
                ? 'rgba(255, 255, 255, 0.90)'
                : 'rgba(255, 255, 255, 0.45)',
              ...(isSylActive && lyricsAnimationStyle === 'lossless_glow'
                ? {
                    textShadow:
                      '0 0 12px var(--color-stop-1, #6366f1), 0 0 24px var(--color-stop-2, #818cf8)',
                  }
                : undefined),
            }}
          >
            {useRomText ? (syl.romanizedText || syl.text) : syl.text}
          </span>
        );
      })}
    </span>
  ));
};

const ActiveSyllableWords: React.FC<{
  line: ParsedLyricLine;
  showTrans: boolean;
  translationMode: string;
  showRom: boolean;
  romanizationMode: string;
  wordGroups: WordGroup[];
  lyricsAnimationStyle: string;
  isPast: boolean;
}> = ({ line, showTrans, translationMode, showRom, romanizationMode, wordGroups, lyricsAnimationStyle, isPast }) => {
  const currentTimeMs = usePlayerStore((s) => s.currentTime * 1000);
  if (showTrans && translationMode === 'replace' && line.translation) {
    const transWords = line.translation.trim().split(/\s+/).filter(Boolean);
    const wordDur = line.durationMs / Math.max(1, transWords.length);
    return <>{renderSyllableTransWords(transWords, wordDur, line, currentTimeMs, isPast, lyricsAnimationStyle)}</>;
  }
  if (showRom && romanizationMode === 'replace' && line.romanized) {
    const hasSylRom = wordGroups.some((g) => g.syllables.some(({ syl }) => syl.romanizedText));
    if (hasSylRom) {
      return <>{renderSyllableGroups(wordGroups, line, currentTimeMs, isPast, lyricsAnimationStyle, true)}</>;
    }
    const romWords = line.romanized.trim().split(/\s+/).filter(Boolean);
    const wordDur = line.durationMs / Math.max(1, romWords.length);
    return <>{renderSyllableTransWords(romWords, wordDur, line, currentTimeMs, isPast, lyricsAnimationStyle)}</>;
  }
  return <>{renderSyllableGroups(wordGroups, line, currentTimeMs, isPast, lyricsAnimationStyle)}</>;
};

const StaticSyllableWords: React.FC<{
  line: ParsedLyricLine;
  showTrans: boolean;
  translationMode: string;
  showRom: boolean;
  romanizationMode: string;
  wordGroups: WordGroup[];
  lyricsAnimationStyle: string;
  isPast: boolean;
}> = ({ line, showTrans, translationMode, showRom, romanizationMode, wordGroups, lyricsAnimationStyle, isPast }) => {
  if (showTrans && translationMode === 'replace' && line.translation) {
    const transWords = line.translation.trim().split(/\s+/).filter(Boolean);
    const wordDur = line.durationMs / Math.max(1, transWords.length);
    return <>{renderSyllableTransWords(transWords, wordDur, line, -1, isPast, lyricsAnimationStyle)}</>;
  }
  if (showRom && romanizationMode === 'replace' && line.romanized) {
    const hasSylRom = wordGroups.some((g) => g.syllables.some(({ syl }) => syl.romanizedText));
    if (hasSylRom) {
      return <>{renderSyllableGroups(wordGroups, line, -1, isPast, lyricsAnimationStyle, true)}</>;
    }
    const romWords = line.romanized.trim().split(/\s+/).filter(Boolean);
    const wordDur = line.durationMs / Math.max(1, romWords.length);
    return <>{renderSyllableTransWords(romWords, wordDur, line, -1, isPast, lyricsAnimationStyle)}</>;
  }
  return <>{renderSyllableGroups(wordGroups, line, -1, isPast, lyricsAnimationStyle)}</>;
};

const renderSubRomGroups = (
  wordGroups: WordGroup[],
  line: ParsedLyricLine,
  currentTimeMs: number,
  isPast: boolean,
  inactiveFontSize: number
) => {
  return wordGroups.map((group) => (
    <span
      key={`${line.id}-rom-word-${group.wordIndex}`}
      className={`inline-flex items-baseline whitespace-nowrap ${
        group.hasTrailingSpace ? 'mr-[0.28em]' : ''
      }`}
    >
      {group.syllables.map(({ syl, sIdx }) => {
        const sylStart = syl.timeMs;
        const sylEnd = syl.timeMs + syl.durationMs;
        const isSylActive = currentTimeMs >= 0 && currentTimeMs >= sylStart && currentTimeMs < sylEnd;
        const isSylPast = isPast || (currentTimeMs >= 0 && currentTimeMs >= sylEnd);
        const romText = syl.romanizedText || syl.text;

        return (
          <span
            key={`${line.id}-rom-${sIdx}`}
            className="inline-block transition-all duration-150"
            style={{
              fontSize: `${Math.max(12, inactiveFontSize * 0.65)}px`,
              color: isSylActive
                ? '#ffffff'
                : isPast
                ? 'rgba(255, 255, 255, 0.45)'
                : isSylPast
                ? 'rgba(255, 255, 255, 0.85)'
                : 'rgba(255, 255, 255, 0.45)',
              fontWeight: isSylActive ? 700 : 400,
              transform: isSylActive ? 'translate3d(0, -1px, 0) scale(1.06)' : 'none',
              willChange: isSylActive ? 'transform' : undefined,
              textShadow: isSylActive
                ? '0 0 10px rgba(255, 255, 255, 0.6), 0 0 18px var(--color-stop-1, #6366f1)'
                : undefined,
            }}
          >
            {romText}
          </span>
        );
      })}
    </span>
  ));
};

const ActiveSubRomWords: React.FC<{
  line: ParsedLyricLine;
  wordGroups: WordGroup[];
  inactiveFontSize: number;
  isPast: boolean;
}> = ({ line, wordGroups, inactiveFontSize, isPast }) => {
  const currentTimeMs = usePlayerStore((s) => s.currentTime * 1000);
  return <>{renderSubRomGroups(wordGroups, line, currentTimeMs, isPast, inactiveFontSize)}</>;
};

const StaticSubRomWords: React.FC<{
  line: ParsedLyricLine;
  wordGroups: WordGroup[];
  inactiveFontSize: number;
  isPast: boolean;
}> = ({ line, wordGroups, inactiveFontSize, isPast }) => {
  return <>{renderSubRomGroups(wordGroups, line, -1, isPast, inactiveFontSize)}</>;
};

const renderSubTransWords = (
  subTrans: string,
  line: ParsedLyricLine,
  currentTimeMs: number,
  isPast: boolean,
  inactiveFontSize: number
) => {
  const transWords = subTrans.trim().split(/\s+/).filter(Boolean);
  const wordDur = line.durationMs / Math.max(1, transWords.length);
  return transWords.map((word, wIdx) => {
    const sylStart = line.timeMs + wIdx * wordDur;
    const sylEnd = sylStart + wordDur;
    const isSylActive = currentTimeMs >= 0 && currentTimeMs >= sylStart && currentTimeMs < sylEnd;
    const isSylPast = isPast || (currentTimeMs >= 0 && currentTimeMs >= sylEnd);

    return (
      <span
        key={`${line.id}-trans-${wIdx}`}
        className="inline-block whitespace-nowrap transition-all duration-150 mr-[0.28em]"
        style={{
          fontSize: `${Math.max(12, inactiveFontSize * 0.65)}px`,
          color: isSylActive
            ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, #ffffff)'
            : isSylPast
            ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, rgba(255, 255, 255, 0.85))'
            : 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, rgba(255, 255, 255, 0.45))',
          fontWeight: isSylActive ? 700 : 400,
          transform: isSylActive ? 'translate3d(0, -1px, 0) scale(1.06)' : 'none',
          willChange: isSylActive ? 'transform' : undefined,
          textShadow: isSylActive
            ? '0 0 10px rgba(255, 255, 255, 0.6), 0 0 18px var(--color-stop-1, #6366f1)'
            : undefined,
        }}
      >
        {word}
      </span>
    );
  });
};

const ActiveSubTransWords: React.FC<{
  line: ParsedLyricLine;
  subTrans: string;
  inactiveFontSize: number;
  isPast: boolean;
}> = ({ line, subTrans, inactiveFontSize, isPast }) => {
  const currentTimeMs = usePlayerStore((s) => s.currentTime * 1000);
  return <>{renderSubTransWords(subTrans, line, currentTimeMs, isPast, inactiveFontSize)}</>;
};

const StaticSubTransWords: React.FC<{
  line: ParsedLyricLine;
  subTrans: string;
  inactiveFontSize: number;
  isPast: boolean;
}> = ({ line, subTrans, inactiveFontSize, isPast }) => {
  return <>{renderSubTransWords(subTrans, line, -1, isPast, inactiveFontSize)}</>;
};

export interface LyricLineRowProps {
  line: ParsedLyricLine;
  idx: number;
  isActive: boolean;
  isPast: boolean;
  distance: number;
  isUnsynced: boolean;
  lyricsAnimationStyle: string;
  lyricsFontSizePreset: string;
  isRomanizationEnabled: boolean;
  romanizationMode: string;
  isTranslationEnabled: boolean;
  translationMode: string;
  activeFontSize: number;
  inactiveFontSize: number;
  activeLineRef: React.Ref<HTMLDivElement> | null;
  onSeek: (secs: number, targetIdx?: number) => void;
  compact?: boolean;
  isTransparent?: boolean;
}

export const LyricLineRow = React.memo<LyricLineRowProps>(
  ({
    line,
    idx,
    isActive,
    isPast,
    distance,
    isUnsynced,
    lyricsAnimationStyle,
    lyricsFontSizePreset,
    isRomanizationEnabled,
    romanizationMode,
    isTranslationEnabled,
    translationMode,
    activeFontSize,
    inactiveFontSize,
    activeLineRef,
    onSeek,
    compact = false,
    isTransparent = false,
  }) => {
    if (lyricsFontSizePreset === 'maximum' && !isUnsynced && distance > 1) {
      return null;
    }

    const showRom = isRomanizationEnabled && Boolean(line.romanized);
    const showTrans =
      isTranslationEnabled &&
      Boolean(line.translation) &&
      !isIdenticalLyricText(line.content, line.translation);

    let mainText = line.content;
    if (showTrans && translationMode === 'replace' && line.translation) {
      mainText = line.translation;
    } else if (showRom && romanizationMode === 'replace' && line.romanized) {
      mainText = line.romanized;
    }

    const subRom = showRom && romanizationMode === 'below' ? line.romanized : null;
    const subTrans = showTrans && translationMode === 'below' ? line.translation : null;

    let scaleTarget = 1;
    let transXTarget = 0;
    let transYTarget = 0;
    let opacityTarget = isActive ? 1 : 0.35;
    let blurAmount = 'none';

    if (!isUnsynced) {
      const isFar = distance >= 2;
      switch (lyricsAnimationStyle) {
        case 'apple_fluid':
          scaleTarget = isActive ? 1.085 : distance === 1 && !isPast ? 0.99 : 0.975;
          transXTarget = isActive ? 4 : isFar ? 0 : isPast ? 0 : -6;
          transYTarget = isActive ? -2 : isFar ? 0 : isPast ? -1 : 3;
          opacityTarget = isActive ? 1 : isFar ? 0.45 : isPast ? 0.45 : distance === 1 ? 0.64 : 0.43;
          break;
        case 'karaoke_pulse':
          scaleTarget = isActive ? 1.1 : distance === 1 && !isPast ? 0.99 : 0.97;
          transXTarget = isActive ? 4 : 0;
          transYTarget = isActive ? -3 : isFar ? 0 : 1;
          opacityTarget = isActive ? 1 : isFar ? 0.45 : isPast ? 0.45 : distance === 1 ? 0.60 : 0.49;
          break;
        case 'kinetic_slide':
          scaleTarget = isActive ? 1.045 : isFar ? 0.975 : isPast ? 0.99 : 0.975;
          transXTarget = isActive ? 0 : isFar ? 0 : isPast ? 14 : -24;
          transYTarget = isActive ? -1 : isFar ? 0 : 1;
          opacityTarget = isActive ? 1 : isFar ? 0.45 : isPast ? 0.45 : 0.42;
          break;
        case 'cinematic_blur':
          scaleTarget = isActive ? 1.065 : distance === 1 && !isPast ? 0.96 : 0.93;
          transYTarget = isActive ? 0 : isFar ? 0 : isPast ? -10 : 10;
          opacityTarget = isActive ? 1 : isFar ? 0.35 : isPast ? 0.45 : distance <= 1 ? 0.58 : 0.28;
          blurAmount = isActive ? 'none' : isFar ? 'none' : isPast ? 'none' : distance === 1 ? 'blur(1.5px)' : 'none';
          break;
        case 'lossless_glow':
          scaleTarget = isActive ? 1.075 : distance === 1 && !isPast ? 0.99 : 0.97;
          transXTarget = isActive ? 3 : 0;
          transYTarget = isActive ? -2 : isFar ? 0 : 1;
          opacityTarget = isActive ? 1 : isFar ? 0.45 : isPast ? 0.45 : distance === 1 ? 0.66 : 0.46;
          break;
        case 'card_pop':
          scaleTarget = isActive ? 1.065 : 0.985;
          transYTarget = isActive ? -5 : isFar ? 0 : 2;
          opacityTarget = isActive ? 1 : isFar ? 0.45 : isPast ? 0.45 : distance === 1 ? 0.60 : 0.48;
          break;
        case 'apple_zoom':
          scaleTarget = isActive ? 1.18 : distance === 1 && !isPast ? 0.94 : 0.88;
          transYTarget = isActive ? -4 : isFar ? 0 : isPast ? -1 : 2;
          opacityTarget = isActive ? 1 : isFar ? 0.35 : isPast ? 0.45 : distance === 1 ? 0.55 : 0.32;
          break;
        case 'minimal_wave':
        default:
          scaleTarget = 1;
          transXTarget = isActive ? 2 : 0;
          transYTarget = isPast ? -1 : isActive ? 0 : 1;
          opacityTarget = isActive ? 1 : isFar ? 0.45 : isPast ? 0.45 : distance === 1 ? 0.58 : 0.38;
          break;
      }
    }

    const isCardPopActive = lyricsAnimationStyle === 'card_pop' && isActive && !isUnsynced;
    const isLosslessGlowActive = lyricsAnimationStyle === 'lossless_glow' && isActive && !isUnsynced;

    let lineGlowStyle: React.CSSProperties | undefined;
    if (isActive && !isUnsynced && !line.hasSyllables) {
      switch (lyricsAnimationStyle) {
        case 'lossless_glow':
          lineGlowStyle = {
            textShadow:
              '0 0 14px var(--color-stop-1, #6366f1), 0 0 28px var(--color-stop-2, #818cf8), 0 0 42px color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
          };
          break;
        case 'apple_fluid':
          lineGlowStyle = {
            textShadow: '0 0 18px color-mix(in srgb, var(--color-stop-1, #6366f1) 32%, transparent)',
          };
          break;
        case 'karaoke_pulse':
          lineGlowStyle = {
            textShadow:
              '0 0 16px color-mix(in srgb, var(--color-stop-1, #ec4899) 65%, white 35%), 0 0 28px color-mix(in srgb, var(--color-stop-2, #818cf8) 40%, transparent)',
          };
          break;
        case 'cinematic_blur':
        case 'apple_zoom':
          lineGlowStyle = {
            textShadow: '0 0 14px rgba(255, 255, 255, 0.4)',
          };
          break;
        default:
          break;
      }
    }

    const wordGroups: WordGroup[] = useMemo(() => {
      if (!line.syllables || line.syllables.length === 0) return [];
      const groups: WordGroup[] = [];
      let currentGroup: SyllableItem[] = [];

      for (let i = 0; i < line.syllables.length; i++) {
        const syl = line.syllables[i];
        currentGroup.push({ syl, sIdx: i });

        const isBoundary =
          Boolean(syl.hasTrailingSpace) ||
          /\s+$/.test(syl.text) ||
          i === line.syllables.length - 1;

        if (isBoundary) {
          groups.push({
            wordIndex: groups.length,
            syllables: currentGroup,
            hasTrailingSpace: Boolean(syl.hasTrailingSpace) || /\s+$/.test(syl.text),
          });
          currentGroup = [];
        }
      }

      if (currentGroup.length > 0) {
        groups.push({
          wordIndex: groups.length,
          syllables: currentGroup,
          hasTrailingSpace: false,
        });
      }

      return groups;
    }, [line.syllables]);

    const lineMaxWidth =
      compact
        ? '100%'
        : lyricsFontSizePreset === 'balanced'
        ? 'min(1750px, 95vw)'
        : lyricsFontSizePreset === 'maximum'
        ? 'min(1400px, 94vw)'
        : lyricsFontSizePreset === 'large'
        ? 'min(1100px, 90vw)'
        : 'min(900px, 86vw)';

    return (
      <div
        id={`lyric-line-${idx}`}
        ref={isActive && !isUnsynced ? activeLineRef : null}
        className={`text-center cursor-pointer w-full ${
          compact ? 'px-2 py-1.5 rounded-xl' : 'px-8 sm:px-12 py-3.5 rounded-2xl'
        } flex flex-col items-center justify-center break-words [text-wrap:balance] overflow-visible relative ${
          isActive && !isUnsynced
            ? 'font-extrabold'
            : isUnsynced
            ? 'text-zinc-200 font-medium'
            : 'text-zinc-400 hover:text-zinc-200 font-medium'
        }`}
        style={{
          maxWidth: lineMaxWidth,
          fontSize: isActive && !isUnsynced ? `${activeFontSize}px` : `${inactiveFontSize}px`,
          lineHeight: 1.35,
          opacity: opacityTarget,
          transform: `translate3d(${transXTarget}px, ${transYTarget}px, 0) scale(${scaleTarget})`,
          filter: blurAmount,
          willChange: 'transform, opacity',
          transition: 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease-out',
          position: 'relative',
          zIndex: isLosslessGlowActive ? 30 : isActive && !isUnsynced ? 25 : 1,
          ...(isTransparent
            ? {
                textShadow:
                  '0 1px 4px rgba(0,0,0,0.95), 0 2px 8px rgba(0,0,0,0.9), 0 0 16px rgba(0,0,0,0.85)',
              }
            : {}),
          ...(isLosslessGlowActive
            ? {
                filter:
                  'drop-shadow(0 0 20px color-mix(in srgb, var(--color-stop-1, #6366f1) 85%, transparent)) drop-shadow(0 0 35px color-mix(in srgb, var(--color-stop-2, #818cf8) 50%, transparent))',
              }
            : {}),
        }}
        onClick={() => {
          if (typeof line.startSecs === 'number' && !isNaN(line.startSecs) && !isUnsynced) {
            onSeek(line.startSecs, idx);
          }
        }}
      >
        {/* Floating Card Pop Background Layer */}
        {isCardPopActive && (
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none -z-10"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          />
        )}

        {/* Granular Syllable / Word rendering with Jumping text */}
        {line.hasSyllables && !isUnsynced ? (
          <div className="inline-flex flex-wrap justify-center items-baseline text-center max-w-full overflow-visible relative">
            {isActive ? (
              <ActiveSyllableWords
                line={line}
                showTrans={showTrans}
                translationMode={translationMode}
                showRom={showRom}
                romanizationMode={romanizationMode}
                wordGroups={wordGroups}
                lyricsAnimationStyle={lyricsAnimationStyle}
                isPast={isPast}
              />
            ) : (
              <StaticSyllableWords
                line={line}
                showTrans={showTrans}
                translationMode={translationMode}
                showRom={showRom}
                romanizationMode={romanizationMode}
                wordGroups={wordGroups}
                lyricsAnimationStyle={lyricsAnimationStyle}
                isPast={isPast}
              />
            )}
          </div>
        ) : (
          <div
            className={`break-words [text-wrap:balance] ${
              isActive && !(showTrans && translationMode === 'replace')
                ? 'text-white'
                : isPast
                ? 'text-white/45'
                : distance === 1
                ? 'text-white/70'
                : 'text-white/45'
            }`}
            style={{
              ...lineGlowStyle,
              ...(showTrans && translationMode === 'replace'
                ? {
                    color: isActive
                      ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 22%, #ffffff)'
                      : 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, rgba(255, 255, 255, 0.45))',
                  }
                : {}),
            }}
          >
            {mainText}
          </div>
        )}

        {/* Word-by-Word Romanization Underneath */}
        {subRom && (
          line.hasSyllables && !isUnsynced ? (
            <div className="w-full flex flex-wrap justify-center items-center gap-1 font-mono mt-1.5 select-none text-center">
              {isActive ? (
                <ActiveSubRomWords
                  line={line}
                  wordGroups={wordGroups}
                  inactiveFontSize={inactiveFontSize}
                  isPast={isPast}
                />
              ) : (
                <StaticSubRomWords
                  line={line}
                  wordGroups={wordGroups}
                  inactiveFontSize={inactiveFontSize}
                  isPast={isPast}
                />
              )}
            </div>
          ) : (
            <div
              className="w-full flex items-center justify-center font-mono font-normal mt-1.5 select-none break-words [text-wrap:balance] text-center"
              style={{
                fontSize: `${Math.max(12, inactiveFontSize * 0.65)}px`,
                color: 'rgba(255, 255, 255, 0.6)',
              }}
            >
              <span>{subRom}</span>
            </div>
          )
        )}

        {/* Word-by-Word Translation Underneath */}
        {subTrans && (
          line.hasSyllables && !isUnsynced ? (
            <div className="w-full flex flex-wrap justify-center items-center gap-1 font-sans mt-1.5 select-none text-center">
              {isActive ? (
                <ActiveSubTransWords
                  line={line}
                  subTrans={subTrans}
                  inactiveFontSize={inactiveFontSize}
                  isPast={isPast}
                />
              ) : (
                <StaticSubTransWords
                  line={line}
                  subTrans={subTrans}
                  inactiveFontSize={inactiveFontSize}
                  isPast={isPast}
                />
              )}
            </div>
          ) : (
            <div
              className="w-full flex items-center justify-center font-sans font-normal mt-1.5 select-none break-words [text-wrap:balance] text-center"
              style={{
                fontSize: `${Math.max(12, inactiveFontSize * 0.65)}px`,
                color: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 22%, rgba(255, 255, 255, 0.7))',
              }}
            >
              <span>{subTrans}</span>
            </div>
          )
        )}
      </div>
    );
  },
  (prev, next) => {
    if (!prev.isActive && !next.isActive && prev.distance >= 2 && next.distance >= 2) {
      return (
        prev.activeFontSize === next.activeFontSize &&
        prev.inactiveFontSize === next.inactiveFontSize &&
        prev.lyricsAnimationStyle === next.lyricsAnimationStyle &&
        prev.lyricsFontSizePreset === next.lyricsFontSizePreset &&
        prev.line === next.line &&
        prev.compact === next.compact &&
        prev.isTransparent === next.isTransparent &&
        prev.isRomanizationEnabled === next.isRomanizationEnabled &&
        prev.romanizationMode === next.romanizationMode &&
        prev.isTranslationEnabled === next.isTranslationEnabled &&
        prev.translationMode === next.translationMode
      );
    }
    return (
      prev.isActive === next.isActive &&
      prev.isPast === next.isPast &&
      prev.distance === next.distance &&
      prev.activeFontSize === next.activeFontSize &&
      prev.inactiveFontSize === next.inactiveFontSize &&
      prev.lyricsAnimationStyle === next.lyricsAnimationStyle &&
      prev.lyricsFontSizePreset === next.lyricsFontSizePreset &&
      prev.line === next.line &&
      prev.compact === next.compact &&
      prev.isTransparent === next.isTransparent &&
      prev.isRomanizationEnabled === next.isRomanizationEnabled &&
      prev.romanizationMode === next.romanizationMode &&
      prev.isTranslationEnabled === next.isTranslationEnabled &&
      prev.translationMode === next.translationMode
    );
  }
);

LyricLineRow.displayName = 'LyricLineRow';
