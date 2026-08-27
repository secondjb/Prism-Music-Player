import React from 'react';
import { motion, useAnimation, PanInfo } from 'framer-motion';
import { Play, Pause } from 'lucide-react';
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
      // Swiped left -> next track
      nextTrack();
    } else if (info.offset.x > threshold) {
      // Swiped right -> previous track
      previousTrack();
    }

    // Always snap back
    controls.start({ x: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } });
  };

  return (
    <div className="md:hidden fixed bottom-[64px] left-0 right-0 px-2 pb-2 z-40">
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        animate={controls}
        className="bg-[#2A2A2A] rounded-md flex items-center p-2 shadow-lg overflow-hidden touch-pan-y"
      >
        <div className="w-12 h-12 bg-zinc-800 rounded-sm flex-shrink-0 overflow-hidden">
          {trackArt ? (
            <img src={trackArt} alt="Album Art" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-800">
              <span className="text-zinc-500 text-xs">No Art</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 mx-3 flex flex-col justify-center">
          <p className="text-white text-sm font-bold truncate">
            {currentTrack.title}
          </p>
          <p className="text-zinc-400 text-xs truncate">
            {currentTrack.artist}
          </p>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="w-10 h-10 flex items-center justify-center text-white"
        >
          {isPlaying ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" />}
        </button>
      </motion.div>
    </div>
  );
};
