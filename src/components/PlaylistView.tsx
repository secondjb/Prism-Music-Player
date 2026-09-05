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
  const removeTrackFromPlaylist = usePlayerStore((s) => s.removeTrackFromPlaylist);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const playPlaylistNext = usePlayerStore((s) => s.playPlaylistNext);
  const addPlaylistToQueue = usePlayerStore((s) => s.addPlaylistToQueue);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; playlistId: string; name: string } | null>(null);

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

    return (
      <div className="w-full h-full flex flex-col gap-6 overflow-hidden pr-2">

        {/* Back button + playlist info */}
        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={() => setActivePlaylistId(null)}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
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
                    className="p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-white/10"
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

          <button
            onClick={handlePlayAll}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors shadow-md"
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
              className="p-2 text-zinc-400 hover:text-red-400 rounded-xl hover:bg-white/10 transition-all"
              title="Delete Playlist"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>

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
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors shadow-md"
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
          className="group glass-card rounded-2xl border border-white/10 p-5 cursor-pointer hover:border-pink-500/40 hover:bg-pink-500/5 transition-all flex flex-col gap-3"
        >
          <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-pink-600 to-purple-700 flex items-center justify-center shadow-lg">
            <Heart className="w-12 h-12 text-white fill-white/50" />
          </div>
          <div>
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

          return (
            <div
              key={pl.id}
              onClick={() => setActivePlaylistId(pl.id)}
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
              className="group glass-card rounded-2xl border border-white/10 p-5 cursor-pointer hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all flex flex-col gap-3 relative"
            >
              {/* Playlist cover art grid */}
              <div className="w-full aspect-square rounded-xl overflow-hidden bg-zinc-800/80 grid grid-cols-2 grid-rows-2 gap-0.5">
                {[0, 1, 2, 3].map((i) => {
                  const t = plTracks[i];
                  return (
                    <PlaylistCoverCell key={i} track={t || null} />
                  );
                })}
              </div>

              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{pl.name}</h3>
                  <p className="text-xs text-zinc-400">{pl.trackIds.length} tracks</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePlaylist(pl.id);
                  }}
                  className="p-1.5 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-white/10"
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
          className="glass-card rounded-2xl border border-dashed border-white/10 p-5 cursor-pointer hover:border-indigo-500/40 hover:bg-white/5 transition-all flex flex-col items-center justify-center gap-3 min-h-[200px]"
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
              className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
              autoFocus
            />
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
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
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Playlist Right-Click Context Menu */}
      {contextMenu && (() => {
        const menuHeight = 170;
        const openUpward = contextMenu.y + menuHeight > window.innerHeight - 100;
        const top = openUpward
          ? Math.max(16, contextMenu.y - menuHeight)
          : Math.min(contextMenu.y, window.innerHeight - 100 - menuHeight);
        const left = Math.min(contextMenu.x, window.innerWidth - 240);

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
              style={{ top, left }}
              className="fixed z-50 w-56 glass-panel border border-white/10 rounded-xl shadow-2xl p-1.5 flex flex-col gap-1 text-xs text-zinc-300 animate-in fade-in zoom-in-95 duration-100 bg-[#181818]/95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-2.5 py-1 text-[11px] font-semibold text-zinc-400 border-b border-white/10 truncate">
                {contextMenu.name}
              </div>
              <button
                onClick={() => {
                  playPlaylistNext(contextMenu.playlistId);
                  setContextMenu(null);
                }}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors text-left font-medium cursor-pointer"
              >
                <ListPlus className="w-4 h-4 text-indigo-400 group-hover:text-white" />
                <span>Play Next (After Song)</span>
              </button>
              <button
                onClick={() => {
                  addPlaylistToQueue(contextMenu.playlistId);
                  setContextMenu(null);
                }}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-left font-medium cursor-pointer"
              >
                <ListVideo className="w-4 h-4 text-zinc-400" />
                <span>Add Playlist to Queue</span>
              </button>
              <button
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
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-left font-medium cursor-pointer"
              >
                <Play className="w-4 h-4 text-zinc-400" />
                <span>Play Now</span>
              </button>
            </div>
          </div>
        );
      })()}
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
