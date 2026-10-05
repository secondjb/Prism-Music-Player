import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { Track } from '../types/player';
import {
  Play,
  ListEnd,
  ListPlus,
  PlusCircle,
  Heart,
  Check,
  X,
  Plus,
} from 'lucide-react';
import { CreatePlaylistModal } from './CreatePlaylistModal';

export const BatchActionPill: React.FC = () => {
  const selectedTrackIds = usePlayerStore((s) => s.selectedTrackIds);
  const clearSelection = usePlayerStore((s) => s.clearSelection);
  const libraryTracks = usePlayerStore((s) => s.tracks);
  const queueTracks = usePlayerStore((s) => s.queue);
  const userQueueTracks = usePlayerStore((s) => s.userQueue);
  const likedTrackIds = usePlayerStore((s) => s.likedTrackIds);
  const playlists = usePlayerStore((s) => s.playlists);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);
  const addTracksToQueue = usePlayerStore((s) => s.addTracksToQueue);
  const playNextTracks = usePlayerStore((s) => s.playNextTracks);
  const likeMultipleTracks = usePlayerStore((s) => s.likeMultipleTracks);
  const addTracksToPlaylist = usePlayerStore((s) => s.addTracksToPlaylist);

  const [batchQueueAdded, setBatchQueueAdded] = useState(false);
  const [batchNextAdded, setBatchNextAdded] = useState(false);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const playlistBtnRef = useRef<HTMLButtonElement>(null);

  // Close playlist submenu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        playlistBtnRef.current &&
        !playlistBtnRef.current.contains(e.target as Node)
      ) {
        setShowPlaylistMenu(false);
      }
    };
    if (showPlaylistMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPlaylistMenu]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPlaylistMenu) {
          setShowPlaylistMenu(false);
        } else if (selectedTrackIds.length > 0) {
          clearSelection();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPlaylistMenu, selectedTrackIds.length, clearSelection]);

  const selectedTracks = useMemo(() => {
    const trackMap = new Map<string, Track>();
    libraryTracks.forEach((t) => trackMap.set(t.id, t));
    queueTracks.forEach((t) => trackMap.set(t.id, t));
    userQueueTracks.forEach((t) => trackMap.set(t.id, t));
    return selectedTrackIds
      .map((id) => trackMap.get(id))
      .filter((t): t is Track => Boolean(t));
  }, [selectedTrackIds, libraryTracks, queueTracks, userQueueTracks]);

  const allSelectedLiked = useMemo(() => {
    if (selectedTrackIds.length === 0) return false;
    return selectedTrackIds.every((id) => likedTrackIds.includes(id));
  }, [selectedTrackIds, likedTrackIds]);

  if (selectedTrackIds.length <= 1) {
    return null;
  }

  const handlePlay = () => {
    if (selectedTracks.length > 0) {
      setQueue(selectedTracks);
      playIndex(0);
    }
  };

  const handleQueue = () => {
    if (selectedTracks.length > 0) {
      addTracksToQueue(selectedTracks);
      setBatchQueueAdded(true);
      setTimeout(() => setBatchQueueAdded(false), 1200);
    }
  };

  const handlePlayNext = () => {
    if (selectedTracks.length > 0) {
      playNextTracks(selectedTracks);
      setBatchNextAdded(true);
      setTimeout(() => setBatchNextAdded(false), 1200);
    }
  };

  const handleToggleLike = () => {
    likeMultipleTracks(selectedTrackIds, !allSelectedLiked);
  };

  const handleCreatePlaylistConfirm = (name: string) => {
    const id = `pl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    usePlayerStore.setState((state) => ({
      playlists: [
        ...state.playlists,
        {
          id,
          name,
          trackIds: [...selectedTrackIds],
          createdAt: Date.now(),
        },
      ],
    }));
    setShowCreateModal(false);
    setShowPlaylistMenu(false);
  };

  return (
    <>
      <div
        className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl shadow-2xl border backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-3 duration-150 select-none pointer-events-auto"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 16%, #121216)',
          borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, rgba(255, 255, 255, 0.18))',
          boxShadow:
            '0 14px 40px -4px rgba(0, 0, 0, 0.85), 0 0 24px color-mix(in srgb, var(--color-stop-1, #6366f1) 30%, transparent)',
        }}
      >
        <div className="flex items-center gap-2 pr-2.5 border-r border-white/10 text-xs font-bold text-white">
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
          />
          <span>{selectedTrackIds.length} Songs</span>
        </div>

        <button
          type="button"
          onClick={handlePlay}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer hover:scale-105 active:scale-95"
          title="Play Selection"
        >
          <Play className="w-3.5 h-3.5 fill-current" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
          <span>Play</span>
        </button>

        <button
          type="button"
          onClick={handleQueue}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold ${
            batchQueueAdded
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-white/10 hover:bg-white/20 text-white'
          } transition-all cursor-pointer hover:scale-105 active:scale-95`}
          title={batchQueueAdded ? 'Queued!' : 'Add to Queue'}
        >
          {batchQueueAdded ? (
            <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
          ) : (
            <ListEnd className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
          )}
          <span>{batchQueueAdded ? 'Queued!' : 'Queue'}</span>
        </button>

        <button
          type="button"
          onClick={handlePlayNext}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold ${
            batchNextAdded
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-white/10 hover:bg-white/20 text-white'
          } transition-all cursor-pointer hover:scale-105 active:scale-95`}
          title={batchNextAdded ? 'Added Next!' : 'Play Next'}
        >
          {batchNextAdded ? (
            <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
          ) : (
            <ListPlus className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
          )}
          <span>{batchNextAdded ? 'Next!' : 'Next'}</span>
        </button>

        {/* Playlist Button & Popover */}
        <div className="relative">
          <button
            ref={playlistBtnRef}
            type="button"
            onClick={() => setShowPlaylistMenu(!showPlaylistMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer hover:scale-105 active:scale-95"
            title="Add to Playlist"
          >
            <PlusCircle className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
            <span>Playlist</span>
          </button>

          {showPlaylistMenu && (
            <div
              ref={menuRef}
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 12%, #141416)',
                borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 30%, rgba(255, 255, 255, 0.15))',
                boxShadow:
                  '0 16px 40px -4px rgba(0, 0, 0, 0.85), 0 0 20px color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)',
                backdropFilter: 'blur(24px)',
              }}
              className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 w-52 border rounded-xl p-1.5 z-50 flex flex-col gap-0.5 max-h-60 overflow-y-auto custom-scrollbar shadow-2xl animate-in fade-in zoom-in-95 duration-100"
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
                <div className="px-2 py-2 text-zinc-500 italic text-[11px]">No playlists yet</div>
              ) : (
                playlists.map((pl) => {
                  const allInPlaylist = selectedTrackIds.every((id) => pl.trackIds.includes(id));
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => {
                        addTracksToPlaylist(pl.id, selectedTrackIds);
                        setShowPlaylistMenu(false);
                      }}
                      className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer text-zinc-200 hover:text-white hover:bg-white/10"
                    >
                      <span className="truncate pr-2">{pl.name}</span>
                      {allInPlaylist && (
                        <span className="flex items-center justify-center shrink-0 w-4 h-4 ml-1.5">
                          <Check className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
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
                  setShowCreateModal(true);
                  setShowPlaylistMenu(false);
                }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer font-medium hover:bg-white/10"
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
          onClick={handleToggleLike}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer hover:scale-105 active:scale-95"
          title={allSelectedLiked ? 'Unlike Selected' : 'Like Selected'}
        >
          <Heart
            className={`w-3.5 h-3.5 ${
              allSelectedLiked ? 'fill-pink-500 text-pink-500' : 'text-zinc-300'
            }`}
          />
          <span>{allSelectedLiked ? 'Unlike' : 'Like'}</span>
        </button>

        <button
          type="button"
          onClick={() => clearSelection()}
          className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors ml-0.5 cursor-pointer"
          title="Deselect All (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <CreatePlaylistModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onConfirm={handleCreatePlaylistConfirm}
        title="New Playlist with Selection"
        description={`Create a new playlist containing the ${selectedTrackIds.length} selected tracks.`}
      />
    </>
  );
};
