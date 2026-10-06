import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useShallow } from 'zustand/react/shallow';
import { useTrackArt } from '../utils/useTrackArt';
import { fetchLrclibLyrics } from '../utils/lrclibFetcher';
import { parseRichLyrics, ParsedLyricLine, hasExplicitWordSync, isIdenticalLyricText } from '../utils/lyricsParser';
import { createRomanizer, detectScript } from 'lyric-romanizer';
import { enrichLineWithRomanization } from '../utils/japaneseRomanizer';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LyricsHeader } from './lyrics/LyricsHeader';
import { LyricsSettingsModal } from './lyrics/LyricsSettingsModal';
import { LyricsSplitLayout } from './lyrics/LyricsSplitLayout';
import { LyricsCenteredLayout } from './lyrics/LyricsCenteredLayout';
import { InterludeGap, computeActiveLyricState, getLineEndSecs } from './lyrics/types';

const romanizer = createRomanizer({ japaneseDictPath: '/dict' });

const hasMusicNoteOrInstrumental = (text: string): boolean => {
  if (!text) return false;
  const trimmed = text.trim();
  if (/[♪♫]/.test(trimmed)) return true;
  if (/^\[?\s*(instrumental|solo|music|outro|intro|guitar solo|piano solo)\s*\]?$/i.test(trimmed)) return true;
  return false;
};

export const LyricsView: React.FC = () => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const duration = usePlayerStore((s) => s.duration);

  const {
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
    lyricsLayoutMode,
    setLyricsLayoutMode,
    backgroundType,
    setBackgroundType,
    customBgPath,
    setCustomBgPath,
    customBgColor,
    setCustomBgColor,
    bgBlurAmount,
    setBgBlurAmount,
    bgDimOpacity,
    setBgDimOpacity,
  } = usePlayerStore(
    useShallow((s) => ({
      togglePlay: s.togglePlay,
      nextTrack: s.nextTrack,
      previousTrack: s.previousTrack,
      shuffleEnabled: s.shuffleEnabled,
      toggleShuffle: s.toggleShuffle,
      repeatMode: s.repeatMode,
      cycleRepeatMode: s.cycleRepeatMode,
      volume: s.volume,
      setVolume: s.setVolume,
      lrclibAutoFetch: s.lrclibAutoFetch,
      setLrclibAutoFetch: s.setLrclibAutoFetch,
      preferOnlineLyrics: s.preferOnlineLyrics,
      setPreferOnlineLyrics: s.setPreferOnlineLyrics,
      isRomanizationEnabled: s.isRomanizationEnabled,
      romanizationMode: s.romanizationMode,
      setRomanizationMode: s.setRomanizationMode,
      toggleRomanization: s.toggleRomanization,
      isTranslationEnabled: s.isTranslationEnabled,
      translationMode: s.translationMode,
      setTranslationMode: s.setTranslationMode,
      toggleTranslation: s.toggleTranslation,
      showAudioSpecs: s.showAudioSpecs,
      toggleShowAudioSpecs: s.toggleShowAudioSpecs,
      autoHideLyricsControls: s.autoHideLyricsControls,
      toggleAutoHideLyricsControls: s.toggleAutoHideLyricsControls,
      setShowLyricsFullscreen: s.setShowLyricsFullscreen,
      activeTab: s.activeTab,
      setActiveTab: s.setActiveTab,
      seek: s.seek,
      lyricsFontSizePreset: s.lyricsFontSizePreset,
      setLyricsFontSizePreset: s.setLyricsFontSizePreset,
      lyricsFontSize: s.lyricsFontSize,
      setLyricsFontSize: s.setLyricsFontSize,
      lyricsFontFamily: s.lyricsFontFamily,
      setLyricsFontFamily: s.setLyricsFontFamily,
      lyricsAnimationStyle: s.lyricsAnimationStyle,
      setLyricsAnimationStyle: s.setLyricsAnimationStyle,
      isWavySeekbarEnabled: s.isWavySeekbarEnabled,
      toggleWavySeekbar: s.toggleWavySeekbar,
      autoEmbedLyrics: s.autoEmbedLyrics,
      toggleAutoEmbedLyrics: s.toggleAutoEmbedLyrics,
      preferWordSyncedLyrics: s.preferWordSyncedLyrics,
      togglePreferWordSyncedLyrics: s.togglePreferWordSyncedLyrics,
      inferWordSyncedLyrics: s.inferWordSyncedLyrics,
      toggleInferWordSyncedLyrics: s.toggleInferWordSyncedLyrics,
      lyricsLayoutMode: s.lyricsLayoutMode,
      setLyricsLayoutMode: s.setLyricsLayoutMode,
      backgroundType: s.backgroundType,
      setBackgroundType: s.setBackgroundType,
      customBgPath: s.customBgPath,
      setCustomBgPath: s.setCustomBgPath,
      customBgColor: s.customBgColor,
      setCustomBgColor: s.setCustomBgColor,
      bgBlurAmount: s.bgBlurAmount,
      setBgBlurAmount: s.setBgBlurAmount,
      bgDimOpacity: s.bgDimOpacity,
      setBgDimOpacity: s.setBgDimOpacity,
    }))
  );

  const trackArt = useTrackArt(currentTrack);
  const bgTrackArt = useTrackArt(currentTrack, { thumbnail: true, maxSize: 128 });

  const [rawLrc, setRawLrc] = useState<string>('');
  const [lines, setLines] = useState<ParsedLyricLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [embedSuccess, setEmbedSuccess] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScrollbarVisible, setIsScrollbarVisible] = useState(false);

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const volNodeRef = useRef<HTMLDivElement | null>(null);

  const volRefCallback = useCallback((node: HTMLDivElement | null) => {
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
    if ((window as any).__TAURI_INTERNALS__) {
      getCurrentWindow().isFullscreen().then(setIsFullscreen).catch(() => {});
    } else {
      setIsFullscreen(!!document.fullscreenElement);
    }
  }, []);

  const toggleFullscreen = async () => {
    try {
      if ((window as any).__TAURI_INTERNALS__) {
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

  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isCompact = windowWidth < 850;

  // Memoize interlude gaps
  const interludeList = useMemo<InterludeGap[]>(() => {
    if (lines.length === 0 || lines[0].startSecs === -1) return [];
    const interludes: InterludeGap[] = [];

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

  const activeLyricState = usePlayerStore(
    useShallow((s) => computeActiveLyricState(s.currentTime, lines, interludeList))
  );

  const { activeIndex, activeLinesKey, activeInterludeKey, isCurrentLinePassed } = activeLyricState;

  const activeLineIndices = useMemo(() => {
    if (!activeLinesKey) return new Set<number>();
    return new Set<number>(activeLinesKey.split(',').map(Number));
  }, [activeLinesKey]);

  const activeInterlude = useMemo(() => {
    if (!activeInterludeKey) return null;
    return interludeList.find((item) => item.key === activeInterludeKey) || null;
  }, [activeInterludeKey, interludeList]);

  // Dynamic font size calculation for 'balanced' preset
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

    const repNormWidth = normWidths[Math.min(normWidths.length - 1, Math.floor(normWidths.length * 0.90))];
    const medianNormWidth = normWidths[Math.floor(normWidths.length * 0.5)];
    const availWidth = Math.max(320, Math.min(windowWidth * 0.95, 1750) - 48);
    const targetHeight = Math.max(340, Math.min(windowHeight * 0.72, windowHeight - 160));

    const hasTrans = isTranslationEnabled && translationMode === 'below' && validLines.some((l) => l.translation && !isIdenticalLyricText(l.content, l.translation));
    const hasRom = isRomanizationEnabled && romanizationMode === 'below' && validLines.some((l) => l.romanized);
    const subLineCount = (hasTrans ? 1 : 0) + (hasRom ? 1 : 0);

    const maxCandidate = Math.min(76, Math.round(windowHeight * 0.085));
    const minCandidate = 30;

    let bestSize = minCandidate;
    for (let candidateF = maxCandidate; candidateF >= minCandidate; candidateF--) {
      const activeWrappedLines = Math.max(1, Math.ceil((repNormWidth * candidateF) / availWidth));
      const inactiveWrappedLines = Math.max(1, Math.ceil((medianNormWidth * candidateF) / availWidth));

      const activeHeight = activeWrappedLines * (candidateF * 1.35) + 24 + subLineCount * (Math.max(12, candidateF * 0.45) * 1.3 + 8);
      const inactiveHeight = 2 * (inactiveWrappedLines * (candidateF * 1.35) + 24);
      const gapsHeight = 48;

      const totalRequiredHeight = activeHeight + inactiveHeight + gapsHeight;

      if (totalRequiredHeight <= targetHeight && activeWrappedLines <= 2) {
        bestSize = candidateF;
        break;
      }
    }

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
    activeFontSize = Math.max(42, Math.min(windowHeight * 0.15, windowWidth * 0.07));
  }
  const inactiveFontSize =
    lyricsFontSizePreset === 'balanced'
      ? activeFontSize
      : Math.max(16, activeFontSize * 0.65);

  const splitActiveFontSize = Math.max(22, Math.min(Math.round(activeFontSize * 0.84), Math.round(windowHeight * 0.05)));
  const splitInactiveFontSize =
    lyricsFontSizePreset === 'balanced'
      ? splitActiveFontSize
      : Math.max(14, Math.round(splitActiveFontSize * 0.68));

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

  // Fetch raw lyrics when currentTrack changes
  useEffect(() => {
    if (!currentTrack) {
      setRawLrc('');
      setLines([]);
      return;
    }

    let isMounted = true;
    const hasLrcTimestamps = (text: string) => /\[\d{1,2}:\d{2}/.test(text);

    if (!preferOnlineLyrics && currentTrack.unsynced_lyrics && hasLrcTimestamps(currentTrack.unsynced_lyrics)) {
      setRawLrc(currentTrack.unsynced_lyrics);
      setIsLoading(false);
      return;
    }

    const loadLyrics = async () => {
      setIsLoading(true);

      if (lrclibAutoFetch && preferOnlineLyrics) {
        const fetched = await fetchLrclibLyrics(
          currentTrack.title,
          currentTrack.artist,
          currentTrack.album,
          currentTrack.duration_secs,
          preferWordSyncedLyrics
        );
        if (isMounted && fetched) {
          setRawLrc(fetched);
          setIsLoading(false);
          return;
        }
      }

      if ((window as any).__TAURI_INTERNALS__) {
        try {
          const lyrics: string | null = await invoke('get_track_lyrics', { path: currentTrack.path });
          if (isMounted && lyrics && lyrics.trim().length > 0) {
            setRawLrc(lyrics);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Native lyrics lookup failed:', e);
        }
      }

      if (lrclibAutoFetch) {
        const fetched = await fetchLrclibLyrics(
          currentTrack.title,
          currentTrack.artist,
          currentTrack.album,
          currentTrack.duration_secs,
          preferWordSyncedLyrics
        );
        if (isMounted && fetched) {
          setRawLrc(fetched);
          setIsLoading(false);
          return;
        }
      }

      if (isMounted) {
        setRawLrc(currentTrack.unsynced_lyrics || '');
        setIsLoading(false);
      }
    };

    loadLyrics();

    return () => {
      isMounted = false;
    };
  }, [currentTrack?.id, preferOnlineLyrics, lrclibAutoFetch, preferWordSyncedLyrics]);

  // Auto-embed lyrics if enabled
  useEffect(() => {
    if (!autoEmbedLyrics || !currentTrack || !rawLrc || !rawLrc.trim()) return;
    if (currentTrack.unsynced_lyrics === rawLrc) return;

    const timer = setTimeout(async () => {
      try {
        if ((window as any).__TAURI_INTERNALS__) {
          await invoke('embed_lyrics', { path: currentTrack.path, lyrics: rawLrc });
          const { currentTrack: ct, tracks, setTracks } = usePlayerStore.getState();
          if (ct && ct.id === currentTrack.id) {
            usePlayerStore.setState({
              currentTrack: { ...ct, unsynced_lyrics: rawLrc }
            });
          }
          if (tracks) {
            setTracks(tracks.map(t => t.id === currentTrack.id ? { ...t, unsynced_lyrics: rawLrc } : t));
          }
        }
      } catch (e) {
        console.warn('Auto embed lyrics error:', e);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [rawLrc, currentTrack?.id, autoEmbedLyrics]);

  // Parse raw LRC & enrich with romanization
  useEffect(() => {
    if (!rawLrc) {
      setLines([]);
      return;
    }

    const formatted = parseRichLyrics(rawLrc, { inferWordSync: inferWordSyncedLyrics });
    let isCancelled = false;

    const processRomanization = async () => {
      let processed = formatted;

      try {
        const allContents = processed.map((l) => l.content);
        const trackScript = detectScript(allContents);

        processed = await Promise.all(
          processed.map((line) => enrichLineWithRomanization(line, trackScript, romanizer))
        );
      } catch (e) {
        console.warn('Romanization enrichment failed:', e);
      }

      if (!isCancelled) {
        setLines(processed);
      }
    };

    processRomanization();

    return () => {
      isCancelled = true;
    };
  }, [rawLrc, inferWordSyncedLyrics]);

  const isProgrammaticScrollRef = useRef(false);
  const userInteractingRef = useRef(false);
  const userInteractionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmaticScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastScrolledMaxLineRef = useRef<number>(-1);
  const lastScrolledInterludeRef = useRef<string | null>(null);
  const lastScrollTargetRef = useRef<number>(0);

  // Reset scroll lock when song is scrubbed backwards or changed
  useEffect(() => {
    let lastTime = 0;
    const unsub = usePlayerStore.subscribe((state) => {
      const curTime = state.currentTime;
      const dt = curTime - lastTime;
      if (dt < -1.0 || dt > 8.0) {
        lastScrolledMaxLineRef.current = -1;
        lastScrollTargetRef.current = 0;
        lastScrolledInterludeRef.current = null;
        if (!isUserScrolled) {
          scrollToActive(true);
        }
      }
      lastTime = curTime;
    });

    return () => unsub();
  }, [isUserScrolled]);

  const maxActiveLine = activeLineIndices.size > 0
    ? Math.max(...Array.from(activeLineIndices))
    : activeIndex;

  const getSmartScrollTarget = useCallback((force: boolean = false, readOnly: boolean = false) => {
    const containerEl = containerRef.current;
    if (!containerEl) return null;

    if (activeInterlude) {
      const targetEl = document.getElementById(activeInterlude.key);
      if (targetEl) {
        const target = Math.max(0, targetEl.offsetTop - containerEl.clientHeight / 2 + targetEl.clientHeight / 2);
        if (!readOnly && !force && Math.abs(containerEl.scrollTop - target) < 14) {
          return null;
        }
        return target;
      }
      return null;
    }

    if (activeLineIndices.size === 0 && activeIndex === -1) return null;

    const currentPrimaryIdx = activeLineIndices.size > 0
      ? Math.min(...Array.from(activeLineIndices))
      : activeIndex;

    if (currentPrimaryIdx < 0) return null;

    const primaryEl = document.getElementById(`lyric-line-${currentPrimaryIdx}`);
    if (!primaryEl) return null;

    const primaryIdealScrollTop = primaryEl.offsetTop - containerEl.clientHeight / 2 + primaryEl.clientHeight / 2;

    const activeIndices = Array.from(activeLineIndices);
    const activeEls = activeIndices
      .map((idx) => document.getElementById(`lyric-line-${idx}`))
      .filter((el): el is HTMLElement => el !== null);

    let idealTop = primaryIdealScrollTop;

    if (activeEls.length > 1) {
      const groupTop = Math.min(...activeEls.map((el) => el.offsetTop));
      const groupBottom = Math.max(...activeEls.map((el) => el.offsetTop + el.clientHeight));
      const groupHeight = groupBottom - groupTop;
      const groupCenter = groupTop + groupHeight / 2;
      const idealGroupScrollTop = groupCenter - containerEl.clientHeight / 2;

      const maxDisplacement = Math.min(containerEl.clientHeight * 0.18, 120);
      const delta = idealGroupScrollTop - primaryIdealScrollTop;
      const clampedDelta = Math.max(-maxDisplacement, Math.min(maxDisplacement, delta));

      idealTop = primaryIdealScrollTop + clampedDelta;
    }

    const target = Math.max(0, idealTop);

    if (!readOnly && !force) {
      const isTinyJitter = Math.abs(containerEl.scrollTop - target) < 14;
      const isAlreadyNear = Math.abs(lastScrollTargetRef.current - target) < 10;
      if (isTinyJitter || isAlreadyNear) {
        return null;
      }
    }

    return target;
  }, [activeInterlude, activeLineIndices, activeIndex]);

  const scrollToActive = useCallback((force: boolean = false) => {
    const containerEl = containerRef.current;
    if (!containerEl) return;

    const targetTop = getSmartScrollTarget(force);
    if (targetTop === null) return;

    lastScrollTargetRef.current = targetTop;
    isProgrammaticScrollRef.current = true;
    if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);

    const isFarJump = Math.abs(containerEl.scrollTop - targetTop) > 650;
    containerEl.scrollTo({
      top: targetTop,
      behavior: isFarJump ? 'auto' : 'smooth',
    });

    programmaticScrollTimerRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, isFarJump ? 80 : 350);
  }, [getSmartScrollTarget]);

  const handleSeek = useCallback(
    (secs: number, targetIdx?: number) => {
      isProgrammaticScrollRef.current = true;
      userInteractingRef.current = false;
      setIsUserScrolled(false);
      seek(secs);

      const containerEl = containerRef.current;
      if (containerEl && typeof targetIdx === 'number') {
        const targetEl = document.getElementById(`lyric-line-${targetIdx}`);
        if (targetEl) {
          const targetTop = Math.max(
            0,
            targetEl.offsetTop - containerEl.clientHeight / 2 + targetEl.clientHeight / 2
          );
          lastScrollTargetRef.current = targetTop;
          lastScrolledMaxLineRef.current = targetIdx;

          const isFarJump = Math.abs(containerEl.scrollTop - targetTop) > 650;
          containerEl.scrollTo({
            top: targetTop,
            behavior: isFarJump ? 'auto' : 'smooth',
          });

          if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);
          programmaticScrollTimerRef.current = setTimeout(() => {
            isProgrammaticScrollRef.current = false;
          }, isFarJump ? 80 : 350);
        }
      } else {
        lastScrolledMaxLineRef.current = -1;
        lastScrollTargetRef.current = 0;
        lastScrolledInterludeRef.current = null;
        setTimeout(() => {
          scrollToActive(true);
        }, 50);
      }
    },
    [seek, scrollToActive]
  );

  // User scroll interaction tracking
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const markUserInteracting = () => {
      userInteractingRef.current = true;
      if (userInteractionTimeoutRef.current) clearTimeout(userInteractionTimeoutRef.current);
      userInteractionTimeoutRef.current = setTimeout(() => {
        userInteractingRef.current = false;
      }, 400);
    };

    const handleScroll = () => {
      if (!isProgrammaticScrollRef.current && userInteractingRef.current) {
        setIsScrollbarVisible(true);
        if (scrollbarTimerRef.current) clearTimeout(scrollbarTimerRef.current);
        scrollbarTimerRef.current = setTimeout(() => {
          setIsScrollbarVisible(false);
        }, 2000);
      } else if (isProgrammaticScrollRef.current) {
        setIsScrollbarVisible(false);
      }

      if (!isProgrammaticScrollRef.current && userInteractingRef.current) {
        const targetTop = getSmartScrollTarget(true, true);
        if (targetTop !== null) {
          const distance = Math.abs(el.scrollTop - targetTop);
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

  // Auto-scroll effect
  useEffect(() => {
    if (isUserScrolled) return;

    if (activeInterlude) {
      if (lastScrolledInterludeRef.current !== activeInterlude.key) {
        lastScrolledInterludeRef.current = activeInterlude.key;
        scrollToActive();
      }
      return;
    }

    if (lastScrolledInterludeRef.current !== null) {
      lastScrolledInterludeRef.current = null;
    }

    if (maxActiveLine !== -1 && maxActiveLine > lastScrolledMaxLineRef.current) {
      lastScrolledMaxLineRef.current = maxActiveLine;
      scrollToActive();
    }
  }, [maxActiveLine, activeInterlude?.key, isUserScrolled, scrollToActive]);

  // Swap layout effect
  const prevLayoutModeRef = useRef(lyricsLayoutMode);
  const prevCompactRef = useRef(isCompact);
  useEffect(() => {
    if (prevLayoutModeRef.current !== lyricsLayoutMode || prevCompactRef.current !== isCompact) {
      prevLayoutModeRef.current = lyricsLayoutMode;
      prevCompactRef.current = isCompact;
      lastScrolledMaxLineRef.current = -1;
      lastScrollTargetRef.current = 0;
      lastScrolledInterludeRef.current = null;
      if (!isUserScrolled) {
        const timer = setTimeout(() => {
          scrollToActive(true);
        }, 50);
        return () => clearTimeout(timer);
      } else {
        setIsUserScrolled(true);
      }
    }
  }, [lyricsLayoutMode, isCompact, isUserScrolled, scrollToActive]);

  useEffect(() => {
    if (lines.length > 0 && !isUserScrolled) {
      const timer = setTimeout(() => {
        scrollToActive(true);
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [lines, isUserScrolled, scrollToActive]);

  const handleClose = async () => {
    setShowLyricsFullscreen(false);
    if (activeTab === 'lyrics') {
      setActiveTab('library');
    }
    try {
      if ((window as any).__TAURI_INTERNALS__) {
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
      if ((window as any).__TAURI_INTERNALS__) {
        await invoke('embed_lyrics', { path: currentTrack.path, lyrics: rawLrc });
      }
      const { currentTrack: ct, tracks, setTracks } = usePlayerStore.getState();
      if (ct && ct.id === currentTrack.id) {
        usePlayerStore.setState({
          currentTrack: { ...ct, unsynced_lyrics: rawLrc }
        });
      }
      if (tracks) {
        setTracks(tracks.map(t => t.id === currentTrack.id ? { ...t, unsynced_lyrics: rawLrc } : t));
      }
      setEmbedSuccess(true);
      setTimeout(() => setEmbedSuccess(false), 2200);
    } catch (e) {
      console.warn('Embed lyrics error:', e);
    } finally {
      setIsEmbedding(false);
    }
  };

  const isUnsynced = lines.length > 0 && lines[0].startSecs === -1;
  const isWordSynced = hasExplicitWordSync(lines);

  const handleRomanizationChange = (state: 'off' | 'below' | 'replace') => {
    if (state === 'off') {
      if (isRomanizationEnabled) toggleRomanization();
    } else {
      if (!isRomanizationEnabled) toggleRomanization();
      setRomanizationMode(state);
    }
  };

  const handleTranslationChange = (state: 'off' | 'below' | 'replace') => {
    if (state === 'off') {
      if (isTranslationEnabled) toggleTranslation();
    } else {
      if (!isTranslationEnabled) toggleTranslation();
      setTranslationMode(state);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#09090b] flex flex-col justify-between p-8 overflow-hidden select-none"
      style={{ fontFamily: lyricsFontFamily }}
    >
      {/* 100% Solid Base Layer */}
      <div className="absolute inset-0 bg-[#09090b] -z-20 pointer-events-none" />

      {/* Background Modes */}
      {backgroundType === 'amoled_black' && (
        <div className="absolute inset-0 bg-[#000000] -z-10 pointer-events-none" />
      )}

      {backgroundType === 'solid_color' && (
        <div
          className="absolute inset-0 -z-10 pointer-events-none transition-colors duration-500"
          style={{ backgroundColor: customBgColor || '#09090b' }}
        />
      )}

      {backgroundType === 'album_art_color' && (
        <div
          className="absolute inset-0 -z-10 pointer-events-none transition-colors duration-700"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #1e1b4b) 35%, #09090b)',
          }}
        />
      )}

      {backgroundType === 'album_art_blur' && (
        <div
          className="absolute inset-0 -z-10 pointer-events-none overflow-hidden bg-[#09090b]"
          style={{ contain: 'strict', transform: 'translate3d(0, 0, 0)', willChange: 'transform' }}
        >
          {(trackArt || bgTrackArt) && (
            <div
              className="absolute inset-0 bg-cover bg-center transition-all duration-700 scale-110"
              style={{
                backgroundImage: `url(${trackArt || bgTrackArt})`,
                filter: `blur(${bgBlurAmount}px)`,
              }}
            />
          )}
          <div
            className="absolute inset-0 bg-black transition-opacity duration-300"
            style={{ opacity: bgDimOpacity }}
          />
        </div>
      )}

      {backgroundType === 'custom_photo' && (
        <div
          className="absolute inset-0 -z-10 pointer-events-none overflow-hidden bg-[#09090b]"
          style={{ contain: 'strict', transform: 'translate3d(0, 0, 0)', willChange: 'transform' }}
        >
          {customBgPath && (
            <div
              className="absolute inset-0 bg-cover bg-center transition-all duration-700 scale-105"
              style={{
                backgroundImage: `url(${customBgPath})`,
                filter: `blur(${bgBlurAmount}px)`,
              }}
            />
          )}
          <div
            className="absolute inset-0 bg-black transition-opacity duration-300"
            style={{ opacity: bgDimOpacity }}
          />
        </div>
      )}

      {backgroundType === 'dynamic_glow' && (
        <div
          className="absolute inset-0 pointer-events-none -z-10 overflow-hidden bg-[#09090b]"
          style={{ contain: 'strict', transform: 'translate3d(0, 0, 0)', willChange: 'transform' }}
        >
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
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/60" />
        </div>
      )}

      {/* Top Bar Controls */}
      <LyricsHeader
        controlsVisible={controlsVisible}
        isUnsynced={isUnsynced}
        isWordSynced={isWordSynced}
        inferWordSyncedLyrics={inferWordSyncedLyrics}
        showAudioSpecs={showAudioSpecs}
        currentTrack={currentTrack}
        isRomanizationEnabled={isRomanizationEnabled}
        toggleRomanization={toggleRomanization}
        isTranslationEnabled={isTranslationEnabled}
        toggleTranslation={toggleTranslation}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        handleClose={handleClose}
      />

      {/* Settings Modal */}
      <LyricsSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        backgroundType={backgroundType}
        setBackgroundType={setBackgroundType}
        customBgPath={customBgPath}
        setCustomBgPath={setCustomBgPath}
        customBgColor={customBgColor}
        setCustomBgColor={setCustomBgColor}
        bgBlurAmount={bgBlurAmount}
        setBgBlurAmount={setBgBlurAmount}
        bgDimOpacity={bgDimOpacity}
        setBgDimOpacity={setBgDimOpacity}
        lyricsLayoutMode={lyricsLayoutMode}
        setLyricsLayoutMode={setLyricsLayoutMode}
        lyricsAnimationStyle={lyricsAnimationStyle}
        setLyricsAnimationStyle={setLyricsAnimationStyle}
        lyricsFontFamily={lyricsFontFamily}
        setLyricsFontFamily={setLyricsFontFamily}
        lyricsFontSizePreset={lyricsFontSizePreset}
        setLyricsFontSizePreset={setLyricsFontSizePreset}
        activeFontSize={activeFontSize}
        setLyricsFontSize={setLyricsFontSize}
        isWavySeekbarEnabled={isWavySeekbarEnabled}
        toggleWavySeekbar={toggleWavySeekbar}
        showAudioSpecs={showAudioSpecs}
        toggleShowAudioSpecs={toggleShowAudioSpecs}
        autoHideLyricsControls={autoHideLyricsControls}
        toggleAutoHideLyricsControls={toggleAutoHideLyricsControls}
        isRomanizationEnabled={isRomanizationEnabled}
        romanizationMode={romanizationMode}
        handleRomanizationChange={handleRomanizationChange}
        isTranslationEnabled={isTranslationEnabled}
        translationMode={translationMode}
        handleTranslationChange={handleTranslationChange}
        preferWordSyncedLyrics={preferWordSyncedLyrics}
        togglePreferWordSyncedLyrics={togglePreferWordSyncedLyrics}
        inferWordSyncedLyrics={inferWordSyncedLyrics}
        toggleInferWordSyncedLyrics={toggleInferWordSyncedLyrics}
        lrclibAutoFetch={lrclibAutoFetch}
        setLrclibAutoFetch={setLrclibAutoFetch}
        preferOnlineLyrics={preferOnlineLyrics}
        setPreferOnlineLyrics={setPreferOnlineLyrics}
        autoEmbedLyrics={autoEmbedLyrics}
        toggleAutoEmbedLyrics={toggleAutoEmbedLyrics}
        handleManualRefresh={handleManualRefresh}
        handleEmbedLyrics={handleEmbedLyrics}
        isLoading={isLoading}
        isEmbedding={isEmbedding}
        embedSuccess={embedSuccess}
        rawLrc={rawLrc}
      />

      {/* Main Content Layout */}
      {lyricsLayoutMode === 'split' && !isCompact ? (
        <LyricsSplitLayout
          currentTrack={currentTrack}
          trackArt={trackArt}
          setLyricsLayoutMode={setLyricsLayoutMode}
          setShowLyricsFullscreen={setShowLyricsFullscreen}
          duration={duration}
          isWavySeekbarEnabled={isWavySeekbarEnabled}
          handleSeek={handleSeek}
          controlsVisible={controlsVisible}
          toggleShuffle={toggleShuffle}
          shuffleEnabled={shuffleEnabled}
          previousTrack={previousTrack}
          togglePlay={togglePlay}
          isPlaying={isPlaying}
          nextTrack={nextTrack}
          cycleRepeatMode={cycleRepeatMode}
          repeatMode={repeatMode}
          volRefCallback={volRefCallback}
          setVolume={setVolume}
          volume={volume}
          containerRef={containerRef}
          isScrollbarVisible={isScrollbarVisible}
          isUserScrolled={isUserScrolled}
          setIsUserScrolled={setIsUserScrolled}
          scrollToActive={scrollToActive}
          lastScrolledMaxLineRef={lastScrolledMaxLineRef}
          lastScrollTargetRef={lastScrollTargetRef}
          lastScrolledInterludeRef={lastScrolledInterludeRef}
          isLoading={isLoading}
          lines={lines}
          activeInterlude={activeInterlude}
          activeLineIndices={activeLineIndices}
          activeIndex={activeIndex}
          isCurrentLinePassed={isCurrentLinePassed}
          interludeList={interludeList}
          lyricsFontSizePreset={lyricsFontSizePreset}
          splitActiveFontSize={splitActiveFontSize}
          splitInactiveFontSize={splitInactiveFontSize}
          lyricsAnimationStyle={lyricsAnimationStyle}
          isRomanizationEnabled={isRomanizationEnabled}
          romanizationMode={romanizationMode}
          isTranslationEnabled={isTranslationEnabled}
          translationMode={translationMode}
          activeLineRef={activeLineRef}
          handleManualRefresh={handleManualRefresh}
        />
      ) : (
        <LyricsCenteredLayout
          currentTrack={currentTrack}
          trackArt={trackArt}
          setLyricsLayoutMode={setLyricsLayoutMode}
          setShowLyricsFullscreen={setShowLyricsFullscreen}
          duration={duration}
          isWavySeekbarEnabled={isWavySeekbarEnabled}
          handleSeek={handleSeek}
          controlsVisible={controlsVisible}
          toggleShuffle={toggleShuffle}
          shuffleEnabled={shuffleEnabled}
          previousTrack={previousTrack}
          togglePlay={togglePlay}
          isPlaying={isPlaying}
          nextTrack={nextTrack}
          cycleRepeatMode={cycleRepeatMode}
          repeatMode={repeatMode}
          volRefCallback={volRefCallback}
          setVolume={setVolume}
          volume={volume}
          containerRef={containerRef}
          isScrollbarVisible={isScrollbarVisible}
          isUserScrolled={isUserScrolled}
          setIsUserScrolled={setIsUserScrolled}
          scrollToActive={scrollToActive}
          lastScrolledMaxLineRef={lastScrolledMaxLineRef}
          lastScrollTargetRef={lastScrollTargetRef}
          lastScrolledInterludeRef={lastScrolledInterludeRef}
          isLoading={isLoading}
          lines={lines}
          activeInterlude={activeInterlude}
          activeLineIndices={activeLineIndices}
          activeIndex={activeIndex}
          isCurrentLinePassed={isCurrentLinePassed}
          interludeList={interludeList}
          lyricsFontSizePreset={lyricsFontSizePreset}
          activeFontSize={activeFontSize}
          inactiveFontSize={inactiveFontSize}
          lyricsAnimationStyle={lyricsAnimationStyle}
          isRomanizationEnabled={isRomanizationEnabled}
          romanizationMode={romanizationMode}
          isTranslationEnabled={isTranslationEnabled}
          translationMode={translationMode}
          activeLineRef={activeLineRef}
          handleManualRefresh={handleManualRefresh}
          handleClose={handleClose}
          isCompact={isCompact}
        />
      )}
    </div>
  );
};
