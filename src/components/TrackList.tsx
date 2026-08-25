import React, { useState } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { Track } from '../types/player';
import { Play, Pause, Heart, MoreVertical, Music, ListPlus, Radio, Sparkles, Check, FolderPlus } from 'lucide-react';

interface TrackListProps {
  tracks: Track[];
}

const TrackRow: React.FC<{
  track: Track;
  idx: number;
  isSelected: boolean;
  isLiked: boolean;
  isPlaying: boolean;
  activeMenuTrackId: string | null;
  setActiveMenuTrackId: (id: string | null) => void;
  playTrack: (track: Track, tracks: Track[]) => void;
  togglePlay: () => void;
  toggleLikeTrack: (id: string) => void;
  addToQueue: (track: Track) => void;
  playNext: (track: Track) => void;
  allTracks: Track[];
  showAudioSpecsInLibrary: boolean;
}> = ({
  track,
  idx,
  isSelected,
  isLiked,
  isPlaying,
  activeMenuTrackId,
  setActiveMenuTrackId,
  playTrack,
  togglePlay,
  toggleLikeTrack,
  addToQueue,
  playNext,
  allTracks,
  showAudioSpecsInLibrary,
}) => {
  const art = useTrackArt(track);
  const [addedToast, setAddedToast] = useState(false);
  const [showPlaylistSub, setShowPlaylistSub] = useState(false);
  const playlists = usePlayerStore((s) => s.playlists);
  const addTrackToPlaylist = usePlayerStore((s) => s.addTrackToPlaylist);

  const formatDuration = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatSampleRate = (rate: number) => {
    if (!rate) return '44.1kHz';
    if (rate >= 1000) {
      return `${(rate / 1000).toFixed(1).replace('.0', '')}kHz`;
    }
    return `${rate}Hz`;
  };

  const isHighRes = (rate: number, depth: number) => {
    return rate >= 88200 || depth >= 24;
  };

  const hiRes = isHighRes(track.sample_rate, track.bit_depth);

  const handleAddQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToQueue(track);
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 1500);
  };

  const gridCols = showAudioSpecsInLibrary
    ? 'grid-cols-[48px_1fr_1fr_120px_90px_80px]'
    : 'grid-cols-[48px_1fr_1fr_90px_80px]';

  return (
    <div
      onClick={() => playTrack(track, allTracks)}
      className={`group grid ${gridCols} items-center px-4 py-3 rounded-xl cursor-pointer transition-all duration-150 relative ${
        isSelected
          ? 'bg-indigo-600/20 border border-indigo-500/30 text-white shadow-lg shadow-indigo-950/40'
          : 'hover:bg-white/5 text-zinc-300 hover:text-white border border-transparent'
      }`}
    >
      {/* Play / Index Column */}
      <div className="flex items-center justify-center font-mono text-sm">
        {isSelected ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-md hover:scale-105 transition-transform"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
          </button>
        ) : (
          <>
            <span className="group-hover:hidden text-zinc-500">{idx + 1}</span>
            <button className="hidden group-hover:flex w-8 h-8 rounded-full bg-white/10 text-white items-center justify-center hover:bg-indigo-500 transition-colors">
              <Play className="w-4 h-4 fill-white ml-0.5" />
            </button>
          </>
        )}
      </div>

      {/* Title & Artist & Artwork */}
      <div className="flex items-center gap-3 min-w-0 pr-4">
        <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-zinc-800/80 border border-white/10 relative group-hover:shadow-md transition-shadow">
          {art ? (
            <img src={art} alt={track.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-900/60 to-purple-900/60 flex items-center justify-center">
              <Music className="w-5 h-5 text-indigo-300/70" />
            </div>
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <span
            className={`font-semibold text-sm truncate ${
              isSelected ? 'text-indigo-400' : 'text-white group-hover:text-white'
            }`}
          >
            {track.title}
          </span>
          <span className="text-xs text-zinc-400 truncate mt-0.5">{track.artist}</span>
        </div>
      </div>

      {/* Album */}
      <div className="text-xs text-zinc-400 truncate pr-4">{track.album}</div>

      {/* Audio Format Badge (conditionally shown) */}
      {showAudioSpecsInLibrary && (
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold tracking-tight ${
              hiRes
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'bg-zinc-800 text-zinc-300 border border-white/5'
            }`}
          >
            {hiRes && <Sparkles className="w-3 h-3 text-amber-400" />}
            {formatSampleRate(track.sample_rate)} / {track.bit_depth || 16}b
          </span>
        </div>
      )}

      {/* Duration & ReplayGain badge */}
      <div className="flex flex-col text-xs font-mono text-zinc-400">
        <span>{formatDuration(track.duration_secs)}</span>
        {track.replay_gain_db != null && (
          <span className="text-[10px] text-zinc-500">
            {track.replay_gain_db > 0 ? `+${track.replay_gain_db.toFixed(1)}dB` : `${track.replay_gain_db.toFixed(1)}dB`}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        {/* Quick Add To Queue Button on Hover */}
        <button
          onClick={handleAddQueue}
          className="p-1.5 text-zinc-400 hover:text-indigo-400 rounded-lg hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
          title="Add to Queue"
        >
          {addedToast ? <Check className="w-4 h-4 text-emerald-400" /> : <ListPlus className="w-4 h-4" />}
        </button>

        <button
          onClick={() => toggleLikeTrack(track.id)}
          className={`p-1.5 rounded-lg transition-colors ${
            isLiked ? 'text-pink-500 hover:text-pink-400' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-pink-500' : ''}`} />
        </button>

                <div className="relative">
                  <button
                    onClick={() => {
                      setActiveMenuTrackId(activeMenuTrackId === track.id ? null : track.id);
                      setShowPlaylistSub(false);
                    }}
                    className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Dropdown Menu */}
                  {activeMenuTrackId === track.id && (
                    <div
                      className="absolute right-0 top-8 w-48 glass-panel border border-white/10 rounded-xl shadow-2xl py-1 z-30 flex flex-col"
                      onMouseLeave={() => {
                        setActiveMenuTrackId(null);
                        setShowPlaylistSub(false);
                      }}
                    >
                      <button
                        onClick={() => {
                          playNext(track);
                          setActiveMenuTrackId(null);
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/10 text-left"
                      >
                        <Radio className="w-3.5 h-3.5 text-indigo-400" />
                        Play Next
                      </button>
                      <button
                        onClick={() => {
                          addToQueue(track);
                          setActiveMenuTrackId(null);
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/10 text-left"
                      >
                        <ListPlus className="w-3.5 h-3.5 text-emerald-400" />
                        Add to Queue
                      </button>
                      {/* Add to Playlist submenu */}
                      <div className="relative">
                        <button
                          onClick={() => setShowPlaylistSub(!showPlaylistSub)}
                          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/10 text-left w-full"
                        >
                          <FolderPlus className="w-3.5 h-3.5 text-purple-400" />
                          Add to Playlist
                        </button>
                        {showPlaylistSub && (
                          <div className="absolute left-full top-0 w-44 glass-panel border border-white/10 rounded-xl shadow-2xl py-1 z-40 flex flex-col ml-1">
                            {playlists.length === 0 ? (
                              <span className="px-3 py-2 text-xs text-zinc-500 italic">No playlists yet</span>
                            ) : (
                              playlists.map((pl) => (
                                <button
                                  key={pl.id}
                                  onClick={() => {
                                    addTrackToPlaylist(pl.id, track.id);
                                    setActiveMenuTrackId(null);
                                    setShowPlaylistSub(false);
                                  }}
                                  className="px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/10 text-left truncate"
                                >
                                  {pl.name}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
    </div>
  );
};

export const TrackList: React.FC<TrackListProps> = ({ tracks }) => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const likedTrackIds = usePlayerStore((s) => s.likedTrackIds);
  const toggleLikeTrack = usePlayerStore((s) => s.toggleLikeTrack);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const playNext = usePlayerStore((s) => s.playNext);
  const showAudioSpecsInLibrary = usePlayerStore((s) => s.showAudioSpecsInLibrary);
  const [activeMenuTrackId, setActiveMenuTrackId] = useState<string | null>(null);

  const gridCols = showAudioSpecsInLibrary
    ? 'grid-cols-[48px_1fr_1fr_120px_90px_80px]'
    : 'grid-cols-[48px_1fr_1fr_90px_80px]';

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Table Header */}
      <div className={`grid ${gridCols} items-center px-4 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/5`}>
        <span className="text-center">#</span>
        <span>Title</span>
        <span>Album</span>
        {showAudioSpecsInLibrary && <span>Audio Format</span>}
        <span>Duration</span>
        <span className="text-right">Actions</span>
      </div>

      {/* Track Rows */}
      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3 glass-card rounded-2xl border border-dashed border-white/10 my-4">
          <div className="w-14 h-14 rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-500">
            <Music className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">No tracks loaded yet</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm">
              Import a directory with FLAC files using the sidebar button to get started.
            </p>
          </div>
        </div>
      ) : (
        tracks.map((track, idx) => (
          <TrackRow
            key={`${track.id}-${idx}`}
            track={track}
            idx={idx}
            isSelected={currentTrack?.id === track.id}
            isLiked={likedTrackIds.includes(track.id)}
            isPlaying={isPlaying}
            activeMenuTrackId={activeMenuTrackId}
            setActiveMenuTrackId={setActiveMenuTrackId}
            playTrack={playTrack}
            togglePlay={togglePlay}
            toggleLikeTrack={toggleLikeTrack}
            addToQueue={addToQueue}
            playNext={playNext}
            allTracks={tracks}
            showAudioSpecsInLibrary={showAudioSpecsInLibrary}
          />
        ))
      )}
    </div>
  );
};
