import React, { useState } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { Track, Playlist } from '../types/player';
import { TrackTableView } from './TrackTableView';
import {
  Heart,
  Music,
  Plus,
  ArrowLeft,
  Play,
  Trash2,
  Pencil,
  Check,
  ListPlus,
  ListVideo,
  Search,
  X,
  PlusCircle,
} from 'lucide-react';

export const PlaylistView: React.FC = () => {
  const tracks = usePlayerStore((s) => s.tracks);
  const playlists = usePlayerStore((s) => s.playlists);
  const likedTrackIds = usePlayerStore((s) => s.likedTrackIds);
  const activePlaylistId = usePlayerStore((s) => s.activePlaylistId);
  const setActivePlaylistId = usePlayerStore((s) => s.setActivePlaylistId);
  const createPlaylist = usePlayerStore((s) => s.createPlaylist);
  const deletePlaylist = usePlayerStore((s) => s.deletePlaylist);
  const renamePlaylist = usePlayerStore((s) => s.renamePlaylist);
  const addTrackToPlaylist = usePlayerStore((s) => s.addTrackToPlaylist);
  const removeTrackFromPlaylist = usePlayerStore((s) => s.removeTrackFromPlaylist);
  const toggleLikeTrack = usePlayerStore((s) => s.toggleLikeTrack);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const playPlaylistNext = usePlayerStore((s) => s.playPlaylistNext);
  const addPlaylistToQueue = usePlayerStore((s) => s.addPlaylistToQueue);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; playlistId: string; name: string } | null>(null);
  const [showAddSongs, setShowAddSongs] = useState(false);
  const [addSongsQuery, setAddSongsQuery] = useState('');
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  // "Liked Songs" virtual playlist
  const likedTracks = tracks.filter((t) => likedTrackIds.includes(t.id));

  // If viewing a specific playlist
  const activePlaylist = activePlaylistId === '__liked__'
    ? { id: '__liked__', name: 'Liked Songs', trackIds: likedTrackIds, createdAt: 0 } as Playlist
    : playlists.find((p) => p.id === activePlaylistId);

  if (activePlaylist) {
    // Playlist detail view
    const playlistTracks = activePlaylist.id === '__liked__'
      ? likedTracks
      : activePlaylist.trackIds
          .map((tid) => tracks.find((t) => t.id === tid))
          .filter((t): t is Track => Boolean(t));

    const totalDuration = playlistTracks.reduce((acc, t) => acc + (t.duration_secs || 0), 0);
    const totalMins = Math.floor(totalDuration / 60);

    const handlePlayAll = () => {
      if (playlistTracks.length > 0) {
        playTrack(playlistTracks[0], playlistTracks);
      }
    };

    const searchFilter = addSongsQuery.trim().toLowerCase();
    const candidateTracks = searchFilter
      ? tracks.filter(
          (t) =>
            t.title.toLowerCase().includes(searchFilter) ||
            (t.artist && t.artist.toLowerCase().includes(searchFilter)) ||
            (t.album && t.album.toLowerCase().includes(searchFilter))
        )
      : tracks;

    return (
      <div className="w-full h-full flex flex-col gap-6 overflow-hidden pr-2">

        {/* Back button + playlist info */}
        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={() => {
              setActivePlaylistId(null);
              setShowAddSongs(false);
              setAddSongsQuery('');
            }}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            {editingId === activePlaylist.id ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editName.trim()) {
                      renamePlaylist(activePlaylist.id, editName.trim());
                      setEditingId(null);
                    }
                  }}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-lg font-bold text-white focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (editName.trim()) {
                      renamePlaylist(activePlaylist.id, editName.trim());
                    }
                    setEditingId(null);
                  }}
                  className="p-1 text-emerald-400 hover:bg-white/10 rounded-lg"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {activePlaylist.id === '__liked__' ? (
                  <Heart className="w-6 h-6 text-pink-500 fill-pink-500 shrink-0" />
                ) : null}
                <h2 className="text-2xl font-bold text-white truncate">{activePlaylist.name}</h2>
                {activePlaylist.id !== '__liked__' && (
                  <button
                    onClick={() => {
                      setEditingId(activePlaylist.id);
                      setEditName(activePlaylist.name);
                    }}
                    className="p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            <p className="text-xs text-zinc-400 mt-1">
              {playlistTracks.length} tracks • {totalMins} min
            </p>
          </div>

          {/* Add Songs Button */}
          <button
            onClick={() => setShowAddSongs((s) => !s)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm border cursor-pointer ${
              showAddSongs
                ? 'text-white'
                : 'text-zinc-300 hover:text-white hover:bg-white/10 border-white/10'
            }`}
            style={
              showAddSongs
                ? {
                    backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)',
                    borderColor: 'var(--color-stop-1, #6366f1)',
                    boxShadow: '0 0 16px color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)',
                  }
                : undefined
            }
          >
            <PlusCircle className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
            <span>{showAddSongs ? 'Hide Add Songs' : 'Add Songs'}</span>
          </button>

          <button
            onClick={handlePlayAll}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:brightness-110 transition-all shadow-md cursor-pointer"
            style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
            disabled={playlistTracks.length === 0}
          >
            <Play className="w-4 h-4 fill-white" />
            Play All
          </button>

          {activePlaylist.id !== '__liked__' && (
            <button
              onClick={() => {
                deletePlaylist(activePlaylist.id);
                setActivePlaylistId(null);
              }}
              className="p-2 text-zinc-400 hover:text-red-400 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
              title="Delete Playlist"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Add Songs Search Bar and Selector Section */}
        {showAddSongs && (
          <div
            className="p-3.5 rounded-2xl border flex flex-col gap-3 shrink-0 animate-in fade-in slide-in-from-top-2 duration-150"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 8%, #141416)',
              borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, rgba(255, 255, 255, 0.12))',
              boxShadow:
                '0 8px 30px rgba(0, 0, 0, 0.5), 0 0 16px color-mix(in srgb, var(--color-stop-1, #6366f1) 12%, transparent)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={addSongsQuery}
                  onChange={(e) => setAddSongsQuery(e.target.value)}
                  placeholder="Search songs to add by title, artist, or album..."
                  autoFocus
                  className="w-full bg-white/5 border rounded-xl pl-10 pr-10 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, rgba(255, 255, 255, 0.12))',
                  }}
                />
                {addSongsQuery && (
                  <button
                    type="button"
                    onClick={() => setAddSongsQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowAddSongs(false)}
                className="px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>

            {/* Candidate Results */}
            <div className="max-h-60 overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-1">
              {candidateTracks.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-500 italic">
                  {addSongsQuery.trim() ? 'No songs matching your search' : 'No songs available in library'}
                </div>
              ) : (
                candidateTracks.slice(0, 40).map((t) => {
                  const isAdded =
                    activePlaylist.id === '__liked__'
                      ? likedTrackIds.includes(t.id)
                      : activePlaylist.trackIds.includes(t.id);
                  return (
                    <SearchTrackRow
                      key={t.id}
                      track={t}
                      isAdded={isAdded}
                      onAdd={() => {
                        if (activePlaylist.id === '__liked__') {
                          toggleLikeTrack(t.id);
                        } else {
                          addTrackToPlaylist(activePlaylist.id, t.id);
                        }
                      }}
                    />
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Track list Grid View */}
        <div className="flex-1 min-h-0">
          <TrackTableView
            tracks={playlistTracks}
            playlistId={activePlaylist.id}
            onRemoveFromPlaylist={(trackId) => {
              if (activePlaylist.id === '__liked__') {
                usePlayerStore.getState().toggleLikeTrack(trackId);
              } else {
                removeTrackFromPlaylist(activePlaylist.id, trackId);
              }
            }}
          />
        </div>
      </div>
    );
  }

  // Playlist selector view
  return (
    <div className="w-full h-full flex flex-col gap-6 overflow-y-auto custom-scrollbar pb-12 pr-2">

      {/* Header with create button */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white">Your Playlists</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Create and manage your music collections</p>
        </div>
        <button
          onClick={() => {
            setNewPlaylistName('');
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:brightness-110 transition-all shadow-md cursor-pointer"
          style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
        >
          <Plus className="w-4 h-4" />
          New Playlist
        </button>
      </div>

      {/* Playlist Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Liked Songs (always first, special card) */}
        <div
          onClick={() => setActivePlaylistId('__liked__')}
          onDragEnter={(e) => e.preventDefault()}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setDragOverCardId('__liked__');
          }}
          onDragLeave={() => setDragOverCardId(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverCardId(null);
            try {
              const data = JSON.parse(e.dataTransfer.getData('text/plain'));
              if (data.type === 'tracks' && Array.isArray(data.ids)) {
                data.ids.forEach((id: string) => {
                  if (!likedTrackIds.includes(id)) {
                    toggleLikeTrack(id);
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
          style={
            dragOverCardId === '__liked__'
              ? {
                  borderColor: 'var(--color-stop-1, #6366f1)',
                  boxShadow:
                    '0 0 24px color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
                  backgroundColor:
                    'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)',
                }
              : undefined
          }
          className="group glass-card rounded-2xl border border-white/10 p-5 cursor-pointer hover:border-pink-500/40 hover:bg-pink-500/5 transition-all flex flex-col gap-3"
        >
          <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-pink-600 to-purple-700 flex items-center justify-center shadow-lg pointer-events-none">
            <Heart className="w-12 h-12 text-white fill-white/50" />
          </div>
          <div className="pointer-events-none">
            <h3 className="text-sm font-bold text-white truncate">Liked Songs</h3>
            <p className="text-xs text-zinc-400">{likedTracks.length} tracks</p>
          </div>
        </div>

        {/* User playlists */}
        {playlists.map((pl) => {
          const plTracks = pl.trackIds
            .slice(0, 4)
            .map((tid) => tracks.find((t) => t.id === tid))
            .filter((t): t is Track => Boolean(t));

          const isDragOver = dragOverCardId === pl.id;

          return (
            <div
              key={pl.id}
              onClick={() => setActivePlaylistId(pl.id)}
              onDragEnter={(e) => e.preventDefault()}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                setDragOverCardId(pl.id);
              }}
              onDragLeave={() => setDragOverCardId(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverCardId(null);
                try {
                  const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                  if (data.type === 'tracks' && Array.isArray(data.ids)) {
                    const existingSet = new Set(pl.trackIds);
                    const duplicates = data.ids.filter((id: string) => existingSet.has(id));

                    if (duplicates.length > 0) {
                      const addDuplicates = window.confirm(
                        `${duplicates.length} of the ${data.ids.length} selected song(s) are already in "${pl.name}".\n\nClick OK to add duplicates anyway, or Cancel to skip duplicates.`
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
              style={
                isDragOver
                  ? {
                      borderColor: 'var(--color-stop-1, #6366f1)',
                      boxShadow:
                        '0 0 24px color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
                      backgroundColor:
                        'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)',
                    }
                  : undefined
              }
              className="group glass-card rounded-2xl border border-white/10 p-5 cursor-pointer hover:border-white/30 transition-all flex flex-col gap-3 relative"
            >
              {/* Playlist cover art grid */}
              <div className="w-full aspect-square rounded-xl overflow-hidden bg-zinc-800/80 grid grid-cols-2 grid-rows-2 gap-0.5 pointer-events-none">
                {[0, 1, 2, 3].map((i) => {
                  const t = plTracks[i];
                  return (
                    <PlaylistCoverCell key={i} track={t || null} />
                  );
                })}
              </div>

              <div className="flex items-center justify-between pointer-events-none">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{pl.name}</h3>
                  <p className="text-xs text-zinc-400">{pl.trackIds.length} tracks</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePlaylist(pl.id);
                  }}
                  className="p-1.5 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-white/10 pointer-events-auto cursor-pointer"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Create New Playlist Card */}
        <div
          onClick={() => {
            setNewPlaylistName('');
            setShowCreateModal(true);
          }}
          className="glass-card rounded-2xl border border-dashed border-white/10 p-5 cursor-pointer hover:border-white/30 hover:bg-white/5 transition-all flex flex-col items-center justify-center gap-3 min-h-[200px]"
        >
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-zinc-500">
            <Plus className="w-6 h-6" />
          </div>
          <span className="text-xs font-medium text-zinc-400">Create Playlist</span>
        </div>
      </div>

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel border border-white/10 rounded-2xl shadow-2xl p-6 w-96 flex flex-col gap-4">
            <h3 className="text-lg font-bold text-white">Create New Playlist</h3>
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newPlaylistName.trim()) {
                  createPlaylist(newPlaylistName.trim());
                  setShowCreateModal(false);
                }
              }}
              placeholder="Playlist name..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
              style={{
                borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, rgba(255, 255, 255, 0.12))',
              }}
              autoFocus
            />
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newPlaylistName.trim()) {
                    createPlaylist(newPlaylistName.trim());
                    setShowCreateModal(false);
                  }
                }}
                disabled={!newPlaylistName.trim()}
                className="px-4 py-2 rounded-xl text-white text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

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
                <ListVideo className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
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
    </div>
  );
};

// Search track item row in Add Songs panel
const SearchTrackRow: React.FC<{
  track: Track;
  isAdded: boolean;
  onAdd: () => void;
}> = ({ track, isAdded, onAdd }) => {
  const art = useTrackArt(track, { thumbnail: true, maxSize: 64 });
  const formatDuration = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors gap-3 group">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-zinc-800 flex items-center justify-center border border-white/10">
          {art ? (
            <img src={art} alt={track.title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <Music className="w-4 h-4 text-zinc-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-white truncate">
            {track.title}
          </div>
          <div className="text-xs text-zinc-400 truncate">
            {track.artist || 'Unknown Artist'}
            {track.album ? ` • ${track.album}` : ''}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs font-mono text-zinc-500">{formatDuration(track.duration_secs)}</span>
        <button
          type="button"
          onClick={onAdd}
          disabled={isAdded}
          style={{
            backgroundColor: isAdded
              ? undefined
              : 'color-mix(in srgb, var(--color-stop-1, #6366f1) 22%, transparent)',
            borderColor: isAdded
              ? undefined
              : 'color-mix(in srgb, var(--color-stop-1, #6366f1) 45%, rgba(255, 255, 255, 0.15))',
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            isAdded
              ? 'bg-white/5 text-emerald-400 border border-emerald-500/30 cursor-default'
              : 'border text-white hover:brightness-125'
          }`}
        >
          {isAdded ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Added</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
              <span>Add</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// Helper component for playlist cover art grid cells
const PlaylistCoverCell: React.FC<{ track: Track | null }> = ({ track }) => {
  const art = useTrackArt(track, { thumbnail: true, maxSize: 96 });

  if (!track) {
    return (
      <div className="bg-zinc-800 flex items-center justify-center">
        <Music className="w-4 h-4 text-zinc-600" />
      </div>
    );
  }

  return art ? (
    <img src={art} alt={track.title} className="w-full h-full object-cover" />
  ) : (
    <div className="bg-gradient-to-br from-indigo-900/60 to-purple-900/60 flex items-center justify-center">
      <Music className="w-4 h-4 text-indigo-300/60" />
    </div>
  );
};
