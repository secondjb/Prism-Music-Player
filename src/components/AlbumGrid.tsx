import React from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { Track } from '../types/player';
import { Disc, Play } from 'lucide-react';

interface AlbumGridProps {
  tracks: Track[];
}

const AlbumCard: React.FC<{ albumName: string; albumTracks: Track[]; onPlay: () => void; onNavigate: () => void; artist: string }> = ({
  albumName,
  albumTracks,
  onPlay,
  onNavigate,
  artist
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { rootMargin: '200px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const firstTrack = albumTracks[0];
  // Only fetch art if it has come into view once
  const art = useTrackArt(isVisible ? firstTrack : null);
  const navigateToArtist = usePlayerStore(s => s.navigateToArtist);

  return (
    <div
      ref={ref}
      onClick={onNavigate}
      className="group glass-card rounded-2xl p-4 flex flex-col gap-3 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-950/30 h-[280px]"
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
        <div 
          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
        >
          <div className="w-12 h-12 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 group-hover:scale-110 transition-transform">
            <Play className="w-6 h-6 fill-white ml-1" />
          </div>
        </div>
      </div>

      {/* Album Details */}
      <div className="flex flex-col min-w-0">
        <h4 className="font-bold text-sm text-white truncate hover:underline">{isVisible ? albumName : '...'}</h4>
        <p 
          className="text-xs text-zinc-400 truncate mt-0.5 hover:underline hover:text-indigo-400 z-10"
          onClick={(e) => {
            if (isVisible && artist !== 'Unknown Artist') {
              e.stopPropagation();
              navigateToArtist(artist);
            }
          }}
        >
          {isVisible ? artist : '...'}
        </p>
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
  const navigateToAlbum = usePlayerStore((s) => s.navigateToAlbum);

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
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 pb-8 overflow-y-auto h-full pr-2" style={{ alignContent: 'start' }}>
      {albumList.map(([albumName, albumTracks]) => (
        <AlbumCard
          key={albumName}
          albumName={albumName}
          albumTracks={albumTracks}
          artist={albumTracks[0]?.artist || 'Unknown Artist'}
          onPlay={() => handlePlayAlbum(albumTracks)}
          onNavigate={() => navigateToAlbum(albumName)}
        />
      ))}
    </div>
  );
};
