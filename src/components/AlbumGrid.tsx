import React from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { Track } from '../types/player';
import { Disc, Play } from 'lucide-react';

interface AlbumGridProps {
  tracks: Track[];
}

const AlbumCard: React.FC<{ albumName: string; albumTracks: Track[]; onPlay: () => void }> = ({
  albumName,
  albumTracks,
  onPlay,
}) => {
  const firstTrack = albumTracks[0];
  const artist = firstTrack?.artist || 'Unknown Artist';
  const art = useTrackArt(firstTrack);

  return (
    <div
      onClick={onPlay}
      className="group glass-card rounded-2xl p-4 flex flex-col gap-3 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-950/30"
    >
      {/* Album Cover Art */}
      <div className="w-full aspect-square rounded-xl overflow-hidden bg-zinc-800 border border-white/10 relative shadow-md">
        {art ? (
          <img src={art} alt={albumName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-900/80 to-purple-950/80 flex items-center justify-center">
            <Disc className="w-12 h-12 text-indigo-300/60" />
          </div>
        )}

        {/* Play Overlay Button */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 group-hover:scale-110 transition-transform">
            <Play className="w-6 h-6 fill-white ml-1" />
          </div>
        </div>
      </div>

      {/* Album Details */}
      <div className="flex flex-col min-w-0">
        <h4 className="font-bold text-sm text-white truncate">{albumName}</h4>
        <p className="text-xs text-zinc-400 truncate mt-0.5">{artist}</p>
        <span className="text-[11px] text-zinc-500 font-mono mt-1">
          {albumTracks.length} track{albumTracks.length > 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
};

export const AlbumGrid: React.FC<AlbumGridProps> = ({ tracks }) => {
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);

  // Group tracks by album name
  const albumsMap: Record<string, Track[]> = {};
  tracks.forEach((track) => {
    const albumName = track.album || 'Unknown Album';
    if (!albumsMap[albumName]) {
      albumsMap[albumName] = [];
    }
    albumsMap[albumName].push(track);
  });

  const albumList = Object.entries(albumsMap);

  const handlePlayAlbum = (albumTracks: Track[]) => {
    setQueue(albumTracks);
    playIndex(0);
  };

  if (albumList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-500 glass-card rounded-2xl border border-dashed border-white/10">
        <Disc className="w-10 h-10 mb-2 text-zinc-600" />
        <p className="text-sm font-semibold">No albums found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 pb-8">
      {albumList.map(([albumName, albumTracks]) => (
        <AlbumCard
          key={albumName}
          albumName={albumName}
          albumTracks={albumTracks}
          onPlay={() => handlePlayAlbum(albumTracks)}
        />
      ))}
    </div>
  );
};
