import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Mic2,
  Columns2,
  ChevronLeft,
  ChevronRight,
  Target,
  RefreshCw,
} from 'lucide-react';
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

export interface LyricsCenteredLayoutProps {
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
  activeFontSize: number;
  inactiveFontSize: number;
  lyricsAnimationStyle: string;
  isRomanizationEnabled: boolean;
  romanizationMode: string;
  isTranslationEnabled: boolean;
  translationMode: string;
  activeLineRef: React.RefObject<HTMLDivElement | null>;
  handleManualRefresh: () => Promise<void>;
  handleClose: () => void;
  isCompact: boolean;
}

export const LyricsCenteredLayout: React.FC<LyricsCenteredLayoutProps> = ({
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
  activeFontSize,
  inactiveFontSize,
  lyricsAnimationStyle,
  isRomanizationEnabled,
  romanizationMode,
  isTranslationEnabled,
  translationMode,
  activeLineRef,
  handleManualRefresh,
  handleClose,
  isCompact,
}) => {
  const [artExpanded, setArtExpanded] = useState(false);

  return (
    <>
      {/* Main Lyrics Display Area */}
      <div
        ref={containerRef}
        style={{ willChange: 'scroll-position' }}
        className={`flex-1 overflow-y-auto my-4 px-8 sm:px-16 lg:px-24 custom-scrollbar ${
          !isScrollbarVisible ? 'scrollbar-hidden' : ''
        } flex flex-col items-center justify-start gap-6 pt-[30vh] pb-[30vh] z-20 relative`}
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
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-xs font-semibold shadow-xl backdrop-blur-md transition-all border animate-in fade-in slide-in-from-bottom-3 cursor-pointer hover:brightness-110 active:scale-95"
          >
            <Target className="w-4 h-4" />
            <span>Re-sync to music</span>
          </button>
        )}

        {isLoading && lines.length === 0 ? (
          <div className="flex flex-col items-center gap-3 my-auto">
            <RefreshCw
              className="w-8 h-8 animate-spin"
              style={{ color: 'var(--color-stop-1, #6366f1)' }}
            />
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
                    activeFontSize={activeFontSize}
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
                  activeFontSize={activeFontSize}
                  inactiveFontSize={inactiveFontSize}
                  activeLineRef={activeLineRef}
                  onSeek={handleSeek}
                />
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Track Info & Expandable Album Art */}
      {currentTrack && (
        <div
          className={`fixed z-40 flex items-end gap-4 pointer-events-auto select-none transition-all duration-300 max-w-[calc(100vw-80px)] md:max-w-[calc(100vw-350px)] ${
            isCompact ? 'top-16 left-6' : 'bottom-8 left-8'
          }`}
        >
          <div
            onClick={() => setArtExpanded(!artExpanded)}
            className={`relative rounded-2xl overflow-hidden shrink-0 group cursor-pointer transition-all duration-300 bg-transparent ${
              artExpanded
                ? isCompact
                  ? 'w-48 h-48 max-w-[40vh] max-h-[40vh]'
                  : 'w-80 h-80 max-w-[45vh] max-h-[45vh]'
                : isCompact
                ? 'w-14 h-14'
                : 'w-20 h-20'
            }`}
          >
            {trackArt ? (
              <img src={trackArt} alt={currentTrack.title} className="w-full h-full object-contain rounded-2xl" />
            ) : (
              <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-500">
                <Mic2 className="w-8 h-8" />
              </div>
            )}
            {artExpanded ? (
              <>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLyricsLayoutMode('split');
                    }}
                    className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/80 hover:bg-black/95 text-white text-xs font-semibold shadow-2xl border border-white/25 hover:scale-105 active:scale-95 transition-all backdrop-blur-md cursor-pointer group/btn"
                    title="Enter Immersive View"
                  >
                    <Columns2 className="w-4 h-4 text-indigo-400 group-hover/btn:text-white transition-colors" />
                    <span>Immersive View</span>
                  </button>
                </div>
                <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-1.5 pointer-events-none">
                  <ChevronLeft className="w-4 h-4 text-white" />
                </div>
              </>
            ) : (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-2">
                  <ChevronRight className="w-5 h-5 text-white" />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col min-w-0 flex-1 mb-1">
            <MarqueeText
              text={currentTrack.title}
              className={`font-extrabold text-white drop-shadow-lg transition-all ${
                artExpanded ? 'text-xl md:text-3xl' : 'text-base md:text-lg'
              }`}
            />
            <span
              className={`font-medium text-zinc-300 truncate mt-0.5 transition-all cursor-pointer hover:underline hover:text-indigo-400 ${
                artExpanded ? 'text-sm md:text-lg' : 'text-xs md:text-sm'
              }`}
              onClick={(e) => {
                if (currentTrack.artist && currentTrack.artist !== 'Unknown Artist') {
                  e.stopPropagation();
                  setShowLyricsFullscreen(false);
                  usePlayerStore.getState().navigateToArtist(currentTrack.artist);
                }
              }}
            >
              {currentTrack.artist}
            </span>
            {currentTrack.album && (
              <span
                className={`text-zinc-400 truncate mt-0.5 transition-all cursor-pointer hover:underline hover:text-indigo-400 ${
                  artExpanded ? 'text-xs md:text-sm' : 'text-[11px]'
                }`}
                onClick={(e) => {
                  if (currentTrack.album && currentTrack.album !== 'Unknown Album') {
                    e.stopPropagation();
                    setShowLyricsFullscreen(false);
                    usePlayerStore.getState().navigateToAlbum(currentTrack.album);
                  }
                }}
              >
                {currentTrack.album}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Floating Glass Transport Controls (Bottom-Center, Responsive) */}
      <motion.div
        animate={{
          opacity: controlsVisible ? 1 : 0,
          y: controlsVisible ? 0 : 20,
        }}
        transition={{ duration: 0.3 }}
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 glass-panel border border-white/10 rounded-full px-5 py-2 shadow-2xl flex items-center justify-center gap-3 sm:gap-4 md:gap-5 overflow-visible ${
          controlsVisible ? 'pointer-events-auto' : 'pointer-events-none'
        } ${isCompact ? 'max-w-[94vw] overflow-x-auto custom-scrollbar' : 'max-w-[min(72rem,calc(100vw-4rem))]'}`}
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
          size={isCompact ? 'sm' : 'md'}
          playButtonColor="primary"
        />

        {/* Seek Bar inside floating pill - Expanded horizontally when space allows */}
        <LyricsSeekbar
          duration={duration}
          isWavySeekbarEnabled={isWavySeekbarEnabled}
          onSeek={handleSeek}
          className={`flex items-center gap-2.5 text-xs font-mono text-zinc-400 min-w-0 ${
            isCompact
              ? 'w-48 sm:w-72 max-w-[50vw]'
              : 'w-64 sm:w-96 md:w-[32rem] lg:w-[44rem] xl:w-[54rem] max-w-[min(56rem,calc(100vw-28rem))]'
          }`}
          active={controlsVisible}
        />

        {/* Integrated Volume control when space is compact */}
        {isCompact && (
          <div ref={volRefCallback} className="flex items-center pl-2 border-l border-white/10 shrink-0">
            <PlayerVolumeControl
              volume={volume}
              setVolume={setVolume}
              width={130}
              showAlways
              showNumericInput={false}
            />
          </div>
        )}

        {/* Exit Lyrics Button (Mobile/Compact Only) */}
        {isCompact && (
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl hover:text-white hover:bg-white/10 transition-colors shrink-0"
            style={{ color: 'var(--color-stop-1, #6366f1)' }}
            title="Exit Karaoke View"
          >
            <Mic2 className="w-5 h-5" />
          </button>
        )}
      </motion.div>

      {/* Floating Glass Volume & Lyrics Toggle Pill (Bottom-Right) */}
      {!isCompact && (
        <motion.div
          animate={{
            opacity: controlsVisible ? 1 : 0,
            y: controlsVisible ? 0 : 20,
          }}
          transition={{ duration: 0.3 }}
          className={`fixed bottom-6 right-8 z-40 glass-panel border border-white/10 rounded-full px-4 py-2 shadow-2xl flex items-center gap-3 ${
            controlsVisible ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          <div ref={volRefCallback}>
            <PlayerVolumeControl
              volume={volume}
              setVolume={setVolume}
              width={{ xs: 120, sm: 140, md: 160 }}
              showAlways
            />
          </div>
          {/* Exit Lyrics Button aligned in exact bottom-right position as main player bar */}
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-white transition-all hover:scale-105 active:scale-95 shrink-0"
            style={{
              backgroundColor: 'var(--color-stop-1, #6366f1)',
              boxShadow: '0 0 14px color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
            }}
            title="Exit Karaoke / Lyrics View"
          >
            <Mic2 className="w-5 h-5" />
          </button>
        </motion.div>
      )}
    </>
  );
};
