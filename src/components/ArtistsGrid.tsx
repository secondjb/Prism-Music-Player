import React, { useState, useEffect, useRef, useMemo } from 'react';
import Box from '@mui/material/Box';
import { usePlayerStore } from '../store/usePlayerStore';
import { Track } from '../types/player';
import { ViewHeaderControls, SortOption } from './common/ViewHeaderControls';
import { ArtistCard } from './artists/ArtistCard';
import { ArtistListRow } from './artists/ArtistListRow';

type ArtistSortKey = 'alphabetical' | 'songs' | 'release_date';

const ARTIST_SORT_OPTIONS: SortOption<ArtistSortKey>[] = [
  { id: 'alphabetical', label: 'Alphabetical', defaultDir: 'asc' },
  { id: 'songs', label: 'Most Songs', defaultDir: 'desc' },
  { id: 'release_date', label: 'Release Date', defaultDir: 'desc' },
];

export interface ArtistsGridProps {
  tracks: Track[];
}

export const ArtistsGrid: React.FC<ArtistsGridProps> = ({ tracks }) => {
  const navigateToArtist = usePlayerStore((s) => s.navigateToArtist);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);

  const [sortKey, setSortKey] = useState<ArtistSortKey>(() => {
    return (localStorage.getItem('prism_artist_sort_key') as ArtistSortKey) || 'alphabetical';
  });
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => {
    return (localStorage.getItem('prism_artist_sort_dir') as 'asc' | 'desc') || 'asc';
  });

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('prism_artist_view_mode') as 'grid' | 'list') || 'grid';
  });

  const [renderCount, setRenderCount] = useState(40);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleSortChange = (key: ArtistSortKey, dir: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDir(dir);
    localStorage.setItem('prism_artist_sort_key', key);
    localStorage.setItem('prism_artist_sort_dir', dir);
  };

  const handleToggleViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('prism_artist_view_mode', mode);
  };

  // Group tracks by artist
  const artistMap = useMemo(() => {
    const map = new Map<string, Track[]>();
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const name = track.artist || 'Unknown Artist';
      const existing = map.get(name);
      if (existing) {
        existing.push(track);
      } else {
        map.set(name, [track]);
      }
    }
    return map;
  }, [tracks]);

  // Sort artists
  const artistList = useMemo(() => {
    const list = Array.from(artistMap.entries());

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
  }, [artistMap, sortKey, sortDir]);

  // Infinite scroll
  useEffect(() => {
    setRenderCount(40);
  }, [artistList]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRenderCount((prev) => Math.min(prev + 40, artistList.length));
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [artistList.length]);

  const visibleArtists = useMemo(() => {
    return artistList.slice(0, renderCount);
  }, [artistList, renderCount]);

  const handlePlayArtist = (artistTracks: Track[]) => {
    if (artistTracks.length > 0) {
      setQueue(artistTracks);
      playIndex(0);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <ViewHeaderControls
        sortOptions={ARTIST_SORT_OPTIONS}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSortChange}
        viewMode={viewMode}
        onViewModeChange={handleToggleViewMode}
        title="Artists"
        countLabel={`${artistList.length} artists`}
      />

      <Box sx={{ overflowY: 'auto', flex: 1, pr: 1 }} className="custom-scrollbar">
        {viewMode === 'grid' ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(auto-fill, minmax(140px, 1fr))',
                sm: 'repeat(auto-fill, minmax(160px, 1fr))',
                md: 'repeat(auto-fill, minmax(180px, 1fr))',
              },
              gap: 2.5,
              pb: 6,
            }}
          >
            {visibleArtists.map(([artistName, artistTracks]) => (
              <ArtistCard
                key={artistName}
                artistName={artistName}
                artistTracks={artistTracks}
                onPlay={() => handlePlayArtist(artistTracks)}
                onNavigate={() => navigateToArtist(artistName)}
              />
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 6 }}>
            {visibleArtists.map(([artistName, artistTracks]) => (
              <ArtistListRow
                key={artistName}
                artistName={artistName}
                artistTracks={artistTracks}
                onPlay={() => handlePlayArtist(artistTracks)}
                onNavigate={() => navigateToArtist(artistName)}
              />
            ))}
          </Box>
        )}

        {renderCount < artistList.length && (
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
            Loading more artists...
          </Box>
        )}
      </Box>
    </Box>
  );
};
