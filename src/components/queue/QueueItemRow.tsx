import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { Play, X, GripVertical, Music } from 'lucide-react';
import { Track } from '../../types/player';
import { useTrackArt } from '../../utils/useTrackArt';

export interface QueueItemRowProps {
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
}

const formatDuration = (seconds?: number): string => {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const QueueItemRow: React.FC<QueueItemRowProps> = ({
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
  const art = useTrackArt(track, { thumbnail: true, maxSize: 128 });
  const isDraggable = Boolean(onDragStart);

  const handleDragStart = (e: React.DragEvent) => {
    if (!onDragStart) return;

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

  return (
    <Box sx={{ position: 'relative', my: 0.25 }}>
      {/* Insertion line indicator */}
      {isDragOver && (
        <Box
          sx={{
            position: 'absolute',
            top: -3,
            left: 0,
            right: 0,
            height: 3,
            borderRadius: '9999px',
            zIndex: 20,
            bgcolor: 'var(--color-stop-1, #6366f1)',
            boxShadow: '0 0 10px var(--color-stop-1, #6366f1)',
          }}
        />
      )}

      <Box
        draggable={isDraggable}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={onDragEnd}
        onContextMenu={onContextMenu}
        onClick={isPlaying ? undefined : onPlay}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1,
          borderRadius: '10px',
          cursor: isPlaying ? 'default' : 'pointer',
          opacity: isDragging ? 0.4 : 1,
          bgcolor: isPlaying
            ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)'
            : 'transparent',
          border: '1px solid',
          borderColor: isPlaying ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)' : 'transparent',
          transition: 'background-color 0.15s ease',
          '&:hover': {
            bgcolor: isPlaying
              ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)'
              : 'rgba(255, 255, 255, 0.05)',
            '& .queue-play-btn': { opacity: 1 },
            '& .queue-remove-btn': { opacity: 1 },
          },
        }}
      >
        {/* Drag handle */}
        {isDraggable && (
          <Box
            sx={{
              color: '#52525b',
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              '&:hover': { color: '#ffffff' },
            }}
          >
            <GripVertical size={14} />
          </Box>
        )}

        {/* Thumbnail Artwork */}
        <Box
          sx={{
            position: 'relative',
            width: 38,
            height: 38,
            borderRadius: '8px',
            overflow: 'hidden',
            bgcolor: '#18181b',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            flexShrink: 0,
          }}
        >
          {art ? (
            <Box component="img" src={art} alt={track.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Music size={16} className="text-zinc-600" />
            </Box>
          )}

          {!isPlaying && (
            <Box
              className="queue-play-btn"
              onClick={(e) => {
                e.stopPropagation();
                onPlay();
              }}
              sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: 'rgba(0, 0, 0, 0.55)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                transition: 'opacity 0.15s ease',
              }}
            >
              <Play size={16} fill="#ffffff" />
            </Box>
          )}
        </Box>

        {/* Title & Artist */}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            noWrap
            variant="body2"
            sx={{
              fontSize: '12px',
              fontWeight: 600,
              color: isPlaying ? 'var(--color-stop-1, #6366f1)' : '#ffffff',
            }}
          >
            {track.title}
          </Typography>
          <Typography noWrap variant="caption" sx={{ fontSize: '11px', color: '#a1a1aa' }}>
            {track.artist || 'Unknown Artist'}
          </Typography>
        </Box>

        {/* Duration & Remove Button */}
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
          <Typography variant="caption" sx={{ fontSize: '11px', fontFamily: 'monospace', color: '#71717a' }}>
            {formatDuration(track.duration_secs)}
          </Typography>

          {!isPlaying && (
            <IconButton
              size="small"
              className="queue-remove-btn"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              sx={{
                p: 0.5,
                color: '#71717a',
                opacity: 0,
                transition: 'opacity 0.15s ease',
                '&:hover': { color: '#fb7185' },
              }}
            >
              <X size={14} />
            </IconButton>
          )}
        </Stack>
      </Box>
    </Box>
  );
};
