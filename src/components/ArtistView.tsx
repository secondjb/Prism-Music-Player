import React from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { Track } from '../types/player';
import { Play, ChevronLeft } from 'lucide-react';
import { TrackList } from './TrackList';
import { useTrackArt } from '../utils/useTrackArt';

const AlbumSection: React.FC<{ albumName: string; tracks: Track[]; artistName: string }> = ({ albumName, tracks, artistName }) => {
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);
  const navigateToAlbum = usePlayerStore((s) => s.navigateToAlbum);
  
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

  const art = useTrackArt(isVisible ? tracks[0] : null);

  const playAlbum = () => {
    setQueue(tracks);
    playIndex(0);
  };

  return (
    <div ref={ref} className="mb-8 bg-white/5 rounded-2xl p-6 border border-white/10">
      <div className="flex items-end gap-6 mb-4">
        <div 
          className="w-32 h-32 rounded-xl overflow-hidden shadow-lg cursor-pointer group relative"
          onClick={() => navigateToAlbum(albumName)}
        >
          {art ? (
            <img src={art} alt={albumName} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          ) : (
            <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
              <span className="text-zinc-500">No Art</span>
            </div>
          )}
          <div 
            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            onClick={(e) => { e.stopPropagation(); playAlbum(); }}
          >
            <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 group-hover:scale-110 transition-transform">
              <Play className="w-5 h-5 fill-white ml-1" />
            </div>
          </div>
        </div>
        <div className="flex-1 pb-2">
          <h3 
            className="text-2xl font-bold text-white hover:underline cursor-pointer"
            onClick={() => navigateToAlbum(albumName)}
          >
            {albumName}
          </h3>
          <p className="text-zinc-400 text-sm mt-1">{artistName} • {tracks.length} songs</p>
        </div>
      </div>
      <TrackList tracks={tracks} hideControls={true} />
    </div>
  );
};

export const ArtistView: React.FC = () => {
  const selectedArtist = usePlayerStore((s) => s.selectedArtist);
  const tracks = usePlayerStore((s) => s.tracks);
  const setActiveTab = usePlayerStore((s) => s.setActiveTab);
  
  if (!selectedArtist) return null;
  
  const artistTracks = tracks.filter((t) => t.artist === selectedArtist || t.artist?.includes(selectedArtist));
  
  const albumsMap: Record<string, Track[]> = {};
  artistTracks.forEach((track) => {
    const albumName = track.album || 'Unknown Album';
    if (!albumsMap[albumName]) {
      albumsMap[albumName] = [];
    }
    albumsMap[albumName].push(track);
  });
  
  // Sort albums by name or year if we had it. Let's just do name for now.
  const sortedAlbums = Object.keys(albumsMap).sort();

  return (
    <div className="flex flex-col h-full overflow-y-auto pr-2 pb-12">
      <div className="flex items-center gap-4 mb-6 sticky top-0 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-3.5 z-10 shadow-lg my-2">
        <button 
          onClick={() => setActiveTab('artists')}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">{selectedArtist}</h2>
          <p className="text-zinc-400 text-sm">{artistTracks.length} total songs</p>
        </div>
      </div>
      
      <div className="flex flex-col gap-2">
        {sortedAlbums.map((albumName) => (
          <AlbumSection 
            key={albumName} 
            albumName={albumName} 
            tracks={albumsMap[albumName]} 
            artistName={selectedArtist} 
          />
        ))}
      </div>
    </div>
  );
};
