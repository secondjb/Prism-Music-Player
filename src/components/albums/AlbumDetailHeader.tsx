import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { ChevronLeft, Play, Disc } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';

export interface AlbumDetailHeaderProps {
  albumName: string;
  artistName: string;
  songCount: number;
  artUrl: string | null;
  onPlayAlbum: () => void;
  onBack: () => void;
}

export const AlbumDetailHeader: React.FC<AlbumDetailHeaderProps> = ({
  albumName,
  artistName,
  songCount,
  artUrl,
  onPlayAlbum,
  onBack,
}) => {
  const navigateToArtist = usePlayerStore((s) => s.navigateToArtist);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 4 }}>
      {/* Back button sticky glass bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          position: 'sticky',
          top: 0,
          bgcolor: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          px: 2,
          py: 1,
          zIndex: 10,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
          my: 1,
        }}
      >
        <IconButton
          onClick={onBack}
          sx={{
            color: '#ffffff',
            p: 1,
            borderRadius: '10px',
            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' },
          }}
        >
          <ChevronLeft size={22} />
        </IconButton>
      </Box>

      {/* Hero Banner: Album Artwork + Details */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 2.5, sm: 4 }}
        sx={{
          alignItems: { xs: 'center', sm: 'flex-end' },
          textAlign: { xs: 'center', sm: 'left' },
          px: { xs: 1, sm: 2 },
        }}
      >
        {/* Cover Art with Play Overlay */}
        <Box
          sx={{
            position: 'relative',
            width: { xs: 140, sm: 180, md: 200 },
            height: { xs: 140, sm: 180, md: 200 },
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            flexShrink: 0,
            cursor: 'pointer',
            '&:hover .hero-play-overlay': { opacity: 1 },
          }}
          onClick={onPlayAlbum}
        >
          {artUrl ? (
            <Box component="img" src={artUrl} alt={albumName} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Box sx={{ width: '100%', height: '100%', bgcolor: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Disc size={64} className="text-zinc-600" />
            </Box>
          )}

          <Box
            className="hero-play-overlay"
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
                width: 56,
                height: 56,
                borderRadius: '50%',
                bgcolor: 'var(--color-stop-1, #6366f1)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px color-mix(in srgb, var(--color-stop-1, #6366f1) 45%, transparent)',
                transition: 'transform 0.15s',
                '&:hover': { transform: 'scale(1.1)' },
              }}
            >
              <Play size={26} fill="#ffffff" style={{ marginLeft: 3 }} />
            </Box>
          </Box>
        </Box>

        {/* Album Metadata */}
        <Box sx={{ minWidth: 0, flex: 1, pb: 1 }}>
          <Typography
            variant="h4"
            noWrap
            title={albumName}
            sx={{
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.02em',
              fontSize: { xs: '1.5rem', sm: '2rem', md: '2.25rem' },
            }}
          >
            {albumName}
          </Typography>

          <Typography
            variant="subtitle1"
            noWrap
            title={artistName}
            onClick={() => {
              if (artistName !== 'Unknown Artist') {
                navigateToArtist(artistName);
              }
            }}
            sx={{
              color: 'var(--color-stop-1, #818cf8)',
              fontWeight: 600,
              mt: 0.5,
              cursor: 'pointer',
              display: 'inline-block',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {artistName}
          </Typography>

          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {songCount} song{songCount > 1 ? 's' : ''}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
};
