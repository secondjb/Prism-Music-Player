import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Doughnut, Bar } from 'react-chartjs-2';

export interface StatsChartsProps {
  genresData: any;
  genresOptions: any;
  habitsData: any;
  habitsOptions: any;
}

export const StatsCharts: React.FC<StatsChartsProps> = ({
  genresData,
  genresOptions,
  habitsData,
  habitsOptions,
}) => {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
        gap: 2,
      }}
    >
      {/* Top Genres Doughnut Chart */}
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
          Top Genres Breakdown
        </Typography>
        <Box sx={{ height: 190, width: '100%' }}>
          <Doughnut data={genresData} options={genresOptions} />
        </Box>
      </Box>

      {/* Listening Habits by Hour */}
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
          Listening Habits (Time of Day)
        </Typography>
        <Box sx={{ height: 190, width: '100%' }}>
          <Bar data={habitsData} options={habitsOptions} />
        </Box>
      </Box>
    </Box>
  );
};
