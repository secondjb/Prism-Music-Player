import React, { useState, useMemo, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import {
  Play,
  ListEnd,
  ListPlus,
  PlusCircle,
  Heart,
  Check,
  X,
  Plus,
  Trash2,
} from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import { Track } from '../types/player';
import { CreatePlaylistModal } from './CreatePlaylistModal';

export const BatchActionPill: React.FC = () => {
  const selectedTrackIds = usePlayerStore((s) => s.selectedTrackIds);
  const clearSelection = usePlayerStore((s) => s.clearSelection);
  const libraryTracks = usePlayerStore((s) => s.tracks);
  const queueTracks = usePlayerStore((s) => s.queue);
  const userQueueTracks = usePlayerStore((s) => s.userQueue);
  const likedTrackIds = usePlayerStore((s) => s.likedTrackIds);
  const playlists = usePlayerStore((s) => s.playlists);
  const activeTab = usePlayerStore((s) => s.activeTab);
  const activePlaylistId = usePlayerStore((s) => s.activePlaylistId);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);
  const addTracksToQueue = usePlayerStore((s) => s.addTracksToQueue);
  const playNextTracks = usePlayerStore((s) => s.playNextTracks);
  const likeMultipleTracks = usePlayerStore((s) => s.likeMultipleTracks);
  const addTracksToPlaylist = usePlayerStore((s) => s.addTracksToPlaylist);
  const removeTracksFromPlaylist = usePlayerStore((s) => s.removeTracksFromPlaylist);
  const createPlaylist = usePlayerStore((s) => s.createPlaylist);

  const [batchQueueAdded, setBatchQueueAdded] = useState(false);
  const [batchNextAdded, setBatchNextAdded] = useState(false);
  const [playlistMenuOpen, setPlaylistMenuOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const playlistButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isViewingPlaylist =
    activeTab === 'playlists' && Boolean(activePlaylistId) && activePlaylistId !== '__liked__';

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

  // Close menu on click outside
  useEffect(() => {
    if (!playlistMenuOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (playlistButtonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setPlaylistMenuOpen(false);
    };

    window.addEventListener('pointerdown', handleOutsideClick);
    return () => {
      window.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, [playlistMenuOpen]);

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
      setTimeout(() => setBatchQueueAdded(false), 1500);
    }
  };

  const handlePlayNext = () => {
    if (selectedTracks.length > 0) {
      playNextTracks(selectedTracks);
      setBatchNextAdded(true);
      setTimeout(() => setBatchNextAdded(false), 1500);
    }
  };

  const handleToggleLike = () => {
    likeMultipleTracks(selectedTrackIds, !allSelectedLiked);
  };

  return (
    <Box
      className="batch-action-bar"
      sx={{
        position: 'fixed',
        bottom: 104,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        bgcolor: 'rgba(18, 18, 24, 0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, rgba(255, 255, 255, 0.15))',
        boxShadow:
          '0 20px 50px -8px rgba(0, 0, 0, 0.85), 0 0 24px color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
        borderRadius: '16px',
        px: 2,
        py: 1.25,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        maxWidth: 'calc(100vw - 2rem)',
        userSelect: 'none',
      }}
    >
      {/* Selection count badge */}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', pr: 1.5, borderRight: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <Box
          sx={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            bgcolor: 'var(--color-stop-1, #6366f1)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontFamily: 'monospace',
            fontWeight: 800,
          }}
        >
          {selectedTrackIds.length}
        </Box>
        <Typography variant="caption" sx={{ color: '#ffffff', fontWeight: 600, fontSize: '12px' }}>
          Selected
        </Typography>
      </Stack>

      {/* Play Button */}
      <Button
        size="small"
        onClick={handlePlay}
        startIcon={<Play size={14} fill="currentColor" />}
        sx={{
          bgcolor: 'var(--color-stop-1, #6366f1)',
          color: '#ffffff',
          borderRadius: '10px',
          px: 1.75,
          py: 0.5,
          fontSize: '12px',
          fontWeight: 700,
          textTransform: 'none',
          boxShadow: '0 4px 14px color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
          '&:hover': {
            bgcolor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 85%, #000000)',
          },
        }}
      >
        Play
      </Button>

      {/* Add to Queue Button */}
      <Button
        size="small"
        onClick={handleQueue}
        startIcon={
          batchQueueAdded ? (
            <Check size={14} style={{ color: '#34d399' }} />
          ) : (
            <ListEnd size={14} style={{ color: 'var(--color-stop-1, #6366f1)' }} />
          )
        }
        sx={{
          bgcolor: batchQueueAdded ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
          color: batchQueueAdded ? '#6ee7b7' : '#ffffff',
          borderRadius: '10px',
          px: 1.5,
          py: 0.5,
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'none',
          '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.15)' },
        }}
      >
        {batchQueueAdded ? 'Queued!' : 'Queue'}
      </Button>

      {/* Play Next Button */}
      <Button
        size="small"
        onClick={handlePlayNext}
        startIcon={
          batchNextAdded ? (
            <Check size={14} style={{ color: '#34d399' }} />
          ) : (
            <ListPlus size={14} style={{ color: 'var(--color-stop-1, #6366f1)' }} />
          )
        }
        sx={{
          bgcolor: batchNextAdded ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
          color: batchNextAdded ? '#6ee7b7' : '#ffffff',
          borderRadius: '10px',
          px: 1.5,
          py: 0.5,
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'none',
          '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.15)' },
        }}
      >
        {batchNextAdded ? 'Next!' : 'Next'}
      </Button>

      {/* Add to Playlist Button with Dropdown Popup */}
      <Box sx={{ position: 'relative' }}>
        <Button
          ref={playlistButtonRef}
          size="small"
          onClick={() => setPlaylistMenuOpen((prev) => !prev)}
          startIcon={<PlusCircle size={14} style={{ color: 'var(--color-stop-1, #6366f1)' }} />}
          sx={{
            bgcolor: playlistMenuOpen ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.08)',
            color: '#ffffff',
            borderRadius: '10px',
            px: 1.5,
            py: 0.5,
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'none',
            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.15)' },
          }}
        >
          Playlist
        </Button>

        {playlistMenuOpen && (
          <div
            ref={menuRef}
            className="context-menu-container absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-52 border rounded-xl p-1.5 flex flex-col gap-0.5 text-xs text-zinc-300 z-50 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 10%, #141416)',
              borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, rgba(255, 255, 255, 0.12))',
              boxShadow: '0 12px 36px -4px rgba(0, 0, 0, 0.7), 0 0 16px color-mix(in srgb, var(--color-stop-1, #6366f1) 18%, transparent)',
              backdropFilter: 'blur(24px)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {isViewingPlaylist && activePlaylistId && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    removeTracksFromPlaylist(activePlaylistId, selectedTrackIds);
                    clearSelection();
                    setPlaylistMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer text-red-400 hover:text-red-300 hover:bg-red-500/15"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove from this Playlist</span>
                </button>
                <div
                  className="border-t my-0.5"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, rgba(255, 255, 255, 0.08))',
                  }}
                />
              </>
            )}

            <div
              className="px-2.5 py-1 text-[10px] font-semibold text-zinc-400 border-b uppercase tracking-wider"
              style={{
                borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, rgba(255, 255, 255, 0.08))',
              }}
            >
              Your Playlists
            </div>

            <div className="max-h-56 overflow-y-auto custom-scrollbar flex flex-col gap-0.5">
              {playlists.length === 0 ? (
                <div className="px-2.5 py-2 text-zinc-500 italic text-[11px]">No playlists yet</div>
              ) : (
                playlists.map((pl) => {
                  const allInPlaylist = selectedTrackIds.every((id) => pl.trackIds.includes(id));
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => {
                        if (allInPlaylist) {
                          removeTracksFromPlaylist(pl.id, selectedTrackIds);
                        } else {
                          addTracksToPlaylist(pl.id, selectedTrackIds);
                        }
                        setPlaylistMenuOpen(false);
                      }}
                      className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer text-zinc-200 hover:text-white hover:bg-white/10"
                    >
                      <span className="truncate pr-2 font-medium">{pl.name}</span>
                      {allInPlaylist && (
                        <span className="flex items-center justify-center shrink-0 w-4 h-4 ml-1.5">
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
            </div>

            <div
              className="border-t my-0.5"
              style={{
                borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, rgba(255, 255, 255, 0.08))',
              }}
            />

            <button
              type="button"
              onClick={() => {
                setPlaylistMenuOpen(false);
                setShowCreateModal(true);
              }}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer font-medium hover:bg-white/10"
              style={{ color: 'var(--color-stop-1, #6366f1)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Playlist...</span>
            </button>
          </div>
        )}
      </Box>

      {/* Remove from active playlist button if viewing one */}
      {isViewingPlaylist && activePlaylistId && (
        <Button
          size="small"
          onClick={() => {
            removeTracksFromPlaylist(activePlaylistId, selectedTrackIds);
            clearSelection();
          }}
          startIcon={<Trash2 size={14} style={{ color: '#f87171' }} />}
          sx={{
            bgcolor: 'rgba(239, 68, 68, 0.15)',
            color: '#f87171',
            borderRadius: '10px',
            px: 1.5,
            py: 0.5,
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'none',
            '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.25)', color: '#ef4444' },
          }}
        >
          Remove
        </Button>
      )}

      {/* Like / Unlike Button */}
      <IconButton
        size="small"
        onClick={handleToggleLike}
        sx={{
          bgcolor: 'rgba(255, 255, 255, 0.08)',
          color: allSelectedLiked ? '#ec4899' : 'var(--color-stop-1, #6366f1)',
          p: 0.75,
          borderRadius: '10px',
          '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.15)' },
        }}
        title={allSelectedLiked ? 'Unlike Selected' : 'Like Selected'}
      >
        <Heart size={16} fill={allSelectedLiked ? '#ec4899' : 'transparent'} />
      </IconButton>

      {/* Clear Selection Button */}
      <IconButton
        size="small"
        onClick={clearSelection}
        sx={{
          color: '#a1a1aa',
          p: 0.75,
          borderRadius: '10px',
          '&:hover': { color: '#ffffff', bgcolor: 'rgba(255, 255, 255, 0.1)' },
        }}
        title="Clear Selection (Esc)"
      >
        <X size={16} />
      </IconButton>

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onConfirm={(name) => {
          createPlaylist(name);
          setTimeout(() => {
            const latest = usePlayerStore.getState().playlists;
            const created = latest.find((p) => p.name === name);
            if (created) {
              addTracksToPlaylist(created.id, selectedTrackIds);
            }
          }, 50);
        }}
      />
    </Box>
  );
};
