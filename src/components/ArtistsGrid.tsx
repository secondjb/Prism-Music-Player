import React, { useState, useEffect, useRef, useMemo } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { Track } from '../types/player';
import { User, Play, LayoutGrid, List } from 'lucide-react';

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
          <div 
            className="w-12 h-12 rounded-full text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"
            style={{
              backgroundColor: 'var(--color-stop-1, #6366f1)',
              boxShadow: '0 8px 24px color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
            }}
          >
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

const ArtistListRow: React.FC<{ artistName: string; artistTracks: Track[]; onPlay: () => void; onNavigate: () => void }> = React.memo(({
  artistName,
  artistTracks,
  onPlay,
  onNavigate,
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
  const art = useTrackArt(isVisible ? firstTrack : null, { thumbnail: true, maxSize: 128 });

  // Calculate unique albums count for this artist
  const albumCount = useMemo(() => {
    const set = new Set<string>();
    artistTracks.forEach((t) => {
      if (t.album) set.add(t.album);
    });
    return set.size;
  }, [artistTracks]);

  return (
    <div
      ref={ref}
      onClick={onNavigate}
      className="group flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-150 cursor-pointer bg-white/[0.025] hover:bg-white/[0.08] border border-white/[0.05] hover:border-white/10"
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {/* Avatar art */}
        <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-zinc-800 border border-white/10 relative group/thumb">
          {art ? (
            <img src={art} alt={artistName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-900/80 to-purple-950/80 flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-300/60" />
            </div>
          )}
          <div
            className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
          >
            <div
              className="w-8 h-8 rounded-full text-white flex items-center justify-center shadow-md group-hover/thumb:scale-110 transition-transform"
              style={{
                backgroundColor: 'var(--color-stop-1, #6366f1)',
              }}
            >
              <Play className="w-4 h-4 fill-white ml-0.5" />
            </div>
          </div>
        </div>

        {/* Artist Name */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-semibold text-sm truncate text-white group-hover:underline">{artistName}</span>
          <span className="text-xs text-zinc-400">
            {albumCount > 0 ? `${albumCount} album${albumCount > 1 ? 's' : ''}` : 'Artist'}
          </span>
        </div>
      </div>

      {/* Meta info */}
      <div className="flex items-center gap-6 text-xs text-zinc-400 font-mono shrink-0">
        <span>{artistTracks.length} track{artistTracks.length > 1 ? 's' : ''}</span>
      </div>
    </div>
  );
});

export const ArtistsGrid: React.FC<ArtistsGridProps> = ({ tracks }) => {
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);
  const navigateToArtist = usePlayerStore((s) => s.navigateToArtist);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('prism_artist_view_mode') as 'grid' | 'list') || 'grid';
  });

  const handleToggleViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('prism_artist_view_mode', mode);
  };

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
    <div className="flex flex-col h-full overflow-hidden pb-12 pr-2">
      {/* Header toolbar with count and view mode toggle */}
      <div className="flex items-center justify-between pb-4 shrink-0">
        <span className="text-xs text-zinc-400 font-medium">
          {artistList.length} artist{artistList.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
          <button
            onClick={() => handleToggleViewMode('grid')}
            title="Grid View"
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-white/15 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleToggleViewMode('list')}
            title="List View"
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'list'
                ? 'bg-white/15 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto custom-scrollbar flex-1">
        {viewMode === 'grid' ? (
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
        ) : (
          <div className="flex flex-col gap-1 pb-8">
            {visibleArtists.map(([artistName, artistTracks]) => (
              <ArtistListRow
                key={artistName}
                artistName={artistName}
                artistTracks={artistTracks}
                onPlay={() => handlePlayArtist(artistTracks)}
                onNavigate={() => navigateToArtist(artistName)}
              />
            ))}
          </div>
        )}

        {renderCount < artistList.length && (
          <div ref={sentinelRef} className="w-full h-12 flex items-center justify-center text-zinc-500 text-xs py-2">
            Loading more artists...
          </div>
        )}
      </div>
    </div>
  );
};
