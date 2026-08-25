import React from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { Search, Settings } from 'lucide-react';

export const Header: React.FC = () => {
  const searchQuery = usePlayerStore((s) => s.searchQuery);
  const setSearchQuery = usePlayerStore((s) => s.setSearchQuery);
  const activeTab = usePlayerStore((s) => s.activeTab);
  const setActiveTab = usePlayerStore((s) => s.setActiveTab);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
  };

  const getTitle = () => {
    switch (activeTab) {
      case 'library':
        return 'Music Library';
      case 'albums':
        return 'Albums';
      case 'liked':
        return 'Liked Songs';
      case 'playlists':
        return 'Playlists';
      case 'folders':
        return 'Local Folders';
      case 'lyrics':
        return 'Karaoke & Lyrics';
      case 'settings':
        return 'Library & Settings';
      default:
        return 'Music Library';
    }
  };

  return (
    <header className="w-full py-4 px-8 flex items-center justify-between z-10 shrink-0">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">{getTitle()}</h2>
        <p className="text-xs text-zinc-400 mt-0.5 font-medium">
          Bit-perfect high-resolution local audio engine
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleChange}
            placeholder="Search tracks, artists, albums..."
            className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Settings Button */}
        <button
          onClick={() => setActiveTab('settings')}
          className={`p-2 rounded-xl transition-all border ${
            activeTab === 'settings'
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-white/10 border-white/10'
          }`}
          title="Library Folders & Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
