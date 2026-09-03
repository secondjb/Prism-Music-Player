import React, { useState, useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { AudioSlider } from './AudioSlider';
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
  Shuffle,
  Repeat,
  Repeat1,
  Info,
  Radio,
  ListPlus,
  FolderPlus,
  Speaker,
} from 'lucide-react';
import { SleepTimerModal } from './SleepTimerModal';
import { AudioDeviceModal } from './AudioDeviceModal';
import { updateLogoGradientFromImage } from '../utils/colorExtractor';

export const BottomBar: React.FC = () => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const previousTrack = usePlayerStore((s) => s.previousTrack);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const seek = usePlayerStore((s) => s.seek);
  const volume = usePlayerStore((s) => s.volume);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const likedTrackIds = usePlayerStore((s) => s.likedTrackIds);
  const toggleLikeTrack = usePlayerStore((s) => s.toggleLikeTrack);
  const sleepTimer = usePlayerStore((s) => s.sleepTimer);
  const tickSleepTimerSecond = usePlayerStore((s) => s.tickSleepTimerSecond);
  const showLyricsFullscreen = usePlayerStore((s) => s.showLyricsFullscreen);
  const setShowLyricsFullscreen = usePlayerStore((s) => s.setShowLyricsFullscreen);
  const shuffleEnabled = usePlayerStore((s) => s.shuffleEnabled);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const cycleRepeatMode = usePlayerStore((s) => s.cycleRepeatMode);

  const trackArt = useTrackArt(currentTrack);

  useEffect(() => {
    updateLogoGradientFromImage(trackArt);
  }, [trackArt]);

  const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVol, setPrevVol] = useState(volume);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showPlaylistSub, setShowPlaylistSub] = useState(false);

  const playlists = usePlayerStore((s) => s.playlists);
  const addTrackToPlaylist = usePlayerStore((s) => s.addTrackToPlaylist);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const playNext = usePlayerStore((s) => s.playNext);
  const setInfoModalTrack = usePlayerStore((s) => s.setInfoModalTrack);

  // Local drag state for butter-smooth seeking
  const [dragSeekVal, setDragSeekVal] = useState<number | null>(null);

  // Ref for volume wheel scrolling
  const volContainerRef = useRef<HTMLDivElement>(null);

  // Poll playback position & duration from Rust audio engine
  useEffect(() => {
    if (!isPlaying || !window.__TAURI_INTERNALS__) return;
    const interval = setInterval(async () => {
      try {
        const res: any = await invoke('get_playback_position');
        const pos = Array.isArray(res) ? res[0] : res;
        const durFromRust = Array.isArray(res) ? res[1] : 0;
        if (typeof pos === 'number' && !isNaN(pos) && pos >= 0) {
          const state = usePlayerStore.getState();
          const effectiveDur = durFromRust > 0 ? durFromRust : (state.currentTrack?.duration_secs || state.duration || 0);
          usePlayerStore.setState({
            currentTime: pos,
            ...(effectiveDur > 0 ? { duration: effectiveDur } : {})
          });
          const dur = effectiveDur;
          const rm = state.repeatMode;
          if (dur > 2 && pos > 0.5 && pos >= dur - 0.5) {
            if (rm === 'one') {
              usePlayerStore.getState().seek(0);
            } else {
              nextTrack();
            }
          }
        }
      } catch (e) {
        // Ignored
      }
    }, 250);
    return () => clearInterval(interval);
  }, [isPlaying, nextTrack]);

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

  const [isEditingVol, setIsEditingVol] = useState(false);
  const [volInputText, setVolInputText] = useState('');

  // Native non-passive wheel listener for smooth & instant volume scrolling in WebView2/Tauri
  useEffect(() => {
    const el = volContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const store = usePlayerStore.getState();
      const current = store.volume;
      const step = e.shiftKey ? 0.01 : 0.02;
      const delta = e.deltaY < 0 ? step : -step;
      const nextVol = Math.max(0, Math.min(1, Math.round((current + delta) * 100) / 100));
      store.setVolume(nextVol);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const handleVolInputSubmit = () => {
    const num = parseInt(volInputText, 10);
    if (!isNaN(num)) {
      const clamped = Math.max(0, Math.min(100, num)) / 100;
      setVolume(clamped);
      if (isMuted && clamped > 0) setIsMuted(false);
    }
    setIsEditingVol(false);
  };

  const isLiked = currentTrack ? likedTrackIds.includes(currentTrack.id) : false;

  const currentSeekDisplay = dragSeekVal !== null ? dragSeekVal : currentTime;
  const effectiveVol = isMuted ? 0 : volume;

  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-24 bg-zinc-950/95 backdrop-blur-2xl border-t border-white/10 z-30 flex items-center justify-between px-6 select-none">
      {/* 1. Track Info (Left) */}
      <div 
        className="flex items-center gap-4 w-1/4 min-w-[180px] shrink relative"
        onContextMenu={(e) => {
          if (currentTrack) {
            e.preventDefault();
            setShowContextMenu(true);
            setShowPlaylistSub(false);
          }
        }}
      >
        {/* Backdrop to close context menu on click outside */}
        {showContextMenu && (
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              setShowContextMenu(false);
              setShowPlaylistSub(false);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowContextMenu(false);
              setShowPlaylistSub(false);
            }}
          />
        )}

        {currentTrack ? (
          <>
            <div className="relative w-14 h-14 rounded-xl overflow-hidden shadow-md shrink-0 group border border-white/10 bg-zinc-900 cursor-context-menu">
              {trackArt ? (
                <img src={trackArt} alt={currentTrack.title} className="w-full h-full object-cover pointer-events-none" />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-indigo-900 to-purple-900 flex items-center justify-center pointer-events-none">
                  <Sparkles className="w-6 h-6 text-indigo-400" />
                </div>
              )}
            </div>

            <div className="flex flex-col min-w-0 cursor-context-menu">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-white truncate max-w-[140px]" title={currentTrack.title}>
                  {currentTrack.title}
                </span>
                <button
                  onClick={() => toggleLikeTrack(currentTrack.id)}
                  className="text-zinc-400 hover:text-red-500 transition-colors p-0.5"
                >
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                </button>
              </div>
              <span 
                className="text-xs text-zinc-400 truncate max-w-[140px] hover:underline hover:text-indigo-400 cursor-pointer" 
                title={currentTrack.artist}
                onClick={(e) => {
                  if (currentTrack.artist && currentTrack.artist !== 'Unknown Artist') {
                    e.stopPropagation();
                    usePlayerStore.getState().navigateToArtist(currentTrack.artist);
                  }
                }}
              >
                {currentTrack.artist}
              </span>
              
              {/* High-Res Audio Specs Badge */}
              {usePlayerStore.getState().showAudioSpecs && (
                <div className="flex items-center gap-1.5 mt-1 pointer-events-none">
                  <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    FLAC
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {(currentTrack.sample_rate / 1000).toFixed(1)}kHz / {currentTrack.bit_depth}bit
                  </span>
                </div>
              )}
            </div>
            
            {/* Context Menu Dropdown */}
            {showContextMenu && (
              <div
                className="absolute left-0 bottom-full mb-3 w-48 glass-panel border border-white/10 rounded-xl shadow-2xl py-1 z-50 flex flex-col animate-fade-in"
                onMouseLeave={() => {
                  setShowContextMenu(false);
                  setShowPlaylistSub(false);
                }}
              >
                <button
                  onClick={() => {
                    setInfoModalTrack(currentTrack);
                    setShowContextMenu(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/10 text-left"
                >
                  <Info className="w-3.5 h-3.5 text-blue-400" />
                  Song Info / Details
                </button>
                <button
                  onClick={() => {
                    playNext(currentTrack);
                    setShowContextMenu(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/10 text-left"
                >
                  <Radio className="w-3.5 h-3.5 text-indigo-400" />
                  Play Next
                </button>
                <button
                  onClick={() => {
                    addToQueue(currentTrack);
                    setShowContextMenu(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/10 text-left"
                >
                  <ListPlus className="w-3.5 h-3.5 text-emerald-400" />
                  Add to Queue
                </button>
                
                {/* Add to Playlist submenu */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPlaylistSub(!showPlaylistSub);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/10 text-left w-full"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-purple-400" />
                    Add to Playlist
                  </button>
                  {showPlaylistSub && (
                    <div className="absolute left-full top-0 w-44 glass-panel border border-white/10 rounded-xl shadow-2xl py-1 z-50 flex flex-col ml-1">
                      {playlists.length === 0 ? (
                        <span className="px-3 py-2 text-xs text-zinc-500 italic">No playlists yet</span>
                      ) : (
                        playlists.map((pl) => (
                          <button
                            key={pl.id}
                            onClick={() => {
                              addTrackToPlaylist(pl.id, currentTrack.id);
                              setShowContextMenu(false);
                              setShowPlaylistSub(false);
                            }}
                            className="px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/10 text-left truncate"
                          >
                            {pl.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-zinc-600">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-zinc-500">No track playing</span>
              <span className="text-xs text-zinc-600">Select a song to start listening</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Audio Controls & Material 3 Expressive Seek Bar (Center) */}
      <div className="flex flex-col items-center gap-1.5 w-2/4 max-w-2xl px-4 min-w-0 shrink">
        {/* Playback Buttons */}
        <div className="flex items-center gap-4">
          {/* Shuffle */}
          <button
            onClick={toggleShuffle}
            style={
              shuffleEnabled
                ? {
                    color: 'var(--color-stop-1, #6366f1)',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  }
                : undefined
            }
            className={`p-1.5 rounded-lg transition-all ${
              shuffleEnabled ? '' : 'text-zinc-400 hover:text-white'
            }`}
            title={shuffleEnabled ? 'Shuffle On' : 'Shuffle Off'}
          >
            <Shuffle className="w-4 h-4" />
          </button>

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

          {/* Repeat */}
          <button
            onClick={cycleRepeatMode}
            style={
              repeatMode !== 'off'
                ? {
                    color: 'var(--color-stop-1, #6366f1)',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  }
                : undefined
            }
            className={`p-1.5 rounded-lg transition-all ${
              repeatMode !== 'off' ? '' : 'text-zinc-400 hover:text-white'
            }`}
            title={repeatMode === 'off' ? 'Repeat Off' : repeatMode === 'all' ? 'Repeat All' : 'Repeat One'}
          >
            <RepeatIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Material 3 Expressive Filled Seek Bar with Hover Tooltip */}
        <div className="w-full flex items-center gap-3 text-xs font-mono text-zinc-400">
          <span>{formatTime(currentSeekDisplay)}</span>
          <AudioSlider
            value={currentSeekDisplay}
            min={0}
            max={duration || 100}
            step={0.1}
            onChange={(val) => setDragSeekVal(val)}
            onChangeCommitted={(val) => {
              seek(val);
              setDragSeekVal(null);
            }}
            formatTooltip={(val) => formatTime(val)}
            className="flex-1"
          />
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* 3. Volume & Extra Controls (Right - Responsive & Auto-Shrinking) */}
      <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 w-1/4 shrink min-w-0">
        {/* Queue Drawer Button */}
        <button
          onClick={() => usePlayerStore.setState((s) => ({ isQueueOpen: !s.isQueueOpen }))}
          className="p-1.5 sm:p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all relative shrink-0"
          title="Play Queue"
        >
          <ListMusic className="w-5 h-5" />
          {usePlayerStore.getState().queue.length > 0 && (
            <span
              className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold text-white shadow-md"
              style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
            >
              {usePlayerStore.getState().queue.length}
            </span>
          )}
        </button>

        {/* Sleep Timer Button */}
        <div className="relative shrink-0">
          <button
            onClick={() => setIsTimerModalOpen(!isTimerModalOpen)}
            className={`p-1.5 sm:p-2 rounded-xl transition-all relative ${
              sleepTimer.active ? 'bg-white/10 text-[var(--color-stop-1)] border border-white/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
            title="Sleep Timer"
          >
            <Timer className="w-5 h-5" />
            {sleepTimer.active && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--color-stop-1)] animate-pulse" />
            )}
          </button>
          <SleepTimerModal isOpen={isTimerModalOpen} onClose={() => setIsTimerModalOpen(false)} />
        </div>

        {/* Volume & Karaoke Toggle */}
        <div className="flex items-center gap-2">
          <div ref={volContainerRef} className="hidden sm:flex items-center gap-2 w-32 md:w-44 shrink-0" title="Scroll wheel to adjust volume">
            <button
              onClick={handleMuteToggle}
              className="text-zinc-400 hover:text-white transition-colors p-1 shrink-0"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5" />}
            </button>
            
            <AudioSlider
              value={effectiveVol}
              min={0}
              max={1}
              step={0.01}
              onChange={(val) => {
                setVolume(val);
                if (isMuted) setIsMuted(false);
              }}
              formatTooltip={(val) => `${Math.round(val * 100)}%`}
              className="flex-1 min-w-[30px]"
            />

            {/* Integer Volume Percentage Display / Direct Input */}
            {isEditingVol ? (
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                autoFocus
                value={volInputText}
                onChange={(e) => setVolInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleVolInputSubmit();
                  if (e.key === 'Escape') setIsEditingVol(false);
                }}
                onBlur={handleVolInputSubmit}
                style={{
                  color: 'var(--color-stop-1, #6366f1)',
                  borderColor: 'var(--color-stop-1, #6366f1)',
                }}
                className="w-12 px-1 py-1 text-xs font-mono font-bold text-center bg-zinc-800/80 border-b-2 rounded-t outline-none focus:bg-zinc-800 shrink-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-inner"
              />
            ) : (
              <button
                onClick={() => {
                  setVolInputText(Math.round(effectiveVol * 100).toString());
                  setIsEditingVol(true);
                }}
                style={{ color: 'var(--color-stop-1, #6366f1)' }}
                className="px-1 py-0.5 text-xs font-mono font-bold hover:brightness-125 rounded transition-all min-w-[28px] text-right shrink-0"
                title="Click to type volume"
              >
                {Math.round(effectiveVol * 100)}%
              </button>
            )}
          </div>

          {/* Audio Output Devices & Quality Modal Button */}
          <div className="relative shrink-0">
            <button
              onClick={() => setIsDeviceModalOpen(!isDeviceModalOpen)}
              className={`p-1.5 sm:p-2 rounded-xl transition-all shrink-0 ${
                isDeviceModalOpen
                  ? 'text-white shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
              style={
                isDeviceModalOpen
                  ? {
                      backgroundColor: 'var(--color-stop-1, #6366f1)',
                      boxShadow: '0 0 14px color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
                    }
                  : undefined
              }
              title="Audio Output & Quality"
            >
              <Speaker className="w-5 h-5" />
            </button>
            <AudioDeviceModal
              isOpen={isDeviceModalOpen}
              onClose={() => setIsDeviceModalOpen(false)}
            />
          </div>

          {/* Karaoke / Lyrics Toggle (Moved to far right) */}
          <button
            onClick={() => setShowLyricsFullscreen(!showLyricsFullscreen)}
            className={`p-1.5 sm:p-2 rounded-xl transition-all shrink-0 ${
              showLyricsFullscreen ? 'text-white shadow-md' : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
            style={showLyricsFullscreen ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
            title="Karaoke / Fullscreen Lyrics"
          >
            <Mic2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </footer>
  );
};
