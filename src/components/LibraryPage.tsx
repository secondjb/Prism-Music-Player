import React from 'react';
import FavoriteIcon from '@mui/icons-material/Favorite';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import AddIcon from '@mui/icons-material/Add';
import IconButton from '@mui/material/IconButton';
import { usePlayerStore } from '../store/usePlayerStore';

export const LibraryPage: React.FC = () => {
  const playlists = usePlayerStore((s) => s.playlists || []);
  const setActiveTab = usePlayerStore((s) => s.setActiveTab);

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-32 p-4 pt-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Your Library</h1>
        <IconButton sx={{ color: '#a1a1aa', '&:hover': { color: '#ffffff' } }}>
          <AddIcon />
        </IconButton>
      </div>

      <div className="flex flex-col gap-3">
        {/* Pinned: Liked Songs */}
        <button 
          onClick={() => setActiveTab('liked')}
          className="flex items-center gap-4 w-full text-left p-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:bg-zinc-800/60 transition-all active:scale-[0.99]"
        >
          <div className="w-14 h-14 flex-shrink-0 bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center rounded-xl shadow-md">
            <FavoriteIcon sx={{ color: '#ffffff' }} />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Liked Songs</h3>
            <p className="text-xs text-zinc-400">Playlist • Favorites</p>
          </div>
        </button>

        {/* Pinned: All Tracks */}
        <button 
          onClick={() => setActiveTab('library')}
          className="flex items-center gap-4 w-full text-left p-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:bg-zinc-800/60 transition-all active:scale-[0.99]"
        >
          <div className="w-14 h-14 flex-shrink-0 bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center rounded-xl shadow-md">
            <MusicNoteIcon sx={{ color: '#ffffff' }} />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">All Tracks</h3>
            <p className="text-xs text-zinc-400">Playlist • Full Collection</p>
          </div>
        </button>

        {/* Dynamic Playlists */}
        {playlists.map((pl) => (
          <button 
            key={pl.id} 
            className="flex items-center gap-4 w-full text-left p-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:bg-zinc-800/60 transition-all active:scale-[0.99]"
          >
            <div className="w-14 h-14 flex-shrink-0 bg-zinc-800 flex items-center justify-center rounded-xl">
              <QueueMusicIcon sx={{ color: '#a1a1aa' }} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">{pl.name}</h3>
              <p className="text-xs text-zinc-400">Playlist • {pl.trackIds.length} tracks</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

