import React, { useState, useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { fetchLrclibLyrics } from '../utils/lrclibFetcher';
import { parse } from 'clrc';
import { createRomanizer } from 'lyric-romanizer';
import { motion } from 'framer-motion';
import { Mic2, Settings2, RefreshCw, X, Languages } from 'lucide-react';

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
    toggleRomanization,
    showAudioSpecs,
    toggleShowAudioSpecs,
    setShowLyricsFullscreen,
    seek,
  } = usePlayerStore();

  const [lines, setLines] = useState<SyncedLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  // 1. Parse LRC using clrc library
  useEffect(() => {
    if (!currentTrack) {
      setLines([]);
      return;
    }

    const loadLyrics = async (lrcText: string) => {
      if (!lrcText.trim()) {
        setLines([]);
        return;
      }

      const parsed = parse(lrcText);
      const lyricLines = parsed.filter((item): item is Extract<typeof item, { type: 'lyric' }> => item.type === 'lyric' && Boolean(item.content?.trim()));

      const formatted: SyncedLine[] = lyricLines.map((item, idx) => ({
        id: `${idx}-${item.startMillisecond}`,
        startSecs: item.startMillisecond / 1000,
        content: item.content.trim(),
      }));

      setLines(formatted);

      // Async batch romanization with lyric-romanizer
      if (isRomanizationEnabled) {
        const updated = await Promise.all(
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
        );
        setLines(updated);
      }
    };

    if (currentTrack.unsynced_lyrics) {
      loadLyrics(currentTrack.unsynced_lyrics);
    } else if (lrclibAutoFetch) {
      setIsLoading(true);
      fetchLrclibLyrics(
        currentTrack.title,
        currentTrack.artist,
        currentTrack.album,
        currentTrack.duration_secs
      ).then((fetched) => {
        setIsLoading(false);
        loadLyrics(fetched || '');
      });
    } else {
      setLines([]);
    }
  }, [currentTrack?.id, lrclibAutoFetch, isRomanizationEnabled]);

  // 2. Determine active line index
  let activeIndex = -1;
  if (lines.length > 0) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startSecs <= currentTime) {
        activeIndex = i;
      }
    }
  }

  // 3. Smooth scroll active line to center
  useEffect(() => {
    if (activeLineRef.current) {
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
      const parsed = parse(fetched);
      const lyricLines = parsed.filter((item): item is Extract<typeof item, { type: 'lyric' }> => item.type === 'lyric' && Boolean(item.content?.trim()));
      const formatted: SyncedLine[] = lyricLines.map((item, idx) => ({
        id: `${idx}-${item.startMillisecond}`,
        startSecs: item.startMillisecond / 1000,
        content: item.content.trim(),
      }));
      setLines(formatted);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-zinc-950/95 backdrop-blur-3xl flex flex-col justify-between p-8 overflow-hidden select-none">
      {/* Background Cover Glow */}
      {currentTrack?.embedded_art_base64 && (
        <div
          className="absolute inset-0 pointer-events-none opacity-20 blur-[140px] scale-125 bg-cover bg-center transition-all duration-1000"
          style={{ backgroundImage: `url(${currentTrack.embedded_art_base64})` }}
        />
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Mic2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Synced Lyrics</h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Single Translate / Romanization Toggle Button */}
          <button
            onClick={toggleRomanization}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              isRomanizationEnabled
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white hover:bg-white/10'
            }`}
            title="Toggle Automatic Translation / Romanization (JP, KR, CN)"
          >
            <Languages className="w-4 h-4" />
            <span>{isRomanizationEnabled ? 'Translation On' : 'Translation Off'}</span>
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 border border-white/10"
            title="Settings"
          >
            <Settings2 className="w-5 h-5" />
          </button>

          <button
            onClick={() => setShowLyricsFullscreen(false)}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 border border-white/10"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings Popup */}
      {showSettings && (
        <div className="absolute right-12 top-20 w-72 glass-panel border border-white/10 rounded-2xl shadow-2xl p-4 z-50 flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-white border-b border-white/10 pb-2">
            Lyrics & Display Settings
          </h4>
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
      <div className="flex-1 overflow-y-auto my-6 px-4 custom-scrollbar flex flex-col items-center justify-start gap-6 pt-[35vh] pb-[35vh] z-10">
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
              No synced lyrics were found for this song. You can click refresh to search online.
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
                onClick={() => seek(line.startSecs)}
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

      {/* Footer Track Info */}
      {currentTrack && (
        <div className="flex items-center justify-between border-t border-white/10 pt-4 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-800 border border-white/10 shadow-md">
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
            <div>
              <h4 className="font-bold text-sm text-white">{currentTrack.title}</h4>
              <p className="text-xs text-zinc-400">{currentTrack.artist}</p>
            </div>
          </div>

          {showAudioSpecs && (
            <div className="text-xs font-mono text-zinc-400 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
              {currentTrack.bit_rate_kbps ? `${currentTrack.bit_rate_kbps} kb/s • ` : ''}
              {(currentTrack.sample_rate / 1000).toFixed(1)} kHz
            </div>
          )}
        </div>
      )}
    </div>
  );
};
