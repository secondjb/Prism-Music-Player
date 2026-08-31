import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  ColumnDef,
  VisibilityState,
  ColumnSizingState,
  flexRender,
  Column,
} from '@tanstack/react-table';
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
  Music,
  Clock,
  Check,
  RefreshCw,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface TrackGridViewProps {
  tracks: Track[];
  playlistId?: string;
  onRemoveFromPlaylist?: (trackId: string) => void;
}

const ALL_COLUMN_IDS: TrackColumnId[] = [
  'order', 'art', 'title', 'artist', 'album', 'date', 'genre', 'duration',
  'favorite', 'playNext', 'addToQueue', 'actions',
];

const DEFAULT_VISIBLE: TrackColumnId[] = [
  'order', 'art', 'title', 'artist', 'album', 'duration',
  'favorite', 'playNext', 'addToQueue', 'actions',
];

const COLUMN_LABELS: Record<TrackColumnId, string> = {
  order: 'Order (#)', art: 'Album Art', title: 'Title', artist: 'Artist',
  album: 'Album', date: 'Year / Date', genre: 'Genre', duration: 'Duration',
  favorite: 'Favorite', playNext: 'Play Next', addToQueue: 'Add to Queue', actions: 'Actions',
};

const ART_COL_WIDTHS: Record<TrackGridDensity, number> = {
  compact: 36, normal: 48, large: 64, 'extra-large': 80, huge: 96, massive: 120,
};

const DENSITY_CONFIG = {
  compact: {
    rowHeight: 40, artSize: 'w-7 h-7', artIconSize: 'w-3 h-3',
    textSize: 'text-xs', subTextSize: 'text-[10px]',
    numTextSize: 'text-xs', playBadgeSize: 'w-4 h-4', playIconSize: 'w-2.5 h-2.5',
  },
  normal: {
    rowHeight: 56, artSize: 'w-10 h-10', artIconSize: 'w-4 h-4',
    textSize: 'text-sm', subTextSize: 'text-xs',
    numTextSize: 'text-sm', playBadgeSize: 'w-5 h-5', playIconSize: 'w-3 h-3',
  },
  large: {
    rowHeight: 72, artSize: 'w-14 h-14', artIconSize: 'w-5 h-5',
    textSize: 'text-base', subTextSize: 'text-xs',
    numTextSize: 'text-base', playBadgeSize: 'w-7 h-7', playIconSize: 'w-4 h-4',
  },
  'extra-large': {
    rowHeight: 88, artSize: 'w-18 h-18', artIconSize: 'w-6 h-6',
    textSize: 'text-lg', subTextSize: 'text-sm',
    numTextSize: 'text-lg', playBadgeSize: 'w-9 h-9', playIconSize: 'w-5 h-5',
  },
  huge: {
    rowHeight: 96, artSize: 'w-20 h-20', artIconSize: 'w-7 h-7',
    textSize: 'text-xl', subTextSize: 'text-base',
    numTextSize: 'text-xl', playBadgeSize: 'w-10 h-10', playIconSize: 'w-6 h-6',
  },
  massive: {
    rowHeight: 120, artSize: 'w-24 h-24', artIconSize: 'w-8 h-8',
    textSize: 'text-2xl', subTextSize: 'text-lg',
    numTextSize: 'text-2xl', playBadgeSize: 'w-12 h-12', playIconSize: 'w-7 h-7',
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
    <div className={`${densityConfig.artSize} rounded-md overflow-hidden shrink-0 bg-zinc-800 border border-white/10 shadow-sm`}>
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
  const setVisibleTrackColumns = usePlayerStore((s) => s.setVisibleTrackColumns);
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  const setTrackGridDensity = usePlayerStore((s) => s.setTrackGridDensity);
  const columnOrder = usePlayerStore((s) => s.columnOrder);
  const setColumnOrder = usePlayerStore((s) => s.setColumnOrder);
  const showSubArtistUnderTitle = usePlayerStore((s) => s.showSubArtistUnderTitle);
  const setShowSubArtistUnderTitle = usePlayerStore((s) => s.setShowSubArtistUnderTitle);

  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: Track } | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const densityConfig = DENSITY_CONFIG[trackGridDensity] || DENSITY_CONFIG.normal;

  // Click-outside handler to close settings menu
  useEffect(() => {
    if (!showSettingsMenu) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettingsMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSettingsMenu]);

  const columnVisibility = useMemo<VisibilityState>(() => {
    const vis: VisibilityState = {};
    ALL_COLUMN_IDS.forEach((id) => { vis[id] = visibleTrackColumns.includes(id); });
    return vis;
  }, [visibleTrackColumns]);

  const handleRowContextMenu = useCallback((e: React.MouseEvent, track: Track) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, track });
  }, []);

  // TanStack Table Column Definitions — custom cells via flexRender
  const columns = useMemo<ColumnDef<Track>[]>(() => [
    {
      id: 'order',
      accessorFn: (_row, idx) => (idx !== undefined ? idx + 1 : 1),
      header: '#',
      size: 44, minSize: 36, maxSize: 60,
      enableResizing: false,
      cell: (info) => {
        const track = info.row.original;
        const selected = currentTrack?.id === track.id;
        return (
          <div className={`w-full text-center font-mono font-medium ${densityConfig.numTextSize} text-zinc-400 flex items-center justify-center`}>
            {selected ? (
              <div className={`${densityConfig.playBadgeSize} rounded-full flex items-center justify-center shadow-md`}
                style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}>
                {isPlaying
                  ? <Pause className={`${densityConfig.playIconSize} fill-white text-white`} />
                  : <Play className={`${densityConfig.playIconSize} fill-white text-white ml-0.5`} />}
              </div>
            ) : <span>{info.row.index + 1}</span>}
          </div>
        );
      },
    },
    {
      id: 'art', accessorKey: 'album_art', header: '',
      size: ART_COL_WIDTHS[trackGridDensity] || 48, minSize: 36, maxSize: 96,
      enableResizing: false,
      cell: (info) => (
        <div className="w-full flex items-center justify-center">
          <TrackArtCell track={info.row.original} densityConfig={densityConfig} />
        </div>
      ),
    },
    {
      id: 'title', accessorKey: 'title', header: 'Title',
      size: 260, minSize: 120,
      cell: (info) => {
        const track = info.row.original;
        const selected = currentTrack?.id === track.id;
        return (
          <div className="flex flex-col justify-center truncate px-2 min-w-0">
            <span className={`font-semibold ${densityConfig.textSize} truncate`}
              style={selected ? { color: 'var(--color-stop-1, #6366f1)' } : undefined}>
              {track.title}
            </span>
            {showSubArtistUnderTitle && (
              <span className={`text-zinc-400 truncate ${densityConfig.subTextSize}`}>{track.artist}</span>
            )}
          </div>
        );
      },
    },
    {
      id: 'artist', accessorKey: 'artist', header: 'Artist',
      size: 160, minSize: 90,
      cell: (info) => (
        <div className={`truncate font-normal ${densityConfig.subTextSize} text-zinc-300 px-2`}>{info.getValue<string>()}</div>
      ),
    },
    {
      id: 'album', accessorKey: 'album', header: 'Album',
      size: 160, minSize: 90,
      cell: (info) => (
        <div className={`truncate font-normal ${densityConfig.subTextSize} text-zinc-400 px-2`}>{info.getValue<string>() || '—'}</div>
      ),
    },
    {
      id: 'date', accessorKey: 'year', header: 'Year',
      size: 70, minSize: 50, maxSize: 100,
      cell: (info) => (
        <div className="text-center font-mono text-xs text-zinc-400 px-1">{info.getValue<number>() || '—'}</div>
      ),
    },
    {
      id: 'genre', accessorKey: 'genre', header: 'Genre',
      size: 100, minSize: 70,
      cell: (info) => (
        <div className="truncate text-xs text-zinc-400 px-2">{info.getValue<string>() || '—'}</div>
      ),
    },
    {
      id: 'duration', accessorKey: 'duration_secs',
      header: () => <Clock className="w-4 h-4 text-zinc-400" />,
      size: 60, minSize: 50, maxSize: 90,
      cell: (info) => (
        <div className="text-right font-mono text-xs text-zinc-400 px-2 w-full">{formatDuration(info.getValue<number>())}</div>
      ),
    },
    {
      id: 'favorite', header: '', size: 32, minSize: 28, maxSize: 40,
      enableResizing: false,
      cell: (info) => {
        const track = info.row.original;
        const liked = likedTrackIds.includes(track.id);
        return (
          <div className="w-full flex items-center justify-center">
            <button onClick={(e) => { e.stopPropagation(); toggleLikeTrack(track.id); }}
              className={`p-0 rounded transition-all ${liked ? 'text-pink-500 hover:scale-110' : 'text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-white'}`}
              title={liked ? 'Unlike' : 'Like'}>
              <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-pink-500' : ''}`} />
            </button>
          </div>
        );
      },
    },
    {
      id: 'playNext', header: '', size: 32, minSize: 28, maxSize: 40,
      enableResizing: false,
      cell: (info) => (
        <div className="w-full flex items-center justify-center">
          <button onClick={(e) => { e.stopPropagation(); playNext(info.row.original); }}
            className="p-0 rounded text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-white transition-all" title="Play Next">
            <ListPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
    {
      id: 'addToQueue', header: '', size: 32, minSize: 28, maxSize: 40,
      enableResizing: false,
      cell: (info) => (
        <div className="w-full flex items-center justify-center">
          <button onClick={(e) => { e.stopPropagation(); addToQueue(info.row.original); }}
            className="p-0 rounded text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-white transition-all" title="Add to Queue">
            <PlusCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
    {
      id: 'actions', header: '', size: 32, minSize: 28, maxSize: 40,
      enableResizing: false,
      cell: (info) => (
        <div className="w-full flex items-center justify-center">
          <button onClick={(e) => handleRowContextMenu(e, info.row.original)}
            className="p-0 rounded text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-white transition-all" title="More Options">
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ], [trackGridDensity, currentTrack?.id, isPlaying, showSubArtistUnderTitle, likedTrackIds, handleRowContextMenu]);

  const table = useReactTable({
    data: tracks,
    columns,
    state: { columnVisibility, columnOrder, columnSizing },
    onColumnSizingChange: setColumnSizing,
    onColumnOrderChange: (updater) => {
      const v = typeof updater === 'function' ? updater(columnOrder) : updater;
      setColumnOrder(v as any);
    },
    onColumnVisibilityChange: (updater) => {
      const v = typeof updater === 'function' ? updater(columnVisibility) : updater;
      setVisibleTrackColumns(Object.keys(v).filter((k) => v[k]) as any);
    },
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    enableSorting: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => densityConfig.rowHeight,
    overscan: 8,
  });

  useEffect(() => { rowVirtualizer.measure(); }, [trackGridDensity, rowVirtualizer]);

  // Compute total table width from TanStack Table for the <table> layout
  const tableWidth = table.getCenterTotalSize();

  const handleResetEntireGrid = useCallback(() => {
    setColumnSizing({});
    setTrackGridDensity('normal');
    setShowSubArtistUnderTitle(true);
    setVisibleTrackColumns(DEFAULT_VISIBLE);
    setColumnOrder(ALL_COLUMN_IDS);
  }, []);

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
    <div className="w-full flex-1 flex flex-col overflow-hidden relative select-none">
      {/* Top Toolbar */}
      <div className="flex items-center justify-end px-4 py-1.5 bg-transparent shrink-0 gap-2 z-20 w-full">
        {/* Grid Settings (with click-outside handling) */}
        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => setShowSettingsMenu((p) => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)',
              color: 'var(--color-stop-1, #6366f1)',
              borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 30%, transparent)',
            }}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="text-white">Grid Settings</span>
          </button>

          {showSettingsMenu && (
            <div className="absolute right-0 top-10 w-64 glass-panel border border-white/10 rounded-2xl shadow-2xl p-3 z-50 flex flex-col gap-3 text-xs max-h-[28rem] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
              {/* Reset Entire Grid */}
              <button onClick={handleResetEntireGrid}
                className="w-full py-2 px-3 rounded-xl font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer shadow-md"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)',
                  color: 'var(--color-stop-1, #6366f1)',
                  borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 50%, transparent)',
                }}>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Grid Entirely</span>
              </button>

              {/* Item Size */}
              <div className="flex flex-col gap-1.5 pt-1 border-t border-white/10">
                <span className="text-zinc-400 font-semibold text-[11px] uppercase tracking-wider">Item Size</span>
                <div className="grid grid-cols-2 gap-1">
                  {(['compact', 'normal', 'large', 'extra-large'] as const).map((d) => (
                    <button key={d} onClick={() => setTrackGridDensity(d)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium capitalize transition-colors text-center cursor-pointer ${
                        trackGridDensity === d ? 'text-white shadow-md' : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                      }`}
                      style={trackGridDensity === d ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}>
                      {d.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-artist toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-zinc-300 font-medium text-xs">Artist under Song Title</span>
                <input type="checkbox" checked={showSubArtistUnderTitle}
                  onChange={(e) => setShowSubArtistUnderTitle(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer" />
              </div>

              {/* Column Visibility */}
              <div className="flex flex-col gap-1 pt-2 border-t border-white/10">
                <span className="text-zinc-400 font-semibold text-[11px] uppercase tracking-wider pb-1">Visible Columns</span>
                {table.getAllLeafColumns().map((col: Column<Track, unknown>) => {
                  const colId = col.id as TrackColumnId;
                  const vis = col.getIsVisible();
                  return (
                    <button key={col.id} onClick={col.getToggleVisibilityHandler()}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors text-left cursor-pointer ${
                        vis ? 'bg-white/10 text-white font-medium' : 'text-zinc-400 hover:bg-white/5'
                      }`}>
                      <span>{COLUMN_LABELS[colId] || col.id}</span>
                      {vis && <Check className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Proper HTML <table> so TanStack Table resizing works natively */}
      <div className="flex-1 overflow-hidden flex flex-col w-full">
        {/* Fixed Header */}
        <div className="shrink-0 overflow-hidden w-full">
          <table style={{ width: tableWidth, tableLayout: 'fixed' }} className="border-collapse">
            <colgroup>
              {table.getVisibleLeafColumns().map((col) => (
                <col key={col.id} style={{ width: col.getSize() }} />
              ))}
            </colgroup>
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-white/10">
                  {hg.headers.map((header) => {
                    const colId = header.id as TrackColumnId;
                    const sorted = header.column.getIsSorted();
                    const canSort = ['title', 'artist', 'album', 'date', 'genre', 'duration'].includes(colId);
                    return (
                      <th key={header.id}
                        style={{ width: header.getSize(), position: 'relative' }}
                        className="bg-transparent text-xs font-medium text-zinc-400 text-left px-1 py-2 select-none border-r border-white/15 last:border-r-0"
                      >
                        <div className={`flex items-center gap-1 truncate ${canSort ? 'cursor-pointer hover:text-white' : ''}`}
                          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' && <ChevronUp className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                          {sorted === 'desc' && <ChevronDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                        </div>

                        {/* TanStack native resize handle */}
                        {header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 group/resizer
                              ${header.column.getIsResizing() ? 'bg-indigo-500/70' : 'hover:bg-indigo-500/40'}`}
                          >
                            <div className="w-px h-full bg-white/20 mx-auto" />
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
          </table>
        </div>

        {/* Virtualized scrollable body */}
        <div ref={parentRef} className="flex-1 overflow-y-auto custom-scrollbar w-full">
          <div style={{ height: rowVirtualizer.getTotalSize(), width: tableWidth, position: 'relative' }}>
            <table style={{ width: tableWidth, tableLayout: 'fixed', position: 'absolute', top: 0, left: 0 }}
              className="border-collapse">
              <colgroup>
                {table.getVisibleLeafColumns().map((col) => (
                  <col key={col.id} style={{ width: col.getSize() }} />
                ))}
              </colgroup>
              <tbody>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  if (!row) return null;
                  const track = row.original;
                  const isSelected = currentTrack?.id === track.id;

                  return (
                    <tr key={row.id}
                      style={{
                        height: virtualRow.size,
                        transform: `translateY(${virtualRow.start}px)`,
                        position: 'absolute',
                        top: 0, left: 0, width: '100%',
                        display: 'table',
                        tableLayout: 'fixed',
                      }}
                      onClick={() => playTrack(track, tracks)}
                      onContextMenu={(e) => handleRowContextMenu(e, track)}
                      className={`group cursor-pointer transition-colors ${
                        isSelected ? 'text-white' : 'text-zinc-300 hover:bg-white/5'
                      }`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}
                          style={{
                            width: cell.column.getSize(),
                            height: virtualRow.size,
                            overflow: 'hidden',
                            ...(isSelected ? { backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 18%, transparent)' } : {}),
                          }}
                          className="px-0 py-0 align-middle"
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}>
          <div
            style={{
              top: Math.min(contextMenu.y, window.innerHeight - 260),
              left: Math.min(contextMenu.x, window.innerWidth - 220),
            }}
            className="fixed z-50 w-56 glass-panel border border-white/10 rounded-xl shadow-2xl p-1.5 flex flex-col gap-1 text-xs text-zinc-300 animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2.5 py-1 text-[11px] font-semibold text-zinc-400 border-b border-white/10 truncate">
              {contextMenu.track.title}
            </div>
            <button onClick={() => { playTrack(contextMenu.track, tracks); setContextMenu(null); }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-left font-medium cursor-pointer">
              <Play className="w-4 h-4 text-indigo-400" /><span>Play Now</span>
            </button>
            <button onClick={() => { playNext(contextMenu.track); setContextMenu(null); }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors text-left font-medium cursor-pointer">
              <ListPlus className="w-4 h-4 text-indigo-400" /><span>Play Next</span>
            </button>
            <button onClick={() => { addToQueue(contextMenu.track); setContextMenu(null); }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-left font-medium cursor-pointer">
              <PlusCircle className="w-4 h-4 text-zinc-400" /><span>Add to Queue</span>
            </button>
            <button onClick={() => { toggleLikeTrack(contextMenu.track.id); setContextMenu(null); }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-left font-medium cursor-pointer">
              <Heart className={`w-4 h-4 ${likedTrackIds.includes(contextMenu.track.id) ? 'fill-pink-500 text-pink-500' : 'text-zinc-400'}`} />
              <span>{likedTrackIds.includes(contextMenu.track.id) ? 'Unlike' : 'Like'}</span>
            </button>
            <button onClick={() => { setInfoModalTrack(contextMenu.track); setContextMenu(null); }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-left font-medium cursor-pointer">
              <Info className="w-4 h-4 text-zinc-400" /><span>Song Details & Specs</span>
            </button>
            {playlistId && onRemoveFromPlaylist && (
              <button onClick={() => { onRemoveFromPlaylist(contextMenu.track.id); setContextMenu(null); }}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-red-600/80 hover:text-white transition-colors text-left font-medium cursor-pointer text-red-400 border-t border-white/10 mt-1 pt-2">
                <span>Remove from Playlist</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
