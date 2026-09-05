import React, { useState, useEffect, useRef, useMemo } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { Track } from '../types/player';
import { User, Play } from 'lucide-react';

interface ArtistsGridProps {
  tracks: Track[];
}

// Global shared intersection observer for all artist and album cards
const observerCallbacks = new Map<Element, (isIntersecting: boolean) => void>();
let globalObserver: IntersectionObserver | null = null;

function getGlobalObserver() {
  if (!globalObserver && typeof window !== 'undefined' && 'IntersectionObserver' in window) {
    globalObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const cb = observerCallbacks.get(entry.target);
          if (cb) cb(entry.isIntersecting);
        });
      },
      { rootMargin: '300px' }
    );
  }
  return globalObserver;
}

function observeElement(el: Element, callback: (isIntersecting: boolean) => void) {
  const observer = getGlobalObserver();
  if (!observer) {
    callback(true);
    return () => {};
  }
  observerCallbacks.set(el, callback);
  observer.observe(el);
  return () => {
    observerCallbacks.delete(el);
    observer.unobserve(el);
  };
}

const ArtistCard: React.FC<{ artistName: string; artistTracks: Track[]; onPlay: () => void; onNavigate: () => void }> = React.memo(({
  artistName,
  artistTracks,
  onPlay,
  onNavigate
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    return observeElement(ref.current, (isIntersecting) => {
      if (isIntersecting) {
        setIsVisible(true);
      }
    });
  }, []);

  const firstTrack = artistTracks[0];
  const art = useTrackArt(isVisible ? firstTrack : null, { thumbnail: true, maxSize: 256 });

  return (
    <div
      ref={ref}
      onClick={onNavigate}
      className="group glass-card rounded-2xl p-4 flex flex-col gap-3 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-950/30 h-[260px] items-center text-center"
    >
      {/* Artist Image Placeholder */}
      <div className="w-full aspect-square rounded-full overflow-hidden bg-zinc-800 border border-white/10 relative shadow-md">
        {art ? (
          <img src={art} alt={artistName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
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
      <div className="flex flex-col min-w-0 mt-2 w-full px-1">
        <h4 className="font-bold text-sm text-white truncate group-hover:underline">{artistName}</h4>
        <span className="text-[11px] text-zinc-500 font-mono mt-1">
          {artistTracks.length} track{artistTracks.length > 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
});

export const ArtistsGrid: React.FC<ArtistsGridProps> = ({ tracks }) => {
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);
  const navigateToArtist = usePlayerStore((s) => s.navigateToArtist);

  // Group and sort tracks by artist name efficiently with useMemo
  const artistList = useMemo(() => {
    const artistsMap = new Map<string, Track[]>();
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const artistName = track.artist || 'Unknown Artist';
      const existing = artistsMap.get(artistName);
      if (existing) {
        existing.push(track);
      } else {
        artistsMap.set(artistName, [track]);
      }
    }
    return Array.from(artistsMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tracks]);

  // Progressive batch rendering: render first 48, load more on scroll
  const [renderCount, setRenderCount] = useState(48);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRenderCount(48);
  }, [tracks]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    return observeElement(sentinelRef.current, (isIntersecting) => {
      if (isIntersecting) {
        setRenderCount((prev) => Math.min(prev + 48, artistList.length));
      }
    });
  }, [artistList.length]);

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

  const visibleArtists = artistList.slice(0, renderCount);

  return (
    <div className="overflow-y-auto custom-scrollbar h-full pb-12 pr-2">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 pb-8" style={{ alignContent: 'start' }}>
        {visibleArtists.map(([artistName, artistTracks]) => (
          <ArtistCard
            key={artistName}
            artistName={artistName}
            artistTracks={artistTracks}
            onPlay={() => handlePlayArtist(artistTracks)}
            onNavigate={() => navigateToArtist(artistName)}
          />
        ))}
      </div>
      {renderCount < artistList.length && (
        <div ref={sentinelRef} className="w-full h-12 flex items-center justify-center text-zinc-500 text-xs py-2">
          Loading more artists...
        </div>
      )}
    </div>
  );
};
