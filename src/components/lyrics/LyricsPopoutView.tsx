import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useTrackArt } from '../../utils/useTrackArt';
import { usePopoutSync } from '../../hooks/usePopoutSync';
import { parseRichLyrics, ParsedLyricLine, isIdenticalLyricText } from '../../utils/lyricsParser';
import { fetchLrclibLyrics } from '../../utils/lrclibFetcher';
import { createRomanizer, detectScript } from 'lyric-romanizer';
import { enrichLineWithRomanization } from '../../utils/japaneseRomanizer';
import { InterludeGap, computeActiveLyricState, getLineEndSecs } from './types';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { updateLogoGradientFromImage } from '../../utils/colorExtractor';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Pin,
  PinOff,
  Settings,
  X,
  Minus,
  Music,
  Check,
  Disc3,
  Sliders,
  Target,
  ArrowLeftRight,
  Columns2,
  Rows,
} from 'lucide-react';
import Slider from '@mui/material/Slider';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';

const romanizer = createRomanizer({ japaneseDictPath: '/dict' });

export const LyricsPopoutView: React.FC = () => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const popoutSettings = usePlayerStore((s) => s.popoutLyricsSettings);
  const setPopoutSettings = usePlayerStore((s) => s.setPopoutLyricsSettings);
  const preferWordSyncedLyrics = usePlayerStore((s) => s.preferWordSyncedLyrics);
  const inferWordSyncedLyrics = usePlayerStore((s) => s.inferWordSyncedLyrics);

  const isRomanizationEnabled = usePlayerStore((s) => s.isRomanizationEnabled);
  const romanizationMode = usePlayerStore((s) => s.romanizationMode);
  const toggleRomanization = usePlayerStore((s) => s.toggleRomanization);
  const setRomanizationMode = usePlayerStore((s) => s.setRomanizationMode);

  const isTranslationEnabled = usePlayerStore((s) => s.isTranslationEnabled);
  const translationMode = usePlayerStore((s) => s.translationMode);
  const toggleTranslation = usePlayerStore((s) => s.toggleTranslation);
  const setTranslationMode = usePlayerStore((s) => s.setTranslationMode);

  const { sendCommand } = usePopoutSync();

  const [rawLrc, setRawLrc] = useState<string>('');
  const [lines, setLines] = useState<ParsedLyricLine[]>([]);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [isPinned, setIsPinned] = useState(popoutSettings.alwaysOnTop ?? true);
  const [currentTimeSecs, setCurrentTimeSecs] = useState(0);

  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const isProgrammaticScrollRef = useRef(false);
  const userScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lyricsScrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [contentSize, setContentSize] = useState({ width: 440, height: 260 });

  const trackArt = useTrackArt(currentTrack, { thumbnail: true, maxSize: 128 });

  // Update album art gradient CSS variables across document
  useEffect(() => {
    if (trackArt) {
      updateLogoGradientFromImage(trackArt);
    }
  }, [trackArt]);

  // Ensure body background is transparent in popout mode
  useEffect(() => {
    document.documentElement.style.backgroundColor = 'transparent';
    document.body.style.backgroundColor = 'transparent';
    return () => {
      document.documentElement.style.backgroundColor = '';
      document.body.style.backgroundColor = '';
    };
  }, []);

  // Measure content container for responsive font scaling
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContentSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [popoutSettings.layoutMode]);

  // Sync Tauri window always on top state with preference
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      getCurrentWindow().setAlwaysOnTop(isPinned).catch(() => {});
    }
  }, [isPinned]);

  const togglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    setPopoutSettings({ alwaysOnTop: next });
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      getCurrentWindow().setAlwaysOnTop(next).catch(() => {});
    }
  };

  const handleMinimize = () => {
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      getCurrentWindow().minimize().catch(() => {});
    }
  };

  const handleClose = () => {
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      getCurrentWindow().hide().catch(() => {});
    }
  };

  // High-frequency audio position polling directly from Rust CPAL atomic clock
  useEffect(() => {
    if (!isPlaying) return;
    let isCancelled = false;

    const interval = setInterval(async () => {
      if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
        try {
          const res: any = await invoke('get_playback_position');
          const pos = Array.isArray(res) ? res[0] : res;
          if (!isCancelled && typeof pos === 'number' && !isNaN(pos) && pos >= 0) {
            setCurrentTimeSecs(pos);
          }
        } catch {}
      }
    }, 75);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [isPlaying]);

  // Load lyrics when currentTrack changes
  useEffect(() => {
    if (!currentTrack) {
      setRawLrc('');
      setLines([]);
      return;
    }

    let isMounted = true;
    const hasLrcTimestamps = (text: string) => /\[\d{1,2}:\d{2}/.test(text);

    if (currentTrack.unsynced_lyrics && hasLrcTimestamps(currentTrack.unsynced_lyrics)) {
      setRawLrc(currentTrack.unsynced_lyrics);
      setIsLoadingLyrics(false);
      return;
    }

    const loadLyrics = async () => {
      setIsLoadingLyrics(true);
      if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
        try {
          const lyrics: string | null = await invoke('get_track_lyrics', { path: currentTrack.path });
          if (isMounted && lyrics && lyrics.trim().length > 0) {
            setRawLrc(lyrics);
            setIsLoadingLyrics(false);
            return;
          }
        } catch {}
      }

      // Fallback: LRCLIB online lookup
      const online = await fetchLrclibLyrics(
        currentTrack.title,
        currentTrack.artist,
        currentTrack.album,
        currentTrack.duration_secs,
        popoutSettings.karaokeMode === 'word' || preferWordSyncedLyrics
      );
      if (isMounted) {
        setRawLrc(online || '');
        setIsLoadingLyrics(false);
      }
    };

    loadLyrics();

    return () => {
      isMounted = false;
    };
  }, [currentTrack?.id, currentTrack?.path, popoutSettings.karaokeMode, preferWordSyncedLyrics]);

  // Parse raw LRC & enrich with romanization
  useEffect(() => {
    if (!rawLrc || !rawLrc.trim()) {
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
        console.warn('Romanization enrichment in popout failed:', e);
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

  // Interludes
  const interludeList = useMemo<InterludeGap[]>(() => {
    if (lines.length === 0 || lines[0].startSecs === -1) return [];
    const interludes: InterludeGap[] = [];

    if (lines[0].startSecs >= 5.0) {
      interludes.push({
        key: 'interlude-intro',
        startSecs: 0,
        endSecs: lines[0].startSecs,
        insertIndex: 0,
      });
    }

    for (let i = 0; i < lines.length - 1; i++) {
      const cur = lines[i];
      const next = lines[i + 1];
      const lineEnd = getLineEndSecs(cur);
      const gap = next.startSecs - lineEnd;
      if (gap >= 5.0) {
        interludes.push({
          key: `interlude-${i}`,
          startSecs: lineEnd,
          endSecs: next.startSecs,
          insertIndex: i + 1,
        });
      }
    }
    return interludes;
  }, [lines]);

  const activeLyricState = useMemo(() => {
    return computeActiveLyricState(currentTimeSecs, lines, interludeList);
  }, [currentTimeSecs, lines, interludeList]);

  const { activeIndex } = activeLyricState;

  // Auto-scroll logic
  const scrollToActive = useCallback(
    (smooth = true) => {
      const container = lyricsScrollRef.current;
      if (!container || activeIndex < 0) return;
      const activeEl = document.getElementById(`popout-lyric-${activeIndex}`);
      if (activeEl) {
        const targetTop = activeEl.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2;
        isProgrammaticScrollRef.current = true;
        container.scrollTo({
          top: Math.max(0, targetTop),
          behavior: smooth ? 'smooth' : 'auto',
        });
        if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
        userScrollTimerRef.current = setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 350);
      }
    },
    [activeIndex]
  );

  useEffect(() => {
    if (!isUserScrolled) {
      scrollToActive(true);
    }
  }, [activeIndex, isUserScrolled, scrollToActive]);

  // Timestamp formatter
  const formatTime = (secs: number) => {
    const s = Math.max(0, Math.floor(secs));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem.toString().padStart(2, '0')}`;
  };

  // Background styling & true transparency
  const bgStyle = useMemo(() => {
    const opacity = popoutSettings.opacity ?? 0.85;
    switch (popoutSettings.backgroundStyle) {
      case 'solid':
        return {
          backgroundColor: `rgba(9, 9, 11, ${opacity})`,
          border: '1px solid rgba(255, 255, 255, 0.08)',
        };
      case 'album_art_color':
        return {
          backgroundColor: `color-mix(in srgb, var(--color-stop-1, #1e1b4b) ${Math.round(
            opacity * 55
          )}%, rgba(9, 9, 11, ${opacity}))`,
          border: '1px solid color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
        };
      case 'transparent':
        return {
          backgroundColor: 'transparent',
          border: 'none',
          boxShadow: 'none',
        };
      case 'frosted':
      default:
        return {
          backgroundColor: `rgba(13, 13, 18, ${opacity * 0.88})`,
          backdropFilter: 'blur(28px) saturate(160%)',
          WebkitBackdropFilter: 'blur(28px) saturate(160%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
        };
    }
  }, [popoutSettings.backgroundStyle, popoutSettings.opacity]);

  // Dynamic font sizing that scales to fill the available space (Balanced mode default)
  const computedFontSize = useMemo(() => {
    const h = contentSize.height;
    if (popoutSettings.fontSize === 'small') {
      return {
        active: Math.max(14, Math.min(22, Math.round(h * 0.09))),
        inactive: Math.max(11, Math.min(16, Math.round(h * 0.06))),
        sub: Math.max(10, Math.min(13, Math.round(h * 0.05))),
      };
    }
    if (popoutSettings.fontSize === 'large') {
      return {
        active: Math.max(26, Math.min(64, Math.round(h * 0.22))),
        inactive: Math.max(16, Math.min(36, Math.round(h * 0.13))),
        sub: Math.max(12, Math.min(20, Math.round(h * 0.08))),
      };
    }
    // 'balanced' mode (default): actively fills the space nicely
    const activeLine = lines[activeIndex];
    const textLen = (activeLine?.content || '').length;
    let factor = 1.0;
    if (textLen > 40) factor = 0.82;
    else if (textLen > 25) factor = 0.92;
    else if (textLen < 15 && textLen > 0) factor = 1.15;

    const activeSize = Math.max(20, Math.min(48, Math.round(h * 0.155 * factor)));
    const inactiveSize = Math.max(13, Math.round(activeSize * 0.65));
    const subSize = Math.max(11, Math.round(activeSize * 0.52));
    return { active: activeSize, inactive: inactiveSize, sub: subSize };
  }, [contentSize.height, popoutSettings.fontSize, lines, activeIndex]);

  // Volume wheel handler
  const handleVolumeWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.04 : -0.04;
    const newVol = Math.max(0, Math.min(1, Math.round((volume + delta) * 100) / 100));
    sendCommand('setVolume', newVol);
  };

  return (
    <div
      className="relative w-screen h-screen flex flex-col justify-between overflow-hidden select-none text-white transition-colors duration-300"
      style={bgStyle}
    >
      {/* Draggable Titlebar & Window Controls */}
      <div
        data-tauri-drag-region
        className="w-full h-8 px-3 flex items-center justify-between z-30 shrink-0 border-b border-white/5 cursor-grab active:cursor-grabbing bg-black/10"
      >
        {/* Left: Brand / Title */}
        <div data-tauri-drag-region className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
          <Disc3
            className="w-3.5 h-3.5 animate-spin"
            style={{ animationDuration: '8s', color: 'var(--color-stop-1, #6366f1)' }}
          />
          <span className="tracking-wide">Prism</span>
          <span className="text-[10px] text-zinc-500 font-mono">Mini</span>
        </div>

        {/* Right: Window Controls */}
        <div className="flex items-center gap-0.5 pointer-events-auto">
          {/* Always on top Pin Toggle */}
          <Tooltip title={isPinned ? 'Unpin from Top' : 'Pin Always on Top'} arrow>
            <IconButton
              size="small"
              onClick={togglePin}
              sx={{
                p: 0.5,
                color: isPinned ? 'var(--color-stop-1, #6366f1)' : 'rgba(255,255,255,0.4)',
                bgcolor: isPinned ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)' : 'transparent',
                '&:hover': {
                  color: '#ffffff',
                  bgcolor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 30%, transparent)',
                },
              }}
            >
              {isPinned ? <Pin size={13} className="rotate-45" /> : <PinOff size={13} />}
            </IconButton>
          </Tooltip>

          {/* Settings Drawer Toggle */}
          <Tooltip title="Configure Mini Player" arrow>
            <IconButton
              size="small"
              onClick={() => setShowSettingsDrawer((p) => !p)}
              sx={{
                p: 0.5,
                color: showSettingsDrawer ? 'var(--color-stop-1, #6366f1)' : 'rgba(255,255,255,0.6)',
                bgcolor: showSettingsDrawer
                  ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)'
                  : 'transparent',
                '&:hover': { color: '#ffffff', bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              <Settings size={13} />
            </IconButton>
          </Tooltip>

          {/* Minimize */}
          <Tooltip title="Minimize" arrow>
            <IconButton
              size="small"
              onClick={handleMinimize}
              sx={{
                p: 0.5,
                color: 'rgba(255,255,255,0.6)',
                '&:hover': { color: '#ffffff', bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              <Minus size={13} />
            </IconButton>
          </Tooltip>

          {/* Close */}
          <Tooltip title="Close Pop-Out" arrow>
            <IconButton
              size="small"
              onClick={handleClose}
              sx={{
                p: 0.5,
                color: 'rgba(255,255,255,0.6)',
                '&:hover': { color: '#f87171', bgcolor: 'rgba(239,68,68,0.15)' },
              }}
            >
              <X size={13} />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        ref={contentRef}
        className="flex-1 min-h-0 flex flex-col justify-between p-3 gap-2 relative overflow-hidden"
      >
        {/* LAYOUT A: STACKED (Default) */}
        {popoutSettings.layoutMode === 'stacked' && (
          <>
            {/* Top Track Header Info */}
            {popoutSettings.showAlbumArt && (
              <div className="flex items-center gap-2.5 shrink-0 z-10">
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-zinc-800 border border-white/10 shadow-md">
                  {trackArt ? (
                    <img src={trackArt} alt="Artwork" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600">
                      <Music size={18} />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate leading-tight">
                    {currentTrack?.title || 'No track playing'}
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate leading-tight mt-0.5">
                    {currentTrack?.artist || 'Prism Music Player'}
                  </div>
                </div>
              </div>
            )}

            {/* Scrolling Lyrics Area */}
            <div
              ref={lyricsScrollRef}
              onWheel={() => {
                if (!isProgrammaticScrollRef.current) setIsUserScrolled(true);
              }}
              onTouchMove={() => {
                if (!isProgrammaticScrollRef.current) setIsUserScrolled(true);
              }}
              className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col items-center gap-4 py-8 px-2 text-center relative"
            >
              {renderLyricsContent()}
            </div>
          </>
        )}

        {/* LAYOUT B & C: SPLIT VIEW (Art Left or Art Right) */}
        {(popoutSettings.layoutMode === 'split_left' || popoutSettings.layoutMode === 'split_right') && (
          <div
            className={`flex-1 min-h-0 flex ${
              popoutSettings.layoutMode === 'split_right' ? 'flex-row-reverse' : 'flex-row'
            } items-center gap-4 px-2 py-1 overflow-hidden`}
          >
            {/* Split Column 1: Big Album Art + Song & Artist */}
            <div className="w-[38%] max-w-[200px] min-w-[110px] flex flex-col items-center justify-center shrink-0 text-center gap-2">
              <div className="relative group w-full aspect-square max-w-[170px] rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-zinc-900">
                {trackArt ? (
                  <img src={trackArt} alt="Artwork" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                    <Music className="w-10 h-10" />
                  </div>
                )}
                {/* Swap button on hover */}
                <button
                  onClick={() =>
                    setPopoutSettings({
                      layoutMode: popoutSettings.layoutMode === 'split_left' ? 'split_right' : 'split_left',
                    })
                  }
                  className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/60 hover:bg-black/90 text-white/80 hover:text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Swap Left / Right"
                >
                  <ArrowLeftRight size={12} />
                </button>
              </div>

              <div className="w-full px-1">
                <div className="text-xs sm:text-sm font-bold text-white truncate leading-tight">
                  {currentTrack?.title || 'No track playing'}
                </div>
                <div className="text-[11px] sm:text-xs text-zinc-400 truncate leading-tight mt-0.5">
                  {currentTrack?.artist || 'Prism'}
                </div>
              </div>
            </div>

            {/* Split Column 2: Scrolling Lyrics */}
            <div
              ref={lyricsScrollRef}
              onWheel={() => {
                if (!isProgrammaticScrollRef.current) setIsUserScrolled(true);
              }}
              onTouchMove={() => {
                if (!isProgrammaticScrollRef.current) setIsUserScrolled(true);
              }}
              className="flex-1 h-full min-w-0 overflow-y-auto custom-scrollbar flex flex-col items-center gap-4 py-8 px-2 text-center relative"
            >
              {renderLyricsContent()}
            </div>
          </div>
        )}

        {/* Floating Re-sync to Music Button */}
        {isUserScrolled && lines.length > 0 && (
          <button
            onClick={() => {
              setIsUserScrolled(false);
              scrollToActive(true);
            }}
            style={{
              background:
                'linear-gradient(135deg, var(--color-stop-1, #6366f1), var(--color-stop-2, #818cf8))',
              boxShadow:
                '0 4px 16px color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
            }}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-[11px] font-semibold shadow-xl backdrop-blur-md cursor-pointer hover:brightness-110 active:scale-95 transition-all"
          >
            <Target className="w-3.5 h-3.5" />
            <span>Re-sync</span>
          </button>
        )}

        {/* Optional Seekbar */}
        {popoutSettings.showSeekbar && (
          <div className="shrink-0 flex items-center gap-2 pt-1 z-10">
            <span className="text-[10px] font-mono text-zinc-400 w-8 text-right">
              {formatTime(currentTimeSecs)}
            </span>
            <Slider
              size="small"
              value={currentTimeSecs}
              min={0}
              max={duration || 1}
              step={0.5}
              onChange={(_e, val) => {
                const target = val as number;
                setCurrentTimeSecs(target);
                sendCommand('seek', target);
              }}
              sx={{
                p: '4px 0',
                color: 'var(--color-stop-1, #6366f1)',
                '& .MuiSlider-thumb': {
                  width: 10,
                  height: 10,
                  transition: '0.2s cubic-bezier(.47,1.64,.41,.8)',
                  '&:before': { boxShadow: '0 2px 8px 0 rgba(0,0,0,0.4)' },
                  '&:hover, &.Mui-focusVisible': {
                    boxShadow:
                      '0px 0px 0px 6px color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)',
                  },
                },
                '& .MuiSlider-rail': {
                  opacity: 0.25,
                },
              }}
            />
            <span className="text-[10px] font-mono text-zinc-500 w-8">
              {formatTime(duration)}
            </span>
          </div>
        )}

        {/* Optional Playback Controls Bar */}
        {popoutSettings.showPlaybackControls && (
          <div className="shrink-0 flex items-center justify-between pt-0.5 z-10 border-t border-white/5">
            {/* Playback Transport Buttons */}
            <div className="flex items-center gap-1 mx-auto">
              <IconButton
                size="small"
                onClick={() => sendCommand('previousTrack')}
                sx={{
                  color: 'rgba(255,255,255,0.8)',
                  p: 0.75,
                  '&:hover': { color: '#ffffff', bgcolor: 'rgba(255,255,255,0.1)' },
                }}
              >
                <SkipBack size={15} />
              </IconButton>

              <IconButton
                size="small"
                onClick={() => sendCommand('togglePlay')}
                sx={{
                  color: '#ffffff',
                  bgcolor: 'var(--color-stop-1, #6366f1)',
                  p: 0.85,
                  '&:hover': {
                    bgcolor: 'var(--color-stop-1, #6366f1)',
                    filter: 'brightness(1.15)',
                    transform: 'scale(1.05)',
                  },
                }}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
              </IconButton>

              <IconButton
                size="small"
                onClick={() => sendCommand('nextTrack')}
                sx={{
                  color: 'rgba(255,255,255,0.8)',
                  p: 0.75,
                  '&:hover': { color: '#ffffff', bgcolor: 'rgba(255,255,255,0.1)' },
                }}
              >
                <SkipForward size={15} />
              </IconButton>
            </div>

            {/* Quick Volume with Mouse Wheel Scrolling */}
            <div
              onWheel={handleVolumeWheel}
              className="flex items-center gap-1 w-20 shrink-0 cursor-pointer"
              title="Scroll to change volume"
            >
              <IconButton
                size="small"
                onClick={() => sendCommand('setVolume', volume > 0 ? 0 : 0.7)}
                sx={{ p: 0.5, color: 'rgba(255,255,255,0.6)' }}
              >
                {volume > 0 ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </IconButton>
              <Slider
                size="small"
                value={volume}
                min={0}
                max={1}
                step={0.02}
                onChange={(_e, val) => sendCommand('setVolume', val as number)}
                sx={{
                  color: 'var(--color-stop-1, #6366f1)',
                  p: '4px 0',
                  '& .MuiSlider-thumb': { width: 8, height: 8 },
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Settings Overlay Drawer */}
      {showSettingsDrawer && (
        <div className="absolute inset-0 z-40 bg-zinc-950/95 backdrop-blur-md p-4 flex flex-col justify-between overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sliders size={14} style={{ color: 'var(--color-stop-1, #6366f1)' }} />
              Mini Player Settings
            </span>
            <IconButton
              size="small"
              onClick={() => setShowSettingsDrawer(false)}
              sx={{ p: 0.5, color: 'rgba(255,255,255,0.6)' }}
            >
              <X size={15} />
            </IconButton>
          </div>

          <div className="flex-1 py-3 space-y-3 text-xs overflow-y-auto">
            {/* Layout Mode Selector */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Layout View
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'stacked', label: 'Stacked', icon: Rows },
                  { id: 'split_left', label: 'Art Left', icon: Columns2 },
                  { id: 'split_right', label: 'Art Right', icon: Columns2 },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setPopoutSettings({ layoutMode: item.id as any })}
                    style={
                      popoutSettings.layoutMode === item.id
                        ? {
                            borderColor: 'var(--color-stop-1, #6366f1)',
                            backgroundColor:
                              'color-mix(in srgb, var(--color-stop-1, #6366f1) 22%, transparent)',
                          }
                        : {}
                    }
                    className={`py-1.5 px-2 rounded-lg text-xs transition-all flex flex-col items-center gap-1 border ${
                      popoutSettings.layoutMode === item.id
                        ? 'text-white font-semibold'
                        : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    <item.icon size={14} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Widgets Toggles */}
            <div className="space-y-1.5 pt-1 border-t border-white/10">
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Widgets
              </div>
              <div className="flex items-center justify-between">
                <span>Album Art</span>
                <ThemeSwitch
                  checked={popoutSettings.showAlbumArt}
                  onChange={(e) => setPopoutSettings({ showAlbumArt: e.target.checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span>Seekbar</span>
                <ThemeSwitch
                  checked={popoutSettings.showSeekbar}
                  onChange={(e) => setPopoutSettings({ showSeekbar: e.target.checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span>Playback Controls</span>
                <ThemeSwitch
                  checked={popoutSettings.showPlaybackControls}
                  onChange={(e) => setPopoutSettings({ showPlaybackControls: e.target.checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span>Word-by-word Highlight</span>
                <ThemeSwitch
                  checked={popoutSettings.karaokeMode === 'word'}
                  onChange={(e) =>
                    setPopoutSettings({ karaokeMode: e.target.checked ? 'word' : 'line' })
                  }
                />
              </div>
            </div>

            {/* Romanization & Translations */}
            <div className="space-y-1.5 pt-1 border-t border-white/10">
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Romanization & Translations
              </div>
              <div className="flex items-center justify-between">
                <span>Romanization</span>
                <ThemeSwitch
                  checked={isRomanizationEnabled}
                  onChange={() => toggleRomanization()}
                />
              </div>
              {isRomanizationEnabled && (
                <div className="flex gap-1.5 pl-2">
                  {(['below', 'replace'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setRomanizationMode(mode)}
                      style={
                        romanizationMode === mode
                          ? {
                              borderColor: 'var(--color-stop-1, #6366f1)',
                              backgroundColor:
                                'color-mix(in srgb, var(--color-stop-1, #6366f1) 22%, transparent)',
                            }
                          : {}
                      }
                      className={`flex-1 py-1 rounded-md text-[11px] capitalize border transition-all ${
                        romanizationMode === mode
                          ? 'text-white font-semibold'
                          : 'border-white/10 bg-white/5 text-zinc-400'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span>Translation</span>
                <ThemeSwitch
                  checked={isTranslationEnabled}
                  onChange={() => toggleTranslation()}
                />
              </div>
              {isTranslationEnabled && (
                <div className="flex gap-1.5 pl-2">
                  {(['below', 'replace'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setTranslationMode(mode)}
                      style={
                        translationMode === mode
                          ? {
                              borderColor: 'var(--color-stop-1, #6366f1)',
                              backgroundColor:
                                'color-mix(in srgb, var(--color-stop-1, #6366f1) 22%, transparent)',
                            }
                          : {}
                      }
                      className={`flex-1 py-1 rounded-md text-[11px] capitalize border transition-all ${
                        translationMode === mode
                          ? 'text-white font-semibold'
                          : 'border-white/10 bg-white/5 text-zinc-400'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Appearance Styles */}
            <div className="space-y-2 pt-1 border-t border-white/10">
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Appearance Style
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'frosted', label: 'Frosted Glass' },
                  { id: 'solid', label: 'Solid Dark' },
                  { id: 'album_art_color', label: 'Album Art Color' },
                  { id: 'transparent', label: 'Transparent' },
                ].map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setPopoutSettings({ backgroundStyle: style.id as any })}
                    style={
                      popoutSettings.backgroundStyle === style.id
                        ? {
                            borderColor: 'var(--color-stop-1, #6366f1)',
                            backgroundColor:
                              'color-mix(in srgb, var(--color-stop-1, #6366f1) 22%, transparent)',
                          }
                        : {}
                    }
                    className={`px-2.5 py-1.5 rounded-lg text-left text-xs transition-all flex items-center justify-between border ${
                      popoutSettings.backgroundStyle === style.id
                        ? 'text-white font-semibold'
                        : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    <span>{style.label}</span>
                    {popoutSettings.backgroundStyle === style.id && (
                      <Check size={12} style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Background Opacity */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-zinc-400 text-[11px]">
                <span>Window Opacity</span>
                <span>{Math.round((popoutSettings.opacity ?? 0.85) * 100)}%</span>
              </div>
              <Slider
                size="small"
                value={popoutSettings.opacity ?? 0.85}
                min={0.2}
                max={1.0}
                step={0.05}
                onChange={(_e, val) => setPopoutSettings({ opacity: val as number })}
                sx={{
                  color: 'var(--color-stop-1, #6366f1)',
                  '& .MuiSlider-thumb': {
                    '&:hover, &.Mui-focusVisible': {
                      boxShadow:
                        '0px 0px 0px 6px color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)',
                    },
                  },
                }}
              />
            </div>

            {/* Font Size Preset */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Lyrics Text Size
              </div>
              <div className="flex gap-1.5">
                {(['small', 'balanced', 'large'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => setPopoutSettings({ fontSize: size })}
                    style={
                      popoutSettings.fontSize === size
                        ? {
                            borderColor: 'var(--color-stop-1, #6366f1)',
                            backgroundColor:
                              'color-mix(in srgb, var(--color-stop-1, #6366f1) 22%, transparent)',
                          }
                        : {}
                    }
                    className={`flex-1 py-1 rounded-md text-xs capitalize border transition-all ${
                      popoutSettings.fontSize === size
                        ? 'text-white font-semibold'
                        : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowSettingsDrawer(false)}
            style={{
              background:
                'linear-gradient(135deg, var(--color-stop-1, #6366f1), var(--color-stop-2, #818cf8))',
              boxShadow:
                '0 4px 16px color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
            }}
            className="w-full py-2 text-white text-xs font-semibold rounded-xl transition-all hover:brightness-110 active:scale-98 shrink-0"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );

  function renderLyricsContent() {
    if (isLoadingLyrics) {
      return (
        <div className="text-xs text-zinc-400 animate-pulse my-auto flex items-center gap-1.5">
          <span>Loading synchronized lyrics...</span>
        </div>
      );
    }

    if (lines.length === 0) {
      return (
        <div className="text-xs text-zinc-500 font-medium my-auto">
          No lyrics available for this track
        </div>
      );
    }

    return lines.map((line, idx) => {
      const isLineActive = idx === activeIndex;
      const isPast = idx < activeIndex;

      // Romanization & Translation text calculation
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

      const isTransparent = popoutSettings.backgroundStyle === 'transparent';

      return (
        <div
          id={`popout-lyric-${idx}`}
          key={`${line.id}-${idx}`}
          onClick={() => {
            if (line.startSecs >= 0) {
              sendCommand('seek', line.startSecs);
            }
          }}
          className={`transition-all duration-300 cursor-pointer select-none leading-snug w-full max-w-xl mx-auto flex flex-col items-center ${
            isLineActive ? 'scale-100 font-bold' : 'scale-95 font-medium'
          }`}
          style={{
            fontSize: `${isLineActive ? computedFontSize.active : computedFontSize.inactive}px`,
            textShadow: isTransparent
              ? '0 1px 4px rgba(0,0,0,0.95), 0 2px 8px rgba(0,0,0,0.9), 0 0 16px rgba(0,0,0,0.85)'
              : isLineActive
              ? '0 0 20px color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)'
              : undefined,
            color: isLineActive
              ? '#ffffff'
              : isPast
              ? 'rgba(255, 255, 255, 0.45)'
              : 'rgba(255, 255, 255, 0.35)',
          }}
        >
          {/* Main Line Content */}
          <div className="w-full">
            {isLineActive &&
            popoutSettings.karaokeMode === 'word' &&
            line.syllables &&
            line.syllables.length > 0 ? (
              <span>
                {line.syllables.map((syl, sIdx) => {
                  const curMs = currentTimeSecs * 1000;
                  const isSylActive = curMs >= syl.timeMs && curMs < syl.timeMs + syl.durationMs;
                  const isSylPassed = curMs >= syl.timeMs + syl.durationMs;
                  return (
                    <span
                      key={sIdx}
                      className={`inline-block transition-colors duration-150 ${
                        syl.hasTrailingSpace ? 'mr-[0.25em]' : ''
                      }`}
                      style={{
                        color: isSylActive
                          ? 'var(--color-stop-1, #a5b4fc)'
                          : isSylPassed
                          ? '#ffffff'
                          : 'rgba(255, 255, 255, 0.40)',
                        textShadow: isSylActive
                          ? '0 0 14px var(--color-stop-1, #6366f1)'
                          : undefined,
                      }}
                    >
                      {syl.text}
                    </span>
                  );
                })}
              </span>
            ) : (
              mainText
            )}
          </div>

          {/* Sub-line: Romanization below */}
          {subRom && (
            <div
              className="opacity-75 tracking-normal leading-tight mt-0.5"
              style={{
                fontSize: `${computedFontSize.sub}px`,
                color: isLineActive ? 'var(--color-stop-2, #a5b4fc)' : 'rgba(255,255,255,0.4)',
              }}
            >
              {subRom}
            </div>
          )}

          {/* Sub-line: Translation below */}
          {subTrans && (
            <div
              className="opacity-70 tracking-normal leading-tight mt-0.5 italic"
              style={{
                fontSize: `${computedFontSize.sub}px`,
                color: isLineActive ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.35)',
              }}
            >
              {subTrans}
            </div>
          )}
        </div>
      );
    });
  }
};

const ThemeSwitch: React.FC<{
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ checked, onChange }) => (
  <Switch
    size="small"
    checked={checked}
    onChange={onChange}
    sx={{
      '& .MuiSwitch-switchBase.Mui-checked': {
        color: 'var(--color-stop-1, #6366f1)',
        '&:hover': {
          backgroundColor:
            'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
        },
      },
      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
        backgroundColor: 'var(--color-stop-1, #6366f1) !important',
        opacity: 0.65,
      },
    }}
  />
);
