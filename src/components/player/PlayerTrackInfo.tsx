import React, { useState, useRef } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { Heart, Sparkles } from 'lucide-react';
import { Track } from '../../types/player';
import { useTrackArt } from '../../utils/useTrackArt';
import { usePlayerStore } from '../../store/usePlayerStore';
import { PlayerContextMenu } from './PlayerContextMenu';

export interface PlayerTrackInfoProps {
  currentTrack: Track | null;
  isLiked: boolean;
  onToggleLike: (trackId: string) => void;
  showAudioSpecs: boolean;
  onOpenCreatePlaylistModal: () => void;
}

const handleTrackDragStart = (e: React.DragEvent, track: Track) => {
  if (!track || !track.id) return;
  e.dataTransfer.setData(
    'text/plain',
    JSON.stringify({ type: 'tracks', ids: [track.id] })
  );
  e.dataTransfer.effectAllowed = 'copy';

  const ghost = document.createElement('div');
  ghost.style.position = 'absolute';
  ghost.style.top = '-9999px';
  ghost.style.left = '-9999px';
  ghost.className =
    'glass-panel text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-2xl z-50 flex items-center gap-2 border border-white/20';
  ghost.style.background = 'rgba(20, 20, 24, 0.95)';
  ghost.innerHTML = `<span>🎵</span> <span style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${track.title || 'Song'}</span>`;

  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 20, 15);
  setTimeout(() => {
    if (document.body.contains(ghost)) {
      document.body.removeChild(ghost);
    }
  }, 0);
};

export const PlayerTrackInfo: React.FC<PlayerTrackInfoProps> = ({
  currentTrack,
  isLiked,
  onToggleLike,
  showAudioSpecs,
  onOpenCreatePlaylistModal,
}) => {
  const trackArt = useTrackArt(currentTrack);
  const containerRef = useRef<HTMLDivElement>(null);

  const [contextMenuAnchor, setContextMenuAnchor] = useState<HTMLElement | null>(null);

  const playlists = usePlayerStore((s) => s.playlists);
  const addTrackToPlaylist = usePlayerStore((s) => s.addTrackToPlaylist);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const playNext = usePlayerStore((s) => s.playNext);
  const setInfoModalTrack = usePlayerStore((s) => s.setInfoModalTrack);
  const navigateToArtist = usePlayerStore((s) => s.navigateToArtist);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (currentTrack) {
      setContextMenuAnchor(containerRef.current);
    }
  };

  if (!currentTrack) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 200, flex: 1, maxWidth: '30%' }}>
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: '12px',
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'zinc.600',
            flexShrink: 0,
          }}
        >
          <Sparkles size={20} className="text-zinc-600" />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '13px' }}>
            No track playing
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', opacity: 0.6, fontSize: '11px' }}>
            Select a song to start listening
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      onContextMenu={handleContextMenu}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        minWidth: 0,
        flex: 1,
        maxWidth: { xs: '35%', sm: '32%', md: '28%' },
      }}
    >
      {/* Album Art (Drag source) */}
      <Box
        draggable
        onDragStart={(e) => handleTrackDragStart(e, currentTrack)}
        title="Drag song to playlist or right-click for options"
        sx={{
          position: 'relative',
          width: 52,
          height: 52,
          borderRadius: '12px',
          overflow: 'hidden',
          flexShrink: 0,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          bgcolor: '#18181b',
          cursor: 'grab',
          '&:active': { cursor: 'grabbing' },
          userSelect: 'none',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        }}
      >
        {trackArt ? (
          <Box
            component="img"
            src={trackArt}
            alt={currentTrack.title}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
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
            <Sparkles size={20} style={{ color: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 75%, white)' }} />
          </Box>
        )}
      </Box>

      {/* Song Details & Badges */}
      <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography
            noWrap
            title={currentTrack.title}
            sx={{
              fontWeight: 600,
              fontSize: '13px',
              color: 'text.primary',
              minWidth: 0,
              flexShrink: 1,
            }}
          >
            {currentTrack.title}
          </Typography>

          <Tooltip title={isLiked ? 'Unlike' : 'Like'} arrow>
            <IconButton
              size="small"
              onClick={() => onToggleLike(currentTrack.id)}
              sx={{
                p: '3px',
                flexShrink: 0,
                color: isLiked ? '#ef4444' : '#a1a1aa',
                '&:hover': { color: '#ef4444' },
              }}
            >
              <Heart size={14} fill={isLiked ? '#ef4444' : 'transparent'} />
            </IconButton>
          </Tooltip>
        </Stack>

        <Typography
          noWrap
          title={currentTrack.artist}
          onClick={(e) => {
            if (currentTrack.artist && currentTrack.artist !== 'Unknown Artist') {
              e.stopPropagation();
              navigateToArtist(currentTrack.artist);
            }
          }}
          sx={{
            fontSize: '11px',
            color: '#a1a1aa',
            cursor: 'pointer',
            minWidth: 0,
            display: 'block',
            '&:hover': {
              color: 'var(--color-stop-1, #818cf8)',
              textDecoration: 'underline',
            },
          }}
        >
          {currentTrack.artist}
        </Typography>

        {showAudioSpecs && (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mt: 0.5 }}>
            <Box
              component="span"
              sx={{
                px: 0.75,
                py: '1px',
                fontSize: '9px',
                fontFamily: 'monospace',
                fontWeight: 700,
                borderRadius: '4px',
                bgcolor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
                borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
                color: 'var(--color-stop-1, #6366f1)',
                border: '1px solid',
                lineHeight: 1.2,
              }}
            >
              FLAC
            </Box>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#71717a', fontSize: '10px' }}>
              {(currentTrack.sample_rate / 1000).toFixed(1)}kHz / {currentTrack.bit_depth}bit
            </Typography>
          </Stack>
        )}
      </Box>

      {/* MUI Context Menu */}
      <PlayerContextMenu
        anchorEl={contextMenuAnchor}
        open={Boolean(contextMenuAnchor)}
        onClose={() => setContextMenuAnchor(null)}
        track={currentTrack}
        isLiked={isLiked}
        onToggleLike={() => onToggleLike(currentTrack.id)}
        playlists={playlists}
        onAddToPlaylist={addTrackToPlaylist}
        onCreatePlaylist={onOpenCreatePlaylistModal}
        onAddToQueue={() => addToQueue(currentTrack)}
        onPlayNext={() => playNext(currentTrack)}
        onOpenDetails={() => setInfoModalTrack(currentTrack)}
      />
    </Box>
  );
};
