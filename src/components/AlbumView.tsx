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
    <div className="flex flex-col h-full overflow-y-auto pr-2 pb-28 custom-scrollbar">
      <div className="flex items-center gap-4 mb-6 sticky top-0 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-3.5 z-10 shadow-lg my-2">
        <button 
          onClick={() => setActiveTab('albums')}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
      </div>
      
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8 mb-8 px-4 text-center sm:text-left">
        <div className="w-36 h-36 sm:w-48 sm:h-48 rounded-2xl overflow-hidden shadow-2xl relative group shrink-0">
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
            <div 
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"
              style={{
                backgroundColor: 'var(--color-stop-1, #6366f1)',
                boxShadow: '0 8px 24px color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
              }}
            >
              <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-white ml-1.5" />
            </div>
          </div>
        </div>
        
        <div className="flex-1 min-w-0 pb-2">
          <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight truncate">{selectedAlbum}</h2>
          <p 
            className="text-base sm:text-lg mt-1 sm:mt-2 font-medium cursor-pointer hover:underline truncate"
            style={{ color: 'var(--color-stop-1, #818cf8)' }}
            onClick={() => {
              if (artistName !== 'Unknown Artist') {
                navigateToArtist(artistName);
              }
            }}
          >
            {artistName}
          </p>
          <p className="text-zinc-500 text-xs sm:text-sm mt-1">{albumTracks.length} songs</p>
        </div>
      </div>
      
      <div className="bg-white/5 rounded-2xl border border-white/10 px-5 pt-4 pb-12 mb-10 shadow-xl">
        <TrackList tracks={albumTracks} hideControls={true} autoHeight={true} />
      </div>
    </div>
  );
};
