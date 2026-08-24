import React, { useState, useEffect } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { invoke } from '@tauri-apps/api/core';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Heart,
  Mic2,
  Timer,
  ListMusic,
  Sparkles,
} from 'lucide-react';
import { SleepTimerModal } from './SleepTimerModal';

export const BottomBar: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    nextTrack,
    previousTrack,
    currentTime,
    duration,
    seek,
    volume,
    setVolume,
    likedTrackIds,
    toggleLikeTrack,
    sleepTimer,
    tickSleepTimerSecond,
    showLyricsFullscreen,
    setShowLyricsFullscreen,
  } = usePlayerStore();

  const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVol, setPrevVol] = useState(volume);

  // Poll playback position from Rust audio engine
  useEffect(() => {
    if (!isPlaying || !window.__TAURI_INTERNALS__) return;
    const interval = setInterval(async () => {
      try {
        const pos: number = await invoke('get_playback_position');
        if (typeof pos === 'number' && !isNaN(pos) && pos >= 0) {
          usePlayerStore.setState({ currentTime: pos });
          if (duration > 2 && pos > 0.5 && pos >= duration - 0.5) {
            nextTrack();
          }
        }
      } catch (e) {
        // Ignored
      }
    }, 250);
    return () => clearInterval(interval);
  }, [isPlaying, duration, nextTrack]);

  // Sleep timer interval tick
  useEffect(() => {
    if (!sleepTimer.active || sleepTimer.mode !== 'time') return;
    const interval = setInterval(() => {
      tickSleepTimerSecond();
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimer.active, sleepTimer.mode, tickSleepTimerSecond]);

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

  const isLiked = currentTrack ? likedTrackIds.includes(currentTrack.id) : false;

  return (
    <footer className="h-24 glass border-t border-white/10 px-6 flex items-center justify-between z-30 shrink-0 relative">
      {/* 1. Track Info (Left) */}
      <div className="flex items-center gap-4 w-1/4 min-w-[200px]">
        {currentTrack ? (
          <>
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-zinc-800 border border-white/10 relative shadow-lg">
              {currentTrack.embedded_art_base64 ? (
                <img
                  src={currentTrack.embedded_art_base64}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-indigo-300" />
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm text-white truncate">{currentTrack.title}</span>
              <span className="text-xs text-zinc-400 truncate mt-0.5">{currentTrack.artist}</span>
              {usePlayerStore.getState().showAudioSpecs && (
                <span className="text-[10px] text-zinc-400 font-mono mt-0.5 flex items-center gap-1.5">
                  {currentTrack.bit_rate_kbps ? `${currentTrack.bit_rate_kbps} kb/s` : ''}
                  {currentTrack.bit_rate_kbps ? ' • ' : ''}
                  {(currentTrack.sample_rate / 1000).toFixed(1)} kHz
                </span>
              )}
            </div>
            <button
              onClick={() => toggleLikeTrack(currentTrack.id)}
              className={`ml-2 p-2 rounded-lg transition-colors ${
                isLiked ? 'text-pink-500' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-pink-500' : ''}`} />
            </button>
          </>
        ) : (
          <div className="text-xs text-zinc-500 italic">No track playing</div>
        )}
      </div>

      {/* 2. Playback Controls & Progress Bar (Center) */}
      <div className="flex flex-col items-center gap-2 w-2/4 max-w-xl">
        <div className="flex items-center gap-6">
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

        {/* Seek Bar */}
        <div className="w-full flex items-center gap-3 text-xs font-mono text-zinc-400">
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
      </div>

      {/* 3. Volume & Extra Controls (Right) */}
      <div className="flex items-center justify-end gap-3 w-1/4 min-w-[200px]">
        {/* Queue Drawer Button */}
        <button
          onClick={() => usePlayerStore.setState((s) => ({ isQueueOpen: !s.isQueueOpen }))}
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all relative"
          title="Play Queue"
        >
          <ListMusic className="w-5 h-5" />
          {usePlayerStore.getState().queue.length > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-indigo-600 text-[9px] font-mono font-bold text-white">
              {usePlayerStore.getState().queue.length}
            </span>
          )}
        </button>

        {/* Karaoke / Lyrics Toggle */}
        <button
          onClick={() => setShowLyricsFullscreen(!showLyricsFullscreen)}
          className={`p-2 rounded-xl transition-all ${
            showLyricsFullscreen ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
          title="Karaoke / Fullscreen Lyrics"
        >
          <Mic2 className="w-5 h-5" />
        </button>

        {/* Sleep Timer Button */}
        <button
          onClick={() => setIsTimerModalOpen(true)}
          className={`p-2 rounded-xl transition-all relative ${
            sleepTimer.active ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/40' : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
          title="Sleep Timer"
        >
          <Timer className="w-5 h-5" />
          {sleepTimer.active && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
          )}
        </button>

        {/* Volume */}
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
            className="w-24 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
          />
        </div>
      </div>

      <SleepTimerModal isOpen={isTimerModalOpen} onClose={() => setIsTimerModalOpen(false)} />
    </footer>
  );
};
