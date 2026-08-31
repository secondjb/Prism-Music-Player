import React, { useState, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePlayerStore, TrackColumnId, TrackGridDensity } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { Track } from '../types/player';
import {
  Play,
  Pause,
  Heart,
  ListPlus,
  PlusCircle,
  MoreVertical,
  Info,
  Columns,
  Maximize2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Music,
  Check,
  RotateCcw,
} from 'lucide-react';

interface TrackGridViewProps {
  tracks: Track[];
  playlistId?: string; // Optional if rendering inside a playlist
  onRemoveFromPlaylist?: (trackId: string) => void;
}

type SortField = 'original' | 'title' | 'artist' | 'album' | 'year' | 'genre' | 'duration';
type SortOrder = 'asc' | 'desc';

const ALL_COLUMNS: { id: TrackColumnId; label: string; minWidth: string }[] = [
  { id: 'order', label: '#', minWidth: '40px' },
  { id: 'art', label: 'Cover', minWidth: '56px' },
  { id: 'title', label: 'Title', minWidth: '160px' },
  { id: 'artist', label: 'Artist', minWidth: '130px' },
  { id: 'album', label: 'Album', minWidth: '130px' },
  { id: 'date', label: 'Year', minWidth: '70px' },
  { id: 'genre', label: 'Genre', minWidth: '90px' },
  { id: 'duration', label: 'Time', minWidth: '65px' },
  { id: 'favorite', label: 'Like', minWidth: '42px' },
  { id: 'playNext', label: 'Next', minWidth: '42px' },
  { id: 'addToQueue', label: '+Queue', minWidth: '42px' },
  { id: 'actions', label: 'More', minWidth: '42px' },
];

const DENSITY_CONFIG: Record<
  TrackGridDensity,
  { rowHeight: number; artSize: string; artIconSize: string; textSize: string; subTextSize: string; py: string }
> = {
  compact: { rowHeight: 44, artSize: 'w-8 h-8', artIconSize: 'w-3.5 h-3.5', textSize: 'text-xs', subTextSize: 'text-[10px]', py: 'py-1' },
  normal: { rowHeight: 60, artSize: 'w-11 h-11', artIconSize: 'w-4 h-4', textSize: 'text-sm', subTextSize: 'text-xs', py: 'py-1.5' },
  large: { rowHeight: 76, artSize: 'w-14 h-14', artIconSize: 'w-5 h-5', textSize: 'text-base', subTextSize: 'text-xs', py: 'py-2' },
  'extra-large': { rowHeight: 92, artSize: 'w-18 h-18', artIconSize: 'w-6 h-6', textSize: 'text-lg', subTextSize: 'text-sm', py: 'py-2.5' },
};

const formatDuration = (secs: number) => {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// Sub-component for rendering album art cell
const TrackArtCell: React.FC<{ track: Track; densityConfig: typeof DENSITY_CONFIG['normal'] }> = ({ track, densityConfig }) => {
  const art = useTrackArt(track);
  return (
    <div className={`${densityConfig.artSize} rounded-lg overflow-hidden shrink-0 bg-zinc-800 border border-white/10 relative shadow-sm`}>
      {art ? (
        <img src={art} alt={track.title} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-indigo-950/60 to-purple-950/60 flex items-center justify-center text-indigo-400">
          <Music className={densityConfig.artIconSize} />
        </div>
      )}
    </div>
  );
};

export const TrackGridView: React.FC<TrackGridViewProps> = ({ tracks, playlistId, onRemoveFromPlaylist }) => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const likedTrackIds = usePlayerStore((s) => s.likedTrackIds);
  const toggleLikeTrack = usePlayerStore((s) => s.toggleLikeTrack);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const playNext = usePlayerStore((s) => s.playNext);
  const setInfoModalTrack = usePlayerStore((s) => s.setInfoModalTrack);

  const visibleTrackColumns = usePlayerStore((s) => s.visibleTrackColumns);
  const toggleTrackColumn = usePlayerStore((s) => s.toggleTrackColumn);
  const setVisibleTrackColumns = usePlayerStore((s) => s.setVisibleTrackColumns);
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  const setTrackGridDensity = usePlayerStore((s) => s.setTrackGridDensity);

  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showDensityMenu, setShowDensityMenu] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('original');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Context menu state (opens at exact click coordinates)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: Track } | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);

  // Memoized sorted tracks
  const sortedTracks = useMemo(() => {
    if (sortField === 'original') return tracks;
    const sorted = [...tracks].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'title':
          valA = (a.title || '').toLowerCase();
          valB = (b.title || '').toLowerCase();
          break;
        case 'artist':
          valA = (a.artist || '').toLowerCase();
          valB = (b.artist || '').toLowerCase();
          break;
        case 'album':
          valA = (a.album || '').toLowerCase();
          valB = (b.album || '').toLowerCase();
          break;
        case 'year':
          valA = a.year || 0;
          valB = b.year || 0;
          break;
        case 'genre':
          valA = (a.genre || '').toLowerCase();
          valB = (b.genre || '').toLowerCase();
          break;
        case 'duration':
          valA = a.duration_secs || 0;
          valB = b.duration_secs || 0;
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [tracks, sortField, sortOrder]);

  const handleHeaderSort = (field: SortField) => {
    if (sortField === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortField('original');
        setSortOrder('asc');
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const densityConfig = DENSITY_CONFIG[trackGridDensity] || DENSITY_CONFIG.normal;

  const rowVirtualizer = useVirtualizer({
    count: sortedTracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => densityConfig.rowHeight,
    overscan: 8,
  });

  const isColVisible = (id: TrackColumnId) => visibleTrackColumns.includes(id);

  const handleRowContextMenu = (e: React.MouseEvent, track: Track) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      track,
    });
  };

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3 glass-card rounded-2xl border border-dashed border-white/10 my-4">
        <div className="w-14 h-14 rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-500">
          <Music className="w-8 h-8 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">No tracks available</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm">There are no tracks to display in this view.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden select-none">
      {/* Top Toolbar Controls (Column customizer, size changer, total count) */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-zinc-900/40 backdrop-blur-md rounded-t-2xl z-10 shrink-0 gap-3">
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span className="font-semibold text-white">{sortedTracks.length} tracks</span>
          {sortField !== 'original' && (
            <button
              onClick={() => {
                setSortField('original');
                setSortOrder('asc');
              }}
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Sort</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 relative">
          {/* Item Density / Size Selector */}
          <div className="relative">
            <button
              onClick={() => {
                setShowDensityMenu(!showDensityMenu);
                setShowColumnMenu(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium border border-white/10 transition-colors cursor-pointer"
              title="Change Item Size / Density"
            >
              <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
              <span className="capitalize">{trackGridDensity} Size</span>
            </button>

            {showDensityMenu && (
              <div
                className="absolute right-0 top-10 w-44 glass-panel border border-white/10 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 text-xs animate-in fade-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2 py-1 text-[11px] font-semibold text-zinc-400 border-b border-white/10">Item Size</div>
                {(['compact', 'normal', 'large', 'extra-large'] as const).map((density) => (
                  <button
                    key={density}
                    onClick={() => {
                      setTrackGridDensity(density);
                      setShowDensityMenu(false);
                    }}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg font-medium capitalize transition-colors text-left ${
                      trackGridDensity === density ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    <span>{density.replace('-', ' ')}</span>
                    {trackGridDensity === density && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Column Customizer Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowColumnMenu(!showColumnMenu);
                setShowDensityMenu(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium border border-white/10 transition-colors cursor-pointer"
              title="Customize Columns"
            >
              <Columns className="w-3.5 h-3.5 text-indigo-400" />
              <span>Columns</span>
            </button>

            {showColumnMenu && (
              <div
                className="absolute right-0 top-10 w-56 glass-panel border border-white/10 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 text-xs max-h-80 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-zinc-400 border-b border-white/10">
                  <span>Toggle Columns</span>
                  <button
                    onClick={() =>
                      setVisibleTrackColumns([
                        'order',
                        'art',
                        'title',
                        'artist',
                        'album',
                        'duration',
                        'favorite',
                        'playNext',
                        'addToQueue',
                        'actions',
                      ])
                    }
                    className="text-indigo-400 hover:underline text-[10px]"
                  >
                    Reset
                  </button>
                </div>
                {ALL_COLUMNS.map((col) => {
                  const active = isColVisible(col.id);
                  return (
                    <button
                      key={col.id}
                      onClick={() => toggleTrackColumn(col.id)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors text-left cursor-pointer ${
                        active ? 'bg-indigo-600/20 text-white font-medium' : 'text-zinc-400 hover:bg-white/5'
                      }`}
                    >
                      <span>{col.label}</span>
                      {active && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid Header Row */}
      <div className="flex items-center px-4 py-2 border-b border-white/10 bg-zinc-900/60 text-xs font-semibold text-zinc-400 gap-3 shrink-0 uppercase tracking-wider">
        {isColVisible('order') && <div className="w-8 shrink-0 text-center">#</div>}
        {isColVisible('art') && <div className="w-12 shrink-0">Cover</div>}
        {isColVisible('title') && (
          <div
            onClick={() => handleHeaderSort('title')}
            className="flex-1 min-w-[140px] flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors"
          >
            <span>Title</span>
            {sortField === 'title' ? (
              sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
            ) : (
              <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
            )}
          </div>
        )}
        {isColVisible('artist') && (
          <div
            onClick={() => handleHeaderSort('artist')}
            className="w-40 md:w-48 shrink-0 flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors truncate"
          >
            <span>Artist</span>
            {sortField === 'artist' ? (
              sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
            ) : (
              <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
            )}
          </div>
        )}
        {isColVisible('album') && (
          <div
            onClick={() => handleHeaderSort('album')}
            className="w-40 md:w-48 shrink-0 flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors truncate"
          >
            <span>Album</span>
            {sortField === 'album' ? (
              sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
            ) : (
              <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
            )}
          </div>
        )}
        {isColVisible('date') && (
          <div
            onClick={() => handleHeaderSort('year')}
            className="w-16 shrink-0 flex items-center gap-1 cursor-pointer hover:text-white transition-colors justify-center"
          >
            <span>Year</span>
            {sortField === 'year' ? (
              sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
            ) : (
              <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
            )}
          </div>
        )}
        {isColVisible('genre') && (
          <div
            onClick={() => handleHeaderSort('genre')}
            className="w-24 shrink-0 flex items-center gap-1 cursor-pointer hover:text-white transition-colors truncate"
          >
            <span>Genre</span>
            {sortField === 'genre' ? (
              sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
            ) : (
              <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
            )}
          </div>
        )}
        {isColVisible('duration') && (
          <div
            onClick={() => handleHeaderSort('duration')}
            className="w-16 shrink-0 flex items-center gap-1 cursor-pointer hover:text-white transition-colors justify-end pr-1"
          >
            <span>Time</span>
            {sortField === 'duration' ? (
              sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
            ) : (
              <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
            )}
          </div>
        )}
        {isColVisible('favorite') && <div className="w-9 shrink-0 text-center">Like</div>}
        {isColVisible('playNext') && <div className="w-9 shrink-0 text-center">Next</div>}
        {isColVisible('addToQueue') && <div className="w-9 shrink-0 text-center">+Queue</div>}
        {isColVisible('actions') && <div className="w-9 shrink-0 text-center">More</div>}
      </div>

      {/* Scrollable Virtualized Track Body */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto custom-scrollbar"
        onClick={() => {
          setShowColumnMenu(false);
          setShowDensityMenu(false);
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const idx = virtualRow.index;
            const track = sortedTracks[idx];
            const isSelected = currentTrack?.id === track.id;
            const isLiked = likedTrackIds.includes(track.id);

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="px-2 py-0.5"
              >
                <div
                  onClick={() => playTrack(track, sortedTracks)}
                  onContextMenu={(e) => handleRowContextMenu(e, track)}
                  className={`group flex items-center px-3 ${densityConfig.py} rounded-xl border transition-all cursor-pointer gap-3 h-full ${
                    isSelected
                      ? 'bg-indigo-600/25 border-indigo-500/40 text-white shadow-md'
                      : 'bg-zinc-900/40 hover:bg-white/10 border-white/5 text-zinc-300'
                  }`}
                >
                  {/* Order / Index Column */}
                  {isColVisible('order') && (
                    <div className="w-8 shrink-0 text-center font-mono text-xs font-semibold text-zinc-400">
                      {isSelected ? (
                        <div className="w-5 h-5 mx-auto rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
                          {isPlaying ? <Pause className="w-3 h-3 fill-white" /> : <Play className="w-3 h-3 fill-white ml-0.5" />}
                        </div>
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>
                  )}

                  {/* Album Art Cell */}
                  {isColVisible('art') && <TrackArtCell track={track} densityConfig={densityConfig} />}

                  {/* Title Cell */}
                  {isColVisible('title') && (
                    <div className="flex-1 min-w-[140px] flex flex-col justify-center truncate">
                      <span className={`font-bold ${densityConfig.textSize} truncate ${isSelected ? 'text-indigo-300' : 'text-white'}`}>
                        {track.title}
                      </span>
                      {(!isColVisible('artist') || trackGridDensity === 'extra-large') && (
                        <span className={`text-zinc-400 truncate ${densityConfig.subTextSize}`}>{track.artist}</span>
                      )}
                    </div>
                  )}

                  {/* Artist Cell */}
                  {isColVisible('artist') && (
                    <div className={`w-40 md:w-48 shrink-0 truncate font-medium ${densityConfig.subTextSize} text-zinc-300`}>
                      {track.artist}
                    </div>
                  )}

                  {/* Album Cell */}
                  {isColVisible('album') && (
                    <div className={`w-40 md:w-48 shrink-0 truncate font-normal ${densityConfig.subTextSize} text-zinc-400`}>
                      {track.album || '—'}
                    </div>
                  )}

                  {/* Year Cell */}
                  {isColVisible('date') && (
                    <div className="w-16 shrink-0 text-center font-mono text-xs text-zinc-400">
                      {track.year ? track.year : '—'}
                    </div>
                  )}

                  {/* Genre Cell */}
                  {isColVisible('genre') && (
                    <div className={`w-24 shrink-0 truncate text-xs text-zinc-400`}>{track.genre || '—'}</div>
                  )}

                  {/* Duration Cell */}
                  {isColVisible('duration') && (
                    <div className="w-16 shrink-0 text-right font-mono text-xs font-medium text-zinc-400 pr-1">
                      {formatDuration(track.duration_secs)}
                    </div>
                  )}

                  {/* Favorite Button Cell */}
                  {isColVisible('favorite') && (
                    <div className="w-9 shrink-0 flex items-center justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLikeTrack(track.id);
                        }}
                        className={`p-1.5 rounded-lg transition-all ${
                          isLiked ? 'text-pink-500 hover:scale-110' : 'text-zinc-500 hover:text-white hover:bg-white/10'
                        }`}
                        title={isLiked ? 'Unlike' : 'Like'}
                      >
                        <Heart className={`w-4 h-4 ${isLiked ? 'fill-pink-500' : ''}`} />
                      </button>
                    </div>
                  )}

                  {/* Play Next Button Cell */}
                  {isColVisible('playNext') && (
                    <div className="w-9 shrink-0 flex items-center justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playNext(track);
                        }}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-indigo-400 hover:bg-white/10 transition-colors"
                        title="Play Next (After Song)"
                      >
                        <ListPlus className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Add to Queue Button Cell */}
                  {isColVisible('addToQueue') && (
                    <div className="w-9 shrink-0 flex items-center justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToQueue(track);
                        }}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-indigo-400 hover:bg-white/10 transition-colors"
                        title="Add to Queue"
                      >
                        <PlusCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Actions 3-Dots Menu Button Cell */}
                  {isColVisible('actions') && (
                    <div className="w-9 shrink-0 flex items-center justify-center">
                      <button
                        onClick={(e) => handleRowContextMenu(e, track)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                        title="More Options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Position-Aware Right-Click Action Context Menu */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-50 pointer-events-auto"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu(null);
          }}
        >
          <div
            style={{
              top: Math.min(contextMenu.y, window.innerHeight - 240),
              left: Math.min(contextMenu.x, window.innerWidth - 220),
            }}
            className="fixed z-50 w-56 glass-panel border border-white/10 rounded-xl shadow-2xl p-1.5 flex flex-col gap-1 text-xs text-zinc-300 animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2.5 py-1 text-[11px] font-semibold text-zinc-400 border-b border-white/10 truncate">
              {contextMenu.track.title}
            </div>

            <button
              onClick={() => {
                playTrack(contextMenu.track, sortedTracks);
                setContextMenu(null);
              }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-left font-medium cursor-pointer"
            >
              <Play className="w-4 h-4 text-indigo-400" />
              <span>Play Now</span>
            </button>

            <button
              onClick={() => {
                playNext(contextMenu.track);
                setContextMenu(null);
              }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors text-left font-medium cursor-pointer"
            >
              <ListPlus className="w-4 h-4 text-indigo-400 group-hover:text-white" />
              <span>Play Next (After Song)</span>
            </button>

            <button
              onClick={() => {
                addToQueue(contextMenu.track);
                setContextMenu(null);
              }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-left font-medium cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-zinc-400" />
              <span>Add to Queue</span>
            </button>

            <button
              onClick={() => {
                toggleLikeTrack(contextMenu.track.id);
                setContextMenu(null);
              }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-left font-medium cursor-pointer"
            >
              <Heart
                className={`w-4 h-4 ${likedTrackIds.includes(contextMenu.track.id) ? 'fill-pink-500 text-pink-500' : 'text-zinc-400'}`}
              />
              <span>{likedTrackIds.includes(contextMenu.track.id) ? 'Unlike' : 'Like'}</span>
            </button>

            <button
              onClick={() => {
                setInfoModalTrack(contextMenu.track);
                setContextMenu(null);
              }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-left font-medium cursor-pointer"
            >
              <Info className="w-4 h-4 text-zinc-400" />
              <span>Song Details & Specs</span>
            </button>

            {playlistId && onRemoveFromPlaylist && (
              <button
                onClick={() => {
                  onRemoveFromPlaylist(contextMenu.track.id);
                  setContextMenu(null);
                }}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-red-600/80 hover:text-white transition-colors text-left font-medium cursor-pointer text-red-400 border-t border-white/10 mt-1 pt-2"
              >
                <span>Remove from Playlist</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
