import React from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { Search, Sparkles, FolderDown } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export const Header: React.FC = () => {
  const { searchQuery, setSearchQuery, activeTab, tracks, setTracks } = usePlayerStore();

  const handleScanSampleFolder = async () => {
    try {
      const sampleTracks: any = await invoke('scan_sample_folder');
      if (sampleTracks && Array.isArray(sampleTracks)) {
        setTracks(sampleTracks);
      }
    } catch (e) {
      console.error('Failed to scan sample folder:', e);
    }
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
        {/* Search Input */}
        <div className="relative w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracks, artists, albums..."
            className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Scan Sample Folder Button if empty */}
        {tracks.length === 0 && (
          <button
            onClick={handleScanSampleFolder}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 text-xs font-semibold transition-all"
          >
            <FolderDown className="w-4 h-4" />
            Load Sample Folder
          </button>
        )}

        {/* High-res indicator badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-card text-xs font-mono text-amber-300 border border-amber-500/20">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>FLAC 192kHz/24b Ready</span>
        </div>
      </div>
    </header>
  );
};
