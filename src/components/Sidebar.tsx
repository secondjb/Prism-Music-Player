import React from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { ActiveTab } from '../types/player';
import { Library, Heart, Disc, Folder, Music, Mic2, FolderPlus, Sparkles } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, setTracks, tracks } = usePlayerStore();

  const handleScanDirectory = async () => {
    try {
      if (window.__TAURI_INTERNALS__) {
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Select Music Directory',
        });
        if (selected && typeof selected === 'string') {
          const scannedTracks: any = await invoke('scan_directory', { dirPath: selected });
          if (scannedTracks && Array.isArray(scannedTracks)) {
            setTracks(scannedTracks);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Dialog error or scan error:', e);
    }
    // Fallback to sample folder scan
    try {
      const sampleTracks: any = await invoke('scan_sample_folder');
      if (sampleTracks && Array.isArray(sampleTracks)) {
        setTracks(sampleTracks);
      }
    } catch (err) {
      console.error('Scan sample folder error:', err);
    }
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'library', label: 'All Tracks', icon: <Library className="w-5 h-5" /> },
    { id: 'albums', label: 'Albums', icon: <Disc className="w-5 h-5" /> },
    { id: 'liked', label: 'Liked Songs', icon: <Heart className="w-5 h-5" /> },
    { id: 'playlists', label: 'Playlists', icon: <Music className="w-5 h-5" /> },
    { id: 'folders', label: 'Folders', icon: <Folder className="w-5 h-5" /> },
    { id: 'lyrics', label: 'Karaoke & Lyrics', icon: <Mic2 className="w-5 h-5" /> },
  ];

  return (
    <aside className="w-64 h-full glass border-r border-white/10 flex flex-col justify-between p-4 z-20 shrink-0">
      <div className="flex flex-col gap-6">
        {/* App Logo */}
        <div className="flex items-center gap-3 px-2 pt-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white tracking-wide leading-none">PRISM</h1>
            <p className="text-[11px] text-zinc-400 font-medium tracking-wider uppercase mt-1">High-Res FLAC</p>
          </div>
        </div>

        {/* Action Button: Scan Folder */}
        <button
          onClick={handleScanDirectory}
          className="flex items-center justify-center gap-2.5 w-full py-2.5 px-4 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white font-medium text-sm transition-all duration-200 shadow-md shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98]"
        >
          <FolderPlus className="w-4 h-4" />
          <span>Import Directory</span>
        </button>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1">
          <p className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Navigation</p>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-white/15 text-white shadow-sm border border-white/10'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                }`}
              >
                <span className={isActive ? 'text-indigo-400' : 'text-zinc-400'}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="px-3 py-3 glass-card rounded-xl border border-white/5">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Library</span>
          <span className="font-mono text-indigo-400 font-semibold">{tracks.length} tracks</span>
        </div>
      </div>
    </aside>
  );
};
