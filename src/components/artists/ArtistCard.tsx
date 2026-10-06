import React, { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { User, Play } from 'lucide-react';
import { Track } from '../../types/player';
import { useTrackArt } from '../../utils/useTrackArt';

export interface ArtistCardProps {
  artistName: string;
  artistTracks: Track[];
  onPlay: () => void;
  onNavigate: () => void;
}

export const ArtistCard: React.FC<ArtistCardProps> = React.memo(({
  artistName,
  artistTracks,
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

  const firstTrack = artistTracks[0];
  const art = useTrackArt(isVisible ? firstTrack : null, { thumbnail: true, maxSize: 256 });

  return (
    <Box
      ref={cardRef}
      onClick={onNavigate}
      sx={{
        borderRadius: '16px',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
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
          '& .artist-play-overlay': { opacity: 1 },
          '& .artist-img': { transform: 'scale(1.05)' },
        },
      }}
    >
      {/* Circular Artist Image */}
      <Box
        sx={{
          position: 'relative',
          width: { xs: 120, sm: 140 },
          height: { xs: 120, sm: 140 },
          borderRadius: '50%',
          overflow: 'hidden',
          bgcolor: '#18181b',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        }}
      >
        {art ? (
          <Box
            component="img"
            src={art}
            alt={artistName}
            className="artist-img"
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
            <User size={48} style={{ color: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 75%, white)' }} />
          </Box>
        )}

        {/* Hover Play Button Overlay */}
        <Box
          className="artist-play-overlay"
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
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

      {/* Artist Name & Songs Count */}
      <Box sx={{ width: '100%', minWidth: 0 }}>
        <Typography
          variant="subtitle2"
          noWrap
          title={artistName}
          sx={{
            fontWeight: 700,
            color: '#ffffff',
            fontSize: '13px',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          {artistName}
        </Typography>

        <Typography variant="caption" sx={{ color: '#71717a', fontSize: '11px', fontFamily: 'monospace', mt: 0.25 }}>
          {artistTracks.length} song{artistTracks.length > 1 ? 's' : ''}
        </Typography>
      </Box>
    </Box>
  );
});
