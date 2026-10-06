import React, { useState, memo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { usePlayerStore } from '../../store/usePlayerStore';
import { AudioSlider } from '../AudioSlider';
import { WavyAudioSlider } from '../WavyAudioSlider';

const formatTime = (secs: number): string => {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export interface LyricsSeekbarProps {
  duration: number;
  isWavySeekbarEnabled: boolean;
  onSeek: (secs: number) => void;
  className?: string;
  active?: boolean;
}

export const LyricsSeekbar: React.FC<LyricsSeekbarProps> = memo(({
  duration,
  isWavySeekbarEnabled,
  onSeek,
  className,
  active = true,
}) => {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const [dragSeekVal, setDragSeekVal] = useState<number | null>(null);

  const displayTime = dragSeekVal !== null ? dragSeekVal : currentTime;

  return (
    <Box
      className={className}
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1, sm: 1.5 },
        fontFamily: 'monospace',
        fontSize: 'clamp(0.65rem, 1vw, 0.75rem)',
        color: 'rgb(161 161 170)',
        my: 0,
        py: 0,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontFamily: 'monospace',
          fontSize: 'inherit',
          color: 'inherit',
          minWidth: '2.5rem',
          textAlign: 'left',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          lineHeight: 1,
        }}
      >
        {formatTime(displayTime)}
      </Typography>

      <Box sx={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', minWidth: '90px' }}>
        {isWavySeekbarEnabled ? (
          <WavyAudioSlider
            value={displayTime}
            min={0}
            max={duration || 100}
            step={0.1}
            onChange={(val) => setDragSeekVal(val)}
            onChangeCommitted={(val) => {
              onSeek(val);
              setDragSeekVal(null);
            }}
            size="md"
            className="flex-1"
            formatTooltip={(val) => formatTime(val)}
            active={active}
          />
        ) : (
          <AudioSlider
            value={displayTime}
            min={0}
            max={duration || 100}
            step={0.1}
            onChange={(val) => setDragSeekVal(val)}
            onChangeCommitted={(val) => {
              onSeek(val);
              setDragSeekVal(null);
            }}
            size="md"
            className="flex-1"
            formatTooltip={(val) => formatTime(val)}
          />
        )}
      </Box>

      <Typography
        variant="caption"
        sx={{
          fontFamily: 'monospace',
          fontSize: 'inherit',
          color: 'inherit',
          minWidth: '2.5rem',
          textAlign: 'right',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          lineHeight: 1,
        }}
      >
        {formatTime(duration)}
      </Typography>
    </Box>
  );
});

LyricsSeekbar.displayName = 'LyricsSeekbar';
