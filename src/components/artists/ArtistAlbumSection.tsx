import React, { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Play } from 'lucide-react';
import { Track } from '../../types/player';
import { useTrackArt } from '../../utils/useTrackArt';
import { usePlayerStore } from '../../store/usePlayerStore';
import { TrackList } from '../TrackList';

export interface ArtistAlbumSectionProps {
  albumName: string;
  tracks: Track[];
  artistName: string;
}

export const ArtistAlbumSection: React.FC<ArtistAlbumSectionProps> = ({
  albumName,
  tracks,
  artistName,
}) => {
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);
  const navigateToAlbum = usePlayerStore((s) => s.navigateToAlbum);

  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { rootMargin: '200px' }
    );
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const art = useTrackArt(isVisible ? tracks[0] : null);

  const playAlbum = () => {
    setQueue(tracks);
    playIndex(0);
  };

  return (
    <Box
      ref={sectionRef}
      sx={{
        mb: 4,
        bgcolor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '16px',
        p: { xs: 2, sm: 3 },
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2.5}
        sx={{
          alignItems: { xs: 'center', sm: 'flex-end' },
          textAlign: { xs: 'center', sm: 'left' },
          mb: 2.5,
        }}
      >
        {/* Cover Art Thumbnail with Play Overlay */}
        <Box
          sx={{
            position: 'relative',
            width: { xs: 110, sm: 120 },
            height: { xs: 110, sm: 120 },
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            flexShrink: 0,
            cursor: 'pointer',
            '&:hover .album-play-overlay': { opacity: 1 },
          }}
          onClick={() => navigateToAlbum(albumName)}
        >
          {art ? (
            <Box component="img" src={art} alt={albumName} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Box sx={{ width: '100%', height: '100%', bgcolor: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>No Art</Typography>
            </Box>
          )}

          <Box
            className="album-play-overlay"
            onClick={(e) => {
              e.stopPropagation();
              playAlbum();
            }}
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
                width: 42,
                height: 42,
                borderRadius: '50%',
                bgcolor: 'var(--color-stop-1, #6366f1)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 18px color-mix(in srgb, var(--color-stop-1, #6366f1) 45%, transparent)',
                transition: 'transform 0.15s',
                '&:hover': { transform: 'scale(1.1)' },
              }}
            >
              <Play size={20} fill="#ffffff" style={{ marginLeft: 2 }} />
            </Box>
          </Box>
        </Box>

        {/* Album Name and Song Count */}
        <Box sx={{ minWidth: 0, flex: 1, pb: 0.5 }}>
          <Typography
            variant="h6"
            noWrap
            title={albumName}
            onClick={() => navigateToAlbum(albumName)}
            sx={{
              fontWeight: 700,
              color: '#ffffff',
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {albumName}
          </Typography>
          <Typography variant="caption" sx={{ color: '#a1a1aa', mt: 0.25, display: 'block' }}>
            {artistName} • {tracks.length} song{tracks.length > 1 ? 's' : ''}
          </Typography>
        </Box>
      </Stack>

      <TrackList tracks={tracks} hideControls autoHeight />
    </Box>
  );
};
