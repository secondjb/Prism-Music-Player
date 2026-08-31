import React from 'react';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import Tooltip from '@mui/material/Tooltip';
import { usePlayerStore } from '../store/usePlayerStore';

export const Header: React.FC = () => {
  const searchQuery = usePlayerStore((s) => s.searchQuery);
  const setSearchQuery = usePlayerStore((s) => s.setSearchQuery);
  const activeTab = usePlayerStore((s) => s.activeTab);
  const setActiveTab = usePlayerStore((s) => s.setActiveTab);

  const tracks = usePlayerStore((s) => s.tracks);
  const likedTrackIds = usePlayerStore((s) => s.likedTrackIds);

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
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-white tracking-tight">{getTitle()}</h2>
        {(activeTab === 'library' || activeTab === 'liked') && (
          <span
            className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
              color: 'var(--color-stop-1, #6366f1)',
              borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
            }}
          >
            {activeTab === 'liked' ? `${likedTrackIds.length} tracks` : `${tracks.length} tracks`}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative w-72">
          <SearchIcon className="w-5 h-5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleChange}
            placeholder="Search tracks, artists, albums..."
            className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Settings Button */}
        <Tooltip title="Library Folders & Settings">
          <IconButton
            onClick={() => setActiveTab('settings')}
            sx={{
              color: activeTab === 'settings' ? '#ffffff' : '#a1a1aa',
              backgroundColor: activeTab === 'settings' ? '#4f46e5' : 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '8px',
              '&:hover': {
                backgroundColor: activeTab === 'settings' ? '#4338ca' : 'rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
              },
            }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </div>
    </header>
  );
};

