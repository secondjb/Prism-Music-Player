import React, { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { Disc, Play } from 'lucide-react';
import { Track } from '../../types/player';
import { useTrackArt } from '../../utils/useTrackArt';
import { usePlayerStore } from '../../store/usePlayerStore';

export interface AlbumListRowProps {
  albumName: string;
  albumTracks: Track[];
  artist: string;
  onPlay: () => void;
  onNavigate: () => void;
}

export const AlbumListRow: React.FC<AlbumListRowProps> = React.memo(({
  albumName,
  albumTracks,
  artist,
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

  const firstTrack = albumTracks[0];
  const art = useTrackArt(isVisible ? firstTrack : null, { thumbnail: true, maxSize: 128 });
  const navigateToArtist = usePlayerStore((s) => s.navigateToArtist);

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
          '& .list-play-btn': { opacity: 1 },
        },
      }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', minWidth: 0, flex: 1 }}>
        {/* Cover Art Thumbnail */}
        <Box
          sx={{
            position: 'relative',
            width: 48,
            height: 48,
            borderRadius: '10px',
            overflow: 'hidden',
            bgcolor: '#18181b',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            flexShrink: 0,
          }}
        >
          {art ? (
            <Box component="img" src={art} alt={albumName} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Disc size={22} className="text-zinc-600" />
            </Box>
          )}

          {/* Hover Play Button */}
          <IconButton
            size="small"
            className="list-play-btn"
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
            <Play size={18} fill="#ffffff" />
          </IconButton>
        </Box>

        {/* Album Titles */}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            noWrap
            variant="body2"
            sx={{
              fontWeight: 600,
              color: '#ffffff',
              fontSize: '13px',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {albumName}
          </Typography>

          <Typography
            noWrap
            variant="caption"
            onClick={(e) => {
              if (artist !== 'Unknown Artist') {
                e.stopPropagation();
                navigateToArtist(artist);
              }
            }}
            sx={{
              color: '#a1a1aa',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'block',
              '&:hover': {
                color: 'var(--color-stop-1, #818cf8)',
                textDecoration: 'underline',
              },
            }}
          >
            {artist}
          </Typography>
        </Box>
      </Stack>

      <Typography variant="caption" sx={{ color: '#71717a', fontSize: '11px', fontFamily: 'monospace', ml: 2, flexShrink: 0 }}>
        {albumTracks.length} tracks
      </Typography>
    </Box>
  );
});
