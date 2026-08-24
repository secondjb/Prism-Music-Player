import React, { useState, useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { fetchLrclibLyrics } from '../utils/lrclibFetcher';
import { parse } from 'clrc';
import { createRomanizer } from 'lyric-romanizer';
import { motion } from 'framer-motion';
import {
  Mic2,
  Settings2,
  RefreshCw,
  X,
  Languages,
  Play,
  Pause,
  SkipBack,
  SkipForward,
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
    volume,
    setVolume,
    lrclibAutoFetch,
    setLrclibAutoFetch,
    isRomanizationEnabled,
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
  const [isMuted, setIsMuted] = useState(false);
  const [prevVol, setPrevVol] = useState(volume);

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // 1. Fetch raw lyrics when currentTrack changes or when initializing
  useEffect(() => {
    if (!currentTrack) {
      setRawLrc('');
      return;
    }

    if (currentTrack.unsynced_lyrics) {
      setRawLrc(currentTrack.unsynced_lyrics);
      return;
    }

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
          setRawLrc(fetched);
        }
      });
    }
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

    const formatted: SyncedLine[] = lyricLines.map((item, idx) => ({
      id: `${idx}-${item.startMillisecond}`,
      startSecs: item.startMillisecond / 1000,
      content: item.content.trim(),
    }));

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
  if (lines.length > 0) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startSecs <= currentTime) {
        activeIndex = i;
      }
    }
  }

  // 4. Smooth scroll active line to center
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex]);

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

  const handleMuteToggle = () => {
    if (isMuted) {
      setVolume(prevVol);
      setIsMuted(false);
    } else {
      setPrevVol(volume);
      setVolume(0);
      setIsMuted(true);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-zinc-950/95 backdrop-blur-3xl flex flex-col justify-between p-8 overflow-hidden select-none">
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
            <h3 className="font-bold text-white text-base">Synced Lyrics</h3>
          </div>
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
      <div className="flex-1 overflow-y-auto my-4 px-4 custom-scrollbar flex flex-col items-center justify-start gap-6 pt-[30vh] pb-[30vh] z-10">
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
            const isActive = idx === activeIndex;

            return (
              <motion.div
                key={line.id}
                ref={isActive ? activeLineRef : null}
                animate={{
                  opacity: isActive ? 1 : 0.35,
                  scale: isActive ? 1.05 : 0.98,
                }}
                transition={{ duration: 0.2 }}
                className={`text-center cursor-pointer max-w-3xl px-6 py-2 rounded-2xl transition-colors ${
                  isActive
                    ? 'text-white font-extrabold text-2xl md:text-3xl drop-shadow-[0_0_25px_rgba(99,102,241,0.6)]'
                    : 'text-zinc-400 hover:text-zinc-200 font-medium text-lg md:text-xl'
                }`}
                onClick={() => {
                  if (typeof line.startSecs === 'number' && !isNaN(line.startSecs)) {
                    seek(line.startSecs);
                  }
                }}
              >
                <div>{line.content}</div>
                {isRomanizationEnabled && line.romanized && (
                  <div className="text-xs md:text-sm font-mono text-indigo-300/80 font-normal mt-1">
                    {line.romanized}
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Footer Playback Controls & Track Info (Fades on idle) */}
      <motion.div
        animate={{
          opacity: controlsVisible ? 1 : 0,
          y: controlsVisible ? 0 : 20,
        }}
        transition={{ duration: 0.3 }}
        className={`border-t border-white/10 pt-4 z-10 flex flex-col gap-3 ${
          controlsVisible ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        {/* Seek Bar */}
        <div className="w-full flex items-center gap-3 text-xs font-mono text-zinc-400 max-w-2xl mx-auto">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
          />
          <span>{formatTime(duration)}</span>
        </div>

        {/* Track Details & Playback Controls */}
        <div className="flex items-center justify-between">
          {/* Left Track Info */}
          <div className="flex items-center gap-4 w-1/3 min-w-[200px]">
            {currentTrack ? (
              <>
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-800 border border-white/10 shadow-md shrink-0">
                  {currentTrack.embedded_art_base64 ? (
                    <img
                      src={currentTrack.embedded_art_base64}
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-indigo-900 flex items-center justify-center">
                      <Mic2 className="w-6 h-6 text-indigo-300" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-white truncate">{currentTrack.title}</h4>
                  <p className="text-xs text-zinc-400 truncate">{currentTrack.artist}</p>
                </div>
              </>
            ) : (
              <span className="text-xs text-zinc-500 italic">No track playing</span>
            )}
          </div>

          {/* Center Transport Controls */}
          <div className="flex items-center gap-6 justify-center w-1/3">
            <button
              onClick={previousTrack}
              className="text-zinc-400 hover:text-white transition-colors p-1"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              onClick={togglePlay}
              className="w-11 h-11 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-lg shadow-white/10 hover:scale-105 active:scale-95 transition-transform"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-zinc-950" /> : <Play className="w-5 h-5 fill-zinc-950 ml-0.5" />}
            </button>

            <button
              onClick={nextTrack}
              className="text-zinc-400 hover:text-white transition-colors p-1"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          {/* Right Volume & Audio Specs */}
          <div className="flex items-center justify-end gap-4 w-1/3 min-w-[200px]">
            {showAudioSpecs && currentTrack && (
              <div className="text-xs font-mono text-zinc-400 bg-white/5 px-3 py-1 rounded-xl border border-white/10">
                {currentTrack.bit_rate_kbps ? `${currentTrack.bit_rate_kbps} kb/s • ` : ''}
                {(currentTrack.sample_rate / 1000).toFixed(1)} kHz
              </div>
            )}

            <div className="flex items-center gap-2">
              <button onClick={handleMuteToggle} className="text-zinc-400 hover:text-white transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  if (isMuted) setIsMuted(false);
                }}
                className="w-20 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
              />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
