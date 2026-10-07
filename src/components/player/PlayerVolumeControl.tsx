import React, { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { Volume2, VolumeX } from 'lucide-react';
import { AudioSlider } from '../AudioSlider';

export interface PlayerVolumeControlProps {
  volume: number;
  setVolume: (vol: number) => void;
  width?: number | string | object;
  showNumericInput?: boolean;
  showAlways?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const PlayerVolumeControl: React.FC<PlayerVolumeControlProps> = ({
  volume,
  setVolume,
  width,
  showNumericInput = true,
  showAlways = false,
  size = 'md',
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [prevVol, setPrevVol] = useState(volume);
  const [isEditingVol, setIsEditingVol] = useState(false);
  const [volInputText, setVolInputText] = useState(Math.round(volume * 100).toString());

  const volContainerRef = useRef<HTMLDivElement>(null);

  // Wheel listener for smooth volume adjustment
  useEffect(() => {
    const el = volContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const step = 0.02;
      const current = isMuted ? 0 : volume;
      const delta = e.deltaY < 0 ? step : -step;
      const next = Math.min(1, Math.max(0, current + delta));
      if (isMuted && next > 0) setIsMuted(false);
      setVolume(next);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [volume, isMuted, setVolume]);

  const handleMuteToggle = () => {
    if (isMuted) {
      setIsMuted(false);
      setVolume(prevVol > 0 ? prevVol : 0.5);
    } else {
      setPrevVol(volume);
      setIsMuted(true);
      setVolume(0);
    }
  };

  const handleVolInputSubmit = () => {
    const parsed = parseInt(volInputText, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.min(100, Math.max(0, parsed));
      setVolume(clamped / 100);
      if (isMuted && clamped > 0) setIsMuted(false);
    }
    setIsEditingVol(false);
  };

  const effectiveVol = isMuted ? 0 : volume;

  return (
    <Stack
      ref={volContainerRef}
      direction="row"
      spacing={size === 'lg' ? 1.25 : 1}
      sx={{
        alignItems: 'center',
        width: width || { xs: 80, sm: 110, md: 155 },
        maxWidth: '100%',
        minWidth: { xs: 80, sm: 110, md: 120 }, // Enforce minimum width so it cannot squash
        flexShrink: 0, // Prevent container from squashing the slider
        display: showAlways ? 'flex' : { xs: 'none', sm: 'flex' },
      }}
      title="Scroll wheel to adjust volume"
    >
      <Tooltip title={isMuted ? 'Unmute' : 'Mute'} arrow>
        <IconButton
          size={size === 'lg' ? 'medium' : 'small'}
          onClick={handleMuteToggle}
          sx={{
            p: size === 'lg' ? 0.75 : 0.5,
            color: isMuted || volume === 0 ? '#fb7185' : '#a1a1aa',
            '&:hover': { color: '#ffffff' },
          }}
        >
          {isMuted || volume === 0 ? (
            <VolumeX size={size === 'lg' ? 22 : 18} />
          ) : (
            <Volume2 size={size === 'lg' ? 22 : 18} />
          )}
        </IconButton>
      </Tooltip>

      <Box sx={{ flex: 1, minWidth: { xs: 46, sm: 50, md: 60 } }}>
        <AudioSlider
          value={effectiveVol}
          min={0}
          max={1}
          step={0.01}
          size={size}
          onChange={(val) => {
            setVolume(val);
            if (isMuted) setIsMuted(false);
          }}
          formatTooltip={(val) => `${Math.round(val * 100)}%`}
          className="w-full"
        />
      </Box>

      {/* Numeric Percentage / Direct Input */}
      {showNumericInput && (
        <Box sx={{ width: size === 'lg' ? 42 : 36, flexShrink: 0, display: showAlways ? 'flex' : { xs: 'none', md: 'flex' }, justifyContent: 'flex-end' }}>
          {isEditingVol ? (
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              autoFocus
              value={volInputText}
              onChange={(e) => setVolInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleVolInputSubmit();
                if (e.key === 'Escape') setIsEditingVol(false);
              }}
              onBlur={handleVolInputSubmit}
              style={{
                color: 'var(--color-stop-1, #6366f1)',
                borderColor: 'var(--color-stop-1, #6366f1)',
                width: '100%',
                padding: '2px',
                fontSize: size === 'lg' ? '13px' : '11px',
                fontFamily: 'monospace',
                fontWeight: 700,
                textAlign: 'center',
                backgroundColor: '#27272a',
                borderBottomWidth: '2px',
                borderStyle: 'solid',
                borderRadius: '4px',
                outline: 'none',
              }}
            />
          ) : (
            <Box
              component="button"
              onClick={() => {
                setVolInputText(Math.round(effectiveVol * 100).toString());
                setIsEditingVol(true);
              }}
              title="Click to type volume"
              sx={{
                p: 0.25,
                fontSize: size === 'lg' ? '13px' : '11px',
                fontFamily: 'monospace',
                fontWeight: 700,
                color: 'var(--color-stop-1, #6366f1)',
                cursor: 'pointer',
                bgcolor: 'transparent',
                border: 'none',
                textAlign: 'right',
                '&:hover': { filter: 'brightness(1.25)' },
              }}
            >
              {Math.round(effectiveVol * 100)}%
            </Box>
          )}
        </Box>
      )}
    </Stack>
  );
};
