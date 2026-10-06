import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import { TopItem, formatDuration } from '../../utils/statsAggregation';

export interface StatsLeaderboardsProps {
  topSongs: TopItem[];
  topArtists: TopItem[];
  leaderboardMetric: 'time' | 'plays';
  onMetricChange: (m: 'time' | 'plays') => void;
  themeColors: { stop1: string };
}

export const StatsLeaderboards: React.FC<StatsLeaderboardsProps> = ({
  topSongs,
  topArtists,
  leaderboardMetric,
  onMetricChange,
  themeColors,
}) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Metric Selector Bar */}
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Leaderboards
        </Typography>

        <ToggleButtonGroup
          size="small"
          value={leaderboardMetric}
          exclusive
          onChange={(_, val) => {
            if (val) onMetricChange(val);
          }}
          sx={{
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
            p: 0.25,
            '& .MuiToggleButtonGroup-grouped': {
              border: 0,
              borderRadius: '6px !important',
              px: 1.5,
              py: 0.5,
              fontSize: '11px',
              fontWeight: 600,
              color: '#a1a1aa',
              '&.Mui-selected': {
                bgcolor: 'var(--color-stop-1, #6366f1)',
                color: '#ffffff',
              },
            },
          }}
        >
          <ToggleButton value="time">Time</ToggleButton>
          <ToggleButton value="plays">Plays</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* 2-Column Leaderboards Grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {/* Top Songs Card */}
        <Box
          sx={{
            borderRadius: '16px',
            p: 2,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            bgcolor: 'rgba(22, 22, 28, 0.5)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Top Tracks
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {topSongs.map((s, idx) => (
              <Box
                key={s.name || idx}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  py: 0.75,
                  px: 1.25,
                  borderRadius: '10px',
                  bgcolor: 'rgba(255, 255, 255, 0.03)',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.06)' },
                }}
              >
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      color: idx === 0 ? themeColors.stop1 : 'text.secondary',
                      width: 18,
                      textAlign: 'center',
                    }}
                  >
                    {idx + 1}
                  </Typography>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography noWrap variant="body2" sx={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                      {s.name}
                    </Typography>
                    {s.artist && (
                      <Typography noWrap variant="caption" sx={{ color: '#a1a1aa', fontSize: '11px' }}>
                        {s.artist}
                      </Typography>
                    )}
                  </Box>
                </Stack>

                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', ml: 2, flexShrink: 0 }}>
                  {leaderboardMetric === 'time' ? formatDuration(s.listened_ms) : `${s.count} plays`}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Top Artists Card */}
        <Box
          sx={{
            borderRadius: '16px',
            p: 2,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            bgcolor: 'rgba(22, 22, 28, 0.5)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Top Artists
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {topArtists.map((a, idx) => (
              <Box
                key={a.name || idx}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  py: 0.75,
                  px: 1.25,
                  borderRadius: '10px',
                  bgcolor: 'rgba(255, 255, 255, 0.03)',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.06)' },
                }}
              >
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      color: idx === 0 ? themeColors.stop1 : 'text.secondary',
                      width: 18,
                      textAlign: 'center',
                    }}
                  >
                    {idx + 1}
                  </Typography>
                  <Typography noWrap variant="body2" sx={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', flex: 1 }}>
                    {a.name}
                  </Typography>
                </Stack>

                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', ml: 2, flexShrink: 0 }}>
                  {leaderboardMetric === 'time' ? formatDuration(a.listened_ms) : `${a.count} plays`}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
