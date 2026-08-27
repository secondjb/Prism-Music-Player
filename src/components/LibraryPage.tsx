import React from 'react';
import { Heart, Music, ListMusic, Plus } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';

export const LibraryPage: React.FC = () => {
  const playlists = usePlayerStore((s) => s.playlists || []);
  const setActiveTab = usePlayerStore((s) => s.setActiveTab);

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-32 p-4 pt-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your Library</h1>
        <button className="text-zinc-400 hover:text-white">
          <Plus size={24} />
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {/* Pinned: Liked Songs */}
        <button 
          onClick={() => setActiveTab('liked')}
          className="flex items-center gap-4 w-full text-left"
        >
          <div className="w-16 h-16 flex-shrink-0 bg-gradient-to-br from-indigo-500 to-indigo-800 flex items-center justify-center rounded-sm">
            <Heart fill="white" className="text-white" size={24} />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Liked Songs</h3>
            <p className="text-sm text-zinc-400">Playlist • You</p>
          </div>
        </button>

        {/* Pinned: All Tracks */}
        <button 
          onClick={() => setActiveTab('library')}
          className="flex items-center gap-4 w-full text-left"
        >
          <div className="w-16 h-16 flex-shrink-0 bg-gradient-to-br from-emerald-500 to-emerald-800 flex items-center justify-center rounded-sm">
            <Music className="text-white" size={24} />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">All Tracks</h3>
            <p className="text-sm text-zinc-400">Playlist • You</p>
          </div>
        </button>

        {/* Dynamic Playlists */}
        {playlists.map((pl) => (
          <button key={pl.id} className="flex items-center gap-4 w-full text-left">
            <div className="w-16 h-16 flex-shrink-0 bg-zinc-800 flex items-center justify-center rounded-sm">
              <ListMusic className="text-zinc-400" size={24} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">{pl.name}</h3>
              <p className="text-sm text-zinc-400">Playlist • {pl.trackIds.length} tracks</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
