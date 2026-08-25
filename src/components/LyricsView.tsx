import React, { useState, useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { fetchLrclibLyrics } from '../utils/lrclibFetcher';
import { parse } from 'clrc';
import { createRomanizer } from 'lyric-romanizer';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import {
  Mic2,
  Settings2,
  RefreshCw,
  X,
  Target,
  Languages,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

const romanizer = createRomanizer();

interface SyncedLine {
  id: string;
  startSecs: number;
  content: string;
  romanized?: string;
}

export const LyricsView: React.FC = () => {
  const {
    currentTrack,
    currentTime,
    lrclibAutoFetch,
    setLrclibAutoFetch,
    isRomanizationEnabled,
    romanizationMode,
    setRomanizationMode,
    toggleRomanization,
    showAudioSpecs,
    toggleShowAudioSpecs,
    autoHideLyricsControls,
    toggleAutoHideLyricsControls,
    setShowLyricsFullscreen,
    activeTab,
    setActiveTab,
    seek,
  } = usePlayerStore();

  const trackArt = useTrackArt(currentTrack);

  const [rawLrc, setRawLrc] = useState<string>('');
  const [lines, setLines] = useState<SyncedLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [artExpanded, setArtExpanded] = useState(false);
  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const isProgrammaticScrollRef = useRef(false);

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);

  // Track window height for dynamic text sizing
  useEffect(() => {
    const handleResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Compute dynamic font sizes based on window height
  // Goal: show ~5 lines (prev 2, current, next 2) comfortably
  const lyricsAreaHeight = windowHeight * 0.55; // rough middle area height
  const lineHeight = lyricsAreaHeight / 5;
  const activeFontSize = Math.max(28, Math.min(52, lineHeight * 0.5));
  const inactiveFontSize = Math.max(18, Math.min(32, lineHeight * 0.35));

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

  // 1. Fetch raw lyrics when currentTrack changes
  useEffect(() => {
    if (!currentTrack) {
      setRawLrc('');
      return;
    }

    // First: try embedded lyrics from track metadata
    if (currentTrack.unsynced_lyrics) {
      setRawLrc(currentTrack.unsynced_lyrics);
      return;
    }

    // Second: try on-demand lyrics extraction from the FLAC file directly
    const fetchFromFile = async () => {
      setIsLoading(true);
      try {
        if (window.__TAURI_INTERNALS__) {
          const lyrics: string | null = await invoke('get_track_lyrics', { path: currentTrack.path });
          if (lyrics && lyrics.trim()) {
            setRawLrc(lyrics);
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn('On-demand lyrics fetch error:', e);
      }

      // Third: try LRCLIB online fetch
      if (lrclibAutoFetch) {
        const fetched = await fetchLrclibLyrics(
          currentTrack.title,
          currentTrack.artist,
          currentTrack.album,
          currentTrack.duration_secs
        );
        if (fetched) {
          setRawLrc(fetched);
        }
      }
      setIsLoading(false);
    };

    fetchFromFile();
  }, [currentTrack?.id]);

  // 2. Parse & Romanize lines locally whenever rawLrc or isRomanizationEnabled changes
  useEffect(() => {
    if (!rawLrc.trim()) {
      setLines([]);
      return;
    }

    const parsed = parse(rawLrc);
    const lyricLines = parsed.filter(
      (item): item is Extract<typeof item, { type: 'lyric' }> =>
        item.type === 'lyric' && Boolean(item.content?.trim())
    );

    let formatted: SyncedLine[] = lyricLines.map((item, idx) => ({
      id: `${idx}-${item.startMillisecond}`,
      startSecs: item.startMillisecond / 1000,
      content: item.content.trim(),
    }));

    // Fallback: If no synced lines were found but we have raw text, treat it as unsynced lines
    if (formatted.length === 0 && rawLrc.trim()) {
      formatted = rawLrc
        .split(/\r?\n/)
        .map((line, idx) => ({
          id: `unsynced-${idx}`,
          startSecs: -1,
          content: line.trim(),
        }))
        .filter((line) => line.content);
    }

    setLines(formatted);

    if (isRomanizationEnabled) {
      let isMounted = true;
      Promise.all(
        formatted.map(async (line) => {
          try {
            const rom = await romanizer.romanizeLine(line.content);
            return {
              ...line,
              romanized: rom !== line.content ? rom : undefined,
            };
          } catch {
            return line;
          }
        })
      ).then((updated) => {
        if (isMounted) {
          setLines(updated);
        }
      });
      return () => {
        isMounted = false;
      };
    }
  }, [rawLrc, isRomanizationEnabled]);

  // 3. Determine active line index
  let activeIndex = -1;
  if (lines.length > 0 && lines[0].startSecs !== -1) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startSecs <= currentTime) {
        activeIndex = i;
      }
    }
  }

  // 4. Smooth scroll active line to center
  const scrollToActive = () => {
    if (activeLineRef.current) {
      isProgrammaticScrollRef.current = true;
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 400);
    }
  };

  useEffect(() => {
    if (!isUserScrolled && activeIndex !== -1) {
      scrollToActive();
    }
  }, [activeIndex, isUserScrolled]);

  const handleClose = () => {
    setShowLyricsFullscreen(false);
    if (activeTab === 'lyrics') {
      setActiveTab('library');
    }
  };



  const handleManualRefresh = async () => {
    if (!currentTrack) return;
    setIsLoading(true);
    const fetched = await fetchLrclibLyrics(
      currentTrack.title,
      currentTrack.artist,
      currentTrack.album,
      currentTrack.duration_secs
    );
    setIsLoading(false);
    if (fetched) {
      setRawLrc(fetched);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-24 z-40 bg-zinc-950/95 backdrop-blur-3xl flex flex-col justify-between p-8 overflow-hidden select-none">
      {/* Background Cover Art Glow */}
      {trackArt && (
        <div
          className="absolute inset-0 pointer-events-none opacity-20 blur-[140px] scale-125 bg-cover bg-center transition-all duration-1000"
          style={{ backgroundImage: `url(${trackArt})` }}
        />
      )}

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
          <div className="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Mic2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">
              {lines.length > 0 && lines[0].startSecs === -1 ? 'Unsynced Lyrics' : 'Synced Lyrics'}
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
          {/* Translation Toggle Button */}
          <button
            onClick={toggleRomanization}
            className={`p-2.5 rounded-xl transition-all ${
              isRomanizationEnabled
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 border border-indigo-500'
                : 'p-2.5 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 border border-white/10'
            }`}
            title={isRomanizationEnabled ? 'Translation Enabled' : 'Translation Disabled'}
          >
            <Languages className="w-5 h-5" />
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2.5 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 border border-white/10"
            title="Settings"
          >
            <Settings2 className="w-5 h-5" />
          </button>

          <button
            onClick={handleClose}
            className="p-2.5 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 border border-white/10"
            title="Close Lyrics View"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </motion.div>

      {/* Settings Popup */}
      {showSettings && (
        <div className="absolute right-12 top-20 w-72 glass-panel border border-white/10 rounded-2xl shadow-2xl p-4 z-50 flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-white border-b border-white/10 pb-2">
            Lyrics & Display Settings
          </h4>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-300">Auto-hide controls on idle</span>
            <input
              type="checkbox"
              checked={autoHideLyricsControls}
              onChange={toggleAutoHideLyricsControls}
              className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-300">Auto-fetch online lyrics</span>
            <input
              type="checkbox"
              checked={lrclibAutoFetch}
              onChange={(e) => setLrclibAutoFetch(e.target.checked)}
              className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-300">Show Audio Bitrate & Frequency</span>
            <input
              type="checkbox"
              checked={showAudioSpecs}
              onChange={toggleShowAudioSpecs}
              className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-white/10">
            <span className="text-zinc-300 font-medium">Romanization Mode</span>
            <select
              value={romanizationMode}
              onChange={(e) => setRomanizationMode(e.target.value as 'below' | 'replace')}
              className="bg-zinc-900 border border-white/10 text-xs text-white rounded-lg px-2 py-1 focus:outline-none"
            >
              <option value="below">Add Below</option>
              <option value="replace">Replace Original</option>
            </select>
          </div>
          <button
            onClick={handleManualRefresh}
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-medium transition-colors mt-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Lyrics
          </button>
        </div>
      )}

      {/* Main Lyrics Display Area */}
      <div
        ref={containerRef}
        onScroll={() => {
          if (!isProgrammaticScrollRef.current) {
            setIsUserScrolled(true);
          }
        }}
        className="flex-1 overflow-y-auto my-4 px-4 custom-scrollbar flex flex-col items-center justify-start gap-6 pt-[30vh] pb-[30vh] z-10 relative"
      >
        {isUserScrolled && lines.length > 0 && lines[0].startSecs !== -1 && (
          <button
            onClick={() => {
              setIsUserScrolled(false);
              scrollToActive();
            }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xl backdrop-blur-md transition-all border border-indigo-400/40 animate-in fade-in slide-in-from-bottom-3 cursor-pointer"
          >
            <Target className="w-4 h-4" />
            <span>Re-sync to music</span>
          </button>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center gap-3 my-auto">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
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
              className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors"
            >
              Search Online
            </button>
          </div>
        ) : (
          lines.map((line, idx) => {
            const isUnsynced = line.startSecs === -1;
            const isActive = isUnsynced || idx === activeIndex;
            const showRom = isRomanizationEnabled && line.romanized;
            const mainText = showRom && romanizationMode === 'replace' ? line.romanized : line.content;
            const subText = showRom && romanizationMode === 'below' ? line.romanized : null;

            return (
              <motion.div
                key={line.id}
                ref={isActive && !isUnsynced ? activeLineRef : null}
                animate={{
                  opacity: isActive ? 1 : 0.35,
                  scale: isActive ? (isUnsynced ? 1 : 1.05) : 0.98,
                }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={`text-center cursor-pointer max-w-4xl px-6 py-2 rounded-2xl transition-colors ${
                  isActive && !isUnsynced
                    ? 'text-white font-extrabold drop-shadow-[0_0_25px_rgba(99,102,241,0.6)]'
                    : isUnsynced
                    ? 'text-zinc-200 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200 font-medium'
                }`}
                style={{
                  fontSize: isActive && !isUnsynced ? `${activeFontSize}px` : `${inactiveFontSize}px`,
                  lineHeight: 1.3,
                }}
                onClick={() => {
                  if (typeof line.startSecs === 'number' && !isNaN(line.startSecs) && !isUnsynced) {
                    seek(line.startSecs);
                    setIsUserScrolled(false);
                  }
                }}
              >
                <div>{mainText}</div>
                {subText && (
                  <div
                    className="font-mono text-indigo-300/80 font-normal mt-1"
                    style={{ fontSize: `${Math.max(12, inactiveFontSize * 0.6)}px` }}
                  >
                    {subText}
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Expandable Album Art (Bottom Left) */}
      {trackArt && currentTrack && (
        <AnimatePresence>
          <motion.div
            className="fixed bottom-32 left-8 z-50 group cursor-pointer"
            initial={false}
            animate={{
              width: artExpanded ? 320 : 160,
              height: artExpanded ? 320 : 160,
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-white/10">
              <img src={trackArt} alt={currentTrack.title} className="w-full h-full object-cover" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setArtExpanded(!artExpanded);
                }}
                className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors"
                title={artExpanded ? 'Collapse' : 'Expand'}
              >
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full p-2">
                  {artExpanded ? (
                    <ChevronLeft className="w-5 h-5 text-white" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-white" />
                  )}
                </div>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};
