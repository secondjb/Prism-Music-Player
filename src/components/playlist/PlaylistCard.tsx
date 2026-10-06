import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Music, Play, Heart } from 'lucide-react';
import { Playlist, Track } from '../../types/player';
import { useTrackArt } from '../../utils/useTrackArt';

export interface PlaylistCardProps {
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

export const PlaylistCard: React.FC<PlaylistCardProps> = ({
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
  const art = useTrackArt(firstTrack, { thumbnail: true, maxSize: 256 });

  return (
    <Box
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragEnter={(e) => e.preventDefault()}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      sx={{
        borderRadius: '16px',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        bgcolor: isDragOver
          ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, rgba(22, 22, 28, 0.7))'
          : 'rgba(22, 22, 28, 0.5)',
        backgroundImage: 'linear-gradient(135deg, rgba(255, 255, 255, 0.045) 0%, rgba(255, 255, 255, 0.015) 100%)',
        backdropFilter: 'blur(16px)',
        border: '1px solid',
        borderColor: isDragOver
          ? 'var(--color-stop-1, #6366f1)'
          : 'rgba(255, 255, 255, 0.08)',
        boxShadow: isDragOver
          ? '0 0 20px color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)'
          : '0 4px 20px -2px rgba(0, 0, 0, 0.25)',
        '&:hover': {
          bgcolor: 'rgba(28, 28, 36, 0.65)',
          transform: 'translateY(-4px)',
          boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.45)',
          borderColor: 'rgba(255, 255, 255, 0.16)',
          '& .playlist-play-overlay': { opacity: 1 },
          '& .playlist-cover': { transform: 'scale(1.04)' },
        },
      }}
    >
      {/* Artwork Box */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1/1',
          borderRadius: '12px',
          overflow: 'hidden',
          bgcolor: '#18181b',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
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
            <Heart size={44} fill="#ffffff" color="#ffffff" />
          </Box>
        ) : art ? (
          <Box
            component="img"
            src={art}
            alt={playlist.name}
            className="playlist-cover"
            sx={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
          />
        ) : (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background:
                'linear-gradient(135deg, color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, #18181b), color-mix(in srgb, var(--color-stop-2, #8b5cf6) 20%, #09090b))',
            }}
          >
            <Music size={40} style={{ color: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 75%, white)' }} />
          </Box>
        )}

        {/* Hover Play Button */}
        {tracks.length > 0 && (
          <Box
            className="playlist-play-overlay"
            onClick={onPlay}
            sx={{
              position: 'absolute',
              inset: 0,
              bgcolor: 'rgba(0, 0, 0, 0.45)',
              opacity: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'opacity 0.2s ease',
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: 'var(--color-stop-1, #6366f1)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px color-mix(in srgb, var(--color-stop-1, #6366f1) 45%, transparent)',
                transition: 'transform 0.15s ease',
                '&:hover': { transform: 'scale(1.1)' },
              }}
            >
              <Play size={22} fill="#ffffff" style={{ marginLeft: 2 }} />
            </Box>
          </Box>
        )}
      </Box>

      {/* Title & Count */}
      <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Typography
          variant="subtitle2"
          noWrap
          title={playlist.name}
          sx={{ fontWeight: 700, color: '#ffffff', fontSize: '13px' }}
        >
          {playlist.name}
        </Typography>
        <Typography variant="caption" sx={{ color: '#71717a', fontSize: '11px', fontFamily: 'monospace', mt: 0.25 }}>
          {tracks.length} track{tracks.length !== 1 ? 's' : ''}
        </Typography>
      </Box>
    </Box>
  );
};
