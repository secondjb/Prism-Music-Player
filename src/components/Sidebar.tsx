import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { FolderPlus, PanelLeftClose } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { usePlayerStore } from '../store/usePlayerStore';
import { GeminiLogo } from './GeminiLogo';
import { SidebarNav } from './sidebar/SidebarNav';
import { SidebarContextMenu } from './sidebar/SidebarContextMenu';

export const Sidebar: React.FC = () => {
  const setActiveTab = usePlayerStore((s) => s.setActiveTab);
  const addIncludedDirectory = usePlayerStore((s) => s.addIncludedDirectory);
  const includedDirectories = usePlayerStore((s) => s.includedDirectories);
  const isSidebarVisible = usePlayerStore((s) => s.isSidebarVisible);
  const toggleSidebar = usePlayerStore((s) => s.toggleSidebar);

  const [contextMenu, setContextMenu] = useState<{
    pos: { top: number; left: number };
    playlistId: string;
    name: string;
  } | null>(null);

  const handleQuickAddDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        await addIncludedDirectory(selected);
        setActiveTab('settings');
      }
    } catch (e) {
      console.warn('Picker error:', e);
    }
  };

  const handleOpenContextMenu = (pos: { top: number; left: number }, playlistId: string, name: string) => {
    setContextMenu({ pos, playlistId, name });
  };

  return (
    <Box
      component="aside"
      sx={{
        width: isSidebarVisible ? 256 : 0,
        opacity: isSidebarVisible ? 1 : 0,
        pointerEvents: isSidebarVisible ? 'auto' : 'none',
        height: '100%',
        bgcolor: 'rgba(18, 18, 24, 0.75)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRight: isSidebarVisible ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        p: isSidebarVisible ? 2 : 0,
        zIndex: 20,
        flexShrink: 0,
        userSelect: 'none',
        overflow: 'hidden',
        transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease, padding 0.22s ease',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: 224 }}>
        {/* App Logo & Collapse Button */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1,
            pt: 1,
          }}
        >
          <Box
            onClick={() => setActiveTab('library')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              cursor: 'pointer',
            }}
          >
            <GeminiLogo className="w-14 h-8 shrink-0" />
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                letterSpacing: '0.02em',
                lineHeight: 1,
                background:
                  'linear-gradient(to right, var(--color-stop-1, #6366F1), var(--color-stop-2, #8B5CF6), var(--color-stop-3, #EC4899), var(--color-stop-4, #D946EF), var(--color-stop-5, #3B82F6), var(--color-stop-6, #818CF8))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Prism
            </Typography>
          </Box>

          <Tooltip title="Hide sidebar" arrow placement="right">
            <IconButton
              size="small"
              onClick={toggleSidebar}
              sx={{
                color: '#a1a1aa',
                p: 0.75,
                borderRadius: '8px',
                '&:hover': { color: '#ffffff', bgcolor: 'rgba(255, 255, 255, 0.08)' },
              }}
            >
              <PanelLeftClose size={18} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Quick Add Library Folder Button (only if 0 folders added) */}
        {includedDirectories.length === 0 && (
          <Button
            variant="contained"
            onClick={handleQuickAddDirectory}
            startIcon={<FolderPlus size={16} />}
            sx={{
              bgcolor: 'var(--color-stop-1, #6366f1)',
              color: '#ffffff',
              borderRadius: '12px',
              py: 1,
              fontSize: '13px',
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: '0 4px 14px color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
              '&:hover': {
                bgcolor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 85%, #000000)',
              },
            }}
          >
            Add Library Folder
          </Button>
        )}

        {/* Navigation List */}
        <SidebarNav onOpenContextMenu={handleOpenContextMenu} />
      </Box>

      {/* Playlist Context Menu */}
      <SidebarContextMenu
        anchorPosition={contextMenu ? contextMenu.pos : null}
        onClose={() => setContextMenu(null)}
        playlistId={contextMenu ? contextMenu.playlistId : null}
        playlistName={contextMenu ? contextMenu.name : ''}
      />
    </Box>
  );
};
