import React from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { Play, ChevronLeft, Disc } from 'lucide-react';
import { TrackList } from './TrackList';
import { useTrackArt } from '../utils/useTrackArt';

export const AlbumView: React.FC = () => {
  const selectedAlbum = usePlayerStore((s) => s.selectedAlbum);
  const tracks = usePlayerStore((s) => s.tracks);
  const setActiveTab = usePlayerStore((s) => s.setActiveTab);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);
  const navigateToArtist = usePlayerStore((s) => s.navigateToArtist);
  
  if (!selectedAlbum) return null;
  
  const albumTracks = tracks.filter((t) => t.album === selectedAlbum || (!t.album && selectedAlbum === 'Unknown Album'));
  const firstTrack = albumTracks[0];
  const artistName = firstTrack?.artist || 'Unknown Artist';
  
  const art = useTrackArt(firstTrack);

  const playAlbum = () => {
    setQueue(albumTracks);
    playIndex(0);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto pr-2 pb-12">
      <div className="flex items-center gap-4 mb-6 sticky top-0 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-3.5 z-10 shadow-lg my-2">
        <button 
          onClick={() => setActiveTab('albums')}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
      </div>
      
      <div className="flex items-end gap-8 mb-8 px-4">
        <div className="w-48 h-48 rounded-2xl overflow-hidden shadow-2xl relative group">
          {art ? (
            <img src={art} alt={selectedAlbum} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
              <Disc className="w-20 h-20 text-zinc-600" />
            </div>
          )}
          <div 
            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
            onClick={playAlbum}
          >
            <div className="w-16 h-16 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 group-hover:scale-110 transition-transform">
              <Play className="w-8 h-8 fill-white ml-2" />
            </div>
          </div>
        </div>
        
        <div className="flex-1 pb-2">
          <h2 className="text-4xl font-bold text-white tracking-tight">{selectedAlbum}</h2>
          <p 
            className="text-indigo-400 text-lg mt-2 font-medium cursor-pointer hover:underline"
            onClick={() => {
              if (artistName !== 'Unknown Artist') {
                navigateToArtist(artistName);
              }
            }}
          >
            {artistName}
          </p>
          <p className="text-zinc-500 text-sm mt-1">{albumTracks.length} songs</p>
        </div>
      </div>
      
      <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
        <TrackList tracks={albumTracks} hideControls={true} />
      </div>
    </div>
  );
};
