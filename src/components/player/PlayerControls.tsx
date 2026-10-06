import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1 } from 'lucide-react';
import { RepeatMode } from '../../types/player';

export interface PlayerControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPreviousTrack: () => void;
  shuffleEnabled: boolean;
  onToggleShuffle: () => void;
  repeatMode: RepeatMode;
  onCycleRepeatMode: () => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  onTogglePlay,
  onNextTrack,
  onPreviousTrack,
  shuffleEnabled,
  onToggleShuffle,
  repeatMode,
  onCycleRepeatMode,
}) => {
  return (
    <Stack direction="row" spacing={{ xs: 1.5, sm: 2 }} sx={{ alignItems: 'center', mb: 0.5 }}>
      {/* Shuffle Button */}
      <Tooltip title={shuffleEnabled ? 'Shuffle On' : 'Shuffle Off'} arrow>
        <IconButton
          size="small"
          onClick={onToggleShuffle}
          sx={{
            p: 1,
            borderRadius: '10px',
            color: shuffleEnabled ? 'var(--color-stop-1, #6366f1)' : '#a1a1aa',
            bgcolor: shuffleEnabled ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)' : 'transparent',
            '&:hover': {
              color: '#ffffff',
              bgcolor: shuffleEnabled
                ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)'
                : 'rgba(255, 255, 255, 0.08)',
            },
          }}
        >
          <Shuffle size={16} />
        </IconButton>
      </Tooltip>

      {/* Previous Track Button */}
      <Tooltip title="Previous Song" arrow>
        <IconButton
          size="small"
          onClick={onPreviousTrack}
          sx={{
            p: 1,
            color: '#a1a1aa',
            '&:hover': { color: '#ffffff' },
          }}
        >
          <SkipBack size={20} />
        </IconButton>
      </Tooltip>

      {/* Play / Pause Main Circle Button */}
      <Box
        component="button"
        onClick={onTogglePlay}
        sx={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          bgcolor: '#ffffff',
          color: '#09090b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(255, 255, 255, 0.15)',
          cursor: 'pointer',
          border: 'none',
          outline: 'none',
          transition: 'transform 0.15s ease',
          '&:hover': {
            transform: 'scale(1.06)',
            bgcolor: '#ffffff',
          },
          '&:active': {
            transform: 'scale(0.95)',
          },
        }}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause size={20} fill="#09090b" />
        ) : (
          <Play size={20} fill="#09090b" style={{ marginLeft: 2 }} />
        )}
      </Box>

      {/* Next Track Button */}
      <Tooltip title="Next Song" arrow>
        <IconButton
          size="small"
          onClick={onNextTrack}
          sx={{
            p: 1,
            color: '#a1a1aa',
            '&:hover': { color: '#ffffff' },
          }}
        >
          <SkipForward size={20} />
        </IconButton>
      </Tooltip>

      {/* Repeat Button */}
      <Tooltip
        title={
          repeatMode === 'off'
            ? 'Repeat Off'
            : repeatMode === 'all'
            ? 'Repeat All'
            : 'Repeat One'
        }
        arrow
      >
        <IconButton
          size="small"
          onClick={onCycleRepeatMode}
          sx={{
            p: 1,
            borderRadius: '10px',
            color: repeatMode !== 'off' ? 'var(--color-stop-1, #6366f1)' : '#a1a1aa',
            bgcolor: repeatMode !== 'off' ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)' : 'transparent',
            '&:hover': {
              color: '#ffffff',
              bgcolor: repeatMode !== 'off'
                ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)'
                : 'rgba(255, 255, 255, 0.08)',
            },
          }}
        >
          {repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
        </IconButton>
      </Tooltip>
    </Stack>
  );
};
