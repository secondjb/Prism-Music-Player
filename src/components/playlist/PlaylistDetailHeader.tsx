import React, { useState, useRef } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { ArrowLeft, Play, Pencil, Check, Plus, PlusCircle, Camera, Music, RotateCcw, Palette, Heart } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { Playlist, Track } from '../../types/player';
import { useTrackArt } from '../../utils/useTrackArt';

export interface PlaylistDetailHeaderProps {
  playlistId: string;
  playlistName: string;
  trackCount: number;
  totalDurationSecs: number;
  isLikedPlaylist: boolean;
  playlist?: Playlist;
  firstTrack?: Track;
  onBack: () => void;
  onPlayAll: () => void;
  showAddSongs: boolean;
  onToggleAddSongs: () => void;
}

const PRESET_COLORS = [
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Sky', hex: '#0ea5e9' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Zinc', hex: '#71717a' },
];

export const PlaylistDetailHeader: React.FC<PlaylistDetailHeaderProps> = ({
  playlistId,
  playlistName,
  trackCount,
  totalDurationSecs,
  isLikedPlaylist,
  playlist,
  firstTrack,
  onBack,
  onPlayAll,
  showAddSongs,
  onToggleAddSongs,
}) => {
  const renamePlaylist = usePlayerStore((s) => s.renamePlaylist);
  const updatePlaylistCover = usePlayerStore((s) => s.updatePlaylistCover);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(playlistName);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [imgError, setImgError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const art = useTrackArt(firstTrack || null, { thumbnail: true, maxSize: 256 });

  const handleSaveRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== playlistName && !isLikedPlaylist) {
      renamePlaylist(playlistId, trimmed);
    }
    setIsEditing(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) return;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 512;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          updatePlaylistCover(playlistId, compressedDataUrl);
          setImgError(false);
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    setMenuAnchor(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSelectColor = (hex: string) => {
    updatePlaylistCover(playlistId, `color:${hex}`);
    setMenuAnchor(null);
    setShowColorPicker(false);
  };

  const handleResetCover = () => {
    updatePlaylistCover(playlistId, null);
    setMenuAnchor(null);
    setShowColorPicker(false);
    setImgError(false);
  };

  const totalMins = Math.floor(totalDurationSecs / 60);
  const customCover = playlist?.customCoverUri;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 2,
        mb: 3,
        flexShrink: 0,
      }}
    >
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Back button, Artwork & Playlist Title */}
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', minWidth: 0 }}>
        <Tooltip title="Back to Playlists" arrow>
          <IconButton
            onClick={onBack}
            sx={{
              p: 1.25,
              borderRadius: '12px',
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.12)' },
            }}
          >
            <ArrowLeft size={20} />
          </IconButton>
        </Tooltip>

        {/* Playlist Artwork Box with Edit Hover */}
        <Box
          onClick={(e) => {
            if (!isLikedPlaylist) setMenuAnchor(e.currentTarget);
          }}
          sx={{
            position: 'relative',
            width: 72,
            height: 72,
            borderRadius: '14px',
            overflow: 'hidden',
            flexShrink: 0,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            cursor: !isLikedPlaylist ? 'pointer' : 'default',
            '&:hover .edit-overlay': {
              opacity: !isLikedPlaylist ? 1 : 0,
            },
          }}
        >
          {isLikedPlaylist ? (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
              }}
            >
              <Heart size={32} fill="#ffffff" color="#ffffff" />
            </Box>
          ) : customCover && !imgError ? (
            customCover.startsWith('color:') ? (
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  bgcolor: customCover.slice(6),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Music size={28} style={{ color: 'rgba(255, 255, 255, 0.85)' }} />
              </Box>
            ) : (
              <Box
                component="img"
                src={customCover}
                alt={playlistName}
                onError={() => setImgError(true)}
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )
          ) : art ? (
            <Box
              component="img"
              src={art}
              alt={playlistName}
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.35) 0%, rgba(139, 92, 246, 0.2) 100%)',
              }}
            >
              <Music size={28} style={{ color: 'rgba(255, 255, 255, 0.6)' }} />
            </Box>
          )}

          {!isLikedPlaylist && (
            <Box
              className="edit-overlay"
              sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: 'rgba(0, 0, 0, 0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                transition: 'opacity 0.2s ease',
                backdropFilter: 'blur(2px)',
              }}
            >
              <Camera size={20} color="#ffffff" />
            </Box>
          )}
        </Box>

        {/* Artwork Action Menu */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => {
            setMenuAnchor(null);
            setShowColorPicker(false);
          }}
          slotProps={{
            paper: {
              sx: {
                bgcolor: 'rgba(24, 24, 27, 0.95)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                color: '#ffffff',
                minWidth: 180,
              },
            },
          }}
        >
          <MenuItem onClick={() => fileInputRef.current?.click()}>
            <ListItemIcon sx={{ color: '#ffffff' }}>
              <Camera size={16} />
            </ListItemIcon>
            <ListItemText primary={<Typography sx={{ fontSize: '0.85rem' }}>Upload image</Typography>} />
          </MenuItem>
          <MenuItem onClick={() => setShowColorPicker(!showColorPicker)}>
            <ListItemIcon sx={{ color: '#ffffff' }}>
              <Palette size={16} />
            </ListItemIcon>
            <ListItemText primary={<Typography sx={{ fontSize: '0.85rem' }}>Set theme color</Typography>} />
          </MenuItem>

          {showColorPicker && (
            <Box sx={{ px: 2, py: 1, display: 'flex', flexWrap: 'wrap', gap: 1, maxWidth: 200 }}>
              {PRESET_COLORS.map((c) => (
                <Box
                  key={c.hex}
                  onClick={() => handleSelectColor(c.hex)}
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    bgcolor: c.hex,
                    cursor: 'pointer',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    '&:hover': { transform: 'scale(1.15)', borderColor: '#ffffff' },
                    transition: 'all 0.15s ease',
                  }}
                  title={c.name}
                />
              ))}
            </Box>
          )}

          {customCover && (
            <MenuItem onClick={handleResetCover}>
              <ListItemIcon sx={{ color: '#f43f5e' }}>
                <RotateCcw size={16} />
              </ListItemIcon>
              <ListItemText
                primary={<Typography sx={{ fontSize: '0.85rem', color: '#f43f5e' }}>Reset to default</Typography>}
              />
            </MenuItem>
          )}
        </Menu>

        <Box sx={{ minWidth: 0 }}>
          {isEditing && !isLikedPlaylist ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <input
                type="text"
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                onBlur={handleSaveRename}
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--color-stop-1, #6366f1)',
                  borderRadius: '8px',
                  padding: '4px 8px',
                  color: '#ffffff',
                  outline: 'none',
                }}
              />
              <IconButton size="small" onClick={handleSaveRename} sx={{ color: 'var(--color-stop-1, #6366f1)' }}>
                <Check size={18} />
              </IconButton>
            </Stack>
          ) : (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography
                variant="h5"
                noWrap
                title={playlistName}
                sx={{
                  fontWeight: 800,
                  color: '#ffffff',
                  letterSpacing: '-0.02em',
                  fontSize: { xs: '1.25rem', sm: '1.5rem' },
                }}
              >
                {playlistName}
              </Typography>
              {!isLikedPlaylist && (
                <IconButton
                  size="small"
                  onClick={() => {
                    setEditName(playlistName);
                    setIsEditing(true);
                  }}
                  sx={{ color: '#71717a', '&:hover': { color: '#ffffff' } }}
                >
                  <Pencil size={15} />
                </IconButton>
              )}
            </Stack>
          )}

          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, mt: 0.25, display: 'block' }}>
            {trackCount} track{trackCount !== 1 ? 's' : ''}
            {totalDurationSecs > 0 && ` • ${totalMins} min${totalMins !== 1 ? 's' : ''}`}
          </Typography>
        </Box>
      </Stack>

      {/* Right Actions: Play All & Add Songs Toggle */}
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Button
          variant="contained"
          startIcon={<Play size={16} fill="currentColor" />}
          onClick={onPlayAll}
          disabled={trackCount === 0}
          sx={{
            borderRadius: '12px',
            textTransform: 'none',
            fontWeight: 700,
            px: 2.5,
            py: 1,
            background: 'linear-gradient(135deg, var(--color-stop-1, #6366f1) 0%, var(--color-stop-2, #8b5cf6) 100%)',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
            '&:hover': {
              background: 'linear-gradient(135deg, var(--color-stop-1, #6366f1) 20%, var(--color-stop-2, #8b5cf6) 120%)',
            },
            '&.Mui-disabled': {
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              color: 'rgba(255, 255, 255, 0.2)',
            },
          }}
        >
          Play All
        </Button>

        {!isLikedPlaylist && (
          <Tooltip title={showAddSongs ? 'Hide song browser' : 'Add songs to this playlist'} arrow>
            <Button
              variant="outlined"
              startIcon={showAddSongs ? <PlusCircle size={16} /> : <Plus size={16} />}
              onClick={onToggleAddSongs}
              sx={{
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 600,
                px: 2,
                py: 1,
                borderColor: showAddSongs ? 'var(--color-stop-1, #6366f1)' : 'rgba(255, 255, 255, 0.15)',
                color: showAddSongs ? 'var(--color-stop-1, #6366f1)' : '#ffffff',
                bgcolor: showAddSongs ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                '&:hover': {
                  borderColor: 'var(--color-stop-1, #6366f1)',
                  bgcolor: 'rgba(99, 102, 241, 0.15)',
                },
              }}
            >
              {showAddSongs ? 'Adding Songs' : 'Add Songs'}
            </Button>
          </Tooltip>
        )}
      </Stack>
    </Box>
  );
};
