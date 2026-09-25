import React, { useState, useRef } from 'react';
import { usePlayerStore, getEffectiveReplayGain } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { Track } from '../types/player';
import { invoke } from '@tauri-apps/api/core';
import {
  ListMusic,
  X,
  Trash2,
  GripVertical,
  Play,
  ChevronDown,
  ChevronRight,
  History,
  ListEnd,
  ListPlus,
  Heart,
  Info,
  PlusCircle,
  Check,
  Plus,
} from 'lucide-react';
import { CreatePlaylistModal } from './CreatePlaylistModal';

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
  onContextMenu?: (e: React.MouseEvent) => void;
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
  onContextMenu,
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
    
    // Create compact pill drag ghost
    const ghost = document.createElement('div');
    ghost.style.position = 'absolute';
    ghost.style.top = '-9999px';
    ghost.style.left = '-9999px';
    ghost.className = 'text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-2xl z-50 border';
    ghost.style.backgroundColor = 'var(--color-stop-1, #6366f1)';
    ghost.style.borderColor = 'var(--color-stop-2, #818cf8)';
    ghost.innerHTML = `<span style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;">🎵 ${track.title}</span>`;

    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 15, 15);
    setTimeout(() => {
      if (document.body.contains(ghost)) {
        document.body.removeChild(ghost);
      }
    }, 0);

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
    <div className="relative my-0.5">
      {/* Insertion line indicator */}
      {isDragOver && (
        <div
          className="absolute -top-1.5 left-0 right-0 h-1 rounded-full z-20 shadow-lg"
          style={{
            backgroundColor: 'var(--color-stop-1, #6366f1)',
            boxShadow: '0 0 10px var(--color-stop-1, #6366f1)',
          }}
        />
      )}
      <div
        ref={rowRef}
        draggable={isDraggable}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        onClick={onPlay}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu?.(e);
        }}
        className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
          isDragging ? 'opacity-30 border-dashed' : ''
        } ${
          isPlaying
            ? 'text-white shadow-md'
            : isDragOver
            ? 'text-white'
            : 'bg-white/5 hover:bg-white/10 border-transparent text-zinc-300'
        }`}
        style={{
          borderColor: isDragging
            ? 'var(--color-stop-1, #6366f1)'
            : isDragOver
            ? 'var(--color-stop-1, #6366f1)'
            : isPlaying
            ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 45%, transparent)'
            : undefined,
          backgroundColor: isPlaying
            ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 22%, transparent)'
            : isDragOver
            ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)'
            : undefined,
        }}
      >
        <div className="flex items-center gap-3 min-w-0 pointer-events-none">
          {isDraggable && (
            <span
              className="text-zinc-500 shrink-0 p-0.5 transition-colors"
              style={{
                color: isDragOver ? 'var(--color-stop-1, #6366f1)' : undefined,
              }}
            >
              <GripVertical className="w-4 h-4" />
            </span>
          )}

          <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-zinc-800 border border-white/10">
            {art ? (
              <img src={art} alt={track.title} className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 30%, transparent)',
                }}
              >
                <Play className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
              </div>
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <span
              className={`text-xs font-semibold truncate ${isPlaying ? 'font-bold' : 'text-white'}`}
              style={{
                color: isPlaying ? 'var(--color-stop-1, #6366f1)' : undefined,
              }}
            >
              {track.title}
            </span>
            <span 
              className="text-[11px] text-zinc-400 truncate hover:underline cursor-pointer pointer-events-auto transition-colors"
              style={{
                color: isPlaying ? 'var(--color-stop-2, #818cf8)' : undefined,
              }}
              onClick={(e) => {
                if (track.artist && track.artist !== 'Unknown Artist') {
                  e.stopPropagation();
                  usePlayerStore.getState().navigateToArtist(track.artist);
                }
              }}
            >
              {track.artist}
            </span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
          title="Remove"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
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
  const likedTrackIds = usePlayerStore((s) => s.likedTrackIds);
  const toggleLikeTrack = usePlayerStore((s) => s.toggleLikeTrack);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const playNext = usePlayerStore((s) => s.playNext);
  const playlists = usePlayerStore((s) => s.playlists);
  const addTracksToPlaylist = usePlayerStore((s) => s.addTracksToPlaylist);
  const createPlaylist = usePlayerStore((s) => s.createPlaylist);
  const setInfoModalTrack = usePlayerStore((s) => s.setInfoModalTrack);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    track: Track;
    source: 'nowPlaying' | 'userQueue' | 'contextQueue' | 'history';
    index?: number;
  } | null>(null);
  const [playlistSubmenuOpen, setPlaylistSubmenuOpen] = useState(false);
  const [newPlaylistTrack, setNewPlaylistTrack] = useState<Track | null>(null);

  const handleContextMenu = (
    e: React.MouseEvent,
    track: Track,
    source: 'nowPlaying' | 'userQueue' | 'contextQueue' | 'history',
    index?: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      track,
      source,
      index,
    });
    setPlaylistSubmenuOpen(false);
  };

  // User Queue drag state
  const [userDraggedIdx, setUserDraggedIdx] = useState<number | null>(null);
  const [userDragOverIdx, setUserDragOverIdx] = useState<number | null>(null);

  // Context Queue drag state
  const [ctxDraggedIdx, setCtxDraggedIdx] = useState<number | null>(null);
  const [ctxDragOverIdx, setCtxDragOverIdx] = useState<number | null>(null);

  const [showPreviousSongs, setShowPreviousSongs] = useState(false);

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
      invoke('play_audio', {
        path: targetTrack.path,
        replayGainDb: getEffectiveReplayGain(
          targetTrack,
          usePlayerStore.getState().replayGainMode,
          usePlayerStore.getState().tracks
        ),
      });
    }
  };

  const handlePlayUpcomingIndex = (offsetIndex: number) => {
    const absoluteIndex = currentIndex + 1 + offsetIndex;
    playIndex(absoluteIndex);
  };

  const totalUpcoming = userQueue.length + upcomingContext.length;
  const userQueueDuration = userQueue.reduce((acc, t) => acc + (t.duration_secs || 0), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 md:w-96 glass-panel border-l border-white/10 shadow-2xl z-50 flex flex-col p-6 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center border shadow-md"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
              borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
              color: 'var(--color-stop-1, #6366f1)',
            }}
          >
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
              onContextMenu={(e) => handleContextMenu(e, currentTrack, 'nowPlaying')}
            />
          </div>
        )}

        {/* Priority User Queue Section ("Next Up") */}
        {userQueue.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: 'var(--color-stop-1, #6366f1)' }}
              >
                Next Up
              </h4>
              <span className="text-xs font-mono font-medium text-zinc-400">
                {formatTotalDuration(userQueueDuration)}
              </span>
            </div>
            <div className="flex flex-col gap-1.5" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}>
              {userQueue.map((track, idx) => (
                <QueueItemRow
                  key={`user-q-${track.id}-${idx}`}
                  track={track}
                  idx={idx}
                  isPlaying={false}
                  onPlay={() => handlePlayUserQueueIndex(idx)}
                  onRemove={() => removeFromUserQueue(idx)}
                  onContextMenu={(e) => handleContextMenu(e, track, 'userQueue', idx)}
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
          <div className="flex flex-col gap-2 flex-1 min-h-0">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Next from Playlist / Album</h4>
              <div
                className="flex-1 overflow-y-auto custom-scrollbar min-h-0"
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              >
                <div className="flex flex-col gap-1.5 w-full relative">
                  {upcomingContext.slice(0, 100).map((track, idx) => (
                        <QueueItemRow
                          key={`ctx-${track.id}-${idx}`}
                          track={track}
                          idx={idx}
                          isPlaying={false}
                          onPlay={() => handlePlayUpcomingIndex(idx)}
                          onRemove={() => {
                            const actualIdx = currentIndex + 1 + idx;
                            const newQ = queue.filter((_, i) => i !== actualIdx);
                            usePlayerStore.setState({ queue: newQ });
                          }}
                          onContextMenu={(e) => handleContextMenu(e, track, 'contextQueue', idx)}
                          onDragStart={handleCtxDragStart}
                          onDragEnter={handleCtxDragEnter}
                          onDrop={handleCtxDrop}
                          onDragEnd={handleCtxDragEnd}
                          isDragging={ctxDraggedIdx === idx}
                          isDragOver={ctxDragOverIdx === idx}
                        />
                  ))}
                  {upcomingContext.length > 100 && (
                    <div className="text-center text-xs text-zinc-500 py-2">
                      + {upcomingContext.length - 100} more tracks
                    </div>
                  )}
                </div>
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
                <History className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
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
                    onContextMenu={(e) => handleContextMenu(e, track, 'history', idx)}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-white/10 cursor-pointer text-zinc-400 hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono text-zinc-500">{idx + 1}</span>
                      <span className="text-xs font-medium truncate">{track.title}</span>
                    </div>
                    <span 
                      className="text-[10px] text-zinc-400 truncate ml-2 hover:underline cursor-pointer pointer-events-auto transition-colors"
                      onClick={(e) => {
                        if (track.artist && track.artist !== 'Unknown Artist') {
                          e.stopPropagation();
                          usePlayerStore.getState().navigateToArtist(track.artist);
                        }
                      }}
                    >
                      {track.artist}
                    </span>
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

      {/* Track Context Menu */}
      {contextMenu && (() => {
        const menuEstimatedHeight =
          contextMenu.source === 'userQueue' || contextMenu.source === 'contextQueue' ? 320 : 270;
        const openUpward = contextMenu.y > window.innerHeight - (menuEstimatedHeight + 60);
        const left = Math.max(16, Math.min(contextMenu.x, window.innerWidth - 240));
        const posStyle: React.CSSProperties = openUpward
          ? {
              bottom: Math.max(16, window.innerHeight - contextMenu.y),
              left,
              transformOrigin: 'bottom left',
            }
          : {
              top: Math.min(contextMenu.y, window.innerHeight - 100),
              left,
              transformOrigin: 'top left',
            };

        const handleItemHover = (e: React.MouseEvent<HTMLElement>, isHover: boolean) => {
          e.currentTarget.style.backgroundColor = isHover
            ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 22%, transparent)'
            : '';
        };

        const isLiked = likedTrackIds.includes(contextMenu.track.id);

        return (
          <div
            className="fixed inset-0 z-[60] pointer-events-auto"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          >
            <div
              style={{
                ...posStyle,
                backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 8%, #141416)',
                borderColor:
                  'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, rgba(255, 255, 255, 0.12))',
                boxShadow:
                  '0 12px 36px -4px rgba(0, 0, 0, 0.7), 0 0 16px color-mix(in srgb, var(--color-stop-1, #6366f1) 18%, transparent)',
                backdropFilter: 'blur(24px)',
              }}
              className="fixed z-[60] w-56 border rounded-xl p-1.5 flex flex-col gap-1 text-xs text-zinc-300 animate-in fade-in zoom-in-95 duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="px-2.5 py-1 text-[11px] font-bold text-zinc-300 border-b truncate"
                style={{
                  borderColor:
                    'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, rgba(255, 255, 255, 0.08))',
                }}
              >
                <span className="truncate">{contextMenu.track.title}</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (contextMenu.source === 'userQueue' && typeof contextMenu.index === 'number') {
                    handlePlayUserQueueIndex(contextMenu.index);
                  } else if (contextMenu.source === 'contextQueue' && typeof contextMenu.index === 'number') {
                    handlePlayUpcomingIndex(contextMenu.index);
                  } else if (contextMenu.source === 'history' && typeof contextMenu.index === 'number') {
                    playIndex(contextMenu.index);
                  } else {
                    usePlayerStore.getState().playTrack(contextMenu.track, queue);
                  }
                  setContextMenu(null);
                }}
                onMouseEnter={(e) => handleItemHover(e, true)}
                onMouseLeave={(e) => handleItemHover(e, false)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
              >
                <Play className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <span>Play Now</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playNext(contextMenu.track);
                  setContextMenu(null);
                }}
                onMouseEnter={(e) => handleItemHover(e, true)}
                onMouseLeave={(e) => handleItemHover(e, false)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
              >
                <ListPlus className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <span>Play Next</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  addToQueue(contextMenu.track);
                  setContextMenu(null);
                }}
                onMouseEnter={(e) => handleItemHover(e, true)}
                onMouseLeave={(e) => handleItemHover(e, false)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
              >
                <ListEnd className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <span>Add to Queue</span>
              </button>

              {/* Add to Playlist with Submenu */}
              <div
                className="relative"
                onMouseEnter={() => setPlaylistSubmenuOpen(true)}
                onMouseLeave={() => setPlaylistSubmenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setPlaylistSubmenuOpen((p) => !p)}
                  onMouseEnter={(e) => handleItemHover(e, true)}
                  onMouseLeave={(e) => handleItemHover(e, false)}
                  className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
                >
                  <div className="flex items-center gap-2.5">
                    <PlusCircle
                      className="w-4 h-4"
                      style={{ color: 'var(--color-stop-1, #6366f1)' }}
                    />
                    <span>Add to Playlist</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 rotate-90 text-zinc-400" />
                </button>

                {playlistSubmenuOpen && (
                  <div
                    style={{
                      backgroundColor:
                        'color-mix(in srgb, var(--color-stop-1, #6366f1) 10%, #141416)',
                      borderColor:
                        'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, rgba(255, 255, 255, 0.12))',
                      boxShadow:
                        '0 12px 36px -4px rgba(0, 0, 0, 0.7), 0 0 16px color-mix(in srgb, var(--color-stop-1, #6366f1) 18%, transparent)',
                      backdropFilter: 'blur(24px)',
                    }}
                    className="absolute top-0 right-full mr-1 w-48 border rounded-xl p-1.5 flex flex-col gap-0.5 text-xs text-zinc-300 z-50 shadow-2xl max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className="px-2 py-1 text-[10px] font-semibold text-zinc-400 border-b uppercase tracking-wider"
                      style={{
                        borderColor:
                          'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, rgba(255, 255, 255, 0.08))',
                      }}
                    >
                      Your Playlists
                    </div>

                    {playlists.length === 0 ? (
                      <div className="px-2 py-2 text-zinc-500 italic text-[11px]">
                        No playlists yet
                      </div>
                    ) : (
                      playlists.map((pl) => {
                        const inPlaylist = pl.trackIds.includes(contextMenu.track.id);
                        return (
                          <button
                            key={pl.id}
                            type="button"
                            onClick={() => {
                              addTracksToPlaylist(pl.id, [contextMenu.track.id]);
                              setContextMenu(null);
                            }}
                            onMouseEnter={(e) => handleItemHover(e, true)}
                            onMouseLeave={(e) => handleItemHover(e, false)}
                            className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer text-zinc-200 hover:text-white"
                          >
                            <span className="truncate pr-2">{pl.name}</span>
                            {inPlaylist && (
                              <span className="flex items-center justify-center shrink-0 w-4 h-4 ml-1.5 translate-y-[0.5px]">
                                <Check
                                  className="w-3.5 h-3.5"
                                  style={{ color: 'var(--color-stop-1, #6366f1)' }}
                                />
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}

                    <div
                      className="border-t my-0.5"
                      style={{
                        borderColor:
                          'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, rgba(255, 255, 255, 0.08))',
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => {
                        setNewPlaylistTrack(contextMenu.track);
                        setContextMenu(null);
                        setPlaylistSubmenuOpen(false);
                      }}
                      onMouseEnter={(e) => handleItemHover(e, true)}
                      onMouseLeave={(e) => handleItemHover(e, false)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer font-medium"
                      style={{ color: 'var(--color-stop-1, #6366f1)' }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Playlist...</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  toggleLikeTrack(contextMenu.track.id);
                  setContextMenu(null);
                }}
                onMouseEnter={(e) => handleItemHover(e, true)}
                onMouseLeave={(e) => handleItemHover(e, false)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
              >
                <Heart
                  className={`w-4 h-4 ${
                    isLiked ? 'fill-pink-500 text-pink-500' : 'text-zinc-400'
                  }`}
                  style={!isLiked ? { color: 'var(--color-stop-1, #6366f1)' } : undefined}
                />
                <span>{isLiked ? 'Unlike' : 'Like'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInfoModalTrack(contextMenu.track);
                  setContextMenu(null);
                }}
                onMouseEnter={(e) => handleItemHover(e, true)}
                onMouseLeave={(e) => handleItemHover(e, false)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
              >
                <Info className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <span>Song Details & Specs</span>
              </button>

              {(contextMenu.source === 'userQueue' || contextMenu.source === 'contextQueue') && (
                <button
                  type="button"
                  onClick={() => {
                    if (contextMenu.source === 'userQueue' && typeof contextMenu.index === 'number') {
                      removeFromUserQueue(contextMenu.index);
                    } else if (contextMenu.source === 'contextQueue' && typeof contextMenu.index === 'number') {
                      const actualIdx = currentIndex + 1 + contextMenu.index;
                      const newQ = queue.filter((_, i) => i !== actualIdx);
                      usePlayerStore.setState({ queue: newQ });
                    }
                    setContextMenu(null);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '';
                  }}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-red-400 border-t mt-1 pt-2"
                  style={{
                    borderColor:
                      'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, rgba(255, 255, 255, 0.08))',
                  }}
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                  <span>Remove from Queue</span>
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        isOpen={Boolean(newPlaylistTrack)}
        onClose={() => setNewPlaylistTrack(null)}
        onConfirm={(playlistName) => {
          if (newPlaylistTrack) {
            const trackId = newPlaylistTrack.id;
            createPlaylist(playlistName);
            setTimeout(() => {
              const latest = usePlayerStore.getState().playlists;
              const created = latest.find((p) => p.name === playlistName);
              if (created) {
                usePlayerStore.getState().addTracksToPlaylist(created.id, [trackId]);
              }
            }, 50);
            setNewPlaylistTrack(null);
          }
        }}
      />
    </div>
  );
};
