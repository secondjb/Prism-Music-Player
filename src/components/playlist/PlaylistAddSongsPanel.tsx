import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import SearchIcon from '@mui/icons-material/Search';
import { Plus, Check, X } from 'lucide-react';
import { Track } from '../../types/player';

export interface PlaylistAddSongsPanelProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  candidateTracks: Track[];
  playlistTrackIds: string[];
  onAddTrack: (trackId: string) => void;
  onClose: () => void;
}

export const PlaylistAddSongsPanel: React.FC<PlaylistAddSongsPanelProps> = ({
  searchQuery,
  onSearchChange,
  candidateTracks,
  playlistTrackIds,
  onAddTrack,
  onClose,
}) => {
  return (
    <Box
      sx={{
        bgcolor: 'rgba(20, 20, 26, 0.75)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        p: 2,
        mb: 2.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        maxHeight: 320,
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#ffffff' }}>
          Add Songs to Playlist
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: '#a1a1aa', '&:hover': { color: '#ffffff' } }}>
          <X size={16} />
        </IconButton>
      </Stack>

      {/* Search Input */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          bgcolor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '10px',
          px: 1.5,
          py: 0.5,
          '&:focus-within': {
            borderColor: 'var(--color-stop-1, #6366f1)',
          },
        }}
      >
        <SearchIcon sx={{ color: '#a1a1aa', fontSize: 18, mr: 1 }} />
        <InputBase
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search songs to add..."
          sx={{
            color: '#ffffff',
            fontSize: '12px',
            width: '100%',
            '& input::placeholder': { color: '#71717a', opacity: 1 },
          }}
        />
        {searchQuery && (
          <IconButton size="small" onClick={() => onSearchChange('')} sx={{ p: 0.25, color: '#a1a1aa' }}>
            <X size={14} />
          </IconButton>
        )}
      </Box>

      {/* Candidate Track List */}
      <Box sx={{ overflowY: 'auto', flex: 1, pr: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }} className="custom-scrollbar">
        {candidateTracks.slice(0, 30).map((t) => {
          const inPlaylist = playlistTrackIds.includes(t.id);

          return (
            <Box
              key={t.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1.5,
                py: 0.75,
                borderRadius: '8px',
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.07)' },
              }}
            >
              <Box sx={{ minWidth: 0, flex: 1, mr: 2 }}>
                <Typography noWrap variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>
                  {t.title}
                </Typography>
                <Typography noWrap variant="caption" sx={{ fontSize: '11px', color: '#a1a1aa' }}>
                  {t.artist || 'Unknown Artist'}
                </Typography>
              </Box>

              <IconButton
                size="small"
                onClick={() => onAddTrack(t.id)}
                sx={{
                  bgcolor: inPlaylist ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                  color: inPlaylist ? 'var(--color-stop-1, #6366f1)' : '#ffffff',
                  p: 0.75,
                  borderRadius: '8px',
                  '&:hover': {
                    bgcolor: 'var(--color-stop-1, #6366f1)',
                    color: '#ffffff',
                  },
                }}
              >
                {inPlaylist ? <Check size={14} /> : <Plus size={14} />}
              </IconButton>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
