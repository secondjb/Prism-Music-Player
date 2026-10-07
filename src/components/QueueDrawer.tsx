import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { ListMusic, X, Trash2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { usePlayerStore, getEffectiveReplayGain } from '../store/usePlayerStore';
import { Track } from '../types/player';
import { QueueItemRow } from './queue/QueueItemRow';
import { QueueContextMenu } from './queue/QueueContextMenu';

export interface QueueDrawerProps {
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

export const QueueDrawer: React.FC<QueueDrawerProps> = ({ isOpen, onClose }) => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const userQueue = usePlayerStore((s) => s.userQueue);
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const removeFromUserQueue = usePlayerStore((s) => s.removeFromUserQueue);
  const reorderUserQueue = usePlayerStore((s) => s.reorderUserQueue);
  const reorderContextQueue = usePlayerStore((s) => s.reorderContextQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);
  const clearQueue = usePlayerStore((s) => s.clearQueue);
  const playlists = usePlayerStore((s) => s.playlists);
  const addTrackToPlaylist = usePlayerStore((s) => s.addTrackToPlaylist);
  const createPlaylist = usePlayerStore((s) => s.createPlaylist);
  const likedTrackIds = usePlayerStore((s) => s.likedTrackIds);
  const toggleLikeTrack = usePlayerStore((s) => s.toggleLikeTrack);
  const playNext = usePlayerStore((s) => s.playNext);
  const setInfoModalTrack = usePlayerStore((s) => s.setInfoModalTrack);

  const [draggedType, setDraggedType] = useState<'user' | 'context' | null>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    pos: { top: number; left: number };
    track: Track;
    canRemove: boolean;
    removeAction: () => void;
  } | null>(null);

  const upcomingContext = queue.slice(currentIndex + 1);
  const totalUpcoming = userQueue.length + upcomingContext.length;
  const userQueueDuration = userQueue.reduce((acc, t) => acc + (t.duration_secs || 0), 0);

  const handlePlayUserQueueIndex = (idx: number) => {
    const targetTrack = userQueue[idx];
    if (targetTrack) {
      const remainingUserQueue = userQueue.filter((_, i) => i !== idx);
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

  const handleUserDragStart = (idx: number) => {
    setDraggedType('user');
    setDraggedIdx(idx);
  };

  const handleUserDragEnter = (idx: number) => {
    if (draggedType === 'user') setDragOverIdx(idx);
  };

  const handleUserDragEnd = () => {
    setDraggedType(null);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleUserDrop = (targetIdx: number) => {
    if (draggedType === 'user' && draggedIdx !== null && draggedIdx !== targetIdx) {
      reorderUserQueue(draggedIdx, targetIdx);
    }
    handleUserDragEnd();
  };

  const handleCtxDragStart = (idx: number) => {
    setDraggedType('context');
    setDraggedIdx(idx);
  };

  const handleCtxDragEnter = (idx: number) => {
    if (draggedType === 'context') setDragOverIdx(idx);
  };

  const handleCtxDragEnd = () => {
    setDraggedType(null);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleCtxDrop = (targetIdx: number) => {
    if (draggedType === 'context' && draggedIdx !== null && draggedIdx !== targetIdx) {
      reorderContextQueue(draggedIdx, targetIdx);
    }
    handleCtxDragEnd();
  };

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={onClose}
      slotProps={{
        backdrop: {
          sx: {
            bgcolor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(4px)',
          },
        },
        paper: {
          sx: {
            width: { xs: 320, sm: 380, md: 420 },
            bgcolor: 'rgba(12, 12, 18, 0.88)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 0 50px rgba(0, 0, 0, 0.8)',
            p: 3,
            display: 'flex',
            flexDirection: 'column',
          },
        },
      }}
    >
      {/* Drawer Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 2, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
              color: 'var(--color-stop-1, #6366f1)',
              border: '1px solid color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
            }}
          >
            <ListMusic size={18} />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#ffffff', fontSize: '15px' }}>
              Play Queue
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              {totalUpcoming} track{totalUpcoming !== 1 ? 's' : ''} next
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {(queue.length > 0 || userQueue.length > 0) && (
            <Tooltip title="Clear Queue" arrow>
              <IconButton
                size="small"
                onClick={clearQueue}
                sx={{
                  color: '#a1a1aa',
                  '&:hover': { color: '#fb7185', bgcolor: 'rgba(239, 68, 68, 0.1)' },
                }}
              >
                <Trash2 size={18} />
              </IconButton>
            </Tooltip>
          )}

          <IconButton size="small" onClick={onClose} sx={{ color: '#a1a1aa', '&:hover': { color: '#ffffff' } }}>
            <X size={20} />
          </IconButton>
        </Stack>
      </Box>

      {/* Queue Scrollable Body */}
      <Box sx={{ flex: 1, overflowY: 'auto', my: 2, display: 'flex', flexDirection: 'column', gap: 3 }} className="custom-scrollbar">
        {/* 1. Now Playing Section */}
        {currentTrack && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Now Playing
            </Typography>
            <QueueItemRow
              track={currentTrack}
              idx={-1}
              isPlaying
              onPlay={() => {}}
              onRemove={() => {}}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({
                  pos: { top: e.clientY, left: e.clientX },
                  track: currentTrack,
                  canRemove: false,
                  removeAction: () => {},
                });
              }}
            />
          </Box>
        )}

        {/* 2. Priority User Queue Section ("Next Up") */}
        {userQueue.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--color-stop-1, #6366f1)',
                }}
              >
                Next Up
              </Typography>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                {formatTotalDuration(userQueueDuration)}
              </Typography>
            </Stack>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {userQueue.map((t, idx) => (
                <QueueItemRow
                  key={`user-q-${t.id}-${idx}`}
                  track={t}
                  idx={idx}
                  isPlaying={false}
                  onPlay={() => handlePlayUserQueueIndex(idx)}
                  onRemove={() => removeFromUserQueue(idx)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      pos: { top: e.clientY, left: e.clientX },
                      track: t,
                      canRemove: true,
                      removeAction: () => removeFromUserQueue(idx),
                    });
                  }}
                  onDragStart={handleUserDragStart}
                  onDragEnter={handleUserDragEnter}
                  onDragEnd={handleUserDragEnd}
                  onDrop={handleUserDrop}
                  isDragging={draggedType === 'user' && draggedIdx === idx}
                  isDragOver={draggedType === 'user' && dragOverIdx === idx}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* 3. Upcoming Context Queue Section */}
        {upcomingContext.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minHeight: 0 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Next from Playlist / Album
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {upcomingContext.slice(0, 100).map((t, idx) => (
                <QueueItemRow
                  key={`ctx-${t.id}-${idx}`}
                  track={t}
                  idx={idx}
                  isPlaying={false}
                  onPlay={() => handlePlayUpcomingIndex(idx)}
                  onRemove={() => {
                    const actualIdx = currentIndex + 1 + idx;
                    const newQ = queue.filter((_, i) => i !== actualIdx);
                    usePlayerStore.setState({ queue: newQ });
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      pos: { top: e.clientY, left: e.clientX },
                      track: t,
                      canRemove: true,
                      removeAction: () => {
                        const actualIdx = currentIndex + 1 + idx;
                        const newQ = queue.filter((_, i) => i !== actualIdx);
                        usePlayerStore.setState({ queue: newQ });
                      },
                    });
                  }}
                  onDragStart={handleCtxDragStart}
                  onDragEnter={handleCtxDragEnter}
                  onDragEnd={handleCtxDragEnd}
                  onDrop={handleCtxDrop}
                  isDragging={draggedType === 'context' && draggedIdx === idx}
                  isDragOver={draggedType === 'context' && dragOverIdx === idx}
                />
              ))}
            </Box>
          </Box>
        )}
      </Box>

      {/* Queue Context Menu */}
      <QueueContextMenu
        anchorPosition={contextMenu ? contextMenu.pos : null}
        onClose={() => setContextMenu(null)}
        track={contextMenu ? contextMenu.track : null}
        isLiked={contextMenu ? likedTrackIds.includes(contextMenu.track.id) : false}
        onToggleLike={toggleLikeTrack}
        playlists={playlists}
        onAddToPlaylist={addTrackToPlaylist}
        onCreatePlaylist={() => {
          const name = window.prompt('Create new playlist:');
          if (name && name.trim()) {
            createPlaylist(name.trim());
          }
        }}
        onPlayNow={() => {
          if (contextMenu) {
            usePlayerStore.getState().playTrack(contextMenu.track);
          }
        }}
        onPlayNext={() => {
          if (contextMenu) {
            playNext(contextMenu.track);
          }
        }}
        onRemove={() => {
          if (contextMenu) {
            contextMenu.removeAction();
          }
        }}
        onOpenDetails={() => {
          if (contextMenu) {
            setInfoModalTrack(contextMenu.track);
          }
        }}
        canRemove={contextMenu ? contextMenu.canRemove : false}
      />
    </Drawer>
  );
};
