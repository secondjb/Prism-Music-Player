import React, { useState, useEffect } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { Lrc } from 'react-lrc';
import { fetchLrclibLyrics } from '../utils/lrclibFetcher';
import { romanizeText } from '../utils/romanization';
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

  const [rawLrc, setRawLrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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
      ).then((fetched: string | null) => {
        setIsLoading(false);
        setRawLrc(fetched || '');
      });
    } else {
      setRawLrc('');
    }
  }, [currentTrack?.id, lrclibAutoFetch]);

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

  const lineRenderer = ({ line, active }: any) => {
    const originalText = line.content;
    const romanized = romanizeText(originalText, romanizationMode);

    return (
      <div
        className={`text-center transition-all cursor-pointer max-w-3xl px-6 py-3 rounded-2xl mx-auto ${
          active
            ? 'text-white font-extrabold text-2xl md:text-3xl drop-shadow-[0_0_25px_rgba(99,102,241,0.6)] scale-105'
            : 'text-zinc-400 hover:text-zinc-200 font-medium text-lg md:text-xl'
        }`}
        onClick={() => {
          if (line.startMillisecond > 0) {
            usePlayerStore.getState().seek(line.startMillisecond / 1000);
          }
        }}
      >
        <div>{originalText}</div>
        {romanizationMode !== 'none' && romanized !== originalText && (
          <div className="text-xs md:text-sm font-mono text-indigo-300/80 font-normal mt-1">
            {romanized}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-40 bg-zinc-950/95 backdrop-blur-3xl flex flex-col justify-between p-8 overflow-hidden select-none">
      {currentTrack?.embedded_art_base64 && (
        <div
          className="absolute inset-0 pointer-events-none opacity-20 blur-[140px] scale-125 bg-cover bg-center transition-all duration-1000"
          style={{ backgroundImage: `url(${currentTrack.embedded_art_base64})` }}
        />
      )}

      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Mic2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Karaoke & Synchronized Lyrics</h3>
            <p className="text-xs text-zinc-400">Powered by react-lrc library</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
                {mode === 'none' ? 'Original' : mode === 'romaji' ? 'Romaji' : mode === 'aromanize' ? 'Roman (KR)' : 'Pinyin'}
              </button>
            ))}
          </div>

          <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 border border-white/10">
            <Settings2 className="w-5 h-5" />
          </button>
          <button onClick={() => setShowLyricsFullscreen(false)} className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 border border-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="absolute right-12 top-20 w-72 glass-panel border border-white/10 rounded-2xl shadow-2xl p-4 z-50 flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-white border-b border-white/10 pb-2">Lyrics Options</h4>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-300">Auto-fetch from LRCLIB</span>
            <input type="checkbox" checked={lrclibAutoFetch} onChange={(e) => setLrclibAutoFetch(e.target.checked)} className="w-4 h-4 accent-indigo-500 rounded cursor-pointer" />
          </div>
          <button onClick={handleManualRefresh} className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-medium transition-colors mt-1">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Fetch / Refresh
          </button>
        </div>
      )}

      <div className="flex-1 my-6 px-4 flex flex-col items-center justify-center z-10 w-full">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 my-auto">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
            <span className="text-sm text-zinc-400 font-medium">Fetching synchronized lyrics...</span>
          </div>
        ) : !rawLrc ? (
          <div className="flex flex-col items-center gap-3 my-auto text-center max-w-md">
            <Mic2 className="w-12 h-12 text-zinc-600" />
            <h4 className="text-lg font-bold text-white">No lyrics available</h4>
            <button onClick={handleManualRefresh} className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors">Search LRCLIB</button>
          </div>
        ) : (
          <Lrc
            lrc={rawLrc}
            currentMillisecond={currentTime * 1000}
            lineRenderer={lineRenderer}
            className="w-full h-full custom-scrollbar"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            recoverAutoScrollInterval={5000}
          />
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
