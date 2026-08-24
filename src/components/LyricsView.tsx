import React, { useState, useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { parseLrc, LrcLine } from '../utils/lrcParser';
import { fetchLrclibLyrics } from '../utils/lrclibFetcher';
import { romanizeText } from '../utils/romanization';
import { motion } from 'framer-motion';
import { Mic2, Settings2, Globe, RefreshCw, X, Sparkles } from 'lucide-react';

export const LyricsView: React.FC = () => {
  const {
    currentTrack,
    currentTime,
    lrclibAutoFetch,
    setLrclibAutoFetch,
    romanizationMode,
    setRomanizationMode,
    setShowLyricsFullscreen,
  } = usePlayerStore();

  const [parsedLines, setParsedLines] = useState<LrcLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Fetch or parse lyrics whenever track changes
  useEffect(() => {
    if (!currentTrack) {
      setParsedLines([]);
      return;
    }

    // 1. Check embedded lyrics first
    if (currentTrack.unsynced_lyrics) {
      setParsedLines(parseLrc(currentTrack.unsynced_lyrics));
      return;
    }

    // 2. Fetch from LRCLIB if auto fetch is enabled
    if (lrclibAutoFetch) {
      setIsLoading(true);
      fetchLrclibLyrics(
        currentTrack.title,
        currentTrack.artist,
        currentTrack.album,
        currentTrack.duration_secs
      ).then((fetched) => {
        setIsLoading(false);
        if (fetched) {
          setParsedLines(parseLrc(fetched));
        } else {
          setParsedLines([]);
        }
      });
    } else {
      setParsedLines([]);
    }
  }, [currentTrack?.id, lrclibAutoFetch]);

  // Find active line index based on currentTime
  let activeIndex = -1;
  if (parsedLines.length > 0) {
    for (let i = 0; i < parsedLines.length; i++) {
      if (parsedLines[i].timeSecs !== -1 && parsedLines[i].timeSecs <= currentTime) {
        activeIndex = i;
      }
    }
    if (activeIndex === -1 && parsedLines[0].timeSecs === -1) {
      // Unsynced fallback: calculate line index proportionally
      if (currentTrack && currentTrack.duration_secs > 0) {
        const ratio = currentTime / currentTrack.duration_secs;
        activeIndex = Math.min(
          parsedLines.length - 1,
          Math.floor(ratio * parsedLines.length)
        );
      }
    }
  }

  // Smooth scroll to keep active line centered
  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex]);

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
      setParsedLines(parseLrc(fetched));
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-zinc-950/95 backdrop-blur-3xl flex flex-col justify-between p-8 overflow-hidden select-none">
      {/* Background Cover Art Glow */}
      {currentTrack?.embedded_art_base64 && (
        <div
          className="absolute inset-0 pointer-events-none opacity-20 blur-[140px] scale-125 bg-cover bg-center transition-all duration-1000"
          style={{ backgroundImage: `url(${currentTrack.embedded_art_base64})` }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Mic2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Karaoke & Synchronized Lyrics</h3>
            <p className="text-xs text-zinc-400">Ultra-low latency audio sync</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Romanization mode selector */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
            <Globe className="w-4 h-4 text-indigo-400 ml-2 mr-1" />
            {(['none', 'romaji', 'aromanize', 'pinyin'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setRomanizationMode(mode)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  romanizationMode === mode
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {mode === 'none'
                  ? 'Original'
                  : mode === 'romaji'
                  ? 'Romaji (JP)'
                  : mode === 'aromanize'
                  ? 'Roman (KR)'
                  : 'Pinyin (CN)'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 border border-white/10"
            title="Lyrics Settings"
          >
            <Settings2 className="w-5 h-5" />
          </button>

          <button
            onClick={() => setShowLyricsFullscreen(false)}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 border border-white/10"
            title="Close Lyrics View"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings popup dropdown */}
      {showSettings && (
        <div className="absolute right-12 top-20 w-72 glass-panel border border-white/10 rounded-2xl shadow-2xl p-4 z-50 flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-white border-b border-white/10 pb-2">
            Lyrics Options
          </h4>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-300">Auto-fetch from LRCLIB</span>
            <input
              type="checkbox"
              checked={lrclibAutoFetch}
              onChange={(e) => setLrclibAutoFetch(e.target.checked)}
              className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
            />
          </div>
          <button
            onClick={handleManualRefresh}
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-medium transition-colors mt-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Fetch / Refresh Lyrics
          </button>
        </div>
      )}

      {/* Lyrics Display Scroll Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto my-6 px-4 custom-scrollbar flex flex-col items-center justify-start gap-6 pt-[30vh] pb-[30vh] z-10"
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 my-auto">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
            <span className="text-sm text-zinc-400 font-medium">Fetching synchronized lyrics...</span>
          </div>
        ) : parsedLines.length === 0 ? (
          <div className="flex flex-col items-center gap-3 my-auto text-center max-w-md">
            <Mic2 className="w-12 h-12 text-zinc-600" />
            <h4 className="text-lg font-bold text-white">No lyrics available</h4>
            <p className="text-xs text-zinc-400">
              We couldn't find synced lyrics for this track automatically. You can try refreshing or toggling LRCLIB settings.
            </p>
            <button
              onClick={handleManualRefresh}
              className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors"
            >
              Search LRCLIB
            </button>
          </div>
        ) : (
          parsedLines.map((line, idx) => {
            const isActive = idx === activeIndex;
            const originalText = line.text;
            const romanized = romanizeText(originalText, romanizationMode);

            return (
              <motion.div
                key={idx}
                ref={isActive ? activeLineRef : null}
                initial={{ opacity: 0.5, scale: 0.96 }}
                animate={{
                  opacity: isActive ? 1 : 0.4,
                  scale: isActive ? 1.06 : 0.98,
                  y: isActive ? 0 : 0,
                }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={`text-center transition-all cursor-pointer max-w-3xl px-6 py-2 rounded-2xl ${
                  isActive
                    ? 'text-white font-extrabold text-2xl md:text-3xl drop-shadow-[0_0_25px_rgba(99,102,241,0.6)]'
                    : 'text-zinc-400 hover:text-zinc-200 font-medium text-lg md:text-xl'
                }`}
                onClick={() => {
                  if (line.timeSecs > 0) {
                    usePlayerStore.getState().seek(line.timeSecs);
                  }
                }}
              >
                <div>{originalText}</div>
                {romanizationMode !== 'none' && romanized !== originalText && (
                  <div className="text-xs md:text-sm font-mono text-indigo-300/80 font-normal mt-1">
                    {romanized}
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Track info footer in Lyrics view */}
      {currentTrack && (
        <div className="flex items-center justify-between border-t border-white/10 pt-4 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-800 border border-white/10 shadow-md">
              {currentTrack.embedded_art_base64 ? (
                <img src={currentTrack.embedded_art_base64} alt={currentTrack.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-indigo-900 flex items-center justify-center">
                  <Mic2 className="w-6 h-6 text-indigo-300" />
                </div>
              )}
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">{currentTrack.title}</h4>
              <p className="text-xs text-zinc-400">{currentTrack.artist}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{(currentTrack.sample_rate / 1000).toFixed(1)}kHz / {currentTrack.bit_depth}b FLAC</span>
          </div>
        </div>
      )}
    </div>
  );
};
