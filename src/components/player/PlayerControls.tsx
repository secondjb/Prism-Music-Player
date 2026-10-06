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
  size?: 'sm' | 'md' | 'lg';
  playButtonColor?: 'white' | 'primary';
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
  size = 'md',
  playButtonColor = 'white',
}) => {
  const playBtnDiameter = size === 'sm' ? 36 : size === 'lg' ? 52 : 44;
  const mainIconSize = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;
  const navIconSize = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;
  const auxIconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;
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
          <Shuffle size={auxIconSize} />
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
          <SkipBack size={navIconSize} />
        </IconButton>
      </Tooltip>

      {/* Play / Pause Main Circle Button */}
      <Box
        component="button"
        onClick={onTogglePlay}
        sx={{
          width: playBtnDiameter,
          height: playBtnDiameter,
          borderRadius: '50%',
          bgcolor: playButtonColor === 'primary' ? 'var(--color-stop-1, #6366f1)' : '#ffffff',
          color: playButtonColor === 'primary' ? '#ffffff' : '#09090b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow:
            playButtonColor === 'primary'
              ? '0 4px 16px color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)'
              : '0 4px 16px rgba(255, 255, 255, 0.15)',
          cursor: 'pointer',
          border: 'none',
          outline: 'none',
          transition: 'transform 0.15s ease, filter 0.15s ease',
          '&:hover': {
            transform: 'scale(1.06)',
            filter: 'brightness(1.08)',
          },
          '&:active': {
            transform: 'scale(0.95)',
          },
        }}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause size={mainIconSize} fill={playButtonColor === 'primary' ? '#ffffff' : '#09090b'} />
        ) : (
          <Play
            size={mainIconSize}
            fill={playButtonColor === 'primary' ? '#ffffff' : '#09090b'}
            style={{ marginLeft: 2 }}
          />
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
          <SkipForward size={navIconSize} />
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
          {repeatMode === 'one' ? <Repeat1 size={auxIconSize} /> : <Repeat size={auxIconSize} />}
        </IconButton>
      </Tooltip>
    </Stack>
  );
};
