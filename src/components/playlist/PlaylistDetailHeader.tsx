import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { ArrowLeft, Play, Pencil, Check, Plus, PlusCircle } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';

export interface PlaylistDetailHeaderProps {
  playlistId: string;
  playlistName: string;
  trackCount: number;
  totalDurationSecs: number;
  isLikedPlaylist: boolean;
  onBack: () => void;
  onPlayAll: () => void;
  showAddSongs: boolean;
  onToggleAddSongs: () => void;
}

export const PlaylistDetailHeader: React.FC<PlaylistDetailHeaderProps> = ({
  playlistId,
  playlistName,
  trackCount,
  totalDurationSecs,
  isLikedPlaylist,
  onBack,
  onPlayAll,
  showAddSongs,
  onToggleAddSongs,
}) => {
  const renamePlaylist = usePlayerStore((s) => s.renamePlaylist);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(playlistName);

  const handleSaveRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== playlistName && !isLikedPlaylist) {
      renamePlaylist(playlistId, trimmed);
    }
    setIsEditing(false);
  };

  const totalMins = Math.floor(totalDurationSecs / 60);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 2,
        mb: 3,
        flexShrink: 0,
      }}
    >
      {/* Back button & Playlist Title */}
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', minWidth: 0 }}>
        <Tooltip title="Back to Playlists" arrow>
          <IconButton
            onClick={onBack}
            sx={{
              p: 1.25,
              borderRadius: '12px',
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.12)' },
            }}
          >
            <ArrowLeft size={20} />
          </IconButton>
        </Tooltip>

        <Box sx={{ minWidth: 0 }}>
          {isEditing && !isLikedPlaylist ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <input
                type="text"
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                onBlur={handleSaveRename}
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--color-stop-1, #6366f1)',
                  borderRadius: '8px',
                  padding: '4px 8px',
                  color: '#ffffff',
                  outline: 'none',
                }}
              />
              <IconButton size="small" onClick={handleSaveRename} sx={{ color: 'var(--color-stop-1, #6366f1)' }}>
                <Check size={18} />
              </IconButton>
            </Stack>
          ) : (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography
                variant="h5"
                noWrap
                title={playlistName}
                sx={{
                  fontWeight: 800,
                  color: '#ffffff',
                  letterSpacing: '-0.02em',
                  fontSize: { xs: '1.25rem', sm: '1.5rem' },
                }}
              >
                {playlistName}
              </Typography>
              {!isLikedPlaylist && (
                <IconButton
                  size="small"
                  onClick={() => {
                    setEditName(playlistName);
                    setIsEditing(true);
                  }}
                  sx={{ color: '#71717a', '&:hover': { color: '#ffffff' } }}
                >
                  <Pencil size={15} />
                </IconButton>
              )}
            </Stack>
          )}

          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, mt: 0.25, display: 'block' }}>
            {trackCount} track{trackCount !== 1 ? 's' : ''}
            {totalDurationSecs > 0 && ` • ${totalMins} min${totalMins !== 1 ? 's' : ''}`}
          </Typography>
        </Box>
      </Stack>

      {/* Action Buttons: Play All & Add Songs */}
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        {trackCount > 0 && (
          <Button
            variant="contained"
            onClick={onPlayAll}
            startIcon={<Play size={16} fill="#ffffff" />}
            sx={{
              bgcolor: 'var(--color-stop-1, #6366f1)',
              color: '#ffffff',
              borderRadius: '12px',
              px: 2,
              py: 0.75,
              fontSize: '13px',
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: '0 4px 16px color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
              '&:hover': {
                bgcolor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 85%, #000000)',
              },
            }}
          >
            Play All
          </Button>
        )}

        {!isLikedPlaylist && (
          <Button
            variant="outlined"
            onClick={onToggleAddSongs}
            startIcon={showAddSongs ? <Plus size={16} style={{ transform: 'rotate(45deg)' }} /> : <PlusCircle size={16} />}
            sx={{
              borderColor: showAddSongs ? 'var(--color-stop-1, #6366f1)' : 'rgba(255, 255, 255, 0.15)',
              color: showAddSongs ? 'var(--color-stop-1, #6366f1)' : '#ffffff',
              bgcolor: showAddSongs ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)' : 'rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              px: 2,
              py: 0.75,
              fontSize: '13px',
              fontWeight: 600,
              textTransform: 'none',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                borderColor: 'var(--color-stop-1, #6366f1)',
              },
            }}
          >
            {showAddSongs ? 'Done Adding' : 'Add Songs'}
          </Button>
        )}
      </Stack>
    </Box>
  );
};
