import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { ChevronLeft } from 'lucide-react';

export interface ArtistDetailHeaderProps {
  artistName: string;
  totalSongs: number;
  onBack: () => void;
}

export const ArtistDetailHeader: React.FC<ArtistDetailHeaderProps> = ({
  artistName,
  totalSongs,
  onBack,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        mb: 3,
        position: 'sticky',
        top: 0,
        bgcolor: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        px: 2.5,
        py: 1.5,
        zIndex: 10,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
        my: 1,
      }}
    >
      <IconButton
        onClick={onBack}
        sx={{
          color: '#ffffff',
          p: 1,
          borderRadius: '10px',
          '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' },
        }}
      >
        <ChevronLeft size={22} />
      </IconButton>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" noWrap sx={{ fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
          {artistName}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
          {totalSongs} total songs
        </Typography>
      </Box>
    </Box>
  );
};
