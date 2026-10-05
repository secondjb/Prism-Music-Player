import React, { useState, useEffect, useRef, useMemo } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { Track } from '../types/player';
import { Disc, Play, LayoutGrid, List, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';

type AlbumSortKey = 'alphabetical' | 'songs' | 'release_date';
type SortDirection = 'asc' | 'desc';

const ALBUM_SORT_OPTIONS = [
  { id: 'alphabetical' as const, label: 'Alphabetical', defaultDir: 'asc' as const },
  { id: 'songs' as const, label: 'Most Songs', defaultDir: 'desc' as const },
  { id: 'release_date' as const, label: 'Release Date', defaultDir: 'desc' as const },
];

interface AlbumGridProps {
  tracks: Track[];
}

// Global shared intersection observer for all album cards
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

const AlbumCard: React.FC<{ albumName: string; albumTracks: Track[]; onPlay: () => void; onNavigate: () => void; artist: string }> = React.memo(({
  albumName,
  albumTracks,
  onPlay,
  onNavigate,
  artist
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

  const firstTrack = albumTracks[0];
  const art = useTrackArt(isVisible ? firstTrack : null, { thumbnail: true, maxSize: 256 });
  const navigateToArtist = usePlayerStore((s) => s.navigateToArtist);

  return (
    <div
      ref={ref}
      onClick={onNavigate}
      className="group glass-card rounded-2xl p-4 flex flex-col gap-3 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-950/30 h-[280px]"
    >
      {/* Album Cover Art */}
      <div className="w-full aspect-square rounded-xl overflow-hidden bg-zinc-800 border border-white/10 relative shadow-md">
        {art ? (
          <img src={art} alt={albumName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, #18181b), color-mix(in srgb, var(--color-stop-2, #8b5cf6) 20%, #09090b))',
            }}
          >
            <Disc
              className="w-12 h-12"
              style={{ color: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 75%, white)' }}
            />
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

      {/* Album Details */}
      <div className="flex flex-col min-w-0">
        <h4 className="font-bold text-sm text-white truncate hover:underline">{albumName}</h4>
        <p 
          className="text-xs text-zinc-400 truncate mt-0.5 hover:underline hover:text-indigo-400 z-10"
          onClick={(e) => {
            if (artist !== 'Unknown Artist') {
              e.stopPropagation();
              navigateToArtist(artist);
            }
          }}
        >
          {artist}
        </p>
        <span className="text-[11px] text-zinc-500 font-mono mt-1">
          {albumTracks.length} track{albumTracks.length > 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
});

const AlbumListRow: React.FC<{ albumName: string; albumTracks: Track[]; onPlay: () => void; onNavigate: () => void; artist: string }> = React.memo(({
  albumName,
  albumTracks,
  onPlay,
  onNavigate,
  artist,
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

  const firstTrack = albumTracks[0];
  const art = useTrackArt(isVisible ? firstTrack : null, { thumbnail: true, maxSize: 128 });
  const navigateToArtist = usePlayerStore((s) => s.navigateToArtist);

  const totalDuration = useMemo(() => {
    return albumTracks.reduce((acc, t) => acc + (t.duration_secs || 0), 0);
  }, [albumTracks]);

  const year = firstTrack?.year;

  return (
    <div
      ref={ref}
      onClick={onNavigate}
      className="group flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-150 cursor-pointer bg-white/[0.025] hover:bg-white/[0.08] border border-white/[0.05] hover:border-white/10"
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {/* Thumbnail art */}
        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-zinc-800 border border-white/10 relative group/thumb">
          {art ? (
            <img src={art} alt={albumName} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, #18181b), color-mix(in srgb, var(--color-stop-2, #8b5cf6) 20%, #09090b))',
              }}
            >
              <Disc
                className="w-5 h-5"
                style={{ color: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 75%, white)' }}
              />
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

        {/* Album & Artist */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-semibold text-sm truncate text-white group-hover:underline">{albumName}</span>
          <span
            className="text-xs text-zinc-400 truncate hover:underline hover:text-indigo-400 cursor-pointer"
            onClick={(e) => {
              if (artist !== 'Unknown Artist') {
                e.stopPropagation();
                navigateToArtist(artist);
              }
            }}
          >
            {artist}
          </span>
        </div>
      </div>

      {/* Meta info */}
      <div className="flex items-center gap-6 text-xs text-zinc-400 font-mono shrink-0">
        {year && <span className="text-zinc-500">{year}</span>}
        <span>{albumTracks.length} track{albumTracks.length > 1 ? 's' : ''}</span>
        {totalDuration > 0 && (() => {
          const totalSecs = Math.round(totalDuration);
          const mins = Math.floor(totalSecs / 60);
          const secs = totalSecs % 60;
          return (
            <span className="w-14 text-right text-zinc-500">
              {mins}:{secs.toString().padStart(2, '0')}
            </span>
          );
        })()}
      </div>
    </div>
  );
});

export const AlbumGrid: React.FC<AlbumGridProps> = ({ tracks }) => {
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);
  const navigateToAlbum = usePlayerStore((s) => s.navigateToAlbum);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('prism_album_view_mode') as 'grid' | 'list') || 'grid';
  });

  const [sortKey, setSortKey] = useState<AlbumSortKey>(() => {
    return (localStorage.getItem('prism_album_sort_key') as AlbumSortKey) || 'alphabetical';
  });
  const [sortDir, setSortDir] = useState<SortDirection>(() => {
    return (localStorage.getItem('prism_album_sort_dir') as SortDirection) || 'asc';
  });
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    if (showSortMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSortMenu]);

  const handleSelectSort = (key: AlbumSortKey, defaultDir: SortDirection) => {
    if (sortKey === key) {
      const nextDir: SortDirection = sortDir === 'asc' ? 'desc' : 'asc';
      setSortDir(nextDir);
      localStorage.setItem('prism_album_sort_dir', nextDir);
    } else {
      setSortKey(key);
      setSortDir(defaultDir);
      localStorage.setItem('prism_album_sort_key', key);
      localStorage.setItem('prism_album_sort_dir', defaultDir);
    }
    setShowSortMenu(false);
  };

  const handleToggleViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('prism_album_view_mode', mode);
  };

  // Group and sort tracks by album name efficiently with useMemo
  const albumList = useMemo(() => {
    const albumsMap = new Map<string, Track[]>();
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const albumName = track.album || 'Unknown Album';
      const existing = albumsMap.get(albumName);
      if (existing) {
        existing.push(track);
      } else {
        albumsMap.set(albumName, [track]);
      }
    }
    const entries = Array.from(albumsMap.entries());

    return entries.sort((a, b) => {
      if (sortKey === 'songs') {
        const diff = sortDir === 'desc' ? b[1].length - a[1].length : a[1].length - b[1].length;
        if (diff !== 0) return diff;
      } else if (sortKey === 'release_date') {
        const getYear = (tracks: Track[]) => {
          let maxYear = 0;
          for (const t of tracks) {
            const y = t.year || (t.date ? parseInt(t.date, 10) : 0) || 0;
            if (y > maxYear) maxYear = y;
          }
          return maxYear;
        };
        const yearA = getYear(a[1]);
        const yearB = getYear(b[1]);
        const diff = sortDir === 'desc' ? yearB - yearA : yearA - yearB;
        if (diff !== 0) return diff;
      }
      const cmp = a[0].localeCompare(b[0], undefined, { numeric: true });
      return sortDir === 'desc' && sortKey === 'alphabetical' ? -cmp : cmp;
    });
  }, [tracks, sortKey, sortDir]);

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
        setRenderCount((prev) => Math.min(prev + 48, albumList.length));
      }
    });
  }, [albumList.length]);

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

  const visibleAlbums = albumList.slice(0, renderCount);

  return (
    <div className="flex flex-col h-full overflow-hidden pb-12 pr-2">
      {/* Header toolbar with count, sort dropdown, and view mode toggle */}
      <div className="flex items-center justify-between pb-4 shrink-0">
        <span className="text-xs text-zinc-400 font-medium">
          {albumList.length} album{albumList.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2">
          {/* Sort Dropdown */}
          <div className="relative" ref={sortDropdownRef}>
            <button
              type="button"
              onClick={() => setShowSortMenu((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer shadow-sm active:scale-95"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)',
                color: 'var(--color-stop-1, #6366f1)',
                borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
              }}
              title="Sort albums"
            >
              <ArrowUpDown className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
              <span>{ALBUM_SORT_OPTIONS.find((o) => o.id === sortKey)?.label}</span>
              {sortDir === 'desc' ? (
                <ArrowDown className="w-3 h-3 stroke-[2.5]" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
              ) : (
                <ArrowUp className="w-3 h-3 stroke-[2.5]" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
              )}
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showSortMenu ? 'rotate-180' : ''}`} style={{ color: 'var(--color-stop-1, #6366f1)' }} />
            </button>

            {showSortMenu && (
              <div
                className="absolute right-0 mt-1.5 w-48 rounded-2xl glass-panel border shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                style={{
                  borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 30%, transparent)',
                }}
              >
                <div className="px-3 py-1.5 text-xs font-semibold text-zinc-400 select-none">
                  Sort albums
                </div>
                {ALBUM_SORT_OPTIONS.map((opt) => {
                  const isActive = sortKey === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectSort(opt.id, opt.defaultDir)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors text-left cursor-pointer select-none ${
                        isActive
                          ? 'font-semibold border'
                          : 'text-zinc-300 hover:text-white hover:bg-white/10'
                      }`}
                      style={
                        isActive
                          ? {
                              color: 'var(--color-stop-1, #6366f1)',
                              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)',
                              borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 30%, transparent)',
                            }
                          : undefined
                      }
                    >
                      <span>{opt.label}</span>
                      {isActive && (
                        sortDir === 'desc' ? (
                          <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                        ) : (
                          <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                        )
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* View Mode Toggle */}
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
      </div>

      <div className="overflow-y-auto custom-scrollbar flex-1">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 pb-8" style={{ alignContent: 'start' }}>
            {visibleAlbums.map(([albumName, albumTracks]) => (
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
        ) : (
          <div className="flex flex-col gap-1 pb-8">
            {visibleAlbums.map(([albumName, albumTracks]) => (
              <AlbumListRow
                key={albumName}
                albumName={albumName}
                albumTracks={albumTracks}
                artist={albumTracks[0]?.artist || 'Unknown Artist'}
                onPlay={() => handlePlayAlbum(albumTracks)}
                onNavigate={() => navigateToAlbum(albumName)}
              />
            ))}
          </div>
        )}

        {renderCount < albumList.length && (
          <div ref={sentinelRef} className="w-full h-12 flex items-center justify-center text-zinc-500 text-xs py-2">
            Loading more albums...
          </div>
        )}
      </div>
    </div>
  );
};
