import React, { useState, useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { fetchLrclibLyrics } from '../utils/lrclibFetcher';
import { parse } from 'clrc';
import { createRomanizer } from 'lyric-romanizer';
import { motion } from 'framer-motion';
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
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
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
  const lyricsAreaHeight = windowHeight * 0.55;
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

    const hasLrcTimestamps = (text: string) => /\[\d{1,2}:\d{2}/.test(text);

    // If embedded lyrics contain synced LRC timestamps, use them immediately
    if (currentTrack.unsynced_lyrics && hasLrcTimestamps(currentTrack.unsynced_lyrics)) {
      setRawLrc(currentTrack.unsynced_lyrics);
      return;
    }

    // Set unsynced fallback if available while searching for synced lyrics
    if (currentTrack.unsynced_lyrics) {
      setRawLrc(currentTrack.unsynced_lyrics);
    } else {
      setRawLrc('');
    }

    const loadLyrics = async () => {
      setIsLoading(true);
      try {
        if (window.__TAURI_INTERNALS__) {
          const lyrics: string | null = await invoke('get_track_lyrics', { path: currentTrack.path });
          if (lyrics && lyrics.trim()) {
            if (hasLrcTimestamps(lyrics) || !currentTrack.unsynced_lyrics) {
              setRawLrc(lyrics);
              if (hasLrcTimestamps(lyrics)) {
                setIsLoading(false);
                return;
              }
            }
          }
        }
      } catch (e) {
        console.warn('On-demand lyrics fetch error:', e);
      }

      // Try LRCLIB online fetch for synced lyrics
      if (lrclibAutoFetch) {
        const fetched = await fetchLrclibLyrics(
          currentTrack.title,
          currentTrack.artist,
          currentTrack.album,
          currentTrack.duration_secs
        );
        if (fetched && fetched.trim()) {
          setRawLrc(fetched);
        }
      }
      setIsLoading(false);
    };

    loadLyrics();
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
    if (containerRef.current && activeIndex !== -1) {
      const lineEl = document.getElementById(`lyric-line-${activeIndex}`);
      const containerEl = containerRef.current;
      if (lineEl) {
        const targetTop = lineEl.offsetTop - containerEl.clientHeight / 2 + lineEl.clientHeight / 2;
        containerEl.scrollTo({
          top: targetTop,
          behavior: 'smooth',
        });
      }
    }
  };

  // 5. Native wheel and touchmove listeners for user manual scroll override
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleUserScroll = () => {
      setIsUserScrolled(true);
    };

    el.addEventListener('wheel', handleUserScroll, { passive: true });
    el.addEventListener('touchmove', handleUserScroll, { passive: true });

    return () => {
      el.removeEventListener('wheel', handleUserScroll);
      el.removeEventListener('touchmove', handleUserScroll);
    };
  }, []);

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

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const seekPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-3xl flex flex-col justify-between p-8 overflow-hidden select-none">
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
                id={`lyric-line-${idx}`}
                ref={isActive && !isUnsynced ? activeLineRef : null}
                animate={{
                  opacity: isActive ? 1 : 0.35,
                  scale: isActive ? (isUnsynced ? 1 : 1.05) : 0.98,
                }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={`text-center cursor-pointer max-w-5xl w-full px-8 py-3 rounded-2xl transition-colors ${
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

      {/* Standalone Bottom-Left Track Info & Expandable Album Art (Decoupled, Always Visible) */}
      {currentTrack && (
        <div className="fixed bottom-8 left-8 z-40 flex items-end gap-4 pointer-events-auto select-none">
          <div
            onClick={() => setArtExpanded(!artExpanded)}
            className={`relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 shrink-0 group cursor-pointer transition-all duration-300 ${
              artExpanded ? 'w-80 h-80' : 'w-20 h-20'
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

          <div className="flex flex-col min-w-0 max-w-xs mb-1">
            <span className="font-extrabold text-white text-lg truncate drop-shadow-lg">{currentTrack.title}</span>
            <span className="text-sm font-medium text-zinc-300 truncate mt-0.5">{currentTrack.artist}</span>
            {currentTrack.album && (
              <span className="text-xs text-zinc-400 truncate mt-0.5">{currentTrack.album}</span>
            )}
          </div>
        </div>
      )}

      {/* Floating Glass Transport Controls (Bottom-Center, Fades on Idle) */}
      <motion.div
        animate={{
          opacity: controlsVisible ? 1 : 0,
          y: controlsVisible ? 0 : 20,
        }}
        transition={{ duration: 0.3 }}
        className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-40 glass-panel border border-white/10 rounded-full px-6 py-2.5 shadow-2xl flex items-center gap-6 ${
          controlsVisible ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <button
          onClick={toggleShuffle}
          className={`p-2 rounded-xl transition-colors ${
            shuffleEnabled ? 'text-indigo-400' : 'text-zinc-400 hover:text-white'
          }`}
          title="Shuffle"
        >
          <Shuffle className="w-4 h-4" />
        </button>

        <button
          onClick={previousTrack}
          className="p-2 text-zinc-400 hover:text-white transition-colors"
          title="Previous"
        >
          <SkipBack className="w-5 h-5" />
        </button>

        <button
          onClick={togglePlay}
          className="w-11 h-11 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 transition-transform active:scale-95 cursor-pointer"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
        </button>

        <button
          onClick={nextTrack}
          className="p-2 text-zinc-400 hover:text-white transition-colors"
          title="Next"
        >
          <SkipForward className="w-5 h-5" />
        </button>

        <button
          onClick={cycleRepeatMode}
          className={`p-2 rounded-xl transition-colors ${
            repeatMode !== 'off' ? 'text-indigo-400' : 'text-zinc-400 hover:text-white'
          }`}
          title="Repeat"
        >
          <RepeatIcon className="w-4 h-4" />
        </button>

        {/* Seek Bar inside floating pill */}
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 w-48">
          <span>{formatTime(currentTime)}</span>
          <div className="relative flex-1 h-3 flex items-center group cursor-pointer">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={(e) => seek(parseFloat(e.target.value))}
              style={{
                background: `linear-gradient(to right, #6366f1 0%, #818cf8 ${seekPercent}%, #27272a ${seekPercent}%)`,
              }}
              className="w-full h-1.5 group-hover:h-2 rounded-full appearance-none cursor-pointer transition-all duration-200 slider-m3"
            />
          </div>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Exit Lyrics Button */}
        <button
          onClick={handleClose}
          className="p-2 rounded-xl text-indigo-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Exit Karaoke View"
        >
          <Mic2 className="w-5 h-5" />
        </button>
      </motion.div>

      {/* Floating Glass Volume & Specs Pill (Bottom-Right, Fades on Idle) */}
      <motion.div
        animate={{
          opacity: controlsVisible ? 1 : 0,
          y: controlsVisible ? 0 : 20,
        }}
        transition={{ duration: 0.3 }}
        className={`fixed bottom-8 right-8 z-40 glass-panel border border-white/10 rounded-full px-4 py-2.5 shadow-2xl flex items-center gap-3.5 ${
          controlsVisible ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        {showAudioSpecs && currentTrack && (
          <div className="text-[11px] font-mono text-zinc-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10 shrink-0">
            {currentTrack.bit_rate_kbps ? `${currentTrack.bit_rate_kbps}k • ` : ''}
            {(currentTrack.sample_rate / 1000).toFixed(1)}kHz
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
            className="text-zinc-400 hover:text-white transition-colors p-1"
            title={volume > 0 ? 'Mute' : 'Unmute'}
          >
            {volume > 0 ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            style={{
              background: `linear-gradient(to right, #6366f1 0%, #818cf8 ${volume * 100}%, #27272a ${volume * 100}%)`,
            }}
            className="w-20 h-1.5 rounded-full appearance-none cursor-pointer slider-m3"
          />
        </div>

        <button
          onClick={handleClose}
          className="p-1.5 rounded-full text-indigo-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Exit Karaoke View"
        >
          <Mic2 className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  );
};
