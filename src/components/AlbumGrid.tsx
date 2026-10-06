import React, { useState, useEffect, useRef, useMemo } from 'react';
import Box from '@mui/material/Box';
import { usePlayerStore } from '../store/usePlayerStore';
import { Track } from '../types/player';
import { ViewHeaderControls, SortOption } from './common/ViewHeaderControls';
import { AlbumCard } from './albums/AlbumCard';
import { AlbumListRow } from './albums/AlbumListRow';

type AlbumSortKey = 'alphabetical' | 'songs' | 'release_date';

const ALBUM_SORT_OPTIONS: SortOption<AlbumSortKey>[] = [
  { id: 'alphabetical', label: 'Alphabetical', defaultDir: 'asc' },
  { id: 'songs', label: 'Most Songs', defaultDir: 'desc' },
  { id: 'release_date', label: 'Release Date', defaultDir: 'desc' },
];

export interface AlbumGridProps {
  tracks: Track[];
}

export const AlbumGrid: React.FC<AlbumGridProps> = ({ tracks }) => {
  const navigateToAlbum = usePlayerStore((s) => s.navigateToAlbum);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);

  const [sortKey, setSortKey] = useState<AlbumSortKey>(() => {
    return (localStorage.getItem('prism_album_sort_key') as AlbumSortKey) || 'alphabetical';
  });
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => {
    return (localStorage.getItem('prism_album_sort_dir') as 'asc' | 'desc') || 'asc';
  });

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('prism_album_view_mode') as 'grid' | 'list') || 'grid';
  });

  const [renderCount, setRenderCount] = useState(40);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleSortChange = (key: AlbumSortKey, dir: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDir(dir);
    localStorage.setItem('prism_album_sort_key', key);
    localStorage.setItem('prism_album_sort_dir', dir);
  };

  const handleToggleViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('prism_album_view_mode', mode);
  };

  // Group tracks by album
  const albumMap = useMemo(() => {
    const map = new Map<string, Track[]>();
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const name = track.album || 'Unknown Album';
      const existing = map.get(name);
      if (existing) {
        existing.push(track);
      } else {
        map.set(name, [track]);
      }
    }
    return map;
  }, [tracks]);

  // Sort albums
  const albumList = useMemo(() => {
    const list = Array.from(albumMap.entries());

    list.sort(([nameA, tracksA], [nameB, tracksB]) => {
      let cmp = 0;
      if (sortKey === 'alphabetical') {
        cmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
      } else if (sortKey === 'songs') {
        cmp = tracksA.length - tracksB.length;
      } else if (sortKey === 'release_date') {
        const yearA = tracksA[0]?.year || 0;
        const yearB = tracksB[0]?.year || 0;
        cmp = yearA - yearB;
      }

      if (cmp === 0) {
        cmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
      }

      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [albumMap, sortKey, sortDir]);

  // Infinite scroll
  useEffect(() => {
    setRenderCount(40);
  }, [albumList]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRenderCount((prev) => Math.min(prev + 40, albumList.length));
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [albumList.length]);

  const visibleAlbums = useMemo(() => {
    return albumList.slice(0, renderCount);
  }, [albumList, renderCount]);

  const handlePlayAlbum = (albumTracks: Track[]) => {
    if (albumTracks.length > 0) {
      setQueue(albumTracks);
      playIndex(0);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <ViewHeaderControls
        sortOptions={ALBUM_SORT_OPTIONS}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSortChange}
        viewMode={viewMode}
        onViewModeChange={handleToggleViewMode}
        title="Albums"
        countLabel={`${albumList.length} albums`}
      />

      <Box sx={{ overflowY: 'auto', flex: 1, pr: 1 }} className="custom-scrollbar">
        {viewMode === 'grid' ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(auto-fill, minmax(150px, 1fr))',
                sm: 'repeat(auto-fill, minmax(170px, 1fr))',
                md: 'repeat(auto-fill, minmax(190px, 1fr))',
              },
              gap: 2.5,
              pb: 6,
            }}
          >
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
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 6 }}>
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
          </Box>
        )}

        {renderCount < albumList.length && (
          <Box
            ref={sentinelRef}
            sx={{
              width: '100%',
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
              fontSize: '12px',
            }}
          >
            Loading more albums...
          </Box>
        )}
      </Box>
    </Box>
  );
};
