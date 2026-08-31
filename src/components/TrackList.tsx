import React, { useState, useRef, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import RadioIcon from '@mui/icons-material/Radio';

import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { Track } from '../types/player';

interface TrackListProps {
  tracks: Track[];
}

const formatDuration = (secs: number) => {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const TrackCardRow = memo(({
  track,
  idx,
  isSelected,
  isPlaying,
  onPlay,
  onOpenMenu,
}: {
  track: Track;
  idx: number;
  isSelected: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onOpenMenu: (e: React.MouseEvent<HTMLButtonElement>, track: Track) => void;
}) => {
  const art = useTrackArt(track);

  return (
    <Card
      elevation={isSelected ? 4 : 0}
      onClick={onPlay}
      className="group transition-all duration-150 cursor-pointer active:scale-[0.995]"
      sx={{
        backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.22)' : 'rgba(24, 24, 27, 0.75)',
        backdropFilter: 'blur(12px)',
        border: isSelected ? '1px solid rgba(129, 140, 248, 0.45)' : '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: '16px',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        margin: '0 2px',
        width: '100%',
        '&:hover': {
          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.3)' : 'rgba(39, 39, 42, 0.85)',
          borderColor: isSelected ? 'rgba(129, 140, 248, 0.6)' : 'rgba(255, 255, 255, 0.15)',
        },
      }}
    >
      {/* 1. Skinny Index / Number Column */}
      <div className="w-6 shrink-0 text-center font-mono text-xs font-semibold text-zinc-400">
        {isSelected ? (
          <div className="w-5 h-5 mx-auto rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
            {isPlaying ? <PauseIcon sx={{ fontSize: 13 }} /> : <PlayArrowIcon sx={{ fontSize: 13 }} />}
          </div>
        ) : (
          <span>{idx + 1}</span>
        )}
      </div>

      {/* 2. Album Art */}
      <div className="w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-zinc-800 border border-white/10 shadow-sm relative">
        {art ? (
          <img src={art} alt={track.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-900/60 to-purple-900/60 flex items-center justify-center">
            <MusicNoteIcon sx={{ color: '#818cf8', fontSize: 22 }} />
          </div>
        )}
      </div>

      {/* 3. Title on top of Artist (Stacked, taking max space) */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span className={`font-bold text-sm truncate leading-snug ${isSelected ? 'text-indigo-300' : 'text-white'}`}>
          {track.title}
        </span>
        <span className="text-xs text-zinc-400 truncate mt-0.5 font-normal">
          {track.artist}
        </span>
      </div>

      {/* 4. Duration */}
      <div className="shrink-0 text-xs font-mono font-medium text-zinc-400 pl-1">
        {formatDuration(track.duration_secs)}
      </div>

      {/* 5. 3 Dots Menu Button */}
      <div className="shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
        <IconButton
          size="small"
          onClick={(e) => onOpenMenu(e, track)}
          sx={{
            color: '#a1a1aa',
            '&:hover': { color: '#ffffff', backgroundColor: 'rgba(255, 255, 255, 0.12)' },
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </div>
    </Card>
  );
});

export const TrackList: React.FC<TrackListProps> = ({ tracks }) => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const likedTrackIds = usePlayerStore((s) => s.likedTrackIds);
  const toggleLikeTrack = usePlayerStore((s) => s.toggleLikeTrack);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const playNext = usePlayerStore((s) => s.playNext);
  const setInfoModalTrack = usePlayerStore((s) => s.setInfoModalTrack);

  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMenuTrack, setSelectedMenuTrack] = useState<Track | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 68,
    overscan: 5,
  });

  const handleOpenMenu = (e: React.MouseEvent<HTMLButtonElement>, track: Track) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
    setSelectedMenuTrack(track);
  };

  const handleCloseMenu = () => {
    setMenuAnchorEl(null);
    setSelectedMenuTrack(null);
  };

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3 glass-card rounded-2xl border border-dashed border-white/10 my-4">
        <div className="w-14 h-14 rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-500">
          <MusicNoteIcon sx={{ fontSize: 32 }} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">No tracks in library</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm">
            Add your music folders in Settings to start listening.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Scrollable Virtualized Container */}
      <div ref={parentRef} className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const idx = virtualRow.index;
            const track = tracks[idx];
            const isSelected = currentTrack?.id === track.id;

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: '6px',
                }}
              >
                <TrackCardRow
                  track={track}
                  idx={idx}
                  isSelected={isSelected}
                  isPlaying={isPlaying}
                  onPlay={() => playTrack(track, tracks)}
                  onOpenMenu={handleOpenMenu}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Material UI Options Context Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleCloseMenu}
        slotProps={{
          paper: {
            sx: {
              backgroundColor: '#18181b',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
              padding: '4px 0',
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            if (selectedMenuTrack) setInfoModalTrack(selectedMenuTrack);
            handleCloseMenu();
          }}
          sx={{ fontSize: '0.85rem', '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' } }}
        >
          <ListItemIcon>
            <InfoOutlinedIcon sx={{ color: '#60a5fa', fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText primary="Song Info / Details" />
        </MenuItem>

        <MenuItem
          onClick={() => {
            if (selectedMenuTrack) playNext(selectedMenuTrack);
            handleCloseMenu();
          }}
          sx={{ fontSize: '0.85rem', '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' } }}
        >
          <ListItemIcon>
            <RadioIcon sx={{ color: '#818cf8', fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText primary="Play Next" />
        </MenuItem>

        <MenuItem
          onClick={() => {
            if (selectedMenuTrack) addToQueue(selectedMenuTrack);
            handleCloseMenu();
          }}
          sx={{ fontSize: '0.85rem', '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' } }}
        >
          <ListItemIcon>
            <QueueMusicIcon sx={{ color: '#34d399', fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText primary="Add to Queue" />
        </MenuItem>

        <MenuItem
          onClick={() => {
            if (selectedMenuTrack) toggleLikeTrack(selectedMenuTrack.id);
            handleCloseMenu();
          }}
          sx={{ fontSize: '0.85rem', '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' } }}
        >
          <ListItemIcon>
            {selectedMenuTrack && likedTrackIds.includes(selectedMenuTrack.id) ? (
              <FavoriteIcon sx={{ color: '#ec4899', fontSize: 20 }} />
            ) : (
              <FavoriteBorderIcon sx={{ color: '#a1a1aa', fontSize: 20 }} />
            )}
          </ListItemIcon>
          <ListItemText primary={selectedMenuTrack && likedTrackIds.includes(selectedMenuTrack.id) ? 'Unlike' : 'Like'} />
        </MenuItem>
      </Menu>
    </div>
  );
};
