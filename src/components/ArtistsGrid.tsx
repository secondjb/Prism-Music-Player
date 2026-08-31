import React from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { Track } from '../types/player';
import { User, Play } from 'lucide-react';

interface ArtistsGridProps {
  tracks: Track[];
}

const ArtistCard: React.FC<{ artistName: string; artistTracks: Track[]; onPlay: () => void; onNavigate: () => void }> = ({
  artistName,
  artistTracks,
  onPlay,
  onNavigate
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

  const firstTrack = artistTracks[0];
  // Fetch art for artist (we can just use the first track's art)
  const art = useTrackArt(isVisible ? firstTrack : null);

  return (
    <div
      ref={ref}
      onClick={onNavigate}
      className="group glass-card rounded-2xl p-4 flex flex-col gap-3 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-950/30 h-[260px] items-center text-center"
    >
      {/* Artist Image Placeholder */}
      <div className="w-full aspect-square rounded-full overflow-hidden bg-zinc-800 border border-white/10 relative shadow-md">
        {art ? (
          <img src={art} alt={artistName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-900/80 to-purple-950/80 flex items-center justify-center">
            <User className="w-12 h-12 text-indigo-300/60" />
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

      {/* Artist Details */}
      <div className="flex flex-col min-w-0 mt-2">
        <h4 className="font-bold text-sm text-white truncate group-hover:underline">{isVisible ? artistName : '...'}</h4>
        <span className="text-[11px] text-zinc-500 font-mono mt-1">
          {artistTracks.length} track{artistTracks.length > 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
};

export const ArtistsGrid: React.FC<ArtistsGridProps> = ({ tracks }) => {
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);
  const navigateToArtist = usePlayerStore((s) => s.navigateToArtist);

  // Group tracks by artist name
  const artistsMap: Record<string, Track[]> = {};
  tracks.forEach((track) => {
    const artistName = track.artist || 'Unknown Artist';
    if (!artistsMap[artistName]) {
      artistsMap[artistName] = [];
    }
    artistsMap[artistName].push(track);
  });

  const artistList = Object.entries(artistsMap);

  const handlePlayArtist = (artistTracks: Track[]) => {
    setQueue(artistTracks);
    playIndex(0);
  };

  if (artistList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-500 glass-card rounded-2xl border border-dashed border-white/10">
        <User className="w-10 h-10 mb-2 text-zinc-600" />
        <p className="text-sm font-semibold">No artists found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 pb-8 overflow-y-auto h-full pr-2" style={{ alignContent: 'start' }}>
      {artistList.map(([artistName, artistTracks]) => (
        <ArtistCard
          key={artistName}
          artistName={artistName}
          artistTracks={artistTracks}
          onPlay={() => handlePlayArtist(artistTracks)}
          onNavigate={() => navigateToArtist(artistName)}
        />
      ))}
    </div>
  );
};
