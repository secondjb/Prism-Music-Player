import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import { ListMusic, Timer, Speaker, Mic2 } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { SleepTimerModal } from '../SleepTimerModal';
import { AudioDeviceModal } from '../AudioDeviceModal';

export const PlayerActions: React.FC = () => {
  const isQueueOpen = usePlayerStore((s) => s.isQueueOpen);
  const queueLength = usePlayerStore((s) => s.queue.length);
  const sleepTimer = usePlayerStore((s) => s.sleepTimer);
  const showLyricsFullscreen = usePlayerStore((s) => s.showLyricsFullscreen);
  const setShowLyricsFullscreen = usePlayerStore((s) => s.setShowLyricsFullscreen);

  const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);

  return (
    <Stack direction="row" spacing={{ xs: 0.5, sm: 1 }} sx={{ alignItems: 'center', flexShrink: 0 }}>
      {/* Play Queue Drawer Button */}
      <Tooltip title="Play Queue" arrow>
        <IconButton
          size="small"
          onClick={() => usePlayerStore.setState((s) => ({ isQueueOpen: !s.isQueueOpen }))}
          sx={{
            p: 1,
            borderRadius: '12px',
            color: isQueueOpen ? '#ffffff' : '#a1a1aa',
            bgcolor: isQueueOpen ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            '&:hover': {
              color: '#ffffff',
              bgcolor: 'rgba(255, 255, 255, 0.08)',
            },
          }}
        >
          <Badge
            badgeContent={queueLength > 0 ? queueLength : 0}
            invisible={queueLength === 0}
            sx={{
              '& .MuiBadge-badge': {
                bgcolor: 'var(--color-stop-1, #6366f1)',
                color: '#ffffff',
                fontSize: '9px',
                fontWeight: 700,
                fontFamily: 'monospace',
                height: 16,
                minWidth: 16,
                px: 0.5,
              },
            }}
          >
            <ListMusic size={20} />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Sleep Timer Button */}
      <Box sx={{ position: 'relative' }}>
        <Tooltip title="Sleep Timer" arrow>
          <IconButton
            size="small"
            onClick={() => setIsTimerModalOpen(!isTimerModalOpen)}
            sx={{
              p: 1,
              borderRadius: '12px',
              color: sleepTimer.active ? 'var(--color-stop-1, #6366f1)' : '#a1a1aa',
              bgcolor: sleepTimer.active ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              border: sleepTimer.active ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
              '&:hover': {
                color: '#ffffff',
                bgcolor: 'rgba(255, 255, 255, 0.08)',
              },
            }}
          >
            <Timer size={20} />
            {sleepTimer.active && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: 'var(--color-stop-1, #6366f1)',
                  boxShadow: '0 0 6px var(--color-stop-1, #6366f1)',
                }}
              />
            )}
          </IconButton>
        </Tooltip>
        <SleepTimerModal isOpen={isTimerModalOpen} onClose={() => setIsTimerModalOpen(false)} />
      </Box>

      {/* Audio Output Devices Button */}
      <Box sx={{ position: 'relative' }}>
        <Tooltip title="Audio Output & Quality" arrow>
          <IconButton
            data-audio-speaker-btn="true"
            size="small"
            onClick={() => setIsDeviceModalOpen(!isDeviceModalOpen)}
            sx={{
              p: 1,
              borderRadius: '12px',
              color: isDeviceModalOpen ? '#ffffff' : '#a1a1aa',
              bgcolor: isDeviceModalOpen ? 'var(--color-stop-1, #6366f1)' : 'transparent',
              boxShadow: isDeviceModalOpen
                ? '0 0 14px color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)'
                : 'none',
              '&:hover': {
                color: '#ffffff',
                bgcolor: isDeviceModalOpen
                  ? 'var(--color-stop-1, #6366f1)'
                  : 'rgba(255, 255, 255, 0.08)',
              },
            }}
          >
            <Speaker size={20} />
          </IconButton>
        </Tooltip>
        <AudioDeviceModal isOpen={isDeviceModalOpen} onClose={() => setIsDeviceModalOpen(false)} />
      </Box>

      {/* Fullscreen Lyrics / Karaoke Toggle Button */}
      <Tooltip title="Karaoke / Fullscreen Lyrics" arrow>
        <IconButton
          size="small"
          onClick={() => setShowLyricsFullscreen(!showLyricsFullscreen)}
          sx={{
            p: 1,
            borderRadius: '12px',
            color: showLyricsFullscreen ? '#ffffff' : '#a1a1aa',
            bgcolor: showLyricsFullscreen ? 'var(--color-stop-1, #6366f1)' : 'transparent',
            boxShadow: showLyricsFullscreen
              ? '0 0 14px color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)'
              : 'none',
            '&:hover': {
              color: '#ffffff',
              bgcolor: showLyricsFullscreen
                ? 'var(--color-stop-1, #6366f1)'
                : 'rgba(255, 255, 255, 0.08)',
            },
          }}
        >
          <Mic2 size={20} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
};
