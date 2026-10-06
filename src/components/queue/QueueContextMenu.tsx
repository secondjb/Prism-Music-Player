import React, { useState } from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import {
  Play,
  ListPlus,
  PlusCircle,
  Heart,
  Info,
  Trash2,
  Check,
  Plus,
  ChevronRight,
} from 'lucide-react';
import { Track, Playlist } from '../../types/player';

export interface QueueContextMenuProps {
  anchorPosition: { top: number; left: number } | null;
  onClose: () => void;
  track: Track | null;
  isLiked: boolean;
  onToggleLike: (trackId: string) => void;
  playlists: Playlist[];
  onAddToPlaylist: (playlistId: string, trackId: string) => void;
  onCreatePlaylist: () => void;
  onPlayNow: () => void;
  onPlayNext: () => void;
  onRemove: () => void;
  onOpenDetails: () => void;
  canRemove: boolean;
}

export const QueueContextMenu: React.FC<QueueContextMenuProps> = ({
  anchorPosition,
  onClose,
  track,
  isLiked,
  onToggleLike,
  playlists,
  onAddToPlaylist,
  onCreatePlaylist,
  onPlayNow,
  onPlayNext,
  onRemove,
  onOpenDetails,
  canRemove,
}) => {
  const [playlistAnchorEl, setPlaylistAnchorEl] = useState<HTMLElement | null>(null);

  if (!track) return null;

  const handleCloseAll = () => {
    setPlaylistAnchorEl(null);
    onClose();
  };

  return (
    <>
      <Menu
        open={Boolean(anchorPosition)}
        onClose={handleCloseAll}
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition || undefined}
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
            onPlayNow();
            handleCloseAll();
          }}
        >
          <ListItemIcon sx={{ minWidth: 28, color: 'var(--color-stop-1, #6366f1)' }}>
            <Play size={16} />
          </ListItemIcon>
          <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>Play Now</Typography>
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
            onToggleLike(track.id);
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

        {canRemove && (
          <>
            <Divider sx={{ my: 0.5, borderColor: 'rgba(255, 255, 255, 0.08)' }} />
            <MenuItem
              onClick={() => {
                onRemove();
                handleCloseAll();
              }}
              sx={{ color: '#fb7185', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.15)', color: '#f87171' } }}
            >
              <ListItemIcon sx={{ minWidth: 28, color: 'inherit' }}>
                <Trash2 size={16} />
              </ListItemIcon>
              <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>Remove from Queue</Typography>
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Playlist Submenu */}
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
