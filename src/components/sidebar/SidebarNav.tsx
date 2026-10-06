import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {
  Library,
  Heart,
  Disc,
  Folder,
  Music,
  Mic2,
  Settings,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
  BarChart2,
  User,
} from 'lucide-react';
import { ActiveTab } from '../../types/player';
import { usePlayerStore } from '../../store/usePlayerStore';
import { SidebarPlaylists } from './SidebarPlaylists';

export interface SidebarNavProps {
  onOpenContextMenu: (pos: { top: number; left: number }, id: string, name: string) => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ onOpenContextMenu }) => {
  const activeTab = usePlayerStore((s) => s.activeTab);
  const setActiveTab = usePlayerStore((s) => s.setActiveTab);
  const setActivePlaylistId = usePlayerStore((s) => s.setActivePlaylistId);
  const latestUpdateResult = usePlayerStore((s) => s.latestUpdateResult);

  const [showPlaylists, setShowPlaylists] = useState(false);

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'library', label: 'All Tracks', icon: <Library size={18} /> },
    { id: 'filter', label: 'Advanced Filter', icon: <SlidersHorizontal size={18} /> },
    { id: 'artists', label: 'Artists', icon: <User size={18} /> },
    { id: 'albums', label: 'Albums', icon: <Disc size={18} /> },
    { id: 'liked', label: 'Liked Songs', icon: <Heart size={18} /> },
    { id: 'playlists', label: 'Playlists', icon: <Music size={18} /> },
    { id: 'folders', label: 'Folders', icon: <Folder size={18} /> },
    { id: 'lyrics', label: 'Karaoke & Lyrics', icon: <Mic2 size={18} /> },
    { id: 'stats', label: 'Listening Stats', icon: <BarChart2 size={18} /> },
    { id: 'settings', label: 'Library & Settings', icon: <Settings size={18} /> },
  ];

  const handleNavClick = (id: ActiveTab) => {
    setActiveTab(id);
    if (id === 'playlists') {
      setActivePlaylistId(null);
    }
    if (id === 'artists') {
      usePlayerStore.setState({ selectedArtist: null });
    }
    if (id === 'albums') {
      usePlayerStore.setState({ selectedAlbum: null });
    }
  };

  return (
    <Box component="nav" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography
        variant="caption"
        sx={{
          px: 1.5,
          fontSize: '11px',
          fontWeight: 700,
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          mb: 0.5,
          userSelect: 'none',
        }}
      >
        Navigation
      </Typography>

      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        const isPlaylists = item.id === 'playlists';

        return (
          <Box key={item.id} sx={{ display: 'flex', flexDirection: 'column' }}>
            <Box
              component="button"
              onClick={() => handleNavClick(item.id)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1.75,
                py: 1.25,
                borderRadius: '12px',
                border: '1px solid',
                borderColor: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                bgcolor: isActive ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                color: isActive ? '#ffffff' : '#a1a1aa',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                '&:hover': {
                  color: '#ffffff',
                  bgcolor: isActive ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    color: isActive ? 'var(--color-stop-1, #6366f1)' : '#a1a1aa',
                  }}
                >
                  {item.icon}
                </Box>
                <Typography variant="body2" sx={{ fontSize: '13px', fontWeight: isActive ? 600 : 500 }}>
                  {item.label}
                </Typography>
              </Box>

              {item.id === 'settings' && latestUpdateResult?.hasUpdate && (
                <Box
                  sx={{
                    px: 0.75,
                    py: 0.25,
                    borderRadius: '10px',
                    fontSize: '10px',
                    fontWeight: 700,
                    bgcolor: 'var(--color-stop-1, #6366f1)',
                    color: '#ffffff',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  }}
                >
                  Update
                </Box>
              )}

              {isPlaylists && (
                <Box
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPlaylists(!showPlaylists);
                  }}
                  sx={{
                    p: 0.5,
                    borderRadius: '6px',
                    color: '#71717a',
                    display: 'flex',
                    alignItems: 'center',
                    '&:hover': {
                      color: '#ffffff',
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                    },
                  }}
                >
                  {showPlaylists ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </Box>
              )}
            </Box>

            {/* Expandable Playlists Subtree */}
            {isPlaylists && showPlaylists && (
              <SidebarPlaylists onOpenContextMenu={onOpenContextMenu} />
            )}
          </Box>
        );
      })}
    </Box>
  );
};
