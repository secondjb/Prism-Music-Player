import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Clock } from 'lucide-react';
import { formatDuration } from '../../utils/statsAggregation';
import { Line } from 'react-chartjs-2';

export interface StatsSummaryCardsProps {
  totalListeningTime: number;
  totalPlays: number;
  themeColors: { stop1: string; stop2: string; stop3: string };
  timePeriod: 'day' | 'week' | 'month';
  setTimePeriod: (p: 'day' | 'week' | 'month') => void;
  timeChartData: any;
  timeChartOptions: any;
}

export const StatsSummaryCards: React.FC<StatsSummaryCardsProps> = ({
  totalListeningTime,
  totalPlays,
  themeColors,
  timePeriod,
  setTimePeriod,
  timeChartData,
  timeChartOptions,
}) => {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: 2,
      }}
    >
      {/* Total Time Card */}
      <Box
        sx={{
          borderRadius: '16px',
          p: 2.25,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          background: `linear-gradient(135deg, ${themeColors.stop1}15 0%, ${themeColors.stop2}08 100%)`,
          bgcolor: 'rgba(22, 22, 28, 0.5)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.5 }}>
          <Clock size={16} style={{ color: themeColors.stop1 }} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '10px' }}>
            Total Time Listened
          </Typography>
        </Box>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 900,
            fontFamily: 'monospace',
            letterSpacing: '-0.03em',
            fontSize: { xs: '1.75rem', sm: '2.25rem' },
            background: `linear-gradient(to right, #ffffff, ${themeColors.stop1})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {formatDuration(totalListeningTime)}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, fontFamily: 'monospace', fontSize: '11px' }}>
          {totalPlays} total plays logged
        </Typography>
      </Box>

      {/* Period Line Chart Card */}
      <Box
        sx={{
          borderRadius: '16px',
          p: 2.25,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          bgcolor: 'rgba(22, 22, 28, 0.5)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Listening History
          </Typography>

          {/* Time Period Selector */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'rgba(0, 0, 0, 0.4)', p: 0.5, borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            {(['day', 'week', 'month'] as const).map((p) => {
              const isSelected = timePeriod === p;
              return (
                <Box
                  key={p}
                  component="button"
                  onClick={() => setTimePeriod(p)}
                  sx={{
                    px: 1.25,
                    py: 0.25,
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: 'none',
                    transition: 'all 0.15s ease',
                    bgcolor: isSelected ? 'var(--color-stop-1, #6366f1)' : 'transparent',
                    color: isSelected ? '#ffffff' : '#a1a1aa',
                    boxShadow: isSelected ? '0 2px 8px rgba(99, 102, 241, 0.4)' : 'none',
                    '&:hover': { color: '#ffffff' },
                  }}
                >
                  {p}
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box sx={{ height: 160, width: '100%' }}>
          <Line data={timeChartData} options={timeChartOptions} />
        </Box>
      </Box>
    </Box>
  );
};
