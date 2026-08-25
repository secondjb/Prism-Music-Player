import React, { useState, useRef } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { Track } from '../types/player';
import { invoke } from '@tauri-apps/api/core';
import { ListMusic, X, Trash2, GripVertical, Play, ChevronDown, ChevronRight, History } from 'lucide-react';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatTotalDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
};

const QueueItemRow: React.FC<{
  track: Track;
  idx: number;
  isPlaying: boolean;
  onPlay: () => void;
  onRemove: () => void;
  onDragStart?: (idx: number) => void;
  onDragEnter?: (idx: number) => void;
  onDragEnd?: () => void;
  onDrop?: (targetIdx: number) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
}> = ({
  track,
  idx,
  isPlaying,
  onPlay,
  onRemove,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
  isDragging,
  isDragOver,
}) => {
  const art = useTrackArt(track);
  const isDraggable = Boolean(onDragStart);
  const rowRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent) => {
    if (!onDragStart) return;
    // Set drag image to the entire row for a clean look
    if (rowRef.current) {
      e.dataTransfer.setDragImage(rowRef.current, 0, 0);
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
    onDragStart(idx);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (onDragEnter) onDragEnter(idx);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (onDrop) onDrop(idx);
  };

  const handleDragEnd = () => {
    if (onDragEnd) onDragEnd();
  };

  return (
    <div
      ref={rowRef}
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      onClick={onPlay}
      className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
        isDragging ? 'opacity-40 border-dashed border-indigo-400' : ''
      } ${
        isDragOver ? 'bg-indigo-600/30 border-indigo-400 scale-[1.02]' : ''
      } ${
        isPlaying
          ? 'bg-indigo-600/25 border-indigo-500/40 text-white shadow-md'
          : 'bg-white/5 hover:bg-white/10 border-transparent text-zinc-300'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {isDraggable && (
          <span
            className="cursor-grab active:cursor-grabbing text-zinc-500 group-hover:text-indigo-400 shrink-0 p-0.5 transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4" />
          </span>
        )}

        <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-zinc-800 border border-white/10">
          {art ? (
            <img src={art} alt={track.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-indigo-900/60 flex items-center justify-center">
              <Play className="w-3.5 h-3.5 text-indigo-300" />
            </div>
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <span className={`text-xs font-semibold truncate ${isPlaying ? 'text-indigo-400' : 'text-white'}`}>
            {track.title}
          </span>
          <span className="text-[11px] text-zinc-400 truncate">{track.artist}</span>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="p-1 text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export const QueueDrawer: React.FC<QueueDrawerProps> = ({ isOpen, onClose }) => {
  const queue = usePlayerStore((s) => s.queue);
  const userQueue = usePlayerStore((s) => s.userQueue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const playIndex = usePlayerStore((s) => s.playIndex);
  const clearQueue = usePlayerStore((s) => s.clearQueue);
  const removeFromUserQueue = usePlayerStore((s) => s.removeFromUserQueue);
  const reorderUserQueue = usePlayerStore((s) => s.reorderUserQueue);
  const reorderContextQueue = usePlayerStore((s) => s.reorderContextQueue);

  // User Queue drag state
  const [userDraggedIdx, setUserDraggedIdx] = useState<number | null>(null);
  const [userDragOverIdx, setUserDragOverIdx] = useState<number | null>(null);

  // Context Queue drag state
  const [ctxDraggedIdx, setCtxDraggedIdx] = useState<number | null>(null);
  const [ctxDragOverIdx, setCtxDragOverIdx] = useState<number | null>(null);

  const [showPreviousSongs, setShowPreviousSongs] = useState(false);

  if (!isOpen) return null;

  const previousSongs = queue.slice(0, Math.max(0, currentIndex));
  const upcomingContext = queue.slice(Math.max(0, currentIndex + 1));

  // User Queue Drag Handlers
  const handleUserDragStart = (idx: number) => {
    setUserDraggedIdx(idx);
  };

  const handleUserDragEnter = (idx: number) => {
    if (userDraggedIdx !== null && userDraggedIdx !== idx) {
      setUserDragOverIdx(idx);
    }
  };

  const handleUserDrop = (targetIdx: number) => {
    if (userDraggedIdx !== null && userDraggedIdx !== targetIdx) {
      reorderUserQueue(userDraggedIdx, targetIdx);
    }
    setUserDraggedIdx(null);
    setUserDragOverIdx(null);
  };

  const handleUserDragEnd = () => {
    setUserDraggedIdx(null);
    setUserDragOverIdx(null);
  };

  // Context Queue Drag Handlers
  const handleCtxDragStart = (idx: number) => {
    setCtxDraggedIdx(idx);
  };

  const handleCtxDragEnter = (idx: number) => {
    if (ctxDraggedIdx !== null && ctxDraggedIdx !== idx) {
      setCtxDragOverIdx(idx);
    }
  };

  const handleCtxDrop = (targetIdx: number) => {
    if (ctxDraggedIdx !== null && ctxDraggedIdx !== targetIdx) {
      reorderContextQueue(ctxDraggedIdx, targetIdx);
    }
    setCtxDraggedIdx(null);
    setCtxDragOverIdx(null);
  };

  const handleCtxDragEnd = () => {
    setCtxDraggedIdx(null);
    setCtxDragOverIdx(null);
  };

  const handlePlayUserQueueIndex = (index: number) => {
    const targetTrack = userQueue[index];
    if (targetTrack) {
      const remainingUserQueue = userQueue.filter((_, i) => i !== index);
      usePlayerStore.setState({
        userQueue: remainingUserQueue,
        currentTrack: targetTrack,
        duration: targetTrack.duration_secs,
        currentTime: 0,
        isPlaying: true,
      });
      invoke('play_audio', { path: targetTrack.path, replayGainDb: targetTrack.replay_gain_db || 0 });
    }
  };

  const handlePlayUpcomingIndex = (offsetIndex: number) => {
    const absoluteIndex = currentIndex + 1 + offsetIndex;
    playIndex(absoluteIndex);
  };

  const totalUpcoming = userQueue.length + upcomingContext.length;
  const userQueueDuration = userQueue.reduce((acc, t) => acc + (t.duration_secs || 0), 0);

  return (
    <div className="fixed inset-y-0 right-0 w-80 md:w-96 glass-panel border-l border-white/10 shadow-2xl z-50 flex flex-col p-6 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <ListMusic className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Play Queue</h3>
            <p className="text-xs text-zinc-400">{totalUpcoming} track(s) next</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(queue.length > 0 || userQueue.length > 0) && (
            <button
              onClick={clearQueue}
              className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-white/10 text-xs font-semibold flex items-center gap-1 transition-colors"
              title="Clear Queue"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Queue Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar my-4 flex flex-col gap-5">
        {/* Now Playing Section */}
        {currentTrack && (
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Now Playing</h4>
            <QueueItemRow
              track={currentTrack}
              idx={-1}
              isPlaying={true}
              onPlay={() => {}}
              onRemove={() => {}}
            />
          </div>
        )}

        {/* Priority User Queue Section ("Next Up") */}
        {userQueue.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                Next Up
              </h4>
              <span className="text-xs font-mono font-medium text-zinc-400">
                {formatTotalDuration(userQueueDuration)}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {userQueue.map((track, idx) => (
                <QueueItemRow
                  key={`user-q-${track.id}-${idx}`}
                  track={track}
                  idx={idx}
                  isPlaying={false}
                  onPlay={() => handlePlayUserQueueIndex(idx)}
                  onRemove={() => removeFromUserQueue(idx)}
                  onDragStart={handleUserDragStart}
                  onDragEnter={handleUserDragEnter}
                  onDrop={handleUserDrop}
                  onDragEnd={handleUserDragEnd}
                  isDragging={userDraggedIdx === idx}
                  isDragOver={userDragOverIdx === idx}
                />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Context Queue Section */}
        {upcomingContext.length > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Next from Playlist / Album</h4>
            <div className="flex flex-col gap-1.5">
              {upcomingContext.map((track, idx) => (
                <QueueItemRow
                  key={`ctx-q-${track.id}-${idx}`}
                  track={track}
                  idx={idx}
                  isPlaying={false}
                  onPlay={() => handlePlayUpcomingIndex(idx)}
                  onRemove={() => {
                    const actualIdx = currentIndex + 1 + idx;
                    const newQ = queue.filter((_, i) => i !== actualIdx);
                    usePlayerStore.setState({ queue: newQ });
                  }}
                  onDragStart={handleCtxDragStart}
                  onDragEnter={handleCtxDragEnter}
                  onDrop={handleCtxDrop}
                  onDragEnd={handleCtxDragEnd}
                  isDragging={ctxDraggedIdx === idx}
                  isDragOver={ctxDragOverIdx === idx}
                />
              ))}
            </div>
          </div>
        )}

        {/* Previous Songs History Section */}
        {previousSongs.length > 0 && (
          <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            <button
              onClick={() => setShowPreviousSongs(!showPreviousSongs)}
              className="w-full flex items-center justify-between p-3 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-400" />
                <span>Previous Songs ({previousSongs.length})</span>
              </div>
              {showPreviousSongs ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {showPreviousSongs && (
              <div className="flex flex-col gap-1 p-2 pt-0 border-t border-white/5 max-h-48 overflow-y-auto custom-scrollbar">
                {previousSongs.map((track, idx) => (
                  <div
                    key={`prev-${track.id}-${idx}`}
                    onClick={() => playIndex(idx)}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-white/10 cursor-pointer text-zinc-400 hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono text-zinc-500">{idx + 1}</span>
                      <span className="text-xs font-medium truncate">{track.title}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 truncate ml-2">{track.artist}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!currentTrack && userQueue.length === 0 && queue.length === 0 && (
          <div className="flex flex-col items-center justify-center my-auto text-zinc-500 text-center gap-2">
            <ListMusic className="w-8 h-8 text-zinc-600" />
            <span className="text-xs font-medium">Queue is empty</span>
          </div>
        )}
      </div>
    </div>
  );
};
