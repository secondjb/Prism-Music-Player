import React, { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Disc, Play } from 'lucide-react';
import { Track } from '../../types/player';
import { useTrackArt } from '../../utils/useTrackArt';
import { usePlayerStore } from '../../store/usePlayerStore';

export interface AlbumCardProps {
  albumName: string;
  albumTracks: Track[];
  artist: string;
  onPlay: () => void;
  onNavigate: () => void;
}

export const AlbumCard: React.FC<AlbumCardProps> = React.memo(({
  albumName,
  albumTracks,
  artist,
  onPlay,
  onNavigate,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { rootMargin: '250px' }
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  const firstTrack = albumTracks[0];
  const art = useTrackArt(isVisible ? firstTrack : null, { thumbnail: true, maxSize: 256 });
  const navigateToArtist = usePlayerStore((s) => s.navigateToArtist);

  return (
    <Box
      ref={cardRef}
      onClick={onNavigate}
      sx={{
        borderRadius: '16px',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        bgcolor: 'rgba(22, 22, 28, 0.5)',
        backgroundImage: 'linear-gradient(135deg, rgba(255, 255, 255, 0.045) 0%, rgba(255, 255, 255, 0.015) 100%)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.25)',
        '&:hover': {
          bgcolor: 'rgba(28, 28, 36, 0.65)',
          transform: 'translateY(-4px)',
          boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.45)',
          borderColor: 'rgba(255, 255, 255, 0.16)',
          '& .album-play-overlay': { opacity: 1 },
          '& .album-cover-img': { transform: 'scale(1.04)' },
        },
      }}
    >
      {/* Cover Art Container */}
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
        {art ? (
          <Box
            component="img"
            src={art}
            alt={albumName}
            className="album-cover-img"
            loading="lazy"
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'transform 0.3s ease',
            }}
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
            <Disc size={44} style={{ color: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 75%, white)' }} />
          </Box>
        )}

        {/* Hover Play Button Overlay */}
        <Box
          className="album-play-overlay"
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(0, 0, 0, 0.4)',
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
      </Box>

      {/* Album Info */}
      <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Typography
          variant="subtitle2"
          noWrap
          title={albumName}
          sx={{
            fontWeight: 700,
            color: '#ffffff',
            fontSize: '13px',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          {albumName}
        </Typography>

        <Typography
          variant="caption"
          noWrap
          title={artist}
          onClick={(e) => {
            if (artist !== 'Unknown Artist') {
              e.stopPropagation();
              navigateToArtist(artist);
            }
          }}
          sx={{
            color: '#a1a1aa',
            fontSize: '11px',
            mt: 0.25,
            cursor: 'pointer',
            '&:hover': {
              color: 'var(--color-stop-1, #818cf8)',
              textDecoration: 'underline',
            },
          }}
        >
          {artist}
        </Typography>

        <Typography variant="caption" sx={{ color: '#71717a', fontSize: '11px', fontFamily: 'monospace', mt: 0.5 }}>
          {albumTracks.length} track{albumTracks.length > 1 ? 's' : ''}
        </Typography>
      </Box>
    </Box>
  );
});
