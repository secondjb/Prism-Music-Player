import React from 'react';
import { motion, useAnimation, PanInfo } from 'framer-motion';
import IconButton from '@mui/material/IconButton';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';

export const SwipeableNowPlaying: React.FC = () => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const previousTrack = usePlayerStore((s) => s.previousTrack);
  
  const trackArt = useTrackArt(currentTrack);
  const controls = useAnimation();

  if (!currentTrack) return null;

  const handleDragEnd = async (
    _e: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const threshold = 100;
    
    if (info.offset.x < -threshold) {
      nextTrack();
    } else if (info.offset.x > threshold) {
      previousTrack();
    }

    controls.start({ x: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } });
  };

  return (
    <div className="md:hidden fixed bottom-[68px] left-2 right-2 z-40">
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        animate={controls}
        className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-700/60 rounded-2xl flex items-center p-2 shadow-2xl overflow-hidden touch-pan-y"
      >
        <div className="w-11 h-11 bg-zinc-800 rounded-xl flex-shrink-0 overflow-hidden shadow-inner">
          {trackArt ? (
            <img src={trackArt} alt="Album Art" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500 text-[10px]">
              No Art
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 mx-3 flex flex-col justify-center">
          <p className="text-white text-xs font-semibold truncate tracking-tight">
            {currentTrack.title}
          </p>
          <p className="text-zinc-400 text-[11px] truncate">
            {currentTrack.artist}
          </p>
        </div>

        <div className="flex items-center gap-0.5">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              previousTrack();
            }}
            sx={{ color: '#a1a1aa', '&:hover': { color: '#ffffff' } }}
          >
            <SkipPreviousIcon fontSize="small" />
          </IconButton>

          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            sx={{
              backgroundColor: '#6366f1',
              color: '#ffffff',
              '&:hover': { backgroundColor: '#4f46e5' },
              width: 36,
              height: 36,
            }}
          >
            {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          </IconButton>

          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              nextTrack();
            }}
            sx={{ color: '#a1a1aa', '&:hover': { color: '#ffffff' } }}
          >
            <SkipNextIcon fontSize="small" />
          </IconButton>
        </div>
      </motion.div>
    </div>
  );
};

