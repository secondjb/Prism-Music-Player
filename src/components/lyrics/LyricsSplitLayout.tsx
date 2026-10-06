import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import {
  Mic2,
  Minimize2,
  Shuffle,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Target,
  RefreshCw,
} from 'lucide-react';
import { Track } from '../../types/player';
import { usePlayerStore } from '../../store/usePlayerStore';
import { MarqueeText } from '../MarqueeText';
import { AudioSlider } from '../AudioSlider';
import { LyricsSeekbar } from './LyricsSeekbar';
import { LyricLineRow } from './LyricLineRow';
import { InterludeIndicator } from '../InterludeIndicator';
import { ParsedLyricLine } from '../../utils/lyricsParser';
import { InterludeGap } from './types';

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
  repeatMode: string;
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
}

export const LyricsSplitLayout: React.FC<LyricsSplitLayoutProps> = ({
  currentTrack,
  trackArt,
  setLyricsLayoutMode,
  setShowLyricsFullscreen,
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
  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;

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
                aspectRatio: '1 / 1',
                height: '100%',
                maxHeight: '100%',
                maxWidth: '100%',
                width: 'auto',
                borderRadius: 'clamp(1rem, 2vw, 1.5rem)',
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                userSelect: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '&:hover': {
                  transform: 'scale(1.01)',
                  borderColor: 'rgba(255, 255, 255, 0.25)',
                },
              }}
            >
              {trackArt ? (
                <img
                  src={trackArt}
                  alt={currentTrack.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
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
              maxWidth: 'min(720px, 100%)',
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              pt: 1,
              pb: 0.5,
            }}
          >
            <Stack spacing={0.5} sx={{ minWidth: 0, width: '100%' }}>
              <MarqueeText
                text={currentTrack.title}
                className="font-extrabold text-white text-[clamp(1.2rem,2.4vw,2.2rem)] drop-shadow-md leading-tight"
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
                  fontWeight: 600,
                  color: 'rgb(212 212 216)',
                  fontSize: 'clamp(0.85rem, 1.3vw, 1.1rem)',
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
                    fontSize: 'clamp(0.75rem, 1vw, 0.85rem)',
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
              className="mt-3 sm:mt-4"
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
                  mt: 'clamp(0.35rem, 1.2vh, 0.75rem)',
                  pt: 'clamp(0.35rem, 1.2vh, 0.75rem)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <Stack direction="row" spacing={{ xs: 0.5, sm: 1 }} sx={{ alignItems: 'center' }}>
                  <button
                    onClick={toggleShuffle}
                    style={shuffleEnabled ? { color: 'var(--color-stop-1, #6366f1)' } : undefined}
                    className={`p-[clamp(0.35rem,0.8vw,0.65rem)] rounded-2xl transition-colors hover:bg-white/10 ${
                      shuffleEnabled ? '' : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Shuffle"
                  >
                    <Shuffle className="w-[clamp(1.1rem,1.8vw,1.35rem)] h-[clamp(1.1rem,1.8vw,1.35rem)]" />
                  </button>
                  <button
                    onClick={previousTrack}
                    className="p-[clamp(0.35rem,0.8vw,0.65rem)] text-zinc-400 hover:text-white hover:bg-white/10 rounded-2xl transition-colors"
                    title="Previous"
                  >
                    <SkipBack className="w-[clamp(1.3rem,2.2vw,1.6rem)] h-[clamp(1.3rem,2.2vw,1.6rem)]" />
                  </button>
                  <button
                    onClick={togglePlay}
                    style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
                    className="w-[clamp(2.5rem,4vw,3.5rem)] h-[clamp(2.5rem,4vw,3.5rem)] rounded-full text-white flex items-center justify-center shadow-2xl transition-transform active:scale-95 cursor-pointer shrink-0 hover:scale-105"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <Pause className="w-[clamp(1.2rem,2vw,1.6rem)] h-[clamp(1.2rem,2vw,1.6rem)] fill-white" />
                    ) : (
                      <Play className="w-[clamp(1.2rem,2vw,1.6rem)] h-[clamp(1.2rem,2vw,1.6rem)] fill-white ml-[clamp(0.1rem,0.2vw,0.125rem)]" />
                    )}
                  </button>
                  <button
                    onClick={() => nextTrack()}
                    className="p-[clamp(0.35rem,0.8vw,0.65rem)] text-zinc-400 hover:text-white hover:bg-white/10 rounded-2xl transition-colors"
                    title="Next"
                  >
                    <SkipForward className="w-[clamp(1.3rem,2.2vw,1.6rem)] h-[clamp(1.3rem,2.2vw,1.6rem)]" />
                  </button>
                  <button
                    onClick={cycleRepeatMode}
                    style={repeatMode !== 'off' ? { color: 'var(--color-stop-1, #6366f1)' } : undefined}
                    className={`p-[clamp(0.35rem,0.8vw,0.65rem)] rounded-2xl transition-colors hover:bg-white/10 ${
                      repeatMode !== 'off' ? '' : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Repeat"
                  >
                    <RepeatIcon className="w-[clamp(1.1rem,1.8vw,1.35rem)] h-[clamp(1.1rem,1.8vw,1.35rem)]" />
                  </button>
                </Stack>

                <Box ref={volRefCallback} sx={{ display: 'flex', flexDirection: 'row', gap: 0.5, alignItems: 'center' }}>
                  <button
                    onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
                    className="text-zinc-400 hover:text-white transition-colors p-[clamp(0.2rem,0.6vw,0.45rem)] hover:bg-white/10 rounded-xl"
                    title={volume > 0 ? 'Mute' : 'Unmute'}
                  >
                    {volume > 0 ? (
                      <Volume2 className="w-[clamp(1.1rem,1.8vw,1.35rem)] h-[clamp(1.1rem,1.8vw,1.35rem)]" />
                    ) : (
                      <VolumeX className="w-[clamp(1.1rem,1.8vw,1.35rem)] h-[clamp(1.1rem,1.8vw,1.35rem)] text-rose-400" />
                    )}
                  </button>
                  <AudioSlider
                    value={volume}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(val) => setVolume(val)}
                    formatTooltip={(val) => `${Math.round(val * 100)}%`}
                    size="md"
                    className="w-[clamp(4rem,8.5vw,11rem)]"
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
            className="fixed bottom-10 right-16 z-30 flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-xs font-semibold shadow-xl backdrop-blur-md transition-all border animate-in fade-in slide-in-from-bottom-3 cursor-pointer hover:brightness-110 active:scale-95"
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
    </Box>
  );
};
