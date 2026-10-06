import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { FolderPlus } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { usePlayerStore } from '../store/usePlayerStore';
import { GeminiLogo } from './GeminiLogo';
import { SidebarNav } from './sidebar/SidebarNav';
import { SidebarContextMenu } from './sidebar/SidebarContextMenu';

export const Sidebar: React.FC = () => {
  const setActiveTab = usePlayerStore((s) => s.setActiveTab);
  const addIncludedDirectory = usePlayerStore((s) => s.addIncludedDirectory);
  const includedDirectories = usePlayerStore((s) => s.includedDirectories);

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
        width: 256,
        height: '100%',
        bgcolor: 'rgba(18, 18, 24, 0.75)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        p: 2,
        zIndex: 20,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* App Logo */}
        <Box
          onClick={() => setActiveTab('library')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 1,
            pt: 1,
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
