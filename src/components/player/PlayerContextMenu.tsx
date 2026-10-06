import React, { useState } from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import {
  ListEnd,
  ListPlus,
  PlusCircle,
  Heart,
  Info,
  Check,
  Plus,
  ChevronRight,
} from 'lucide-react';
import { Track, Playlist } from '../../types/player';

export interface PlayerContextMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  track: Track;
  isLiked: boolean;
  onToggleLike: () => void;
  playlists: Playlist[];
  onAddToPlaylist: (playlistId: string, trackId: string) => void;
  onCreatePlaylist: () => void;
  onAddToQueue: () => void;
  onPlayNext: () => void;
  onOpenDetails: () => void;
}

export const PlayerContextMenu: React.FC<PlayerContextMenuProps> = ({
  anchorEl,
  open,
  onClose,
  track,
  isLiked,
  onToggleLike,
  playlists,
  onAddToPlaylist,
  onCreatePlaylist,
  onAddToQueue,
  onPlayNext,
  onOpenDetails,
}) => {
  const [playlistAnchorEl, setPlaylistAnchorEl] = useState<HTMLElement | null>(null);

  const handleCloseAll = () => {
    setPlaylistAnchorEl(null);
    onClose();
  };

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleCloseAll}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 200,
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
          {track.title}
        </Typography>

        <MenuItem
          onClick={() => {
            onAddToQueue();
            handleCloseAll();
          }}
        >
          <ListItemIcon sx={{ minWidth: 28, color: 'var(--color-stop-1, #6366f1)' }}>
            <ListEnd size={16} />
          </ListItemIcon>
          <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>Add to Queue</Typography>
        </MenuItem>

        <MenuItem
          onClick={() => {
            onPlayNext();
            handleCloseAll();
          }}
        >
          <ListItemIcon sx={{ minWidth: 28, color: 'var(--color-stop-1, #6366f1)' }}>
            <ListPlus size={16} />
          </ListItemIcon>
          <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>Play Next</Typography>
        </MenuItem>

        <MenuItem
          onClick={(e) => {
            setPlaylistAnchorEl(e.currentTarget);
          }}
          sx={{ display: 'flex', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ListItemIcon sx={{ minWidth: 28, color: 'var(--color-stop-1, #6366f1)' }}>
              <PlusCircle size={16} />
            </ListItemIcon>
            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>Add to Playlist</Typography>
          </div>
          <ChevronRight size={14} className="text-zinc-400" />
        </MenuItem>

        <MenuItem
          onClick={() => {
            onToggleLike();
            handleCloseAll();
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: 28,
              color: isLiked ? '#ec4899' : 'var(--color-stop-1, #6366f1)',
            }}
          >
            <Heart size={16} fill={isLiked ? '#ec4899' : 'transparent'} />
          </ListItemIcon>
          <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
            {isLiked ? 'Unlike' : 'Like'}
          </Typography>
        </MenuItem>

        <Divider sx={{ my: 0.5, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

        <MenuItem
          onClick={() => {
            onOpenDetails();
            handleCloseAll();
          }}
        >
          <ListItemIcon sx={{ minWidth: 28, color: 'var(--color-stop-1, #6366f1)' }}>
            <Info size={16} />
          </ListItemIcon>
          <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>Song Details & Specs</Typography>
        </MenuItem>
      </Menu>

      {/* Playlist Nested Menu */}
      <Menu
        anchorEl={playlistAnchorEl}
        open={Boolean(playlistAnchorEl)}
        onClose={() => setPlaylistAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 180,
              maxHeight: 280,
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
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            mb: 0.5,
          }}
        >
          Your Playlists
        </Typography>

        {playlists.length === 0 ? (
          <MenuItem disabled sx={{ fontSize: '11px', color: 'text.secondary', fontStyle: 'italic' }}>
            No playlists yet
          </MenuItem>
        ) : (
          playlists.map((pl) => {
            const inPlaylist = pl.trackIds.includes(track.id);
            return (
              <MenuItem
                key={pl.id}
                onClick={() => {
                  onAddToPlaylist(pl.id, track.id);
                  handleCloseAll();
                }}
                sx={{ display: 'flex', justifyContent: 'space-between' }}
              >
                <Typography
                  sx={{
                    fontSize: '12px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {pl.name}
                </Typography>
                {inPlaylist && (
                  <Check size={14} style={{ color: 'var(--color-stop-1, #6366f1)', marginLeft: 8 }} />
                )}
              </MenuItem>
            );
          })
        )}

        <Divider sx={{ my: 0.5, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

        <MenuItem
          onClick={() => {
            onCreatePlaylist();
            handleCloseAll();
          }}
          sx={{ color: 'var(--color-stop-1, #6366f1)' }}
        >
          <ListItemIcon sx={{ minWidth: 24, color: 'var(--color-stop-1, #6366f1)' }}>
            <Plus size={14} />
          </ListItemIcon>
          <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>New Playlist...</Typography>
        </MenuItem>
      </Menu>
    </>
  );
};
