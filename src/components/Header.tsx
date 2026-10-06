import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import InputBase from '@mui/material/InputBase';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import { X, PanelLeft } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';

export const Header: React.FC = () => {
  const searchQuery = usePlayerStore((s) => s.searchQuery);
  const setSearchQuery = usePlayerStore((s) => s.setSearchQuery);
  const activeTab = usePlayerStore((s) => s.activeTab);
  const setActiveTab = usePlayerStore((s) => s.setActiveTab);
  const isSidebarVisible = usePlayerStore((s) => s.isSidebarVisible);
  const toggleSidebar = usePlayerStore((s) => s.toggleSidebar);

  const tracks = usePlayerStore((s) => s.tracks);
  const likedTrackIds = usePlayerStore((s) => s.likedTrackIds);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const getTitle = () => {
    switch (activeTab) {
      case 'library':
        return 'Music Library';
      case 'albums':
        return 'Albums';
      case 'artists':
        return 'Artists';
      case 'artistView':
        return 'Artist Details';
      case 'albumView':
        return 'Album Details';
      case 'liked':
        return 'Liked Songs';
      case 'playlists':
        return 'Playlists';
      case 'folders':
        return 'Local Folders';
      case 'lyrics':
        return 'Karaoke & Lyrics';
      case 'settings':
        return 'Library & Settings';
      default:
        return 'Music Library';
    }
  };

  const trackCount = activeTab === 'liked' ? likedTrackIds.length : tracks.length;

  return (
    <Box
      component="header"
      sx={{
        width: '100%',
        py: { xs: 1.5, sm: 2 },
        px: { xs: 2, sm: 4 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
        flexShrink: 0,
        gap: 2,
      }}
    >
      {/* Title & Count Badge */}
      <Stack direction="row" spacing={{ xs: 1.5, sm: 2 }} sx={{ alignItems: 'center', minWidth: 0 }}>
        {!isSidebarVisible && (
          <Tooltip title="Show sidebar" arrow>
            <IconButton
              size="small"
              onClick={toggleSidebar}
              sx={{
                color: '#a1a1aa',
                p: 0.75,
                mr: 0.5,
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                '&:hover': { color: '#ffffff', bgcolor: 'rgba(255, 255, 255, 0.12)' },
              }}
            >
              <PanelLeft size={18} />
            </IconButton>
          </Tooltip>
        )}

        <Typography
          variant="h5"
          noWrap
          sx={{
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            fontSize: { xs: '1.25rem', sm: '1.5rem' },
          }}
        >
          {getTitle()}
        </Typography>

        {(activeTab === 'library' || activeTab === 'liked') && (
          <Box
            component="span"
            sx={{
              px: { xs: 1, sm: 1.25 },
              py: 0.25,
              borderRadius: '9999px',
              fontSize: { xs: '11px', sm: '12px' },
              fontFamily: 'monospace',
              fontWeight: 600,
              bgcolor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
              color: 'var(--color-stop-1, #6366f1)',
              border: '1px solid color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
              flexShrink: 0,
              display: { xs: 'none', sm: 'inline-block' },
            }}
          >
            {trackCount} tracks
          </Box>
        )}
      </Stack>

      {/* Search Input & Settings Button */}
      <Stack direction="row" spacing={{ xs: 1.5, sm: 2 }} sx={{ alignItems: 'center', flexShrink: 0 }}>
        <Box
          sx={{
            position: 'relative',
            width: { xs: 180, sm: 240, md: 300 },
            borderRadius: '12px',
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid',
            borderColor: searchQuery.trim()
              ? 'var(--color-stop-1, #6366f1)'
              : 'rgba(255, 255, 255, 0.1)',
            boxShadow: searchQuery.trim()
              ? '0 0 12px color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)'
              : 'none',
            display: 'flex',
            alignItems: 'center',
            px: 1.5,
            py: 0.5,
            transition: 'border-color 0.2s, box-shadow 0.2s',
            '&:focus-within': {
              borderColor: 'var(--color-stop-1, #6366f1)',
              boxShadow: '0 0 12px color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)',
            },
          }}
        >
          <SearchIcon sx={{ color: '#a1a1aa', fontSize: 20, mr: 1, flexShrink: 0 }} />
          <InputBase
            value={searchQuery}
            onChange={handleChange}
            placeholder="Search tracks, artists, albums..."
            sx={{
              color: '#ffffff',
              fontSize: '13px',
              width: '100%',
              '& .MuiInputBase-input': {
                p: 0,
                background: 'transparent !important',
                border: 'none !important',
                outline: 'none !important',
                boxShadow: 'none !important',
                '&:focus': {
                  background: 'transparent !important',
                  border: 'none !important',
                  outline: 'none !important',
                  boxShadow: 'none !important',
                },
              },
              '& input::placeholder': {
                color: '#71717a',
                opacity: 1,
              },
            }}
          />
          {searchQuery && (
            <IconButton
              size="small"
              onClick={() => setSearchQuery('')}
              sx={{ p: 0.25, color: '#a1a1aa', '&:hover': { color: '#ffffff' } }}
            >
              <X size={14} />
            </IconButton>
          )}
        </Box>

        {/* Settings Button */}
        <Tooltip title="Library Folders & Settings" arrow>
          <IconButton
            onClick={() => setActiveTab('settings')}
            sx={{
              color: activeTab === 'settings' ? '#ffffff' : '#a1a1aa',
              bgcolor: activeTab === 'settings' ? 'var(--color-stop-1, #4f46e5)' : 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              p: 1,
              '&:hover': {
                bgcolor: activeTab === 'settings'
                  ? 'color-mix(in srgb, var(--color-stop-1, #4f46e5) 85%, black)'
                  : 'rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
              },
            }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
};
