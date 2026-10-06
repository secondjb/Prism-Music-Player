import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Heart, Music } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';

export interface SidebarPlaylistsProps {
  onOpenContextMenu: (pos: { top: number; left: number }, id: string, name: string) => void;
}

export const SidebarPlaylists: React.FC<SidebarPlaylistsProps> = ({ onOpenContextMenu }) => {
  const activeTab = usePlayerStore((s) => s.activeTab);
  const setActiveTab = usePlayerStore((s) => s.setActiveTab);
  const playlists = usePlayerStore((s) => s.playlists);
  const activePlaylistId = usePlayerStore((s) => s.activePlaylistId);
  const setActivePlaylistId = usePlayerStore((s) => s.setActivePlaylistId);
  const addTrackToPlaylist = usePlayerStore((s) => s.addTrackToPlaylist);

  const [dragOverPlaylistId, setDragOverPlaylistId] = useState<string | null>(null);

  const handleLikedDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverPlaylistId(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.type === 'tracks' && Array.isArray(data.ids)) {
        const state = usePlayerStore.getState();
        data.ids.forEach((id: string) => {
          if (!state.likedTrackIds.includes(id)) {
            state.toggleLikeTrack(id);
          }
        });
      }
    } catch {}
  };

  const handlePlaylistDrop = (e: React.DragEvent, plId: string) => {
    e.preventDefault();
    setDragOverPlaylistId(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.type === 'tracks' && Array.isArray(data.ids)) {
        const state = usePlayerStore.getState();
        const targetPlaylist = state.playlists.find((p) => p.id === plId);
        if (!targetPlaylist) return;

        const existingSet = new Set(targetPlaylist.trackIds);
        const duplicates = data.ids.filter((id: string) => existingSet.has(id));

        if (duplicates.length > 0) {
          const addDuplicates = window.confirm(
            `${duplicates.length} of the ${data.ids.length} selected song(s) are already in "${targetPlaylist.name}".\n\nClick OK to add duplicates anyway, or Cancel to skip duplicates.`
          );

          if (addDuplicates) {
            data.ids.forEach((id: string) => addTrackToPlaylist(plId, id));
          } else {
            const uniqueIds = data.ids.filter((id: string) => !existingSet.has(id));
            uniqueIds.forEach((id: string) => addTrackToPlaylist(plId, id));
          }
        } else {
          data.ids.forEach((id: string) => addTrackToPlaylist(plId, id));
        }
      }
    } catch {}
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pl: 4, pr: 1, my: 0.5 }}>
      {/* Liked Songs Pseudo-Playlist */}
      <Box
        component="button"
        onDragEnter={(e) => e.preventDefault()}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setDragOverPlaylistId('liked');
        }}
        onDragLeave={() => setDragOverPlaylistId(null)}
        onDrop={handleLikedDrop}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenContextMenu({ top: e.clientY, left: e.clientX }, '__liked__', 'Liked Songs');
        }}
        onClick={() => setActiveTab('liked')}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          textAlign: 'left',
          fontSize: '12px',
          py: 0.75,
          px: 1.5,
          borderRadius: '8px',
          border: '1px solid transparent',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          bgcolor:
            dragOverPlaylistId === 'liked'
              ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)'
              : activeTab === 'liked'
              ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)'
              : 'transparent',
          color:
            activeTab === 'liked'
              ? 'var(--color-stop-1, #6366f1)'
              : dragOverPlaylistId === 'liked'
              ? '#ffffff'
              : '#a1a1aa',
          fontWeight: activeTab === 'liked' ? 600 : 400,
          '&:hover': {
            color: '#ffffff',
            bgcolor: 'rgba(255, 255, 255, 0.06)',
          },
        }}
      >
        <Heart size={14} className="text-pink-500 pointer-events-none" />
        <Typography variant="body2" noWrap sx={{ fontSize: '12px', fontWeight: 'inherit' }}>
          Liked Songs
        </Typography>
      </Box>

      {/* User Playlists */}
      {playlists.map((pl) => {
        const isCurrentActive = activeTab === 'playlists' && activePlaylistId === pl.id;
        const isDragOver = dragOverPlaylistId === pl.id;

        return (
          <Box
            key={pl.id}
            component="button"
            onDragEnter={(e) => e.preventDefault()}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              setDragOverPlaylistId(pl.id);
            }}
            onDragLeave={() => setDragOverPlaylistId(null)}
            onDrop={(e) => handlePlaylistDrop(e, pl.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenContextMenu({ top: e.clientY, left: e.clientX }, pl.id, pl.name);
            }}
            onClick={() => {
              setActiveTab('playlists');
              setActivePlaylistId(pl.id);
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              textAlign: 'left',
              fontSize: '12px',
              py: 0.75,
              px: 1.5,
              borderRadius: '8px',
              border: '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              bgcolor: isDragOver
                ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)'
                : isCurrentActive
                ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)'
                : 'transparent',
              color: isCurrentActive
                ? 'var(--color-stop-1, #6366f1)'
                : isDragOver
                ? '#ffffff'
                : '#a1a1aa',
              fontWeight: isCurrentActive ? 600 : 400,
              '&:hover': {
                color: '#ffffff',
                bgcolor: 'rgba(255, 255, 255, 0.06)',
              },
            }}
          >
            <Music size={14} className="pointer-events-none text-zinc-400" />
            <Typography
              variant="body2"
              sx={{
                fontSize: '12px',
                fontWeight: 'inherit',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {pl.name}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};
