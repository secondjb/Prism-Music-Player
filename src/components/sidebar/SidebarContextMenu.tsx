import React from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Typography from '@mui/material/Typography';
import { Play, ListPlus, ListVideo } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { Track } from '../../types/player';

export interface SidebarContextMenuProps {
  anchorPosition: { top: number; left: number } | null;
  onClose: () => void;
  playlistId: string | null;
  playlistName: string;
}

export const SidebarContextMenu: React.FC<SidebarContextMenuProps> = ({
  anchorPosition,
  onClose,
  playlistId,
  playlistName,
}) => {
  const addPlaylistToQueue = usePlayerStore((s) => s.addPlaylistToQueue);
  const playPlaylistNext = usePlayerStore((s) => s.playPlaylistNext);

  if (!playlistId) return null;

  const handlePlayNow = () => {
    const store = usePlayerStore.getState();
    let targetTracks: Track[] = [];
    if (playlistId === '__liked__') {
      targetTracks = store.tracks.filter((t) => store.likedTrackIds.includes(t.id));
    } else {
      const pl = store.playlists.find((p) => p.id === playlistId);
      if (pl) {
        targetTracks = pl.trackIds
          .map((id) => store.tracks.find((t) => t.id === id))
          .filter((t): t is Track => Boolean(t));
      }
    }
    if (targetTracks.length > 0) {
      store.playTrack(targetTracks[0], targetTracks);
    }
    onClose();
  };

  return (
    <Menu
      open={Boolean(anchorPosition)}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition || undefined}
      slotProps={{
        paper: {
          sx: {
            minWidth: 190,
            p: 0.5,
          },
        },
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          px: 1.5,
          py: 0.5,
          fontWeight: 700,
          color: 'text.secondary',
          fontSize: '11px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          mb: 0.5,
        }}
      >
        {playlistName}
      </Typography>

      <MenuItem onClick={handlePlayNow}>
        <ListItemIcon sx={{ minWidth: 28, color: 'var(--color-stop-1, #6366f1)' }}>
          <Play size={16} />
        </ListItemIcon>
        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>Play Now</Typography>
      </MenuItem>

      <MenuItem
        onClick={() => {
          playPlaylistNext(playlistId);
          onClose();
        }}
      >
        <ListItemIcon sx={{ minWidth: 28, color: 'var(--color-stop-1, #6366f1)' }}>
          <ListPlus size={16} />
        </ListItemIcon>
        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>Play Next (After Song)</Typography>
      </MenuItem>

      <MenuItem
        onClick={() => {
          addPlaylistToQueue(playlistId);
          onClose();
        }}
      >
        <ListItemIcon sx={{ minWidth: 28, color: 'text.secondary' }}>
          <ListVideo size={16} />
        </ListItemIcon>
        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>Add Playlist to Queue</Typography>
      </MenuItem>
    </Menu>
  );
};
