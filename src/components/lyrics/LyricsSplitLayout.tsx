import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import {
  Mic2,
  Minimize2,
  Target,
  RefreshCw,
  PictureInPicture2,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Track, RepeatMode } from '../../types/player';
import { usePlayerStore } from '../../store/usePlayerStore';
import { MarqueeText } from '../MarqueeText';
import { LyricsSeekbar } from './LyricsSeekbar';
import { LyricLineRow } from './LyricLineRow';
import { InterludeIndicator } from '../InterludeIndicator';
import { ParsedLyricLine } from '../../utils/lyricsParser';
import { InterludeGap } from './types';
import { PlayerControls } from '../player/PlayerControls';
import { PlayerVolumeControl } from '../player/PlayerVolumeControl';

export interface LyricsSplitLayoutProps {
  currentTrack: Track | null;
  trackArt: string | null;
  setLyricsLayoutMode: (mode: 'centered' | 'split') => void;
  setShowLyricsFullscreen: (show: boolean) => void;
  duration: number;
  isWavySeekbarEnabled: boolean;
  handleSeek: (secs: number, targetIdx?: number) => void;
  controlsVisible: boolean;
  toggleShuffle: () => void;
  shuffleEnabled: boolean;
  previousTrack: () => void;
  togglePlay: () => void;
  isPlaying: boolean;
  nextTrack: () => void;
  cycleRepeatMode: () => void;
  repeatMode: RepeatMode;
  volRefCallback: (node: HTMLDivElement | null) => void;
  setVolume: (vol: number) => void;
  volume: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isScrollbarVisible: boolean;
  isUserScrolled: boolean;
  setIsUserScrolled: (val: boolean) => void;
  scrollToActive: (force?: boolean) => void;
  lastScrolledMaxLineRef: React.MutableRefObject<number>;
  lastScrollTargetRef: React.MutableRefObject<number>;
  lastScrolledInterludeRef: React.MutableRefObject<string | null>;
  isLoading: boolean;
  lines: ParsedLyricLine[];
  activeInterlude: InterludeGap | null;
  activeLineIndices: Set<number>;
  activeIndex: number;
  isCurrentLinePassed: boolean;
  interludeList: InterludeGap[];
  lyricsFontSizePreset: string;
  splitActiveFontSize: number;
  splitInactiveFontSize: number;
  lyricsAnimationStyle: string;
  isRomanizationEnabled: boolean;
  romanizationMode: string;
  isTranslationEnabled: boolean;
  translationMode: string;
  activeLineRef: React.RefObject<HTMLDivElement | null>;
  handleManualRefresh: () => Promise<void>;
  handleClose: () => void;
}

export const LyricsSplitLayout: React.FC<LyricsSplitLayoutProps> = ({
  currentTrack,
  trackArt,
  setLyricsLayoutMode,
  setShowLyricsFullscreen,
  handleClose,
  duration,
  isWavySeekbarEnabled,
  handleSeek,
  controlsVisible,
  toggleShuffle,
  shuffleEnabled,
  previousTrack,
  togglePlay,
  isPlaying,
  nextTrack,
  cycleRepeatMode,
  repeatMode,
  volRefCallback,
  setVolume,
  volume,
  containerRef,
  isScrollbarVisible,
  isUserScrolled,
  setIsUserScrolled,
  scrollToActive,
  lastScrolledMaxLineRef,
  lastScrollTargetRef,
  lastScrolledInterludeRef,
  isLoading,
  lines,
  activeInterlude,
  activeLineIndices,
  activeIndex,
  isCurrentLinePassed,
  interludeList,
  lyricsFontSizePreset,
  splitActiveFontSize,
  splitInactiveFontSize,
  lyricsAnimationStyle,
  isRomanizationEnabled,
  romanizationMode,
  isTranslationEnabled,
  translationMode,
  activeLineRef,
  handleManualRefresh,
}) => {
  const [artAspectRatio, setArtAspectRatio] = useState<number | null>(null);

  const handlePopout = () => {
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      invoke('open_lyrics_popout').catch(() => {});
    }
  };

  useEffect(() => {
    if (!trackArt) {
      setArtAspectRatio(null);
      return;
    }
    const img = new Image();
    img.src = trackArt;
    if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      setArtAspectRatio(img.naturalWidth / img.naturalHeight);
    } else {
      img.onload = () => {
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          setArtAspectRatio(img.naturalWidth / img.naturalHeight);
        }
      };
    }
  }, [trackArt]);

  return (
    <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0, width: '100%', height: '100%', overflow: 'hidden', zIndex: 10 }}>
      {/* Left Column (50%): Dynamic Album Art, Track Info, Seekbar & Controls that never overflow */}
      {currentTrack && (
        <Box
          sx={{
            height: '100%',
            width: '100%',
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: { xs: 2, sm: 4, lg: 6 },
            py: 2,
            overflow: 'hidden',
          }}
        >
          {/* Top / Center Box: Album Artwork (flex: 1, dynamic scale, always strictly 1:1 square) */}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: { xs: 1, sm: 2 },
              overflow: 'hidden',
            }}
          >
            <Box
              onClick={() => setLyricsLayoutMode('centered')}
              className="group"
              sx={{
                position: 'relative',
                aspectRatio: artAspectRatio ? `${artAspectRatio}` : '1 / 1',
                height: '100%',
                maxHeight: '100%',
                maxWidth: '100%',
                width: 'auto',
                borderRadius: 'clamp(1rem, 2vw, 1.5rem)',
                overflow: 'hidden',
                boxShadow: 'none',
                border: 'none',
                outline: 'none',
                userSelect: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backgroundColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '&:hover': {
                  transform: 'scale(1.01)',
                },
              }}
            >
              {trackArt ? (
                <img
                  src={trackArt}
                  alt={currentTrack.title}
                  onLoad={(e) => {
                    const el = e.currentTarget;
                    if (el.naturalWidth > 0 && el.naturalHeight > 0) {
                      setArtAspectRatio(el.naturalWidth / el.naturalHeight);
                    }
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                    borderRadius: 'clamp(1rem, 2vw, 1.5rem)',
                  }}
                />
              ) : (
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    bgcolor: 'rgb(24 24 27)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgb(113 113 122)',
                  }}
                >
                  <Mic2 style={{ width: '4rem', height: '4rem' }} />
                </Box>
              )}

              {/* Hover Overlay Button */}
              <Box
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  bgcolor: 'rgba(0, 0, 0, 0.25)',
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLyricsLayoutMode('centered');
                  }}
                  className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/80 hover:bg-black/95 text-white text-xs font-semibold shadow-2xl border border-white/25 hover:scale-105 active:scale-95 transition-all backdrop-blur-md cursor-pointer"
                  title="Minimize back to Fullscreen View"
                >
                  <Minimize2 className="w-4 h-4 text-indigo-400" />
                  <span>Fullscreen View</span>
                </button>
              </Box>
            </Box>
          </Box>

          {/* Bottom Area: Track Info, Seekbar & Controls (flexShrink: 0 so it never gets cut off) */}
          <Box
            sx={{
              flexShrink: 0,
              width: '100%',
              maxWidth: 'min(860px, 100%)',
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              pt: { xs: 1, sm: 1.5 },
              pb: 0.5,
            }}
          >
            <Stack spacing={0.75} sx={{ minWidth: 0, width: '100%' }}>
              <MarqueeText
                text={currentTrack.title}
                className="font-black text-white text-[clamp(1.6rem,2.8vw,2.75rem)] drop-shadow-lg leading-tight tracking-tight"
              />
              <Box
                component="span"
                onClick={() => {
                  if (currentTrack.artist && currentTrack.artist !== 'Unknown Artist') {
                    setShowLyricsFullscreen(false);
                    usePlayerStore.getState().navigateToArtist(currentTrack.artist);
                  }
                }}
                sx={{
                  fontWeight: 700,
                  color: 'rgb(228 228 231)',
                  fontSize: 'clamp(1.05rem, 1.6vw, 1.4rem)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline', color: 'rgb(129 140 248)' },
                }}
              >
                {currentTrack.artist}
              </Box>
              {currentTrack.album && (
                <Box
                  component="span"
                  onClick={() => {
                    if (currentTrack.album && currentTrack.album !== 'Unknown Album') {
                      setShowLyricsFullscreen(false);
                      usePlayerStore.getState().navigateToAlbum(currentTrack.album);
                    }
                  }}
                  sx={{
                    color: 'rgb(161 161 170)',
                    fontWeight: 500,
                    fontSize: 'clamp(0.9rem, 1.3vw, 1.15rem)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    '&:hover': { textDecoration: 'underline', color: 'rgb(129 140 248)' },
                  }}
                >
                  {currentTrack.album} {currentTrack.year ? `• ${currentTrack.year}` : ''}
                </Box>
              )}
            </Stack>

            {/* Seekbar */}
            <LyricsSeekbar
              duration={duration}
              isWavySeekbarEnabled={isWavySeekbarEnabled}
              onSeek={handleSeek}
              size="lg"
              className="mt-3.5 sm:mt-5"
            />

            {/* Controls */}
            <Box
              sx={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'opacity 0.3s ease',
                opacity: controlsVisible ? 1 : 0,
                pointerEvents: controlsVisible ? 'auto' : 'none',
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mt: 'clamp(0.45rem, 1.4vh, 0.95rem)',
                  pt: 'clamp(0.45rem, 1.4vh, 0.95rem)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <PlayerControls
                  isPlaying={isPlaying}
                  onTogglePlay={togglePlay}
                  onNextTrack={nextTrack}
                  onPreviousTrack={previousTrack}
                  shuffleEnabled={shuffleEnabled}
                  onToggleShuffle={toggleShuffle}
                  repeatMode={repeatMode}
                  onCycleRepeatMode={cycleRepeatMode}
                  size="lg"
                  playButtonColor="primary"
                />

                <Box ref={volRefCallback} sx={{ display: 'flex', alignItems: 'center' }}>
                  <PlayerVolumeControl
                    volume={volume}
                    setVolume={setVolume}
                    width={{ xs: 140, sm: 180, md: 230 }}
                    size="lg"
                    showAlways
                  />
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* Right Column (50%): Scrolling Lyrics */}
      <div
        ref={containerRef}
        style={{ willChange: 'scroll-position' }}
        className={`h-full w-full min-w-0 overflow-y-auto custom-scrollbar ${
          !isScrollbarVisible ? 'scrollbar-hidden' : ''
        } flex flex-col items-center justify-start gap-6 pt-[16vh] pb-[22vh] px-8 sm:px-12 lg:px-16 z-20 relative`}
      >
        {isUserScrolled && lines.length > 0 && lines[0].startSecs !== -1 && (
          <button
            onClick={() => {
              lastScrolledMaxLineRef.current = -1;
              lastScrollTargetRef.current = 0;
              lastScrolledInterludeRef.current = null;
              setIsUserScrolled(false);
              scrollToActive(true);
            }}
            style={{
              background: 'linear-gradient(135deg, var(--color-stop-1, #6366f1), var(--color-stop-2, #818cf8))',
              borderColor: 'color-mix(in srgb, var(--color-stop-2, #818cf8) 60%, white)',
              boxShadow: '0 8px 24px -4px color-mix(in srgb, var(--color-stop-1, #6366f1) 50%, transparent)',
            }}
            className="fixed bottom-10 right-20 z-30 flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-xs font-semibold shadow-xl backdrop-blur-md transition-all border animate-in fade-in slide-in-from-bottom-3 cursor-pointer hover:brightness-110 active:scale-95"
          >
            <Target className="w-4 h-4" />
            <span>Re-sync to music</span>
          </button>
        )}

        {isLoading && lines.length === 0 ? (
          <div className="flex flex-col items-center gap-3 my-auto mx-auto">
            <RefreshCw
              className="w-8 h-8 animate-spin"
              style={{ color: 'var(--color-stop-1, #6366f1)' }}
            />
            <span className="text-sm text-zinc-400 font-medium">Loading synchronized lyrics...</span>
          </div>
        ) : lines.length === 0 ? (
          <div className="flex flex-col items-start gap-3 my-auto max-w-md">
            <Mic2 className="w-12 h-12 text-zinc-600" />
            <h4 className="text-lg font-bold text-white">No lyrics found</h4>
            <p className="text-xs text-zinc-400">
              No synced lyrics were found for this song. Click refresh to search online.
            </p>
            <button
              onClick={handleManualRefresh}
              style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
              className="mt-2 px-4 py-2 rounded-xl text-white text-xs font-semibold transition-colors hover:brightness-110"
            >
              Search Online
            </button>
          </div>
        ) : (
          lines.map((line, idx) => {
            const isUnsynced = line.startSecs === -1;
            const isActive = !isUnsynced && !activeInterlude && activeLineIndices.has(idx);
            const isPast =
              !isActive &&
              ((activeInterlude && idx < activeInterlude.insertIndex) ||
                (!activeInterlude && activeIndex >= 0 && idx < activeIndex) ||
                (idx === activeIndex && !isActive && isCurrentLinePassed));
            const rawDistance = isActive
              ? 0
              : activeInterlude
              ? idx < activeInterlude.insertIndex
                ? Math.abs(activeInterlude.insertIndex - idx)
                : Math.abs(idx - activeInterlude.insertIndex + 1)
              : Math.abs(idx - (activeIndex >= 0 ? activeIndex : 0));
            const distance = Math.min(2, rawDistance);

            const interludeBefore = !isUnsynced
              ? interludeList.find((item) => item.insertIndex === idx)
              : null;

            return (
              <React.Fragment key={line.id}>
                {interludeBefore && (
                  <InterludeIndicator
                    key={interludeBefore.key}
                    id={interludeBefore.key}
                    startSecs={interludeBefore.startSecs}
                    endSecs={interludeBefore.endSecs}
                    isPlaying={isPlaying}
                    isActive={activeInterlude?.key === interludeBefore.key}
                    isPast={activeIndex >= interludeBefore.insertIndex}
                    distance={
                      activeInterlude?.key === interludeBefore.key
                        ? 0
                        : Math.min(2, Math.abs(idx - (activeIndex >= 0 ? activeIndex : 0)))
                    }
                    lyricsFontSizePreset={lyricsFontSizePreset}
                    activeFontSize={splitActiveFontSize}
                    onSeek={handleSeek}
                  />
                )}
                <LyricLineRow
                  line={line}
                  idx={idx}
                  isActive={isActive}
                  isPast={isPast}
                  distance={distance}
                  isUnsynced={isUnsynced}
                  lyricsAnimationStyle={lyricsAnimationStyle}
                  lyricsFontSizePreset={lyricsFontSizePreset}
                  isRomanizationEnabled={isRomanizationEnabled}
                  romanizationMode={romanizationMode}
                  isTranslationEnabled={isTranslationEnabled}
                  translationMode={translationMode}
                  activeFontSize={splitActiveFontSize}
                  inactiveFontSize={splitInactiveFontSize}
                  activeLineRef={activeLineRef}
                  onSeek={handleSeek}
                />
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Pop Out & Exit Lyrics / Karaoke Toggle Buttons (Exact bottom-right corner matching main page bottom bar) */}
      <Box
        sx={{
          position: 'fixed',
          bottom: '22px',
          right: { xs: '16px', sm: '24px' },
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          transition: 'opacity 0.3s ease, transform 0.3s ease',
          opacity: controlsVisible ? 1 : 0,
          transform: controlsVisible ? 'translateY(0)' : 'translateY(10px)',
          pointerEvents: controlsVisible ? 'auto' : 'none',
        }}
      >
        <Tooltip title="Pop Out Lyrics (Mini Player)" arrow>
          <IconButton
            size="small"
            onClick={handlePopout}
            sx={{
              p: 1,
              borderRadius: '12px',
              color: 'rgba(255,255,255,0.85)',
              bgcolor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(12px)',
              transition: 'transform 0.15s ease, background-color 0.15s ease',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.14)',
                transform: 'scale(1.05)',
              },
              '&:active': {
                transform: 'scale(0.95)',
              },
            }}
          >
            <PictureInPicture2 size={20} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Exit Lyrics View" arrow>
          <IconButton
            size="small"
            onClick={handleClose}
            sx={{
              p: 1,
              borderRadius: '12px',
              color: '#ffffff',
              bgcolor: 'var(--color-stop-1, #6366f1)',
              boxShadow: '0 0 14px color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
              transition: 'transform 0.15s ease, filter 0.15s ease',
              '&:hover': {
                bgcolor: 'var(--color-stop-1, #6366f1)',
                filter: 'brightness(1.1)',
                transform: 'scale(1.05)',
              },
              '&:active': {
                transform: 'scale(0.95)',
              },
            }}
          >
            <Mic2 size={20} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};
