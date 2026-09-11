import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Checkbox from '@mui/material/Checkbox';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { AudioSlider } from './AudioSlider';
import { WavyAudioSlider } from './WavyAudioSlider';
import { M3Selector } from './M3Selector';
import { fetchLrclibLyrics } from '../utils/lrclibFetcher';
import { InterludeIndicator } from './InterludeIndicator';
import { parseRichLyrics, ParsedLyricLine, LyricSyllable, hasExplicitWordSync, isIdenticalLyricText } from '../utils/lyricsParser';
import { createRomanizer, detectScript } from 'lyric-romanizer';
import { enrichLineWithRomanization } from '../utils/japaneseRomanizer';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  Mic2,
  Settings2,
  RefreshCw,
  X,
  Target,
  Languages,
  ChevronRight,
  ChevronLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Save,
  Type as TypeIcon,
  Activity,
  Waves,
  Globe,
} from 'lucide-react';

const romanizer = createRomanizer({ japaneseDictPath: '/dict' });

const FONT_OPTIONS = [
  { id: 'system-ui, -apple-system, sans-serif', name: 'System Default', desc: 'Native OS typeface' },
  { id: "'Plus Jakarta Sans', system-ui, sans-serif", name: 'Google Sans / Jakarta', desc: 'Modern geometric sans', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" },
  { id: "'Outfit', system-ui, sans-serif", name: 'Outfit', desc: 'Warm display sans', fontFamily: "'Outfit', system-ui, sans-serif" },
  { id: "'Inter', system-ui, sans-serif", name: 'Inter Clean', desc: 'Neutral high-legibility sans', fontFamily: "'Inter', system-ui, sans-serif" },
  { id: "'Lexend', system-ui, sans-serif", name: 'Lexend', desc: 'Designed for fluid reading', fontFamily: "'Lexend', system-ui, sans-serif" },
  { id: "'Poppins', system-ui, sans-serif", name: 'Poppins', desc: 'Geometric round shapes', fontFamily: "'Poppins', system-ui, sans-serif" },
  { id: "'DM Sans', system-ui, sans-serif", name: 'DM Sans', desc: 'Clean geometric low-contrast', fontFamily: "'DM Sans', system-ui, sans-serif" },
  { id: "'Nunito', system-ui, sans-serif", name: 'Nunito (Rounded)', desc: 'Soft rounded terminals', fontFamily: "'Nunito', system-ui, sans-serif" },
];

const ANIMATION_OPTIONS = [
  { id: 'apple_fluid', name: 'Apple Fluid', desc: 'Smooth spring scaling & dynamic focal tracking' },
  { id: 'karaoke_pulse', name: 'Karaoke Pulse', desc: 'Rhythmic scale pop & jumping text bounce' },
  { id: 'kinetic_slide', name: 'Kinetic Slide', desc: 'Active line glides smoothly from edge' },
  { id: 'cinematic_blur', name: 'Cinematic Focus', desc: 'Soft depth blur on surrounding lines' },
  { id: 'lossless_glow', name: 'Lossless Glow', desc: 'Vibrant neon gradient & glass glow' },
  { id: 'card_pop', name: 'Glass Elevation', desc: '3D floating frosted card lift' },
  { id: 'apple_zoom', name: 'Dynamic Focus Zoom', desc: 'Magnified active line with spring push' },
  { id: 'minimal_wave', name: 'Minimal Clean', desc: 'Low-latency clean opacity transitions' },
] as const;

const ROMANIZATION_OPTIONS = [
  { id: 'below', name: 'Add Below Original', desc: 'Display romanization underneath original script' },
  { id: 'replace', name: 'Replace Original', desc: 'Replace original script with romanized text' },
] as const;

const TRANSLATION_OPTIONS = [
  { id: 'below', name: 'Add Below Original', desc: 'Display translation underneath original lyrics' },
  { id: 'replace', name: 'Replace Original', desc: 'Replace original lyrics with translated text' },
] as const;

interface LyricLineRowProps {
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
  currentTimeMs: number;
  activeLineRef: React.Ref<HTMLDivElement> | null;
  onSeek: (secs: number) => void;
}

interface SyllableItem {
  syl: LyricSyllable;
  sIdx: number;
}

interface WordGroup {
  wordIndex: number;
  syllables: SyllableItem[];
  hasTrailingSpace: boolean;
}

const LyricLineRow = React.memo<LyricLineRowProps>(
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
    currentTimeMs,
    activeLineRef,
    onSeek,
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
      switch (lyricsAnimationStyle) {
        case 'apple_fluid':
          scaleTarget = isActive ? 1.085 : distance === 1 ? 0.99 : 0.975;
          transXTarget = isActive ? 4 : isPast ? 0 : -6;
          transYTarget = isActive ? -2 : isPast ? -1 : 3;
          opacityTarget = isActive ? 1 : distance === 1 ? 0.64 : isPast ? 0.5 : 0.43;
          break;
        case 'karaoke_pulse':
          scaleTarget = isActive ? 1.1 : distance === 1 ? 0.99 : 0.97;
          transXTarget = isActive ? 4 : 0;
          transYTarget = isActive ? -3 : 1;
          opacityTarget = isActive ? 1 : isPast ? 0.62 : 0.49;
          break;
        case 'kinetic_slide':
          scaleTarget = isActive ? 1.045 : isPast ? 0.99 : 0.975;
          transXTarget = isActive ? 0 : isPast ? 14 : -24;
          transYTarget = isActive ? -1 : 1;
          opacityTarget = isActive ? 1 : isPast ? 0.54 : 0.42;
          break;
        case 'cinematic_blur':
          scaleTarget = isActive ? 1.065 : distance === 1 ? 0.96 : 0.93;
          transYTarget = isActive ? 0 : isPast ? -10 : 10;
          opacityTarget = isActive ? 1 : distance <= 1 ? 0.58 : 0.28;
          blurAmount = isActive ? 'blur(0px)' : distance === 1 ? 'blur(2px)' : 'blur(4px)';
          break;
        case 'lossless_glow':
          scaleTarget = isActive ? 1.075 : distance === 1 ? 0.99 : 0.97;
          transXTarget = isActive ? 3 : 0;
          transYTarget = isActive ? -2 : 1;
          opacityTarget = isActive ? 1 : distance === 1 ? 0.66 : 0.46;
          break;
        case 'card_pop':
          scaleTarget = isActive ? 1.065 : 0.985;
          transYTarget = isActive ? -5 : 2;
          opacityTarget = isActive ? 1 : isPast ? 0.62 : 0.48;
          break;
        case 'apple_zoom':
          scaleTarget = isActive ? 1.18 : distance === 1 ? 0.94 : 0.88;
          transYTarget = isActive ? -4 : isPast ? -1 : 2;
          opacityTarget = isActive ? 1 : distance === 1 ? 0.55 : 0.32;
          break;
        case 'minimal_wave':
        default:
          scaleTarget = 1;
          transXTarget = isActive ? 2 : isPast ? 0 : -2;
          transYTarget = isPast ? -1 : isActive ? 0 : 1;
          opacityTarget = isActive ? 1 : distance === 1 ? 0.58 : 0.38;
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
      lyricsFontSizePreset === 'balanced'
        ? 'min(1750px, 95vw)'
        : lyricsFontSizePreset === 'maximum'
        ? 'min(1400px, 94vw)'
        : lyricsFontSizePreset === 'large'
        ? 'min(1100px, 90vw)'
        : 'min(900px, 86vw)';

    return (
      <motion.div
        id={`lyric-line-${idx}`}
        ref={isActive && !isUnsynced ? activeLineRef : null}
        animate={{
          opacity: opacityTarget,
          scale: scaleTarget,
          x: transXTarget,
          y: transYTarget,
          filter: blurAmount,
        }}
        transition={{
          type: 'spring',
          damping: lyricsAnimationStyle === 'karaoke_pulse' ? 16 : 22,
          stiffness: lyricsAnimationStyle === 'karaoke_pulse' ? 140 : 170,
        }}
        className={`text-center cursor-pointer w-full px-6 py-3 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 break-words [text-wrap:balance] ${
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
          ...(isCardPopActive
            ? {
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
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
            onSeek(line.startSecs);
          }
        }}
      >
        {/* Granular Syllable / Word rendering with Jumping text */}
        {line.hasSyllables && !isUnsynced ? (
          <div className="inline-flex flex-wrap justify-center items-baseline text-center max-w-full">
            {(() => {
              if (showTrans && translationMode === 'replace' && line.translation) {
                const transWords = line.translation.trim().split(/\s+/).filter(Boolean);
                const wordDur = line.durationMs / Math.max(1, transWords.length);
                return transWords.map((word, wIdx) => {
                  const sylStart = line.timeMs + (wIdx * wordDur);
                  const sylEnd = sylStart + wordDur;
                  const isSylActive = isActive && currentTimeMs >= sylStart && currentTimeMs < sylEnd;
                  const isSylPast = isPast || (isActive && currentTimeMs >= sylEnd);

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
                          transform: `translateY(${sylLift}px) scale(${sylScale})`,
                          opacity: isSylActive ? 1 : isSylPast ? 0.95 : 0.45,
                        color: isSylActive
                          ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 22%, #ffffff)'
                          : isSylPast
                          ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 18%, rgba(255, 255, 255, 0.92))'
                          : 'color-mix(in srgb, var(--color-stop-1, #6366f1) 14%, rgba(255, 255, 255, 0.45))',
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
              }

              return wordGroups.map((group) => (
                <span
                  key={`${line.id}-word-${group.wordIndex}`}
                  className={`inline-flex items-baseline whitespace-nowrap ${
                    group.hasTrailingSpace ? 'mr-[0.28em]' : ''
                  }`}
                >
                  {group.syllables.map(({ syl, sIdx }) => {
                    const sylStart = syl.timeMs;
                    const sylEnd = syl.timeMs + syl.durationMs;
                    const isSylActive = isActive && currentTimeMs >= sylStart && currentTimeMs < sylEnd;
                    const isSylPast = isPast || (isActive && currentTimeMs >= sylEnd);

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

                    const sylDisplayText =
                      isRomanizationEnabled && romanizationMode === 'replace' && syl.romanizedText
                        ? syl.romanizedText
                        : syl.text;

                    return (
                      <span
                        key={`${line.id}-syl-${sIdx}`}
                        className={`inline-block transition-all duration-200 ease-out ${
                          isSylActive
                            ? 'text-white drop-shadow-md'
                            : isSylPast
                            ? 'text-white/95'
                            : 'text-white/45'
                        }`}
                        style={{
                          transform: `translateY(${sylLift}px) scale(${sylScale})`,
                          opacity: isSylActive ? 1 : isSylPast ? 0.95 : 0.45,
                          ...(isSylActive && lyricsAnimationStyle === 'lossless_glow'
                            ? {
                                textShadow:
                                  '0 0 12px var(--color-stop-1, #6366f1), 0 0 24px var(--color-stop-2, #818cf8)',
                              }
                            : undefined)
                        }}
                      >
                        {sylDisplayText}
                      </span>
                    );
                  })}
                </span>
              ));
            })()}
          </div>
        ) : (
          <div
            className={`break-words [text-wrap:balance] ${
              isActive && !(showTrans && translationMode === 'replace') ? 'text-white' : undefined
            }`}
            style={{
              ...lineGlowStyle,
              ...(showTrans && translationMode === 'replace'
                ? {
                    color: isActive
                      ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 22%, #ffffff)'
                      : 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, rgba(255, 255, 255, 0.5))',
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
              {wordGroups.map((group) => (
                <span
                  key={`${line.id}-rom-word-${group.wordIndex}`}
                  className={`inline-flex items-baseline whitespace-nowrap ${
                    group.hasTrailingSpace ? 'mr-[0.28em]' : ''
                  }`}
                >
                  {group.syllables.map(({ syl, sIdx }) => {
                    const sylStart = syl.timeMs;
                    const sylEnd = syl.timeMs + syl.durationMs;
                    const isSylActive = isActive && currentTimeMs >= sylStart && currentTimeMs < sylEnd;
                    const isSylPast = isPast || (isActive && currentTimeMs >= sylEnd);
                    const romText = syl.romanizedText || syl.text;

                    return (
                      <span
                        key={`${line.id}-rom-${sIdx}`}
                        className="inline-block transition-all duration-150"
                        style={{
                          fontSize: `${Math.max(12, inactiveFontSize * 0.65)}px`,
                          color: isSylActive
                            ? '#ffffff'
                            : isSylPast
                            ? 'rgba(255, 255, 255, 0.85)'
                            : 'rgba(255, 255, 255, 0.45)',
                          fontWeight: isSylActive ? 700 : 400,
                          transform: isSylActive ? 'scale(1.06) translateY(-1px)' : 'scale(1)',
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
              ))}
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
              {(() => {
                const transWords = subTrans.trim().split(/\s+/).filter(Boolean);
                const wordDur = line.durationMs / Math.max(1, transWords.length);
                return transWords.map((word, wIdx) => {
                  const sylStart = line.timeMs + (wIdx * wordDur);
                  const sylEnd = sylStart + wordDur;
                  const isSylActive = isActive && currentTimeMs >= sylStart && currentTimeMs < sylEnd;
                  const isSylPast = isPast || (isActive && currentTimeMs >= sylEnd);

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
                        transform: isSylActive ? 'scale(1.06) translateY(-1px)' : 'scale(1)',
                        textShadow: isSylActive
                          ? '0 0 10px rgba(255, 255, 255, 0.6), 0 0 18px var(--color-stop-1, #6366f1)'
                          : undefined,
                      }}
                    >
                      {word}
                    </span>
                  );
                });
              })()}
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
      </motion.div>
    );
  },
  (prev, next) => {
    if (
      !prev.isActive &&
      !next.isActive &&
      prev.distance === next.distance &&
      prev.activeFontSize === next.activeFontSize &&
      prev.inactiveFontSize === next.inactiveFontSize &&
      prev.lyricsAnimationStyle === next.lyricsAnimationStyle &&
      prev.line === next.line &&
      prev.isRomanizationEnabled === next.isRomanizationEnabled &&
      prev.romanizationMode === next.romanizationMode &&
      prev.isTranslationEnabled === next.isTranslationEnabled &&
      prev.translationMode === next.translationMode
    ) {
      return true;
    }
    if (
      prev.isActive &&
      next.isActive &&
      !next.line.hasSyllables &&
      prev.distance === next.distance &&
      prev.activeFontSize === next.activeFontSize &&
      prev.inactiveFontSize === next.inactiveFontSize &&
      prev.lyricsAnimationStyle === next.lyricsAnimationStyle &&
      prev.line === next.line &&
      prev.isRomanizationEnabled === next.isRomanizationEnabled &&
      prev.romanizationMode === next.romanizationMode &&
      prev.isTranslationEnabled === next.isTranslationEnabled &&
      prev.translationMode === next.translationMode
    ) {
      return true;
    }
    return false;
  }
);

const hasMusicNoteOrInstrumental = (text: string): boolean => {
  if (!text) return false;
  const trimmed = text.trim();
  if (/[♪♫]/.test(trimmed)) return true;
  if (/^\[?\s*(instrumental|solo|music|outro|intro|guitar solo|piano solo)\s*\]?$/i.test(trimmed)) return true;
  return false;
};

const getLineEndSecs = (line: ParsedLyricLine): number => {
  if (line.syllables && line.syllables.length > 0) {
    const lastSyl = line.syllables[line.syllables.length - 1];
    return Math.max(line.startSecs + 1, (lastSyl.timeMs + lastSyl.durationMs) / 1000);
  }
  const wordsCount = line.content.trim().split(/\s+/).filter(Boolean).length;
  const estimatedSecs = Math.max(2.0, Math.min(line.durationSecs || 4.0, wordsCount * 0.55));
  return line.startSecs + estimatedSecs;
};

const LyricInterludeRow = InterludeIndicator;

export const LyricsView: React.FC = () => {
  const {
    currentTrack,
    currentTime,
    duration,
    isPlaying,
    togglePlay,
    nextTrack,
    previousTrack,
    shuffleEnabled,
    toggleShuffle,
    repeatMode,
    cycleRepeatMode,
    volume,
    setVolume,
    lrclibAutoFetch,
    setLrclibAutoFetch,
    preferOnlineLyrics,
    setPreferOnlineLyrics,
    isRomanizationEnabled,
    romanizationMode,
    setRomanizationMode,
    toggleRomanization,
    isTranslationEnabled,
    translationMode,
    setTranslationMode,
    toggleTranslation,
    showAudioSpecs,
    toggleShowAudioSpecs,
    autoHideLyricsControls,
    toggleAutoHideLyricsControls,
    setShowLyricsFullscreen,
    activeTab,
    setActiveTab,
    seek,
    lyricsFontSizePreset,
    setLyricsFontSizePreset,
    lyricsFontSize,
    setLyricsFontSize,
    lyricsFontFamily,
    setLyricsFontFamily,
    lyricsAnimationStyle,
    setLyricsAnimationStyle,
    isWavySeekbarEnabled,
    toggleWavySeekbar,
    autoEmbedLyrics,
    toggleAutoEmbedLyrics,
    preferWordSyncedLyrics,
    togglePreferWordSyncedLyrics,
    inferWordSyncedLyrics,
    toggleInferWordSyncedLyrics,
  } = usePlayerStore();

  const trackArt = useTrackArt(currentTrack);
  const bgTrackArt = useTrackArt(currentTrack, { thumbnail: true, maxSize: 128 });

  const [rawLrc, setRawLrc] = useState<string>('');
  const [lines, setLines] = useState<ParsedLyricLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [artExpanded, setArtExpanded] = useState(false);
  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScrollbarVisible, setIsScrollbarVisible] = useState(false);

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const volNodeRef = useRef<HTMLDivElement | null>(null);

  const volRefCallback = React.useCallback((node: HTMLDivElement | null) => {
    if (volNodeRef.current) {
      const prev = (volNodeRef.current as any)._volWheelHandler;
      if (prev) volNodeRef.current.removeEventListener('wheel', prev);
    }
    volNodeRef.current = node;
    if (node) {
      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const store = usePlayerStore.getState();
        const current = store.volume;
        const step = e.shiftKey ? 0.005 : 0.02;
        const delta = e.deltaY < 0 ? step : -step;
        const nextVol = Math.max(0, Math.min(1, Math.round((current + delta) * 100) / 100));
        store.setVolume(nextVol);
      };
      node.addEventListener('wheel', handleWheel, { passive: false });
      (node as any)._volWheelHandler = handleWheel;
    }
  }, []);

  // Check initial window fullscreen state
  useEffect(() => {
    if (window.__TAURI_INTERNALS__) {
      getCurrentWindow().isFullscreen().then(setIsFullscreen).catch(() => {});
    } else {
      setIsFullscreen(!!document.fullscreenElement);
    }
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (window.__TAURI_INTERNALS__) {
        const appWin = getCurrentWindow();
        const next = !isFullscreen;
        await appWin.setFullscreen(next);
        setIsFullscreen(next);
      } else {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
          setIsFullscreen(true);
        } else {
          await document.exitFullscreen();
          setIsFullscreen(false);
        }
      }
    } catch (e) {
      console.warn('Fullscreen toggle error:', e);
    }
  };

  // Keyboard shortcuts (F11, 'f' for fullscreen, Escape to exit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showSettings) {
          setShowSettings(false);
        } else {
          handleClose();
        }
        return;
      }
      if (e.key === 'F11' || (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, showSettings]);

  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Track window dimensions for dynamic text sizing & small window layouts
  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isCompact = windowWidth < 850;

  interface InterludeGap {
    key: string;
    startSecs: number;
    endSecs: number;
    insertIndex: number;
  }

  // Memoize interlude gaps (intro or >=5s pauses between lines without music notes/instrumental tags)
  const interludeList = useMemo<InterludeGap[]>(() => {
    if (lines.length === 0 || lines[0].startSecs === -1) return [];
    const interludes: InterludeGap[] = [];

    // Intro gap >= 5.0s
    if (lines[0].startSecs >= 5.0 && !hasMusicNoteOrInstrumental(lines[0].content)) {
      interludes.push({
        key: 'lyric-interlude-intro',
        startSecs: 0,
        endSecs: lines[0].startSecs,
        insertIndex: 0,
      });
    }

    for (let i = 0; i < lines.length - 1; i++) {
      const curLine = lines[i];
      const nextLine = lines[i + 1];
      const lineEnd = getLineEndSecs(curLine);
      const gap = nextLine.startSecs - lineEnd;
      if (
        (gap >= 5.0 || (nextLine.startSecs - curLine.startSecs >= 6.0 && gap >= 4.0)) &&
        !hasMusicNoteOrInstrumental(curLine.content) &&
        !hasMusicNoteOrInstrumental(nextLine.content)
      ) {
        interludes.push({
          key: `lyric-interlude-${i}`,
          startSecs: lineEnd,
          endSecs: nextLine.startSecs,
          insertIndex: i + 1,
        });
      }
    }

    return interludes;
  }, [lines]);

  const activeInterlude = interludeList.find(
    (item) => currentTime >= item.startSecs && currentTime < item.endSecs
  );

  // Determine active line index and set of overlapping active lines (spoken at the same time)
  let activeIndex = -1;
  const activeLineIndices = new Set<number>();

  if (lines.length > 0 && lines[0].startSecs !== -1) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startSecs <= currentTime) {
        activeIndex = i;
      }
      let endSecs = line.startSecs + line.durationSecs;
      if (line.syllables.length > 0) {
        const lastSyl = line.syllables[line.syllables.length - 1];
        endSecs = Math.max(endSecs, (lastSyl.timeMs + lastSyl.durationMs) / 1000);
      }
      if (currentTime >= line.startSecs && currentTime < endSecs) {
        activeLineIndices.add(i);
      }
    }

    if (activeLineIndices.size === 0 && activeIndex !== -1 && !activeInterlude) {
      activeLineIndices.add(activeIndex);
    }
  }

  // Dynamic font size calculation for 'balanced' preset:
  // Dynamically calculates the optimal font size based on the current song's line lengths and wrapping,
  // allowing lines to take up the majority of the window's horizontal space while ensuring
  // 3 lines (previous, active, next) fit on the screen as large as possible without rapid zooming or jitter.
  const balancedFontSize = useMemo(() => {
    const validLines = lines.filter((l) => l.content && l.content.trim().length > 0);
    if (validLines.length === 0) {
      return Math.max(32, Math.min(52, Math.round(windowHeight * 0.052)));
    }

    const getEffectiveText = (l: ParsedLyricLine) => {
      if (isTranslationEnabled && translationMode === 'replace' && l.translation && !isIdenticalLyricText(l.content, l.translation)) {
        return l.translation.trim();
      }
      if (isRomanizationEnabled && romanizationMode === 'replace' && l.romanized) {
        return l.romanized.trim();
      }
      return l.content.trim();
    };

    // Measure normalized visual character widths (accounting for CJK vs Latin)
    const normWidths = validLines.map((l) => {
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
    }).sort((a, b) => a - b);

    // 90th percentile represents the longest typical line of the song without being distorted by rare outliers
    const repNormWidth = normWidths[Math.min(normWidths.length - 1, Math.floor(normWidths.length * 0.90))];
    const medianNormWidth = normWidths[Math.floor(normWidths.length * 0.5)];

    // Majority of window horizontal space (95vw, up to 1750px), minus padding (48px)
    const availWidth = Math.max(320, Math.min(windowWidth * 0.95, 1750) - 48);

    // Target vertical height budget for 3 lines (active line + 2 inactive lines + gaps + padding)
    // Lyrics view centers 3 lines on screen; we budget up to 72% of window height (leaving plenty of room for header and seekbar)
    const targetHeight = Math.max(340, Math.min(windowHeight * 0.72, windowHeight - 160));

    // Has sub-text (translation / romanization) rendered below active line?
    const hasTrans = isTranslationEnabled && translationMode === 'below' && validLines.some((l) => l.translation && !isIdenticalLyricText(l.content, l.translation));
    const hasRom = isRomanizationEnabled && romanizationMode === 'below' && validLines.some((l) => l.romanized);
    const subLineCount = (hasTrans ? 1 : 0) + (hasRom ? 1 : 0);

    // Search from largest desired font size down to minimum comfortable size
    const maxCandidate = Math.min(76, Math.round(windowHeight * 0.085));
    const minCandidate = 30;

    let bestSize = minCandidate;
    for (let candidateF = maxCandidate; candidateF >= minCandidate; candidateF--) {
      const activeWrappedLines = Math.max(1, Math.ceil((repNormWidth * candidateF) / availWidth));
      // In balanced mode, inactive lines have uniform font size
      const inactiveWrappedLines = Math.max(1, Math.ceil((medianNormWidth * candidateF) / availWidth));

      const activeHeight = activeWrappedLines * (candidateF * 1.35) + 24 + subLineCount * (Math.max(12, candidateF * 0.45) * 1.3 + 8);
      const inactiveHeight = 2 * (inactiveWrappedLines * (candidateF * 1.35) + 24);
      const gapsHeight = 48; // two 24px gaps between the 3 lines

      const totalRequiredHeight = activeHeight + inactiveHeight + gapsHeight;

      // Ensure 3 lines fit comfortably on screen, and the representative line doesn't wrap more than 2 visual lines
      if (totalRequiredHeight <= targetHeight && activeWrappedLines <= 2) {
        bestSize = candidateF;
        break;
      }
    }

    // Fallback if even at minCandidate activeWrappedLines > 2 due to narrow window or long lines
    if (bestSize === minCandidate) {
      for (let candidateF = maxCandidate; candidateF >= minCandidate; candidateF--) {
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
  }, [lines, windowWidth, windowHeight, isTranslationEnabled, translationMode, isRomanizationEnabled, romanizationMode]);

  // Compute dynamic font sizes based on preset & manual slider
  let activeFontSize = lyricsFontSize;
  if (lyricsFontSizePreset === 'normal') {
    activeFontSize = Math.max(26, Math.min(38, windowHeight * 0.04));
  } else if (lyricsFontSizePreset === 'balanced') {
    activeFontSize = balancedFontSize;
  } else if (lyricsFontSizePreset === 'large') {
    activeFontSize = Math.max(34, Math.min(52, windowHeight * 0.058));
  } else if (lyricsFontSizePreset === 'maximum') {
    // Fill the screen so exactly 3 lines are shown, but cap it so it doesn't wrap excessively
    activeFontSize = Math.max(42, Math.min(windowHeight * 0.15, windowWidth * 0.07));
  }
  const inactiveFontSize =
    lyricsFontSizePreset === 'balanced'
      ? activeFontSize
      : Math.max(16, activeFontSize * 0.65);

  // Auto-hide controls logic on mouse idle
  useEffect(() => {
    if (!autoHideLyricsControls) {
      setControlsVisible(true);
      return;
    }

    const resetIdleTimer = () => {
      setControlsVisible(true);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3500);
    };

    resetIdleTimer();
    window.addEventListener('mousemove', resetIdleTimer);

    return () => {
      window.removeEventListener('mousemove', resetIdleTimer);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [autoHideLyricsControls]);

  // 1. Fetch raw lyrics when currentTrack changes without flashing unsynced lyrics
  useEffect(() => {
    if (!currentTrack) {
      setRawLrc('');
      setLines([]);
      return;
    }

    let isMounted = true;
    const hasLrcTimestamps = (text: string) => /\[\d{1,2}:\d{2}/.test(text);

    // If embedded lyrics contain synced LRC timestamps, use them immediately (UNLESS preferOnlineLyrics is true)
    if (!preferOnlineLyrics && currentTrack.unsynced_lyrics && hasLrcTimestamps(currentTrack.unsynced_lyrics)) {
      setRawLrc(currentTrack.unsynced_lyrics);
      setIsLoading(false);
      return;
    }

    // Set loading state true and hold off rendering unsynced text until synced check finishes
    setIsLoading(true);

    const loadLyrics = async () => {
      let foundSynced: string | null = null;

      // 1. If preferOnlineLyrics or preferWordSyncedLyrics, try online FIRST
      if ((preferOnlineLyrics || preferWordSyncedLyrics) && lrclibAutoFetch) {
        const fetched = await fetchLrclibLyrics(
          currentTrack.title,
          currentTrack.artist,
          currentTrack.album,
          currentTrack.duration_secs,
          preferWordSyncedLyrics
        );
        if (fetched && fetched.trim()) {
          foundSynced = fetched;
        }
      }

      // 2. If not found online (or didn't try yet), check local
      if (!foundSynced) {
        try {
          if (window.__TAURI_INTERNALS__) {
            const lyrics: string | null = await invoke('get_track_lyrics', { path: currentTrack.path });
            if (lyrics && lyrics.trim() && (hasLrcTimestamps(lyrics) || !currentTrack.unsynced_lyrics)) {
              foundSynced = lyrics;
            }
          }
        } catch (e) {
          console.warn('On-demand lyrics fetch error:', e);
        }
      }

      // 3. If local check failed but we haven't tried online yet, try online now
      if (!foundSynced && !preferOnlineLyrics && lrclibAutoFetch) {
        const fetched = await fetchLrclibLyrics(
          currentTrack.title,
          currentTrack.artist,
          currentTrack.album,
          currentTrack.duration_secs,
          preferWordSyncedLyrics
        );
        if (fetched && fetched.trim()) {
          foundSynced = fetched;
        }
      }

      if (!isMounted) return;

      if (foundSynced) {
        setRawLrc(foundSynced);

        // Auto-embed online lyrics if setting is enabled and file doesn't already have it
        if (autoEmbedLyrics && currentTrack.path && window.__TAURI_INTERNALS__) {
          if (foundSynced !== currentTrack.unsynced_lyrics) {
            invoke('embed_lyrics', { path: currentTrack.path, lyrics: foundSynced }).catch(() => {});
          }
        }
      } else if (currentTrack.unsynced_lyrics) {
        // Fallback to unsynced lyrics only after synced lookup finishes
        setRawLrc(currentTrack.unsynced_lyrics);
      } else {
        setRawLrc('');
      }

      setIsLoading(false);
    };

    loadLyrics();

    return () => {
      isMounted = false;
    };
  }, [currentTrack?.id, preferOnlineLyrics, preferWordSyncedLyrics, lrclibAutoFetch, autoEmbedLyrics]);

  // 2. Parse, Romanize & Translate lines locally whenever rawLrc, romanization, or translation changes
  useEffect(() => {
    if (!rawLrc.trim()) {
      setLines([]);
      return;
    }

    const formatted = parseRichLyrics(rawLrc, { inferWordSync: inferWordSyncedLyrics });
    setLines(formatted);

    let isMounted = true;

    async function enrichLines() {
      let processed = formatted;

      if (isRomanizationEnabled) {
        const allContents = processed.map((l) => l.content);
        const trackScript = detectScript(allContents);

        processed = await Promise.all(
          processed.map((line) => enrichLineWithRomanization(line, trackScript, romanizer))
        );
      }
 
      if (isMounted) {
        setLines(processed);
      }
    }

    enrichLines();

    return () => {
      isMounted = false;
    };
  }, [rawLrc, isRomanizationEnabled, inferWordSyncedLyrics]);



  const isProgrammaticScrollRef = useRef(false);
  const userInteractingRef = useRef(false);
  const userInteractionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmaticScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tracking refs to ensure single, smooth monotonic forward movement during playback
  const lastScrolledMaxLineRef = useRef<number>(-1);
  const lastScrolledInterludeRef = useRef<string | null>(null);
  const lastScrollTargetRef = useRef<number>(0);
  const lastCurrentTimeRef = useRef<number>(currentTime);

  // Detect manual seeks or skips (time jumping backwards or skipping > 2.5s) and reset monotonic scroll clamp
  useEffect(() => {
    const dt = currentTime - lastCurrentTimeRef.current;
    if (dt < -0.5 || dt > 2.5) {
      lastScrolledMaxLineRef.current = -1;
      lastScrollTargetRef.current = 0;
      lastScrolledInterludeRef.current = null;
    }
    lastCurrentTimeRef.current = currentTime;
  }, [currentTime]);

  // When lines change or reload, reset scroll tracking
  useEffect(() => {
    lastScrolledMaxLineRef.current = -1;
    lastScrollTargetRef.current = 0;
    lastScrolledInterludeRef.current = null;
  }, [lines]);

  // Stable key representing currently active lines
  const activeLinesKey = Array.from(activeLineIndices).sort((a, b) => a - b).join(',');

  // The furthest active line index in forward playback
  const maxActiveLine = activeLineIndices.size > 0
    ? Math.max(...Array.from(activeLineIndices))
    : activeIndex;

  // Unified seek handler that resets scroll tracking and sync state
  const handleSeek = useCallback((secs: number) => {
    lastScrolledMaxLineRef.current = -1;
    lastScrollTargetRef.current = 0;
    lastScrolledInterludeRef.current = null;
    seek(secs);
    setIsUserScrolled(false);
  }, [seek]);

  // Smart centering target calculation: centers multi-line active groups while prioritizing current line.
  // Enforces monotonic forward scrolling during normal playback so it never bounces backwards.
  const getSmartScrollTarget = useCallback((force: boolean = false, readOnly: boolean = false) => {
    const containerEl = containerRef.current;
    if (!containerEl) return null;

    if (activeInterlude) {
      const targetEl = document.getElementById(activeInterlude.key);
      if (targetEl) {
        const target = Math.max(0, targetEl.offsetTop - containerEl.clientHeight / 2 + targetEl.clientHeight / 2);
        if (!force && target < lastScrollTargetRef.current) {
          return lastScrollTargetRef.current;
        }
        if (!readOnly) {
          lastScrollTargetRef.current = target;
        }
        return target;
      }
      return null;
    }

    const currentPrimaryIdx = activeLineIndices.size > 0
      ? Math.max(...Array.from(activeLineIndices))
      : activeIndex;

    if (currentPrimaryIdx === -1) return null;

    const primaryEl = document.getElementById(`lyric-line-${currentPrimaryIdx}`);
    if (!primaryEl) return null;

    const primaryIdealScrollTop = primaryEl.offsetTop - containerEl.clientHeight / 2 + primaryEl.clientHeight / 2;

    const activeIndices = Array.from(activeLineIndices);
    const activeEls = activeIndices
      .map((i) => document.getElementById(`lyric-line-${i}`))
      .filter((el): el is HTMLElement => el !== null);

    let idealTop = primaryIdealScrollTop;

    if (activeEls.length > 1) {
      const groupTop = Math.min(...activeEls.map((el) => el.offsetTop));
      const groupBottom = Math.max(...activeEls.map((el) => el.offsetTop + el.clientHeight));
      const groupHeight = groupBottom - groupTop;
      const groupCenter = groupTop + groupHeight / 2;
      const idealGroupScrollTop = groupCenter - containerEl.clientHeight / 2;

      // Prioritize the current line: allow group centering while keeping current line comfortably near center
      const maxDisplacement = Math.min(containerEl.clientHeight * 0.18, 120);
      const delta = idealGroupScrollTop - primaryIdealScrollTop;
      const clampedDelta = Math.max(-maxDisplacement, Math.min(maxDisplacement, delta));

      idealTop = primaryIdealScrollTop + clampedDelta;
    }

    const target = Math.max(0, idealTop);

    // During forward playback, enforce monotonic downward scrolling to eliminate any upward bouncing
    if (!force && target < lastScrollTargetRef.current) {
      return lastScrollTargetRef.current;
    }

    if (!readOnly) {
      lastScrollTargetRef.current = target;
    }
    return target;
  }, [activeIndex, activeInterlude?.key, activeLinesKey]);

  // 4. Smooth scroll active line or balanced multi-line group to center
  const scrollToActive = useCallback((force: boolean = false) => {
    const containerEl = containerRef.current;
    if (!containerEl) return;

    const targetTop = getSmartScrollTarget(force);
    if (targetTop !== null) {
      if (programmaticScrollTimerRef.current) {
        clearTimeout(programmaticScrollTimerRef.current);
      }
      isProgrammaticScrollRef.current = true;
      setIsScrollbarVisible(false);
      containerEl.scrollTo({
        top: targetTop,
        behavior: 'smooth',
      });
      programmaticScrollTimerRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 800);
    }
  }, [getSmartScrollTarget]);

  // Scroll to top when track changes / skips
  useEffect(() => {
    setIsUserScrolled(false);
    setIsScrollbarVisible(false);
    lastScrolledMaxLineRef.current = -1;
    lastScrollTargetRef.current = 0;
    lastScrolledInterludeRef.current = null;
    if (containerRef.current) {
      if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);
      isProgrammaticScrollRef.current = true;
      containerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
      programmaticScrollTimerRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 800);
    }
  }, [currentTrack?.id]);

  // Keep at top if lyrics load and song is at intro (activeIndex === -1 and no interlude)
  useEffect(() => {
    if (activeIndex === -1 && !activeInterlude && !isUserScrolled && containerRef.current) {
      if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);
      isProgrammaticScrollRef.current = true;
      setIsScrollbarVisible(false);
      containerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
      programmaticScrollTimerRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 600);
    }
  }, [lines, activeIndex, activeInterlude?.key, isUserScrolled]);

  // 5. Detect genuine user scrolling (wheel/touch/drag) away from current lyric line or interlude
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const markUserInteracting = () => {
      userInteractingRef.current = true;
      if (userInteractionTimeoutRef.current) clearTimeout(userInteractionTimeoutRef.current);
      userInteractionTimeoutRef.current = setTimeout(() => {
        userInteractingRef.current = false;
      }, 1500);
    };

    const handleScroll = () => {
      // Only show scrollbar if user is genuinely interacting and it is NOT an auto-scroll!
      if (!isProgrammaticScrollRef.current && userInteractingRef.current) {
        setIsScrollbarVisible(true);
        if (scrollbarTimerRef.current) clearTimeout(scrollbarTimerRef.current);
        scrollbarTimerRef.current = setTimeout(() => {
          setIsScrollbarVisible(false);
        }, 2000);
      } else if (isProgrammaticScrollRef.current) {
        setIsScrollbarVisible(false);
      }

      // Only unsync if it's NOT a programmatic scroll, user is actively scrolling, and scrolled away from active line/interlude
      if (!isProgrammaticScrollRef.current && userInteractingRef.current) {
        const targetTop = getSmartScrollTarget(true, true);
        if (targetTop !== null) {
          const distance = Math.abs(el.scrollTop - targetTop);
          // Require at least 100px displacement from the centered active item to consider it an unsync scroll
          if (distance > 100) {
            setIsUserScrolled(true);
          }
        }
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    el.addEventListener('wheel', markUserInteracting, { passive: true });
    el.addEventListener('touchmove', markUserInteracting, { passive: true });
    el.addEventListener('pointerdown', markUserInteracting, { passive: true });

    return () => {
      el.removeEventListener('scroll', handleScroll);
      el.removeEventListener('wheel', markUserInteracting);
      el.removeEventListener('touchmove', markUserInteracting);
      el.removeEventListener('pointerdown', markUserInteracting);
      if (scrollbarTimerRef.current) clearTimeout(scrollbarTimerRef.current);
      if (userInteractionTimeoutRef.current) clearTimeout(userInteractionTimeoutRef.current);
      if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);
    };
  }, [getSmartScrollTarget]);

  // Auto-scroll effect: ONLY fires when advancing forward to a new line index or new interlude.
  // When an older/concurrent line finishes singing, maxActiveLine does not advance, so ZERO scroll is triggered.
  useEffect(() => {
    if (isUserScrolled) return;

    // Case 1: Interlude active
    if (activeInterlude) {
      if (lastScrolledInterludeRef.current !== activeInterlude.key) {
        lastScrolledInterludeRef.current = activeInterlude.key;
        scrollToActive();
      }
      return;
    }

    // Interlude ended
    if (lastScrolledInterludeRef.current !== null) {
      lastScrolledInterludeRef.current = null;
    }

    // Case 2: Lyric lines active
    // Advance ONLY when a new line is reached (maxActiveLine > lastScrolledMaxLineRef.current)
    if (maxActiveLine !== -1 && maxActiveLine > lastScrolledMaxLineRef.current) {
      lastScrolledMaxLineRef.current = maxActiveLine;
      scrollToActive();
    }
  }, [maxActiveLine, activeInterlude?.key, isUserScrolled, scrollToActive]);

  const handleClose = async () => {
    setShowLyricsFullscreen(false);
    if (activeTab === 'lyrics') {
      setActiveTab('library');
    }
    try {
      if (window.__TAURI_INTERNALS__) {
        const appWin = getCurrentWindow();
        if (await appWin.isFullscreen()) {
          await appWin.setFullscreen(false);
          setIsFullscreen(false);
        }
      } else {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
          setIsFullscreen(false);
        }
      }
    } catch (e) {
      console.warn('Fullscreen exit error on close:', e);
    }
  };

  const handleManualRefresh = async () => {
    if (!currentTrack) return;
    setIsLoading(true);
    const fetched = await fetchLrclibLyrics(
      currentTrack.title,
      currentTrack.artist,
      currentTrack.album,
      currentTrack.duration_secs,
      preferWordSyncedLyrics
    );
    setIsLoading(false);
    if (fetched) {
      setRawLrc(fetched);
    }
  };

  const handleEmbedLyrics = async () => {
    if (!currentTrack || !rawLrc.trim()) return;
    setIsEmbedding(true);
    try {
      if (window.__TAURI_INTERNALS__) {
        await invoke('embed_lyrics', { path: currentTrack.path, lyrics: rawLrc });
      }
    } catch (e) {
      console.warn('Embed lyrics error:', e);
    } finally {
      setIsEmbedding(false);
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;
  const currentTimeMs = currentTime * 1000;
  const isUnsynced = lines.length > 0 && lines[0].startSecs === -1;
  const isWordSynced = hasExplicitWordSync(lines);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#09090b] flex flex-col justify-between p-8 overflow-hidden select-none"
      style={{ fontFamily: lyricsFontFamily }}
    >
      {/* 100% Solid Base Layer (guarantees zero bleed-through from background) */}
      <div className="absolute inset-0 bg-[#09090b] -z-10 pointer-events-none" />

      {/* Vibrant Ambient Colored Glow (cover art or theme radial gradient) */}
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
        {(bgTrackArt || trackArt) ? (
          <div
            className="absolute inset-0 pointer-events-none opacity-25 blur-[90px] scale-110 bg-cover bg-center transition-all duration-1000"
            style={{ backgroundImage: `url(${bgTrackArt || trackArt})` }}
          />
        ) : (
          <>
            <div 
              className="absolute -top-40 -left-40 w-[650px] h-[650px] rounded-full blur-[140px] opacity-20 pointer-events-none transition-all duration-700"
              style={{
                background: 'radial-gradient(circle, var(--color-stop-1, #6366F1), var(--color-stop-3, #EC4899), transparent 70%)'
              }}
            />
            <div 
              className="absolute top-1/3 -right-40 w-[650px] h-[650px] rounded-full blur-[150px] opacity-20 pointer-events-none transition-all duration-700"
              style={{
                background: 'radial-gradient(circle, var(--color-stop-4, #D946EF), var(--color-stop-6, #818CF8), transparent 70%)'
              }}
            />
          </>
        )}
        {/* Subtle dark vignette overlay for lyric contrast and readability */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/60" />
      </div>

      {/* Top Bar Controls (Fades on idle) */}
      <motion.div
        animate={{
          opacity: controlsVisible ? 1 : 0,
          y: controlsVisible ? 0 : -20,
        }}
        transition={{ duration: 0.3 }}
        className={`flex items-center justify-between z-10 ${
          controlsVisible ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center border"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
              color: 'var(--color-stop-1, #6366f1)',
              borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
            }}
          >
            <Mic2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className="font-bold text-white text-base truncate"
              title={
                isUnsynced
                  ? 'Plain unsynced lyrics'
                  : isWordSynced
                    ? 'Native word-by-word timestamps from LRC file'
                    : inferWordSyncedLyrics
                      ? 'Line-synced lyrics (word timing is inferred)'
                      : 'Line-synced lyrics'
              }
            >
              {isUnsynced
                ? 'Unsynced Lyrics'
                : isWordSynced
                  ? 'Word Synced Lyrics'
                  : 'Synced Lyrics'}
            </h3>
          </div>
          {showAudioSpecs && currentTrack && (
            <div className="ml-4 text-xs font-mono text-zinc-400 bg-white/5 px-3 py-1 rounded-xl border border-white/10 shrink-0">
              {currentTrack.bit_rate_kbps ? `${currentTrack.bit_rate_kbps} kb/s • ` : ''}
              {(currentTrack.sample_rate / 1000).toFixed(1)} kHz
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Romanization Toggle Button */}
          <button
            onClick={toggleRomanization}
            className={`p-2.5 rounded-xl transition-all border ${
              isRomanizationEnabled
                ? 'text-white shadow-lg border-transparent'
                : 'text-zinc-400 hover:text-white hover:bg-white/10 border-white/10'
            }`}
            style={
              isRomanizationEnabled
                ? {
                    backgroundColor: 'var(--color-stop-1, #6366f1)',
                    borderColor: 'transparent',
                  }
                : undefined
            }
            title={isRomanizationEnabled ? 'Romanization Enabled' : 'Romanization Disabled'}
          >
            <Languages className="w-5 h-5" />
          </button>

          {/* Translation Toggle Button */}
          <button
            onClick={toggleTranslation}
            className={`p-2.5 rounded-xl transition-all border ${
              isTranslationEnabled
                ? 'text-white shadow-lg border-transparent'
                : 'text-zinc-400 hover:text-white hover:bg-white/10 border-white/10'
            }`}
            style={
              isTranslationEnabled
                ? {
                    backgroundColor: 'var(--color-stop-1, #6366f1)',
                    borderColor: 'transparent',
                  }
                : undefined
            }
            title={isTranslationEnabled ? 'Translation Enabled' : 'Translation Disabled'}
          >
            <Globe className="w-5 h-5" />
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            onClick={toggleFullscreen}
            className={`p-2.5 rounded-xl transition-all border ${
              isFullscreen
                ? 'text-white shadow-lg border-transparent'
                : 'text-zinc-400 hover:text-white hover:bg-white/10 border-white/10'
            }`}
            style={
              isFullscreen
                ? {
                    backgroundColor: 'var(--color-stop-1, #6366f1)',
                    borderColor: 'transparent',
                  }
                : undefined
            }
            title={isFullscreen ? 'Exit Fullscreen (F11)' : 'Fullscreen (F11)'}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2.5 rounded-xl transition-all border ${
              showSettings
                ? 'text-white shadow-lg border-transparent'
                : 'text-zinc-400 hover:text-white hover:bg-white/10 border-white/10'
            }`}
            style={
              showSettings
                ? {
                    backgroundColor: 'var(--color-stop-1, #6366f1)',
                    borderColor: 'transparent',
                  }
                : undefined
            }
            title="Settings"
          >
            <Settings2 className="w-5 h-5" />
          </button>

          <button
            onClick={handleClose}
            className="p-2.5 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 border border-white/10 transition-all"
            title="Close Lyrics View"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </motion.div>

      {/* Settings Popup */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute right-8 top-20 w-80 max-h-[80vh] overflow-y-auto custom-scrollbar glass-panel border border-white/15 rounded-2xl shadow-2xl p-4.5 z-50 flex flex-col gap-3 text-xs text-zinc-200"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Settings2 className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                Lyrics & Visual Settings
              </h4>
              <button
                onClick={() => setShowSettings(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* --- SECTION 1: LYRICS & TYPOGRAPHY --- */}
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Lyrics & Typography</span>

              {/* Animation Style Selector */}
              <M3Selector
                label="Lyric Animation Style"
                icon={<Activity className="w-3.5 h-3.5" />}
                value={lyricsAnimationStyle}
                onChange={(val) => setLyricsAnimationStyle(val as any)}
                options={ANIMATION_OPTIONS}
              />

              {/* Font Family Selector */}
              <M3Selector
                label="Lyrics Typography & Font"
                icon={<TypeIcon className="w-3.5 h-3.5" />}
                value={lyricsFontFamily}
                onChange={(val) => setLyricsFontFamily(val)}
                options={FONT_OPTIONS}
              />

              {/* Romanization Mode Selector */}
              <M3Selector
                label="Romanization Mode"
                icon={<Languages className="w-3.5 h-3.5" />}
                value={romanizationMode}
                onChange={(val) => setRomanizationMode(val as any)}
                options={ROMANIZATION_OPTIONS}
              />

              {/* Translation Mode Selector */}
              <M3Selector
                label="Translation Mode"
                icon={<Globe className="w-3.5 h-3.5" />}
                value={translationMode}
                onChange={(val) => setTranslationMode(val as any)}
                options={TRANSLATION_OPTIONS}
              />

              {/* Lyrics Size Presets */}
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-zinc-300 font-semibold text-xs">Lyrics Size Preset</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['normal', 'balanced', 'large', 'maximum'] as const).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setLyricsFontSizePreset(preset)}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold capitalize transition-all ${
                        lyricsFontSizePreset === preset
                          ? 'text-white shadow-md'
                          : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5'
                      }`}
                      style={
                        lyricsFontSizePreset === preset
                          ? { backgroundColor: 'var(--color-stop-1, #6366f1)' }
                          : undefined
                      }
                    >
                      {preset === 'maximum' ? 'Max Space' : preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Font Size Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs text-zinc-300">
                  <span>Manual Font Size</span>
                  <span className="font-mono font-bold" style={{ color: 'var(--color-stop-1, #6366f1)' }}>
                    {Math.round(activeFontSize)}px
                  </span>
                </div>
                <input
                  type="range"
                  min={18}
                  max={150}
                  step={1}
                  value={activeFontSize}
                  onChange={(e) => {
                    setLyricsFontSizePreset('manual');
                    setLyricsFontSize(parseInt(e.target.value, 10));
                  }}
                  style={{
                    background: `linear-gradient(to right, var(--color-stop-1, #6366f1) 0%, var(--color-stop-2, #818cf8) ${
                      ((activeFontSize - 18) / (150 - 18)) * 100
                    }%, #27272a ${((activeFontSize - 18) / (150 - 18)) * 100}%)`,
                  }}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer slider-m3"
                />
              </div>

              {/* Prefer Word-Synced Online Lyrics */}
              <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex flex-col pr-2">
                  <span className="text-white font-medium text-xs">Prefer Word/Syllable Sync</span>
                  <span className="text-[10px] text-zinc-400">Query rich syllable & word-level timing</span>
                </div>
                <Checkbox
                  checked={preferWordSyncedLyrics}
                  onChange={togglePreferWordSyncedLyrics}
                  size="small"
                  sx={{
                    color: 'var(--color-stop-1, #6366f1)',
                    '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                    p: 0.5,
                  }}
                />
              </div>

              {/* Infer Word-by-Word Sync */}
              <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex flex-col pr-2">
                  <span className="text-white font-medium text-xs">Infer Word-by-Word Sync</span>
                  <span className="text-[10px] text-zinc-400">Estimate word timing for standard LRC</span>
                </div>
                <Checkbox
                  checked={inferWordSyncedLyrics}
                  onChange={toggleInferWordSyncedLyrics}
                  size="small"
                  sx={{
                    color: 'var(--color-stop-1, #6366f1)',
                    '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                    p: 0.5,
                  }}
                />
              </div>

              {/* Lyric Translation Toggle */}
              <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex flex-col pr-2">
                  <span className="text-white font-medium text-xs">Lyric Translation</span>
                  <span className="text-[10px] text-zinc-400">Translate lyrics & word timestamps to English</span>
                </div>
                <Checkbox
                  checked={isTranslationEnabled}
                  onChange={toggleTranslation}
                  size="small"
                  sx={{
                    color: 'var(--color-stop-1, #6366f1)',
                    '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                    p: 0.5,
                  }}
                />
              </div>

              {/* Auto-fetch Online Lyrics */}
              <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex flex-col pr-2">
                  <span className="text-white font-medium text-xs">Auto-fetch Online Lyrics</span>
                  <span className="text-[10px] text-zinc-400">Search online database on track load</span>
                </div>
                <Checkbox
                  checked={lrclibAutoFetch}
                  onChange={(e) => setLrclibAutoFetch(e.target.checked)}
                  size="small"
                  sx={{
                    color: 'var(--color-stop-1, #6366f1)',
                    '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                    p: 0.5,
                  }}
                />
              </div>

              {/* Prefer Online Lyrics */}
              <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex flex-col pr-2">
                  <span className="text-white font-medium text-xs">Prefer Online Over Embedded</span>
                  <span className="text-[10px] text-zinc-400">Prioritize online synced lyrics</span>
                </div>
                <Checkbox
                  checked={preferOnlineLyrics}
                  onChange={(e) => setPreferOnlineLyrics(e.target.checked)}
                  size="small"
                  sx={{
                    color: 'var(--color-stop-1, #6366f1)',
                    '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                    p: 0.5,
                  }}
                />
              </div>

              {/* Auto-Embed Synced Lyrics */}
              <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex flex-col pr-2">
                  <span className="text-white font-medium text-xs">Auto-embed Lyrics to Audio</span>
                  <span className="text-[10px] text-zinc-400">Save fetched lyrics directly to file tags</span>
                </div>
                <Checkbox
                  checked={autoEmbedLyrics}
                  onChange={toggleAutoEmbedLyrics}
                  size="small"
                  sx={{
                    color: 'var(--color-stop-1, #6366f1)',
                    '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                    p: 0.5,
                  }}
                />
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={handleManualRefresh}
                  style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
                  className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-white text-xs font-semibold transition-colors hover:brightness-110"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh Online Lyrics
                </button>
                
                <button
                  onClick={handleEmbedLyrics}
                  disabled={isEmbedding || !rawLrc.trim()}
                  style={{ backgroundColor: 'var(--color-stop-2, #818cf8)' }}
                  className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-white text-xs font-semibold transition-colors hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className={`w-3.5 h-3.5 ${isEmbedding ? 'animate-pulse' : ''}`} />
                  {isEmbedding ? 'Embedding...' : 'Embed Lyrics to File'}
                </button>
              </div>
            </div>

            {/* --- SECTION 2: PLAYER & VISUAL ELEMENTS --- */}
            <div className="border-t border-white/10 my-1 pt-3 flex flex-col gap-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Player & Visuals</span>

              {/* Wavy Seekbar Toggle */}
              <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex items-center gap-2.5 pr-2">
                  <Waves className="w-4 h-4 shrink-0" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                  <div className="flex flex-col">
                    <span className="text-white font-medium text-xs">Wavy Seekbar</span>
                    <span className="text-[10px] text-zinc-400">Dynamic 3-layer frosted waveform</span>
                  </div>
                </div>
                <Checkbox
                  checked={isWavySeekbarEnabled}
                  onChange={toggleWavySeekbar}
                  size="small"
                  sx={{
                    color: 'var(--color-stop-1, #6366f1)',
                    '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                    p: 0.5,
                  }}
                />
              </div>

              {/* Show Audio Bitrate & Frequency Specs */}
              <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex flex-col pr-2">
                  <span className="text-white font-medium text-xs">Show Audio Specs Badge</span>
                  <span className="text-[10px] text-zinc-400">Display FLAC kHz/bit depth badges</span>
                </div>
                <Checkbox
                  checked={showAudioSpecs}
                  onChange={toggleShowAudioSpecs}
                  size="small"
                  sx={{
                    color: 'var(--color-stop-1, #6366f1)',
                    '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                    p: 0.5,
                  }}
                />
              </div>

              {/* Auto-hide controls on idle */}
              <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex flex-col pr-2">
                  <span className="text-white font-medium text-xs">Auto-hide Controls on Idle</span>
                  <span className="text-[10px] text-zinc-400">Fade out buttons during playback</span>
                </div>
                <Checkbox
                  checked={autoHideLyricsControls}
                  onChange={() => toggleAutoHideLyricsControls()}
                  size="small"
                  sx={{
                    color: 'var(--color-stop-1, #6366f1)',
                    '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                    p: 0.5,
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Lyrics Display Area */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-y-auto my-4 px-4 custom-scrollbar ${
          !isScrollbarVisible ? 'scrollbar-hidden' : ''
        } flex flex-col items-center justify-start gap-6 pt-[30vh] pb-[30vh] z-10 relative`}
      >

        {isUserScrolled && lines.length > 0 && lines[0].startSecs !== -1 && (
          <button
            onClick={() => {
              lastScrolledMaxLineRef.current = -1;
              lastScrollTargetRef.current = 0;
              lastScrolledInterludeRef.current = null;
              setIsUserScrolled(false);
              scrollToActive(true);
            }}
            style={{
              background: 'linear-gradient(135deg, var(--color-stop-1, #6366f1), var(--color-stop-2, #818cf8))',
              borderColor: 'color-mix(in srgb, var(--color-stop-2, #818cf8) 60%, white)',
              boxShadow: '0 8px 24px -4px color-mix(in srgb, var(--color-stop-1, #6366f1) 50%, transparent)',
            }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-xs font-semibold shadow-xl backdrop-blur-md transition-all border animate-in fade-in slide-in-from-bottom-3 cursor-pointer hover:brightness-110 active:scale-95"
          >
            <Target className="w-4 h-4" />
            <span>Re-sync to music</span>
          </button>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center gap-3 my-auto">
            <RefreshCw
              className="w-8 h-8 animate-spin"
              style={{ color: 'var(--color-stop-1, #6366f1)' }}
            />
            <span className="text-sm text-zinc-400 font-medium">Loading synchronized lyrics...</span>
          </div>
        ) : lines.length === 0 ? (
          <div className="flex flex-col items-center gap-3 my-auto text-center max-w-md">
            <Mic2 className="w-12 h-12 text-zinc-600" />
            <h4 className="text-lg font-bold text-white">No lyrics found</h4>
            <p className="text-xs text-zinc-400">
              No synced lyrics were found for this song. Click refresh to search online.
            </p>
            <button
              onClick={handleManualRefresh}
              style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
              className="mt-2 px-4 py-2 rounded-xl text-white text-xs font-semibold transition-colors hover:brightness-110"
            >
              Search Online
            </button>
          </div>
        ) : (
          lines.map((line, idx) => {
            const isUnsynced = line.startSecs === -1;
            const isActive = isUnsynced || activeLineIndices.has(idx);
            const isPast = !isActive && activeIndex >= 0 && idx < activeIndex;
            const distance = isActive ? 0 : Math.abs(idx - activeIndex);

            // Interlude before this line (intro at index 0, or interlude between idx-1 and idx)
            const interludeBefore = !isUnsynced
              ? interludeList.find((item) => item.insertIndex === idx)
              : null;

            return (
              <React.Fragment key={line.id}>
                {interludeBefore && (
                  <LyricInterludeRow
                    key={interludeBefore.key}
                    id={interludeBefore.key}
                    startSecs={interludeBefore.startSecs}
                    endSecs={interludeBefore.endSecs}
                    currentTime={currentTime}
                    isPlaying={isPlaying}
                    isActive={activeInterlude?.key === interludeBefore.key}
                    isPast={currentTime >= interludeBefore.endSecs}
                    distance={
                      activeInterlude?.key === interludeBefore.key
                        ? 0
                        : Math.abs(idx - (activeIndex >= 0 ? activeIndex : 0))
                    }
                    lyricsFontSizePreset={lyricsFontSizePreset}
                    activeFontSize={activeFontSize}
                    onSeek={handleSeek}
                  />
                )}
                <LyricLineRow
                  line={line}
                  idx={idx}
                  isActive={isActive}
                  isPast={isPast}
                  distance={distance}
                  isUnsynced={isUnsynced}
                  lyricsAnimationStyle={lyricsAnimationStyle}
                  lyricsFontSizePreset={lyricsFontSizePreset}
                  isRomanizationEnabled={isRomanizationEnabled}
                  romanizationMode={romanizationMode}
                  isTranslationEnabled={isTranslationEnabled}
                  translationMode={translationMode}
                  activeFontSize={activeFontSize}
                  inactiveFontSize={inactiveFontSize}
                  currentTimeMs={currentTimeMs}
                  activeLineRef={activeLineRef}
                  onSeek={handleSeek}
                />
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Track Info & Expandable Album Art */}
      {currentTrack && (
        <div className={`fixed z-40 flex items-end gap-4 pointer-events-auto select-none transition-all duration-300 max-w-[calc(100vw-80px)] md:max-w-[calc(100vw-350px)] ${
          isCompact ? 'top-16 left-6' : 'bottom-8 left-8'
        }`}>
          <div
            onClick={() => setArtExpanded(!artExpanded)}
            className={`relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 shrink-0 group cursor-pointer transition-all duration-300 ${
              artExpanded ? (isCompact ? 'w-48 h-48' : 'w-80 h-80') : (isCompact ? 'w-14 h-14' : 'w-20 h-20')
            }`}
          >
            {trackArt ? (
              <img src={trackArt} alt={currentTrack.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-500">
                <Mic2 className="w-8 h-8" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-2">
                {artExpanded ? (
                  <ChevronLeft className="w-5 h-5 text-white" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-white" />
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col min-w-0 flex-1 mb-1">
            <span
              className={`font-extrabold text-white truncate drop-shadow-lg transition-all ${
                artExpanded ? 'text-xl md:text-3xl' : 'text-base md:text-lg'
              }`}
            >
              {currentTrack.title}
            </span>
            <span
              className={`font-medium text-zinc-300 truncate mt-0.5 transition-all cursor-pointer hover:underline hover:text-indigo-400 ${
                artExpanded ? 'text-sm md:text-lg' : 'text-xs md:text-sm'
              }`}
              onClick={(e) => {
                if (currentTrack.artist && currentTrack.artist !== 'Unknown Artist') {
                  e.stopPropagation();
                  setShowLyricsFullscreen(false);
                  usePlayerStore.getState().navigateToArtist(currentTrack.artist);
                }
              }}
            >
              {currentTrack.artist}
            </span>
            {currentTrack.album && (
              <span
                className={`text-zinc-400 truncate mt-0.5 transition-all cursor-pointer hover:underline hover:text-indigo-400 ${
                  artExpanded ? 'text-xs md:text-sm' : 'text-[11px]'
                }`}
                onClick={(e) => {
                  if (currentTrack.album && currentTrack.album !== 'Unknown Album') {
                    e.stopPropagation();
                    setShowLyricsFullscreen(false);
                    usePlayerStore.getState().navigateToAlbum(currentTrack.album);
                  }
                }}
              >
                {currentTrack.album}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Floating Glass Transport Controls (Bottom-Center, Responsive) */}
      <motion.div
        animate={{
          opacity: controlsVisible ? 1 : 0,
          y: controlsVisible ? 0 : 20,
        }}
        transition={{ duration: 0.3 }}
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 glass-panel border border-white/10 rounded-full px-5 py-2.5 shadow-2xl flex items-center gap-4 md:gap-6 ${
          controlsVisible ? 'pointer-events-auto' : 'pointer-events-none'
        } ${isCompact ? 'max-w-[92vw] overflow-x-auto custom-scrollbar' : ''}`}
      >
        <button
          onClick={toggleShuffle}
          style={shuffleEnabled ? { color: 'var(--color-stop-1, #6366f1)' } : undefined}
          className={`p-1.5 rounded-xl transition-colors ${
            shuffleEnabled ? '' : 'text-zinc-400 hover:text-white'
          }`}
          title="Shuffle"
        >
          <Shuffle className="w-4 h-4" />
        </button>

        <button
          onClick={previousTrack}
          className="p-1.5 text-zinc-400 hover:text-white transition-colors"
          title="Previous"
        >
          <SkipBack className="w-5 h-5" />
        </button>

        <button
          onClick={togglePlay}
          style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
          className="w-10 h-10 rounded-full text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer shrink-0"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
        </button>

        <button
          onClick={nextTrack}
          className="p-1.5 text-zinc-400 hover:text-white transition-colors"
          title="Next"
        >
          <SkipForward className="w-5 h-5" />
        </button>

        <button
          onClick={cycleRepeatMode}
          style={repeatMode !== 'off' ? { color: 'var(--color-stop-1, #6366f1)' } : undefined}
          className={`p-1.5 rounded-xl transition-colors ${
            repeatMode !== 'off' ? '' : 'text-zinc-400 hover:text-white'
          }`}
          title="Repeat"
        >
          <RepeatIcon className="w-4 h-4" />
        </button>

        {/* Seek Bar inside floating pill */}
        <div className="flex items-center gap-2.5 text-xs font-mono text-zinc-400 w-48 sm:w-72 md:w-96">
          <span>{formatTime(currentTime)}</span>
          <div className="relative flex-1 flex items-center group cursor-pointer min-w-[90px]">
            {isWavySeekbarEnabled ? (
              <WavyAudioSlider
                value={currentTime}
                min={0}
                max={duration || 100}
                step={0.1}
                onChange={handleSeek}
                size="md"
                className="flex-1"
                formatTooltip={(val) => formatTime(val)}
                active={controlsVisible}
              />
            ) : (
              <AudioSlider
                value={currentTime}
                min={0}
                max={duration || 100}
                step={0.1}
                onChange={handleSeek}
                size="md"
                className="flex-1"
                formatTooltip={(val) => formatTime(val)}
              />
            )}
          </div>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Integrated Volume control when space is compact */}
        {isCompact && (
          <div ref={volRefCallback} className="flex items-center gap-1.5 pl-2 border-l border-white/10">
            <button
              onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
              className="text-zinc-400 hover:text-white transition-colors p-1"
            >
              {volume > 0 ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
            </button>
            <AudioSlider
              value={volume}
              min={0}
              max={1}
              step={0.01}
              onChange={(val) => setVolume(val)}
              formatTooltip={(val) => `${Math.round(val * 100)}%`}
              size="sm"
              className="w-20"
            />
            <span
              style={{ color: 'var(--color-stop-1, #6366f1)' }}
              className="text-[10px] font-mono font-bold min-w-[28px] text-right"
            >
              {Math.round(volume * 100)}%
            </span>
          </div>
        )}

        {/* Exit Lyrics Button */}
        <button
          onClick={handleClose}
          className="p-1.5 rounded-xl hover:text-white hover:bg-white/10 transition-colors"
          style={{ color: 'var(--color-stop-1, #6366f1)' }}
          title="Exit Karaoke View"
        >
          <Mic2 className="w-5 h-5" />
        </button>
      </motion.div>

      {/* Floating Glass Volume Pill (Bottom-Right, Hidden on Compact Windows to avoid collision) */}
      {!isCompact && (
        <motion.div
          animate={{
            opacity: controlsVisible ? 1 : 0,
            y: controlsVisible ? 0 : 20,
          }}
          transition={{ duration: 0.3 }}
          className={`fixed bottom-6 right-8 z-40 glass-panel border border-white/10 rounded-full px-4 py-2 shadow-2xl flex items-center gap-3.5 ${
            controlsVisible ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          <div ref={volRefCallback} className="flex items-center gap-2.5">
            <button
              onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
              className="text-zinc-400 hover:text-white transition-colors p-1"
              title={volume > 0 ? 'Mute' : 'Unmute'}
            >
              {volume > 0 ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
            </button>
            <AudioSlider
              value={volume}
              min={0}
              max={1}
              step={0.01}
              onChange={(val) => setVolume(val)}
              formatTooltip={(val) => `${Math.round(val * 100)}%`}
              size="md"
              className="w-24 sm:w-28 md:w-32"
            />
            <span
              style={{ color: 'var(--color-stop-1, #6366f1)' }}
              className="text-xs font-mono font-bold min-w-[32px] text-right"
            >
              {Math.round(volume * 100)}%
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
};
