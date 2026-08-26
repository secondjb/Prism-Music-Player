import React, { useState } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { ActiveTab } from '../types/player';
import { Library, Heart, Disc, Folder, Music, Mic2, FolderPlus, Sparkles, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';

export const Sidebar: React.FC = () => {
  const activeTab = usePlayerStore((s) => s.activeTab);
  const setActiveTab = usePlayerStore((s) => s.setActiveTab);
  const addIncludedDirectory = usePlayerStore((s) => s.addIncludedDirectory);
  const tracks = usePlayerStore((s) => s.tracks);
  const playlists = usePlayerStore((s) => s.playlists);
  const activePlaylistId = usePlayerStore((s) => s.activePlaylistId);
  const setActivePlaylistId = usePlayerStore((s) => s.setActivePlaylistId);
  const addTrackToPlaylist = usePlayerStore((s) => s.addTrackToPlaylist);

  const [showPlaylists, setShowPlaylists] = useState(false);
  const [dragOverPlaylistId, setDragOverPlaylistId] = useState<string | null>(null);

  const handleQuickAddDirectory = async () => {
    try {
      if (window.__TAURI_INTERNALS__) {
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Select Music Library Folder',
        });
        if (selected && typeof selected === 'string') {
          await addIncludedDirectory(selected);
          setActiveTab('settings');
        }
      }
    } catch (e) {
      console.warn('Dialog error:', e);
    }
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'library', label: 'All Tracks', icon: <Library className="w-5 h-5" /> },
    { id: 'albums', label: 'Albums', icon: <Disc className="w-5 h-5" /> },
    { id: 'liked', label: 'Liked Songs', icon: <Heart className="w-5 h-5" /> },
    { id: 'playlists', label: 'Playlists', icon: <Music className="w-5 h-5" /> },
    { id: 'folders', label: 'Folders', icon: <Folder className="w-5 h-5" /> },
    { id: 'lyrics', label: 'Karaoke & Lyrics', icon: <Mic2 className="w-5 h-5" /> },
    { id: 'settings', label: 'Library & Settings', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <aside className="w-64 h-full glass border-r border-white/10 flex flex-col justify-between p-4 z-20 shrink-0">
      <div className="flex flex-col gap-6">
        {/* App Logo */}
        <div className="flex items-center gap-3 px-2 pt-2 cursor-pointer" onClick={() => setActiveTab('library')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white tracking-wide leading-none">PRISM</h1>
            <p className="text-[11px] text-zinc-400 font-medium tracking-wider uppercase mt-1">High-Res FLAC</p>
          </div>
        </div>

        {/* Action Button: Manage Library Folders */}
        <button
          onClick={handleQuickAddDirectory}
          className="flex items-center justify-center gap-2.5 w-full py-2.5 px-4 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white font-medium text-sm transition-all duration-200 shadow-md shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98]"
        >
          <FolderPlus className="w-4 h-4" />
          <span>Add Library Folder</span>
        </button>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1">
          <p className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Navigation</p>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const isPlaylists = item.id === 'playlists';
            return (
              <div key={item.id} className="flex flex-col gap-0.5">
                <button
                  onClick={() => {
                    setActiveTab(item.id);
                  }}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-white/15 text-white shadow-sm border border-white/10'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={isActive ? 'text-indigo-400' : 'text-zinc-400'}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {isPlaylists && (
                    <div
                      className="text-zinc-500 p-1 hover:text-zinc-300 rounded-md hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPlaylists(!showPlaylists);
                      }}
                    >
                      {showPlaylists ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  )}
                </button>

                {/* Sub Playlists List */}
                {isPlaylists && showPlaylists && (
                  <div className="flex flex-col gap-0.5 pl-9 pr-2 mt-1 mb-1">
                    {/* Liked Songs Pseudo-Playlist */}
                    <button
                      onDragEnter={(e) => e.preventDefault()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'copy';
                        setDragOverPlaylistId('liked');
                      }}
                      onDragLeave={() => setDragOverPlaylistId(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverPlaylistId(null);
                        try {
                          const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                          if (data.type === 'tracks' && Array.isArray(data.ids)) {
                            const state = usePlayerStore.getState();
                            data.ids.forEach((id: string) => {
                              if (!state.likedTrackIds.includes(id)) {
                                state.toggleLikeTrack(id);
                              }
                            });
                          }
                        } catch (err) {}
                      }}
                      onClick={() => {
                        setActiveTab('liked');
                      }}
                      className={`flex items-center gap-2 text-left text-xs py-1.5 px-3 rounded-lg truncate transition-colors ${
                        activeTab === 'liked'
                          ? 'bg-indigo-500/20 text-indigo-300 font-medium'
                          : dragOverPlaylistId === 'liked'
                          ? 'bg-indigo-500/40 text-white'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                      }`}
                    >
                      <Heart className="w-3.5 h-3.5 text-pink-500 pointer-events-none" />
                      <span className="pointer-events-none">Liked Songs</span>
                    </button>

                    {/* User Playlists */}
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        onDragEnter={(e) => e.preventDefault()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'copy';
                          setDragOverPlaylistId(pl.id);
                        }}
                        onDragLeave={() => setDragOverPlaylistId(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverPlaylistId(null);
                          try {
                            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                            if (data.type === 'tracks' && Array.isArray(data.ids)) {
                              data.ids.forEach((id: string) => addTrackToPlaylist(pl.id, id));
                            }
                          } catch (err) {}
                        }}
                        onClick={() => {
                          setActiveTab('playlists');
                          setActivePlaylistId(pl.id);
                        }}
                        className={`text-left text-xs py-1.5 px-3 rounded-lg truncate transition-colors ${
                          activeTab === 'playlists' && activePlaylistId === pl.id
                            ? 'bg-indigo-500/20 text-indigo-300 font-medium'
                            : dragOverPlaylistId === pl.id
                            ? 'bg-indigo-500/40 text-white'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                        }`}
                      >
                        <span className="pointer-events-none">{pl.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
