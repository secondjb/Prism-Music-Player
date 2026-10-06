import React from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { Play, ListPlus, ListVideo, Pencil, Trash2 } from 'lucide-react';
import { Playlist } from '../../types/player';

export interface PlaylistContextMenuProps {
  anchorPosition: { top: number; left: number } | null;
  onClose: () => void;
  playlist: Playlist | null;
  onPlay: (pl: Playlist) => void;
  onPlayNext: (plId: string) => void;
  onAddToQueue: (plId: string) => void;
  onRename: (pl: Playlist) => void;
  onDelete: (plId: string) => void;
}

export const PlaylistContextMenu: React.FC<PlaylistContextMenuProps> = ({
  anchorPosition,
  onClose,
  playlist,
  onPlay,
  onPlayNext,
  onAddToQueue,
  onRename,
  onDelete,
}) => {
  if (!playlist) return null;

  const isLiked = playlist.id === '__liked__';

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
        {playlist.name}
      </Typography>

      <MenuItem
        onClick={() => {
          onPlay(playlist);
          onClose();
        }}
      >
        <ListItemIcon sx={{ minWidth: 28, color: 'var(--color-stop-1, #6366f1)' }}>
          <Play size={16} />
        </ListItemIcon>
        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>Play Now</Typography>
      </MenuItem>

      <MenuItem
        onClick={() => {
          onPlayNext(playlist.id);
          onClose();
        }}
      >
        <ListItemIcon sx={{ minWidth: 28, color: 'var(--color-stop-1, #6366f1)' }}>
          <ListPlus size={16} />
        </ListItemIcon>
        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>Play Next</Typography>
      </MenuItem>

      <MenuItem
        onClick={() => {
          onAddToQueue(playlist.id);
          onClose();
        }}
      >
        <ListItemIcon sx={{ minWidth: 28, color: 'text.secondary' }}>
          <ListVideo size={16} />
        </ListItemIcon>
        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>Add to Queue</Typography>
      </MenuItem>

      {!isLiked && (
        <>
          <Divider sx={{ my: 0.5, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

          <MenuItem
            onClick={() => {
              onRename(playlist);
              onClose();
            }}
          >
            <ListItemIcon sx={{ minWidth: 28, color: 'text.secondary' }}>
              <Pencil size={15} />
            </ListItemIcon>
            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>Rename</Typography>
          </MenuItem>

          <MenuItem
            onClick={() => {
              onDelete(playlist.id);
              onClose();
            }}
            sx={{
              color: '#fb7185',
              '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.15)', color: '#f87171' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 28, color: 'inherit' }}>
              <Trash2 size={15} />
            </ListItemIcon>
            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>Delete</Typography>
          </MenuItem>
        </>
      )}
    </Menu>
  );
};
