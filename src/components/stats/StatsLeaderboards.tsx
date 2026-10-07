import React, { useState, useMemo, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Tooltip from '@mui/material/Tooltip';
import { Music, User, Disc, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { TopItem, formatDuration } from '../../utils/statsAggregation';
import { Track } from '../../types/player';
import { useTrackArt } from '../../utils/useTrackArt';
import { usePlayerStore } from '../../store/usePlayerStore';

export interface StatsLeaderboardsProps {
  topSongs: TopItem[];
  topArtists: TopItem[];
  topAlbums?: TopItem[];
  leaderboardMetric: 'time' | 'plays';
  onMetricChange: (m: 'time' | 'plays') => void;
  themeColors: { stop1: string; stop2?: string; stop3?: string };
  libraryTracks?: Track[];
}

type LeaderboardCategory = 'all' | 'tracks' | 'artists' | 'albums';

interface LeaderboardItemRowProps {
  type: 'track' | 'artist' | 'album';
  item: TopItem;
  rank: number;
  matchedTrack?: Track;
  leaderboardMetric: 'time' | 'plays';
  onClick: () => void;
}

const LeaderboardItemRow: React.FC<LeaderboardItemRowProps> = React.memo(({
  type,
  item,
  rank,
  matchedTrack,
  leaderboardMetric,
  onClick,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  // Lazy-list virtualization: only decode artwork when scrolled near the viewport
  useEffect(() => {
    if (!rowRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(rowRef.current);
    return () => observer.disconnect();
  }, []);

  const art = useTrackArt(isVisible ? (matchedTrack ?? null) : null, { thumbnail: true, maxSize: 96 });

  // Outlined Podium Medals (1: Gold, 2: Silver, 3: Bronze)
  const rankStyle = useMemo(() => {
    if (rank === 1) {
      return {
        bgcolor: 'rgba(234, 179, 8, 0.16)',
        border: '1px solid rgba(234, 179, 8, 0.55)',
        color: '#facc15',
        boxShadow: '0 0 10px rgba(234, 179, 8, 0.25)',
      };
    }
    if (rank === 2) {
      return {
        bgcolor: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.22)',
        color: '#f4f4f5',
      };
    }
    if (rank === 3) {
      return {
        bgcolor: 'rgba(217, 119, 6, 0.15)',
        border: '1px solid rgba(217, 119, 6, 0.35)',
        color: '#fbbf24',
      };
    }
    return {
      bgcolor: 'transparent',
      border: '1px solid transparent',
      color: 'rgba(255, 255, 255, 0.45)',
    };
  }, [rank]);

  // Clean secondary label
  const subtitle = useMemo(() => {
    if (type === 'track') {
      return item.artist || 'Unknown Artist';
    }
    if (type === 'album') {
      return item.artist || 'Unknown Artist';
    }
    return 'Artist';
  }, [type, item.artist]);

  const tooltipText = type === 'track'
    ? matchedTrack ? `Click to play "${item.name}"` : item.name
    : type === 'artist'
    ? `View artist page for "${item.name}"`
    : `View album page for "${item.name}"`;

  return (
    <Tooltip title={tooltipText} enterDelay={500} placement="top" arrow>
      <Box
        ref={rowRef}
        onClick={onClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 52,
          py: 0.85,
          px: 1.25,
          borderRadius: '10px',
          bgcolor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid transparent',
          cursor: 'pointer',
          width: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
          transition: 'all 0.15s ease',
          '&:hover': {
            bgcolor: 'rgba(255, 255, 255, 0.07)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            '& .item-play-overlay': { opacity: 1 },
          },
        }}
      >
        {/* Left Stack: Rank + Thumbnail + Title/Artist (All vertically centered) */}
        <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1, mr: 1.5, overflow: 'hidden' }}>
          {/* Centered Rank Medal Badge */}
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: '11px',
              fontWeight: 800,
              fontFamily: 'monospace',
              mr: 1.25,
              ...rankStyle,
            }}
          >
            {rank}
          </Box>

          {/* Centered Media Thumbnail */}
          <Box
            sx={{
              position: 'relative',
              width: 38,
              height: 38,
              borderRadius: type === 'artist' ? '50%' : '8px',
              overflow: 'hidden',
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              mr: 1.25,
            }}
          >
            {art ? (
              <img
                src={art}
                alt={item.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                loading="lazy"
              />
            ) : type === 'artist' ? (
              <User size={18} className="text-zinc-500" />
            ) : type === 'album' ? (
              <Disc size={18} className="text-zinc-500" />
            ) : (
              <Music size={18} className="text-zinc-500" />
            )}

            {/* Hover Play cue for playable tracks */}
            {type === 'track' && matchedTrack && (
              <Box
                className="item-play-overlay"
                sx={{
                  position: 'absolute',
                  inset: 0,
                  bgcolor: 'rgba(0, 0, 0, 0.55)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0,
                  transition: 'opacity 0.15s ease',
                  color: '#ffffff',
                }}
              >
                <Play size={14} fill="#ffffff" />
              </Box>
            )}
          </Box>

          {/* Centered 2-Line Text Content with Ellipsis */}
          <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Typography
              noWrap
              variant="body2"
              sx={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#ffffff',
                lineHeight: 1.25,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
                display: 'block',
              }}
            >
              {item.name}
            </Typography>
            <Typography
              noWrap
              variant="caption"
              sx={{
                color: '#a1a1aa',
                fontSize: '11px',
                lineHeight: 1.25,
                mt: '2px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
                display: 'block',
              }}
            >
              {subtitle}
            </Typography>
          </Box>
        </Box>

        {/* Right Stacked Stat Pill (Time + Plays both visible and vertically centered) */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            justifyContent: 'center',
            minWidth: 68,
            px: 1,
            py: 0.4,
            borderRadius: '8px',
            bgcolor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            flexShrink: 0,
          }}
        >
          {/* Primary sorted metric */}
          <Typography
            variant="caption"
            sx={{
              fontFamily: 'monospace',
              fontSize: '11px',
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
            }}
          >
            {leaderboardMetric === 'time' ? formatDuration(item.listened_ms) : `${item.count} plays`}
          </Typography>

          {/* Secondary companion metric */}
          <Typography
            variant="caption"
            sx={{
              fontFamily: 'monospace',
              fontSize: '10px',
              fontWeight: 500,
              color: '#a1a1aa',
              lineHeight: 1.2,
              mt: '2px',
              whiteSpace: 'nowrap',
            }}
          >
            {leaderboardMetric === 'time' ? `${item.count} plays` : formatDuration(item.listened_ms)}
          </Typography>
        </Box>
      </Box>
    </Tooltip>
  );
});

export const StatsLeaderboards: React.FC<StatsLeaderboardsProps> = ({
  topSongs,
  topArtists,
  topAlbums = [],
  leaderboardMetric,
  onMetricChange,
  themeColors,
  libraryTracks = [],
}) => {
  const [activeCategory, setActiveCategory] = useState<LeaderboardCategory>('all');
  const [visibleCounts, setVisibleCounts] = useState<{ tracks: number; artists: number; albums: number }>({
    tracks: 5,
    artists: 5,
    albums: 5,
  });

  const leaderboardsRootRef = useRef<HTMLDivElement>(null);

  const navigateToArtist = usePlayerStore((s) => s.navigateToArtist);
  const navigateToAlbum = usePlayerStore((s) => s.navigateToAlbum);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);

  // Fast O(1) track lookup maps for artwork & navigation
  const lookupMaps = useMemo(() => {
    const bySong = new Map<string, Track>();
    const byArtist = new Map<string, Track>();
    const byAlbum = new Map<string, Track>();

    for (let i = 0; i < libraryTracks.length; i++) {
      const t = libraryTracks[i];
      if (t.title) {
        const songKey = `${t.title.toLowerCase()}::${(t.artist || '').toLowerCase()}`;
        if (!bySong.has(songKey)) bySong.set(songKey, t);
      }
      if (t.artist && !byArtist.has(t.artist.toLowerCase())) {
        byArtist.set(t.artist.toLowerCase(), t);
      }
      if (t.album && !byAlbum.has(t.album.toLowerCase())) {
        byAlbum.set(t.album.toLowerCase(), t);
      }
    }
    return { bySong, byArtist, byAlbum };
  }, [libraryTracks]);

  const handleMore = (cat: 'tracks' | 'artists' | 'albums') => {
    setVisibleCounts((prev) => ({
      ...prev,
      [cat]: prev[cat] + 5,
    }));
  };

  const handleCollapse = (cat: 'tracks' | 'artists' | 'albums') => {
    setVisibleCounts((prev) => ({
      ...prev,
      [cat]: 5,
    }));
    // Smoothly scroll back to the leaderboard section header
    leaderboardsRootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleTrackClick = (item: TopItem) => {
    const songKey = `${item.name.toLowerCase()}::${(item.artist || '').toLowerCase()}`;
    const matched = lookupMaps.bySong.get(songKey);
    if (matched) {
      setQueue([matched]);
      playIndex(0);
    }
  };

  const handleArtistClick = (item: TopItem) => {
    navigateToArtist(item.name);
  };

  const handleAlbumClick = (item: TopItem) => {
    navigateToAlbum(item.name);
  };

  const renderCategoryCard = (
    catKey: 'tracks' | 'artists' | 'albums',
    title: string,
    IconComponent: React.ComponentType<{ size: number; className?: string }>,
    items: TopItem[],
    onItemClick: (item: TopItem) => void
  ) => {
    const count = visibleCounts[catKey];
    const visibleItems = items.slice(0, count);
    const hasMore = items.length > count;
    const isExpanded = count > 5;

    return (
      <Box
        sx={{
          borderRadius: '16px',
          p: 2,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          bgcolor: 'rgba(22, 22, 28, 0.5)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Card Header */}
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: `${themeColors.stop1}18`,
                color: themeColors.stop1,
              }}
            >
              <IconComponent size={15} />
            </Box>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              {title}
            </Typography>
          </Stack>

          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '11px', fontFamily: 'monospace' }}>
            {items.length > 0 ? `${items.length} total` : 'None'}
          </Typography>
        </Stack>

        {/* Natural-flowing list with no inner scrollbar (scrolls with entire page) */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.75,
            width: '100%',
            overflow: 'visible',
          }}
        >
          {visibleItems.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
              <Typography variant="caption">No plays logged in this time range</Typography>
            </Box>
          ) : (
            visibleItems.map((item, idx) => {
              let matched: Track | undefined;
              if (catKey === 'tracks') {
                const key = `${item.name.toLowerCase()}::${(item.artist || '').toLowerCase()}`;
                matched = lookupMaps.bySong.get(key);
              } else if (catKey === 'artists') {
                matched = lookupMaps.byArtist.get(item.name.toLowerCase());
              } else {
                matched = lookupMaps.byAlbum.get(item.name.toLowerCase());
              }

              return (
                <LeaderboardItemRow
                  key={`${item.name}-${item.artist || ''}-${idx}`}
                  type={catKey === 'tracks' ? 'track' : catKey === 'artists' ? 'artist' : 'album'}
                  item={item}
                  rank={idx + 1}
                  matchedTrack={matched}
                  leaderboardMetric={leaderboardMetric}
                  onClick={() => onItemClick(item)}
                />
              );
            })
          )}
        </Box>

        {/* Card Footer with "More" & "Collapse" controls */}
        {items.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pt: 1.25,
              mt: 'auto',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '11px' }}>
              {`Showing ${Math.min(count, items.length)} of ${items.length}`}
            </Typography>

            <Stack direction="row" spacing={1}>
              {hasMore && (
                <Button
                  size="small"
                  onClick={() => handleMore(catKey)}
                  endIcon={<ChevronDown size={14} />}
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.06)',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'none',
                    py: 0.35,
                    px: 1.25,
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.12)',
                      borderColor: 'rgba(255, 255, 255, 0.16)',
                    },
                  }}
                >
                  More
                </Button>
              )}

              {isExpanded && (
                <Button
                  size="small"
                  onClick={() => handleCollapse(catKey)}
                  endIcon={<ChevronUp size={14} />}
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.04)',
                    color: 'text.secondary',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'none',
                    py: 0.35,
                    px: 1.25,
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.08)',
                      color: '#ffffff',
                    },
                  }}
                >
                  Collapse
                </Button>
              )}
            </Stack>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box ref={leaderboardsRootRef} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Top Header Toolbar: Category Tabs + Time/Plays Metric Toggle */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            Leaderboards
          </Typography>

          {/* Category Filter Tabs */}
          <ToggleButtonGroup
            size="small"
            value={activeCategory}
            exclusive
            onChange={(_, val) => {
              if (val) setActiveCategory(val);
            }}
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              p: 0.25,
              '& .MuiToggleButtonGroup-grouped': {
                border: 0,
                borderRadius: '6px !important',
                px: 1.25,
                py: 0.35,
                fontSize: '11px',
                fontWeight: 600,
                color: '#a1a1aa',
                textTransform: 'none',
                '&.Mui-selected': {
                  bgcolor: 'rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                },
              },
            }}
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="tracks">Tracks</ToggleButton>
            <ToggleButton value="artists">Artists</ToggleButton>
            <ToggleButton value="albums">Albums</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {/* Time / Plays Metric Selector */}
        <ToggleButtonGroup
          size="small"
          value={leaderboardMetric}
          exclusive
          onChange={(_, val) => {
            if (val) onMetricChange(val);
          }}
          sx={{
            bgcolor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            p: 0.25,
            '& .MuiToggleButtonGroup-grouped': {
              border: 0,
              borderRadius: '6px !important',
              px: 1.5,
              py: 0.35,
              fontSize: '11px',
              fontWeight: 600,
              color: '#a1a1aa',
              '&.Mui-selected': {
                bgcolor: 'var(--color-stop-1, #6366f1)',
                color: '#ffffff',
              },
            },
          }}
        >
          <ToggleButton value="time">Time</ToggleButton>
          <ToggleButton value="plays">Plays</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* Grid Layout of Leaderboard Categories */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: activeCategory === 'all'
            ? { xs: '1fr', md: 'repeat(3, 1fr)' }
            : '1fr',
          gap: 2,
          width: '100%',
        }}
      >
        {(activeCategory === 'all' || activeCategory === 'tracks') &&
          renderCategoryCard('tracks', 'Top Tracks', Music, topSongs, handleTrackClick)}

        {(activeCategory === 'all' || activeCategory === 'artists') &&
          renderCategoryCard('artists', 'Top Artists', User, topArtists, handleArtistClick)}

        {(activeCategory === 'all' || activeCategory === 'albums') &&
          renderCategoryCard('albums', 'Top Albums', Disc, topAlbums, handleAlbumClick)}
      </Box>
    </Box>
  );
};
