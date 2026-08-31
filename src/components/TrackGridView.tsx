import React, { useState, useRef, useMemo, useEffect } from 'react';
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
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  Music,
  Clock,
  Check,
  RotateCcw,
} from 'lucide-react';

interface TrackGridViewProps {
  tracks: Track[];
  playlistId?: string;
  onRemoveFromPlaylist?: (trackId: string) => void;
}

type SortField = 'original' | 'title' | 'artist' | 'album' | 'year' | 'genre' | 'duration';
type SortOrder = 'asc' | 'desc';

const DEFAULT_COLUMN_WIDTHS: Record<TrackColumnId, number> = {
  order: 44,
  art: 48,
  title: 260,
  artist: 160,
  album: 160,
  date: 70,
  genre: 100,
  duration: 60,
  favorite: 26,
  playNext: 26,
  addToQueue: 26,
  actions: 26,
};

const ART_COL_WIDTHS: Record<TrackGridDensity, number> = {
  compact: 36,
  normal: 48,
  large: 64,
  'extra-large': 80,
};

const DENSITY_CONFIG: Record<
  TrackGridDensity,
  {
    rowHeight: number;
    artSize: string;
    artIconSize: string;
    textSize: string;
    subTextSize: string;
    numTextSize: string;
    playBadgeSize: string;
    playIconSize: string;
  }
> = {
  compact: {
    rowHeight: 40,
    artSize: 'w-7 h-7',
    artIconSize: 'w-3 h-3',
    textSize: 'text-xs',
    subTextSize: 'text-[10px]',
    numTextSize: 'text-xs',
    playBadgeSize: 'w-4 h-4',
    playIconSize: 'w-2.5 h-2.5',
  },
  normal: {
    rowHeight: 56,
    artSize: 'w-10 h-10',
    artIconSize: 'w-4 h-4',
    textSize: 'text-sm',
    subTextSize: 'text-xs',
    numTextSize: 'text-sm',
    playBadgeSize: 'w-5 h-5',
    playIconSize: 'w-3 h-3',
  },
  large: {
    rowHeight: 72,
    artSize: 'w-14 h-14',
    artIconSize: 'w-5 h-5',
    textSize: 'text-base',
    subTextSize: 'text-xs',
    numTextSize: 'text-base',
    playBadgeSize: 'w-7 h-7',
    playIconSize: 'w-4 h-4',
  },
  'extra-large': {
    rowHeight: 88,
    artSize: 'w-18 h-18',
    artIconSize: 'w-6 h-6',
    textSize: 'text-lg',
    subTextSize: 'text-sm',
    numTextSize: 'text-lg',
    playBadgeSize: 'w-9 h-9',
    playIconSize: 'w-5 h-5',
  },
};

const formatDuration = (secs: number) => {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const TrackArtCell: React.FC<{ track: Track; densityConfig: typeof DENSITY_CONFIG['normal'] }> = ({ track, densityConfig }) => {
  const art = useTrackArt(track);
  return (
    <div className={`${densityConfig.artSize} rounded-md overflow-hidden shrink-0 bg-zinc-800 border border-white/10 relative shadow-sm`}>
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

  const columnOrder = usePlayerStore((s) => s.columnOrder);
  const setColumnOrder = usePlayerStore((s) => s.setColumnOrder);
  const showSubArtistUnderTitle = usePlayerStore((s) => s.showSubArtistUnderTitle);
  const setShowSubArtistUnderTitle = usePlayerStore((s) => s.setShowSubArtistUnderTitle);

  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // Column width state
  const [colWidths, setColWidths] = useState<Record<TrackColumnId, number>>(DEFAULT_COLUMN_WIDTHS);
  const resizingRef = useRef<{ colId: TrackColumnId; startX: number; startWidth: number } | null>(null);

  // Drag and drop column reordering state
  const [draggedCol, setDraggedCol] = useState<TrackColumnId | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TrackColumnId | null>(null);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('original');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Position-aware context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: Track } | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);

  const densityConfig = DENSITY_CONFIG[trackGridDensity] || DENSITY_CONFIG.normal;

  // Helper for column width with auto-scaling album art
  const getColWidth = (id: TrackColumnId): number => {
    if (id === 'art') {
      return ART_COL_WIDTHS[trackGridDensity] || 48;
    }
    return colWidths[id] || DEFAULT_COLUMN_WIDTHS[id];
  };

  // Virtualizer setup
  const rowVirtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => densityConfig.rowHeight,
    overscan: 8,
  });

  // Re-measure rows whenever density setting changes
  useEffect(() => {
    rowVirtualizer.measure();
  }, [trackGridDensity, rowVirtualizer]);

  // Synchronized resizing handler
  const handleMouseDownResize = (colId: TrackColumnId, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const initialWidth = getColWidth(colId);
    resizingRef.current = {
      colId,
      startX: e.clientX,
      startWidth: initialWidth,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      const { colId: id, startX, startWidth } = resizingRef.current;
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(20, startWidth + delta);
      setColWidths((prev) => ({ ...prev, [id]: newWidth }));
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Drag and drop column reordering handlers
  const handleColDragStart = (colId: TrackColumnId, e: React.DragEvent) => {
    setDraggedCol(colId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleColDragOver = (colId: TrackColumnId, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedCol && draggedCol !== colId) {
      setDragOverCol(colId);
    }
  };

  const handleColDrop = (targetColId: TrackColumnId, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedCol && draggedCol !== targetColId) {
      const currentOrder = [...columnOrder];
      const fromIdx = currentOrder.indexOf(draggedCol);
      const toIdx = currentOrder.indexOf(targetColId);
      if (fromIdx !== -1 && toIdx !== -1) {
        currentOrder.splice(fromIdx, 1);
        currentOrder.splice(toIdx, 0, draggedCol);
        setColumnOrder(currentOrder);
      }
    }
    setDraggedCol(null);
    setDragOverCol(null);
  };

  // Sorted tracks
  const sortedTracks = useMemo(() => {
    if (sortField === 'original') return tracks;
    return [...tracks].sort((a, b) => {
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

  const isColVisible = (id: TrackColumnId) => visibleTrackColumns.includes(id);

  // Filtered & ordered columns to render
  const orderedVisibleColumns = useMemo(() => {
    return columnOrder.filter((id) => isColVisible(id));
  }, [columnOrder, visibleTrackColumns]);

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
      {/* Top Transparent Toolbar Controls */}
      <div className="flex items-center justify-end px-4 py-1.5 bg-transparent shrink-0 gap-2 z-10">
        {/* Reset Sort Button (Theme-Reactive) */}
        {sortField !== 'original' && (
          <button
            onClick={() => {
              setSortField('original');
              setSortOrder('asc');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer shadow-sm"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
              color: 'var(--color-stop-1, #6366f1)',
              borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
            }}
            title="Reset Column Sorting"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Sort</span>
          </button>
        )}

        {/* Unified Settings Button (Theme-Reactive) */}
        <div className="relative">
          <button
            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)',
              color: 'var(--color-stop-1, #6366f1)',
              borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 30%, transparent)',
            }}
            title="Grid Settings"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="text-white">Grid Settings</span>
          </button>

          {showSettingsMenu && (
            <div
              className="absolute right-0 top-10 w-64 glass-panel border border-white/10 rounded-2xl shadow-2xl p-3 z-50 flex flex-col gap-3 text-xs max-h-96 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Size Density Controls */}
              <div className="flex flex-col gap-1.5">
                <span className="text-zinc-400 font-semibold text-[11px] uppercase tracking-wider">Item Size</span>
                <div className="grid grid-cols-2 gap-1">
                  {(['compact', 'normal', 'large', 'extra-large'] as const).map((density) => (
                    <button
                      key={density}
                      onClick={() => setTrackGridDensity(density)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium capitalize transition-colors text-center cursor-pointer ${
                        trackGridDensity === density ? 'text-white shadow-md' : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                      }`}
                      style={trackGridDensity === density ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                    >
                      {density.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-artist under title toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-zinc-300 font-medium text-xs">Artist under Song Title</span>
                <input
                  type="checkbox"
                  checked={showSubArtistUnderTitle}
                  onChange={(e) => setShowSubArtistUnderTitle(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                />
              </div>

              {/* Column Visibility Toggles & Reset */}
              <div className="flex flex-col gap-1 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-zinc-400 font-semibold text-[11px] uppercase tracking-wider">Visible Columns</span>
                  <button
                    onClick={() => {
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
                      ]);
                      setColumnOrder([
                        'order',
                        'art',
                        'title',
                        'artist',
                        'album',
                        'date',
                        'genre',
                        'duration',
                        'favorite',
                        'playNext',
                        'addToQueue',
                        'actions',
                      ]);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
                      color: 'var(--color-stop-1, #6366f1)',
                      borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
                    }}
                  >
                    Reset
                  </button>
                </div>

                {[
                  { id: 'order', label: 'Order (#)' },
                  { id: 'art', label: 'Album Art' },
                  { id: 'title', label: 'Title' },
                  { id: 'artist', label: 'Artist' },
                  { id: 'album', label: 'Album' },
                  { id: 'date', label: 'Year / Date' },
                  { id: 'genre', label: 'Genre' },
                  { id: 'duration', label: 'Duration' },
                  { id: 'favorite', label: 'Favorite Button' },
                  { id: 'playNext', label: 'Play Next Button' },
                  { id: 'addToQueue', label: 'Add to Queue Button' },
                  { id: 'actions', label: 'Actions Menu' },
                ].map((col) => {
                  const active = isColVisible(col.id as TrackColumnId);
                  return (
                    <button
                      key={col.id}
                      onClick={() => toggleTrackColumn(col.id as TrackColumnId)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors text-left cursor-pointer ${
                        active ? 'bg-white/10 text-white font-medium' : 'text-zinc-400 hover:bg-white/5'
                      }`}
                    >
                      <span>{col.label}</span>
                      {active && <Check className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Spotify-Style Transparent Header Row with Header-Only Dividers */}
      <div className="flex items-center px-4 py-2 border-b border-white/10 bg-transparent text-xs font-medium text-zinc-400 shrink-0 select-none relative">
        {orderedVisibleColumns.map((colId) => {
          const width = getColWidth(colId);
          const isDragging = draggedCol === colId;
          const isDragOver = dragOverCol === colId;

          return (
            <div
              key={colId}
              draggable
              onDragStart={(e) => handleColDragStart(colId, e)}
              onDragOver={(e) => handleColDragOver(colId, e)}
              onDrop={(e) => handleColDrop(colId, e)}
              style={{
                width: `${width}px`,
                minWidth: `${width}px`,
                maxWidth: `${width}px`,
              }}
              className={`shrink-0 flex items-center relative border-r border-white/15 h-full py-0.5 transition-all ${
                isDragging ? 'opacity-40 border-dashed border-indigo-400' : ''
              } ${isDragOver ? 'bg-indigo-600/30' : ''}`}
            >
              {/* Header Content */}
              {colId === 'order' && <div className="w-full text-center">#</div>}
              {colId === 'art' && <div className="w-full" />}
              {colId === 'title' && (
                <div
                  onClick={() => handleHeaderSort('title')}
                  className="flex-1 flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors truncate px-2"
                >
                  <span>Title</span>
                  {sortField === 'title' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                </div>
              )}
              {colId === 'artist' && (
                <div
                  onClick={() => handleHeaderSort('artist')}
                  className="flex-1 flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors truncate px-2"
                >
                  <span>Artist</span>
                  {sortField === 'artist' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                </div>
              )}
              {colId === 'album' && (
                <div
                  onClick={() => handleHeaderSort('album')}
                  className="flex-1 flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors truncate px-2"
                >
                  <span>Album</span>
                  {sortField === 'album' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                </div>
              )}
              {colId === 'date' && (
                <div
                  onClick={() => handleHeaderSort('year')}
                  className="flex-1 flex items-center justify-center gap-1 cursor-pointer hover:text-white transition-colors px-1"
                >
                  <span>Year</span>
                  {sortField === 'year' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                </div>
              )}
              {colId === 'genre' && (
                <div
                  onClick={() => handleHeaderSort('genre')}
                  className="flex-1 flex items-center gap-1 cursor-pointer hover:text-white transition-colors truncate px-2"
                >
                  <span>Genre</span>
                  {sortField === 'genre' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                </div>
              )}
              {colId === 'duration' && (
                <div
                  onClick={() => handleHeaderSort('duration')}
                  className="flex-1 flex items-center justify-end gap-1 cursor-pointer hover:text-white transition-colors px-2"
                >
                  <Clock className="w-4 h-4 text-zinc-400" />
                  {sortField === 'duration' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                </div>
              )}
              {['favorite', 'playNext', 'addToQueue', 'actions'].includes(colId) && <div className="w-full" />}

              {/* Draggable Column Resizer Handle */}
              <div
                onMouseDown={(e) => handleMouseDownResize(colId, e)}
                className="absolute -right-1 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-indigo-500/50 flex justify-center items-center opacity-40 hover:opacity-100 transition-opacity z-20"
                title="Drag to resize column width"
              >
                <div className="w-0.5 h-full bg-white/20" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Spotify-Style Virtualized Table Body (No Body Column/Row Lines) */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto custom-scrollbar"
        onClick={() => setShowSettingsMenu(false)}
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
              >
                <div
                  onClick={() => playTrack(track, sortedTracks)}
                  onContextMenu={(e) => handleRowContextMenu(e, track)}
                  className={`group flex items-center px-4 transition-colors cursor-pointer h-full ${
                    isSelected ? 'text-white' : 'text-zinc-300 hover:bg-white/5'
                  }`}
                  style={
                    isSelected
                      ? {
                          backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 18%, transparent)',
                        }
                      : undefined
                  }
                >
                  {orderedVisibleColumns.map((colId) => {
                    const width = getColWidth(colId);

                    return (
                      <div
                        key={colId}
                        style={{
                          width: `${width}px`,
                          minWidth: `${width}px`,
                          maxWidth: `${width}px`,
                        }}
                        className="shrink-0 flex items-center h-full overflow-hidden"
                      >
                        {colId === 'order' && (
                          <div className={`w-full text-center font-mono font-medium ${densityConfig.numTextSize} text-zinc-400 flex items-center justify-center`}>
                            {isSelected ? (
                              <div
                                className={`${densityConfig.playBadgeSize} mx-auto rounded-full flex items-center justify-center shadow-md`}
                                style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
                              >
                                {isPlaying ? (
                                  <Pause className={`${densityConfig.playIconSize} fill-white text-white`} />
                                ) : (
                                  <Play className={`${densityConfig.playIconSize} fill-white text-white ml-0.5`} />
                                )}
                              </div>
                            ) : (
                              <span>{idx + 1}</span>
                            )}
                          </div>
                        )}

                        {colId === 'art' && (
                          <div className="w-full flex items-center justify-center">
                            <TrackArtCell track={track} densityConfig={densityConfig} />
                          </div>
                        )}

                        {colId === 'title' && (
                          <div className="flex-1 flex flex-col justify-center truncate px-2 min-w-0">
                            <span
                              className={`font-semibold ${densityConfig.textSize} truncate`}
                              style={isSelected ? { color: 'var(--color-stop-1, #6366f1)' } : undefined}
                            >
                              {track.title}
                            </span>
                            {showSubArtistUnderTitle && (
                              <span className={`text-zinc-400 truncate ${densityConfig.subTextSize}`}>{track.artist}</span>
                            )}
                          </div>
                        )}

                        {colId === 'artist' && (
                          <div className={`w-full truncate font-normal ${densityConfig.subTextSize} text-zinc-300 px-2`}>
                            {track.artist}
                          </div>
                        )}

                        {colId === 'album' && (
                          <div className={`w-full truncate font-normal ${densityConfig.subTextSize} text-zinc-400 px-2`}>
                            {track.album || '—'}
                          </div>
                        )}

                        {colId === 'date' && (
                          <div className="w-full text-center font-mono text-xs text-zinc-400 px-1">
                            {track.year ? track.year : '—'}
                          </div>
                        )}

                        {colId === 'genre' && (
                          <div className="w-full truncate text-xs text-zinc-400 px-2">
                            {track.genre || '—'}
                          </div>
                        )}

                        {colId === 'duration' && (
                          <div className="w-full text-right font-mono text-xs text-zinc-400 px-2">
                            {formatDuration(track.duration_secs)}
                          </div>
                        )}

                        {colId === 'favorite' && (
                          <div className="w-full flex items-center justify-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLikeTrack(track.id);
                              }}
                              className={`p-0 rounded transition-all ${
                                isLiked ? 'text-pink-500 hover:scale-110' : 'text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-white'
                              }`}
                              title={isLiked ? 'Unlike' : 'Like'}
                            >
                              <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-pink-500' : ''}`} />
                            </button>
                          </div>
                        )}

                        {colId === 'playNext' && (
                          <div className="w-full flex items-center justify-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                playNext(track);
                              }}
                              className="p-0 rounded text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-white transition-all"
                              title="Play Next (After Song)"
                            >
                              <ListPlus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {colId === 'addToQueue' && (
                          <div className="w-full flex items-center justify-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addToQueue(track);
                              }}
                              className="p-0 rounded text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-white transition-all"
                              title="Add to Queue"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {colId === 'actions' && (
                          <div className="w-full flex items-center justify-center">
                            <button
                              onClick={(e) => handleRowContextMenu(e, track)}
                              className="p-0 rounded text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-white transition-all"
                              title="More Options"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
