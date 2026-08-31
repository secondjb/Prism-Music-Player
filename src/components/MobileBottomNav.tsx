import React from 'react';
import Paper from '@mui/material/Paper';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import HomeIcon from '@mui/icons-material/Home';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import SearchIcon from '@mui/icons-material/Search';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import LibraryMusicOutlinedIcon from '@mui/icons-material/LibraryMusicOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { usePlayerStore } from '../store/usePlayerStore';

export const MobileBottomNav: React.FC = () => {
  const activeTab = usePlayerStore((s) => s.activeTab);
  const setActiveTab = usePlayerStore((s) => s.setActiveTab);

  const tabToValue = (tab: string) => {
    switch (tab) {
      case 'home':
        return 0;
      case 'search':
        return 1;
      case 'library':
        return 2;
      case 'settings':
        return 3;
      default:
        return 0;
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    const tabs = ['home', 'search', 'library', 'settings'];
    if (tabs[newValue]) {
      setActiveTab(tabs[newValue] as any);
    }
  };

  return (
    <Paper
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800/80 backdrop-blur-xl"
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(15, 15, 18, 0.95)',
        backgroundImage: 'none',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <BottomNavigation
        showLabels
        value={tabToValue(activeTab)}
        onChange={handleTabChange}
        sx={{
          backgroundColor: 'transparent',
          height: 64,
          '& .MuiBottomNavigationAction-root': {
            color: '#71717a',
            minWidth: 'auto',
            padding: '6px 0',
            '&.Mui-selected': {
              color: '#818cf8',
              '& .MuiSvgIcon-root': {
                transform: 'scale(1.1)',
                transition: 'transform 0.2s ease-in-out',
              },
            },
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.7rem',
            fontWeight: 500,
            marginTop: '2px',
            '&.Mui-selected': {
              fontSize: '0.75rem',
              fontWeight: 600,
            },
          },
        }}
      >
        <BottomNavigationAction
          label="Home"
          icon={activeTab === 'home' ? <HomeIcon /> : <HomeOutlinedIcon />}
        />
        <BottomNavigationAction
          label="Search"
          icon={<SearchIcon />}
        />
        <BottomNavigationAction
          label="Library"
          icon={activeTab === 'library' ? <LibraryMusicIcon /> : <LibraryMusicOutlinedIcon />}
        />
        <BottomNavigationAction
          label="Settings"
          icon={activeTab === 'settings' ? <SettingsIcon /> : <SettingsOutlinedIcon />}
        />
      </BottomNavigation>
    </Paper>
  );
};

