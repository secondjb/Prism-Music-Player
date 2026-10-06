import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
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
  const [playlistAnchorEl, setPlaylistAnchorEl] = useState<null | HTMLElement>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

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

      {/* Add to Playlist Button */}
      <Button
        size="small"
        onClick={(e) => setPlaylistAnchorEl(e.currentTarget)}
        onMouseEnter={(e) => setPlaylistAnchorEl(e.currentTarget)}
        startIcon={<PlusCircle size={14} style={{ color: 'var(--color-stop-1, #6366f1)' }} />}
        sx={{
          bgcolor: 'rgba(255, 255, 255, 0.08)',
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

      {/* Remove from active playlist if viewing one */}
      {activePlaylistId && activePlaylistId !== '__liked__' && (
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

      {/* Playlist Dropdown Menu */}
      <Menu
        anchorEl={playlistAnchorEl}
        open={Boolean(playlistAnchorEl)}
        onClose={() => setPlaylistAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 200,
              maxHeight: 280,
              p: 0.5,
            },
          },
        }}
      >
        {activePlaylistId && activePlaylistId !== '__liked__' && (
          <>
            <MenuItem
              onClick={() => {
                removeTracksFromPlaylist(activePlaylistId, selectedTrackIds);
                clearSelection();
                setPlaylistAnchorEl(null);
              }}
              sx={{ color: '#f87171', fontSize: '12px', gap: 1 }}
            >
              <Trash2 size={14} />
              <span>Remove from this Playlist</span>
            </MenuItem>
            <Divider sx={{ my: 0.5, borderColor: 'rgba(255, 255, 255, 0.08)' }} />
          </>
        )}

        <Typography
          variant="caption"
          sx={{
            display: 'block',
            px: 1.5,
            py: 0.5,
            fontWeight: 700,
            color: 'text.secondary',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            mb: 0.5,
          }}
        >
          Your Playlists
        </Typography>

        {playlists.length === 0 ? (
          <MenuItem disabled sx={{ fontSize: '11px', color: 'text.secondary', fontStyle: 'italic' }}>
            No playlists yet
          </MenuItem>
        ) : (
          playlists.map((pl) => {
            const allInPlaylist = selectedTrackIds.every((id) => pl.trackIds.includes(id));
            return (
              <MenuItem
                key={pl.id}
                onClick={() => {
                  if (allInPlaylist) {
                    removeTracksFromPlaylist(pl.id, selectedTrackIds);
                  } else {
                    addTracksToPlaylist(pl.id, selectedTrackIds);
                  }
                  setPlaylistAnchorEl(null);
                }}
                sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}
              >
                <Typography noWrap sx={{ fontSize: '12px', flex: 1 }}>
                  {pl.name}
                </Typography>
                {allInPlaylist && (
                  <Check size={14} style={{ color: 'var(--color-stop-1, #6366f1)', flexShrink: 0 }} />
                )}
              </MenuItem>
            );
          })
        )}

        <Divider sx={{ my: 0.5, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

        <MenuItem
          onClick={() => {
            setPlaylistAnchorEl(null);
            setShowCreateModal(true);
          }}
          sx={{ color: 'var(--color-stop-1, #6366f1)', gap: 1 }}
        >
          <Plus size={14} />
          <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>New Playlist...</Typography>
        </MenuItem>
      </Menu>

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
