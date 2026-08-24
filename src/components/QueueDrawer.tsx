import React, { useState } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { ListMusic, X, Trash2, GripVertical, Play, ChevronDown, ChevronRight, History } from 'lucide-react';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({ isOpen, onClose }) => {
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const playIndex = usePlayerStore((s) => s.playIndex);
  const clearQueue = usePlayerStore((s) => s.clearQueue);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [showPreviousSongs, setShowPreviousSongs] = useState(false);

  if (!isOpen) return null;

  const previousSongs = queue.slice(0, Math.max(0, currentIndex));

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;

    const updatedQueue = [...queue];
    const [movedItem] = updatedQueue.splice(draggedIdx, 1);
    updatedQueue.splice(targetIdx, 0, movedItem);

    let newCurrentIdx = currentIndex;
    if (currentIndex === draggedIdx) {
      newCurrentIdx = targetIdx;
    } else if (draggedIdx < currentIndex && targetIdx >= currentIndex) {
      newCurrentIdx -= 1;
    } else if (draggedIdx > currentIndex && targetIdx <= currentIndex) {
      newCurrentIdx += 1;
    }

    usePlayerStore.setState({ queue: updatedQueue, currentIndex: newCurrentIdx });
    setDraggedIdx(targetIdx);
  };

  const handleRemoveTrack = (idx: number) => {
    const updatedQueue = queue.filter((_, i) => i !== idx);
    let newIdx = currentIndex;
    if (idx < currentIndex) {
      newIdx -= 1;
    } else if (idx === currentIndex) {
      newIdx = Math.min(currentIndex, updatedQueue.length - 1);
    }
    usePlayerStore.setState({ queue: updatedQueue, currentIndex: newIdx });
  };

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
            <p className="text-xs text-zinc-400">{queue.length} track(s)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {queue.length > 0 && (
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
      <div className="flex-1 overflow-y-auto custom-scrollbar my-4 flex flex-col gap-3">
        {/* Collapsible Previous Songs History Section */}
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

        {/* Current & Upcoming Queue Items */}
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center my-auto text-zinc-500 text-center gap-2">
            <ListMusic className="w-8 h-8 text-zinc-600" />
            <span className="text-xs font-medium">Queue is empty</span>
          </div>
        ) : (
          queue.map((track, idx) => {
            const isPlayingThis = currentTrack?.id === track.id && idx === currentIndex;
            return (
              <div
                key={`${track.id}-${idx}`}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onClick={() => playIndex(idx)}
                className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isPlayingThis
                    ? 'bg-indigo-600/25 border-indigo-500/40 text-white shadow-md'
                    : 'bg-white/5 hover:bg-white/10 border-transparent text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="cursor-grab text-zinc-600 group-hover:text-zinc-400 shrink-0">
                    <GripVertical className="w-4 h-4" />
                  </span>

                  <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-zinc-800 border border-white/10">
                    {track.embedded_art_base64 ? (
                      <img src={track.embedded_art_base64} alt={track.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-indigo-900/60 flex items-center justify-center">
                        <Play className="w-3.5 h-3.5 text-indigo-300" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className={`text-xs font-semibold truncate ${isPlayingThis ? 'text-indigo-400' : 'text-white'}`}>
                      {track.title}
                    </span>
                    <span className="text-[11px] text-zinc-400 truncate">{track.artist}</span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTrack(idx);
                  }}
                  className="p-1 text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
