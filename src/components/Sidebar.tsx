import React, { useState } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { ActiveTab, Track } from '../types/player';
import { Library, Heart, Disc, Folder, Music, Mic2, FolderPlus, Settings, ChevronDown, ChevronRight, SlidersHorizontal, BarChart2, ListPlus, ListVideo, Play, User } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { GeminiLogo } from './GeminiLogo';

export const Sidebar: React.FC = () => {
  const activeTab = usePlayerStore((s) => s.activeTab);
  const setActiveTab = usePlayerStore((s) => s.setActiveTab);
  const addIncludedDirectory = usePlayerStore((s) => s.addIncludedDirectory);
  const tracks = usePlayerStore((s) => s.tracks);
  const playlists = usePlayerStore((s) => s.playlists);
  const activePlaylistId = usePlayerStore((s) => s.activePlaylistId);
  const setActivePlaylistId = usePlayerStore((s) => s.setActivePlaylistId);
  const addTrackToPlaylist = usePlayerStore((s) => s.addTrackToPlaylist);
  const playPlaylistNext = usePlayerStore((s) => s.playPlaylistNext);
  const addPlaylistToQueue = usePlayerStore((s) => s.addPlaylistToQueue);
  const latestUpdateResult = usePlayerStore((s) => s.latestUpdateResult);

  const includedDirectories = usePlayerStore((s) => s.includedDirectories);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [dragOverPlaylistId, setDragOverPlaylistId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; playlistId: string; name: string } | null>(null);

  const handleQuickAddDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      console.log('Picked directory path:', selected);
      if (selected && typeof selected === 'string') {
        await addIncludedDirectory(selected);
        setActiveTab('settings');
      }
    } catch (e) {
      console.warn('Picker error:', e);
    }
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'library', label: 'All Tracks', icon: <Library className="w-5 h-5" /> },
    { id: 'filter', label: 'Advanced Filter', icon: <SlidersHorizontal className="w-5 h-5" /> },
    { id: 'artists', label: 'Artists', icon: <User className="w-5 h-5" /> },
    { id: 'albums', label: 'Albums', icon: <Disc className="w-5 h-5" /> },
    { id: 'liked', label: 'Liked Songs', icon: <Heart className="w-5 h-5" /> },
    { id: 'playlists', label: 'Playlists', icon: <Music className="w-5 h-5" /> },
    { id: 'folders', label: 'Folders', icon: <Folder className="w-5 h-5" /> },
    { id: 'lyrics', label: 'Karaoke & Lyrics', icon: <Mic2 className="w-5 h-5" /> },
    { id: 'stats', label: 'Listening Stats', icon: <BarChart2 className="w-5 h-5" /> },
    { id: 'settings', label: 'Library & Settings', icon: <Settings className="w-5 h-5" /> },
  ];


  return (
    <aside className="w-64 h-full glass border-r border-white/10 flex flex-col justify-between p-4 z-20 shrink-0">
      <div className="flex flex-col gap-6">
        {/* App Logo */}
        <div className="flex items-center gap-3 px-1 pt-2 cursor-pointer" onClick={() => setActiveTab('library')}>
          <GeminiLogo className="w-14 h-8 shrink-0" />
          <div>
            <h1 
              className="font-extrabold text-2xl tracking-wide leading-none text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(to right, var(--color-stop-1, #6366F1), var(--color-stop-2, #8B5CF6), var(--color-stop-3, #EC4899), var(--color-stop-4, #D946EF), var(--color-stop-5, #3B82F6), var(--color-stop-6, #818CF8))'
              }}
            >
              Prism
            </h1>
          </div>
        </div>

        {/* Action Button: Manage Library Folders (only show if no folders added) */}
        {includedDirectories.length === 0 && (
          <button
            onClick={handleQuickAddDirectory}
            className="flex items-center justify-center gap-2.5 w-full py-2.5 px-4 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white font-medium text-sm transition-all duration-200 shadow-md shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Add Library Folder</span>
          </button>
        )}

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
                    if (item.id === 'playlists') {
                      setActivePlaylistId(null);
                    }
                    if (item.id === 'artists') {
                      usePlayerStore.setState({ selectedArtist: null });
                    }
                    if (item.id === 'albums') {
                      usePlayerStore.setState({ selectedAlbum: null });
                    }
                  }}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-white/15 text-white shadow-sm border border-white/10'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={isActive ? '' : 'text-zinc-400'} style={isActive ? { color: 'var(--color-stop-1, #6366f1)' } : undefined}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.id === 'settings' && latestUpdateResult?.hasUpdate && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500 text-white animate-pulse">
                      Update
                    </span>
                  )}
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
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          playlistId: '__liked__',
                          name: 'Liked Songs',
                        });
                      }}
                      onClick={() => {
                        setActiveTab('liked');
                      }}
                      style={
                        dragOverPlaylistId === 'liked'
                          ? {
                              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
                              color: '#fff',
                              boxShadow: '0 0 12px color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
                            }
                          : activeTab === 'liked'
                          ? {
                              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
                              color: 'var(--color-stop-1, #6366f1)',
                            }
                          : undefined
                      }
                      className={`flex items-center gap-2 text-left text-xs py-1.5 px-3 rounded-lg truncate transition-colors border border-transparent ${
                        activeTab === 'liked'
                          ? 'font-medium'
                          : dragOverPlaylistId === 'liked'
                          ? ''
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
                              const state = usePlayerStore.getState();
                              const targetPlaylist = state.playlists.find((p) => p.id === pl.id);
                              if (!targetPlaylist) return;

                              const existingSet = new Set(targetPlaylist.trackIds);
                              const duplicates = data.ids.filter((id: string) => existingSet.has(id));

                              if (duplicates.length > 0) {
                                const addDuplicates = window.confirm(
                                  `${duplicates.length} of the ${data.ids.length} selected song(s) are already in "${targetPlaylist.name}".\n\nClick OK to add duplicates anyway, or Cancel to skip duplicates.`
                                );

                                if (addDuplicates) {
                                  data.ids.forEach((id: string) => addTrackToPlaylist(pl.id, id));
                                } else {
                                  const uniqueIds = data.ids.filter((id: string) => !existingSet.has(id));
                                  uniqueIds.forEach((id: string) => addTrackToPlaylist(pl.id, id));
                                }
                              } else {
                                data.ids.forEach((id: string) => addTrackToPlaylist(pl.id, id));
                              }
                            }
                          } catch (err) {}
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            playlistId: pl.id,
                            name: pl.name,
                          });
                        }}
                        onClick={() => {
                          setActiveTab('playlists');
                          setActivePlaylistId(pl.id);
                        }}
                        style={
                          dragOverPlaylistId === pl.id
                            ? {
                                backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
                                color: '#fff',
                                boxShadow: '0 0 12px color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
                              }
                            : activeTab === 'playlists' && activePlaylistId === pl.id
                            ? {
                                backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
                                color: 'var(--color-stop-1, #6366f1)',
                              }
                            : undefined
                        }
                        className={`text-left text-xs py-1.5 px-3 rounded-lg truncate transition-colors border border-transparent ${
                          activeTab === 'playlists' && activePlaylistId === pl.id
                            ? 'font-medium'
                            : dragOverPlaylistId === pl.id
                            ? ''
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
          <span className="font-mono font-semibold" style={{ color: 'var(--color-stop-1, #6366f1)' }}>
            {tracks.length} tracks
          </span>
        </div>
      </div>

      {/* Playlist Right-Click Context Menu */}
      {contextMenu && (() => {
        const menuEstimatedHeight = 170;
        const openUpward = contextMenu.y > window.innerHeight - (menuEstimatedHeight + 80);
        const left = Math.min(contextMenu.x, window.innerWidth - 240);
        const posStyle: React.CSSProperties = openUpward
          ? {
              bottom: Math.max(16, window.innerHeight - contextMenu.y),
              left,
              transformOrigin: 'bottom left',
            }
          : {
              top: Math.min(contextMenu.y, window.innerHeight - 100),
              left,
              transformOrigin: 'top left',
            };

        const handleItemHover = (e: React.MouseEvent<HTMLElement>, isHover: boolean) => {
          e.currentTarget.style.backgroundColor = isHover
            ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 22%, transparent)'
            : '';
        };

        return (
          <div
            className="fixed inset-0 z-50 pointer-events-auto"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          >
            <div
              style={{
                ...posStyle,
                backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 8%, #141416)',
                borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, rgba(255, 255, 255, 0.12))',
                boxShadow:
                  '0 12px 36px -4px rgba(0, 0, 0, 0.7), 0 0 16px color-mix(in srgb, var(--color-stop-1, #6366f1) 18%, transparent)',
                backdropFilter: 'blur(24px)',
              }}
              className="fixed z-50 w-56 border rounded-xl p-1.5 flex flex-col gap-1 text-xs text-zinc-300 animate-in fade-in zoom-in-95 duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="px-2.5 py-1 text-[11px] font-semibold text-zinc-400 border-b truncate"
                style={{
                  borderColor:
                    'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, rgba(255, 255, 255, 0.08))',
                }}
              >
                {contextMenu.name}
              </div>
              <button
                type="button"
                onClick={() => {
                  playPlaylistNext(contextMenu.playlistId);
                  setContextMenu(null);
                }}
                onMouseEnter={(e) => handleItemHover(e, true)}
                onMouseLeave={(e) => handleItemHover(e, false)}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
              >
                <ListPlus className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <span>Play Next (After Song)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  addPlaylistToQueue(contextMenu.playlistId);
                  setContextMenu(null);
                }}
                onMouseEnter={(e) => handleItemHover(e, true)}
                onMouseLeave={(e) => handleItemHover(e, false)}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
              >
                <ListVideo className="w-4 h-4 text-zinc-400" />
                <span>Add Playlist to Queue</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const store = usePlayerStore.getState();
                  let targetTracks: Track[] = [];
                  if (contextMenu.playlistId === '__liked__') {
                    targetTracks = store.tracks.filter((t) => store.likedTrackIds.includes(t.id));
                  } else {
                    const pl = store.playlists.find((p) => p.id === contextMenu.playlistId);
                    if (pl) {
                      targetTracks = pl.trackIds.map((id) => store.tracks.find((t) => t.id === id)).filter((t): t is Track => Boolean(t));
                    }
                  }
                  if (targetTracks.length > 0) {
                    store.playTrack(targetTracks[0], targetTracks);
                  }
                  setContextMenu(null);
                }}
                onMouseEnter={(e) => handleItemHover(e, true)}
                onMouseLeave={(e) => handleItemHover(e, false)}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
              >
                <Play className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <span>Play Now</span>
              </button>
            </div>
          </div>
        );
      })()}
    </aside>
  );
};
