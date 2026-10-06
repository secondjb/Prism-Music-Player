import React, { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { User, Play } from 'lucide-react';
import { Track } from '../../types/player';
import { useTrackArt } from '../../utils/useTrackArt';

export interface ArtistListRowProps {
  artistName: string;
  artistTracks: Track[];
  onPlay: () => void;
  onNavigate: () => void;
}

export const ArtistListRow: React.FC<ArtistListRowProps> = React.memo(({
  artistName,
  artistTracks,
  onPlay,
  onNavigate,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rowRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { rootMargin: '200px' }
    );
    observer.observe(rowRef.current);
    return () => observer.disconnect();
  }, []);

  const firstTrack = artistTracks[0];
  const art = useTrackArt(isVisible ? firstTrack : null, { thumbnail: true, maxSize: 128 });

  return (
    <Box
      ref={rowRef}
      onClick={onNavigate}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 1.5,
        borderRadius: '12px',
        border: '1px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        '&:hover': {
          bgcolor: 'rgba(255, 255, 255, 0.05)',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          '& .artist-list-play': { opacity: 1 },
        },
      }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', minWidth: 0, flex: 1 }}>
        {/* Circular Avatar */}
        <Box
          sx={{
            position: 'relative',
            width: 44,
            height: 44,
            borderRadius: '50%',
            overflow: 'hidden',
            bgcolor: '#18181b',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            flexShrink: 0,
          }}
        >
          {art ? (
            <Box component="img" src={art} alt={artistName} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={20} className="text-zinc-500" />
            </Box>
          )}

          {/* Hover Play Button */}
          <IconButton
            size="small"
            className="artist-list-play"
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
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
          {artistName}
        </Typography>
      </Stack>

      <Typography variant="caption" sx={{ color: '#71717a', fontSize: '11px', fontFamily: 'monospace', ml: 2, flexShrink: 0 }}>
        {artistTracks.length} tracks
      </Typography>
    </Box>
  );
});
