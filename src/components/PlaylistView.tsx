import React, { useState } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { Track, Playlist } from '../types/player';
import {
  Heart,
  Music,
  Plus,
  ArrowLeft,
  Play,
  Trash2,
  Pencil,
  Check,
  X,
  GripVertical,
} from 'lucide-react';

// Small component for track art in playlist detail
const PlaylistTrackRow: React.FC<{
  track: Track;
  idx: number;
  isSelected: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onRemove: () => void;
  onDragStart: (idx: number) => void;
  onDragEnter: (idx: number) => void;
  onDrop: (idx: number) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDragOver: boolean;
}> = ({ track, idx, isSelected, isPlaying, onPlay, onRemove, onDragStart, onDragEnter, onDrop, onDragEnd, isDragging, isDragOver }) => {
  const art = useTrackArt(track);

  const formatDuration = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
        onDragStart(idx);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragEnter(idx);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(idx);
      }}
      onDragEnd={onDragEnd}
      onClick={onPlay}
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${
        isDragging ? 'opacity-40 border-dashed border-indigo-400' : ''
      } ${isDragOver ? 'bg-indigo-600/30 border-indigo-400' : ''} ${
        isSelected
          ? isPlaying
            ? 'bg-indigo-600/30 border-indigo-500/50 text-white shadow-md'
            : 'bg-indigo-600/20 border-indigo-500/30 text-white'
          : 'hover:bg-white/5 border-transparent text-zinc-300'
      }`}
    >
      <span
        className="cursor-grab active:cursor-grabbing text-zinc-500 group-hover:text-indigo-400 shrink-0"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4" />
      </span>

      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-zinc-800 border border-white/10">
        {art ? (
          <img src={art} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-indigo-900/40 flex items-center justify-center">
            <Music className="w-3.5 h-3.5 text-indigo-300" />
          </div>
        )}
      </div>

      <div className="flex flex-col min-w-0 flex-1">
        <span className={`text-sm font-semibold truncate ${isSelected ? 'text-indigo-400' : 'text-white'}`}>
          {track.title}
        </span>
        <span className="text-xs text-zinc-400 truncate">{track.artist}</span>
      </div>

      <span className="text-xs font-mono text-zinc-500 shrink-0">{formatDuration(track.duration_secs)}</span>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="p-1 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-white/10"
        title="Remove from playlist"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

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
  const reorderPlaylistTracks = usePlayerStore((s) => s.reorderPlaylistTracks);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

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

    const handleDragDrop = (targetIdx: number) => {
      if (draggedIdx !== null && draggedIdx !== targetIdx && activePlaylist.id !== '__liked__') {
        reorderPlaylistTracks(activePlaylist.id, draggedIdx, targetIdx);
      }
      setDraggedIdx(null);
      setDragOverIdx(null);
    };

    return (
      <div className="flex flex-col gap-6">
        {/* Back button + playlist info */}
        <div className="flex items-center gap-4">
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

        {/* Track list */}
        <div className="flex flex-col gap-1.5" onDragOver={(e) => e.preventDefault()}>
          {playlistTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Music className="w-10 h-10 text-zinc-600" />
              <p className="text-sm text-zinc-400">
                {activePlaylist.id === '__liked__'
                  ? 'No liked songs yet. Click the heart icon on tracks to add them.'
                  : 'This playlist is empty. Add tracks from the library using the three-dot menu.'}
              </p>
            </div>
          ) : (
            playlistTracks.map((track, idx) => (
              <PlaylistTrackRow
                key={`${track.id}-${idx}`}
                track={track}
                idx={idx}
                isSelected={currentTrack?.id === track.id}
                isPlaying={isPlaying}
                onPlay={() => playTrack(track, playlistTracks)}
                onRemove={() => {
                  if (activePlaylist.id === '__liked__') {
                    usePlayerStore.getState().toggleLikeTrack(track.id);
                  } else {
                    removeTrackFromPlaylist(activePlaylist.id, track.id);
                  }
                }}
                onDragStart={(i) => setDraggedIdx(i)}
                onDragEnter={(i) => {
                  if (draggedIdx !== null && draggedIdx !== i) setDragOverIdx(i);
                }}
                onDrop={handleDragDrop}
                onDragEnd={() => {
                  setDraggedIdx(null);
                  setDragOverIdx(null);
                }}
                isDragging={draggedIdx === idx}
                isDragOver={dragOverIdx === idx}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  // Playlist selector view
  return (
    <div className="flex flex-col gap-6">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
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
    </div>
  );
};

// Helper component for playlist cover art grid cells
const PlaylistCoverCell: React.FC<{ track: Track | null }> = ({ track }) => {
  const art = useTrackArt(track);

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
