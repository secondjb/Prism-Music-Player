import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { Music, Play, Heart } from 'lucide-react';
import { Playlist, Track } from '../../types/player';
import { useTrackArt } from '../../utils/useTrackArt';

export interface PlaylistListRowProps {
  playlist: Playlist;
  tracks: Track[];
  isLiked?: boolean;
  onPlay: (e: React.MouseEvent) => void;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  isDragOver: boolean;
}

export const PlaylistListRow: React.FC<PlaylistListRowProps> = ({
  playlist,
  tracks,
  isLiked = false,
  onPlay,
  onClick,
  onContextMenu,
  onDrop,
  onDragOver,
  onDragLeave,
  isDragOver,
}) => {
  const firstTrack = tracks[0] || null;
  const art = useTrackArt(firstTrack, { thumbnail: true, maxSize: 128 });

  return (
    <Box
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragEnter={(e) => e.preventDefault()}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 1.5,
        borderRadius: '12px',
        border: '1px solid',
        borderColor: isDragOver ? 'var(--color-stop-1, #6366f1)' : 'transparent',
        bgcolor: isDragOver
          ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)'
          : 'transparent',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        '&:hover': {
          bgcolor: 'rgba(255, 255, 255, 0.05)',
          borderColor: isDragOver ? 'var(--color-stop-1, #6366f1)' : 'rgba(255, 255, 255, 0.08)',
          '& .pl-list-play': { opacity: 1 },
        },
      }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', minWidth: 0, flex: 1 }}>
        <Box
          sx={{
            position: 'relative',
            width: 44,
            height: 44,
            borderRadius: '10px',
            overflow: 'hidden',
            bgcolor: '#18181b',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            flexShrink: 0,
          }}
        >
          {isLiked ? (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
              }}
            >
              <Heart size={20} fill="#ffffff" color="#ffffff" />
            </Box>
          ) : art ? (
            <Box component="img" src={art} alt={playlist.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Music size={20} className="text-zinc-600" />
            </Box>
          )}

          {tracks.length > 0 && (
            <IconButton
              size="small"
              className="pl-list-play"
              onClick={onPlay}
              sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: 'rgba(0, 0, 0, 0.5)',
                color: '#ffffff',
                borderRadius: 0,
                opacity: 0,
                transition: 'opacity 0.15s ease',
                '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.6)' },
              }}
            >
              <Play size={16} fill="#ffffff" />
            </IconButton>
          )}
        </Box>

        <Typography
          noWrap
          variant="body2"
          sx={{
            fontWeight: 600,
            color: '#ffffff',
            fontSize: '13px',
            flex: 1,
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          {playlist.name}
        </Typography>
      </Stack>

      <Typography variant="caption" sx={{ color: '#71717a', fontSize: '11px', fontFamily: 'monospace', ml: 2, flexShrink: 0 }}>
        {tracks.length} tracks
      </Typography>
    </Box>
  );
};
