import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  ColumnDef,
  VisibilityState,
  ColumnSizingState,
  SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { usePlayerStore, TrackColumnId, TrackGridDensity } from '../store/usePlayerStore';
import { Track } from '../types/player';
import { Clock } from 'lucide-react';

export type { TrackColumnId, TrackGridDensity };

const COLUMN_SIZING_STORAGE_KEY = 'prism_track_table_column_sizing_v1';

export const ALL_COLUMN_IDS: TrackColumnId[] = [
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
];

export const LOCKED_COLUMN_IDS: TrackColumnId[] = ['order', 'art'];

export const DEFAULT_VISIBLE_COLUMNS: TrackColumnId[] = [
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
];

export const COLUMN_LABELS: Record<TrackColumnId, string> = {
  order: '#',
  art: 'Album Art',
  title: 'Title',
  artist: 'Artist',
  album: 'Album',
  date: 'Year / Date',
  genre: 'Genre',
  duration: 'Duration',
  favorite: 'Favorite',
  playNext: 'Play Next',
  addToQueue: 'Add to Queue',
  actions: 'Actions',
};

export const MIN_COLUMN_WIDTHS: Partial<Record<TrackColumnId, number>> = {
  order: 40,
  art: 40,
  title: 180,
  artist: 120,
  album: 120,
  date: 60,
  genre: 80,
  duration: 60,
  favorite: 36,
  playNext: 36,
  addToQueue: 36,
  actions: 36,
};

export const DENSITY_ROW_HEIGHTS: Record<TrackGridDensity, number> = {
  compact: 36,
  normal: 56,
  large: 68,
  'extra-large': 80,
  huge: 96,
  massive: 120,
};

export interface UseTrackTableStateOptions {
  tracks: Track[];
  parentRef: React.RefObject<HTMLDivElement | null>;
}

export function useTrackTableState({ tracks, parentRef }: UseTrackTableStateOptions) {
  // Global store states
  const visibleTrackColumns = usePlayerStore((s) => s.visibleTrackColumns);
  const setVisibleTrackColumns = usePlayerStore((s) => s.setVisibleTrackColumns);
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  const setTrackGridDensity = usePlayerStore((s) => s.setTrackGridDensity);
  const columnOrder = usePlayerStore((s) => s.columnOrder);
  const setColumnOrder = usePlayerStore((s) => s.setColumnOrder);
  const showSubArtistUnderTitle = usePlayerStore((s) => s.showSubArtistUnderTitle);
  const setShowSubArtistUnderTitle = usePlayerStore((s) => s.setShowSubArtistUnderTitle);

  // Table local states
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    try {
      const saved = localStorage.getItem(COLUMN_SIZING_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore fallback
    }
    return {};
  });

  // Persist column sizing to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(COLUMN_SIZING_STORAGE_KEY, JSON.stringify(columnSizing));
    } catch {
      // Ignore storage errors
    }
  }, [columnSizing]);

  // Derived column visibility map for TanStack Table
  const columnVisibility = useMemo<VisibilityState>(() => {
    const vis: VisibilityState = {};
    ALL_COLUMN_IDS.forEach((id) => {
      vis[id] = visibleTrackColumns.includes(id);
    });
    return vis;
  }, [visibleTrackColumns]);

  // Columns definition (minimal layout data; cells rendered in component)
  const columns = useMemo<ColumnDef<Track>[]>(
    () => [
      {
        id: 'order',
        accessorFn: (_row, idx) => (idx !== undefined ? idx + 1 : 1),
        header: '#',
        size: columnSizing['order'] ?? 44,
        minSize: MIN_COLUMN_WIDTHS.order,
        enableResizing: false,
      },
      {
        id: 'art',
        accessorKey: 'embedded_art_base64',
        header: '',
        size: columnSizing['art'] ?? 48,
        minSize: MIN_COLUMN_WIDTHS.art,
        enableResizing: false,
      },
      {
        id: 'title',
        accessorKey: 'title',
        header: 'Title',
        size: columnSizing['title'] ?? 240,
        minSize: MIN_COLUMN_WIDTHS.title,
        enableResizing: true,
      },
      {
        id: 'artist',
        accessorKey: 'artist',
        header: 'Artist',
        size: columnSizing['artist'] ?? 160,
        minSize: MIN_COLUMN_WIDTHS.artist,
        enableResizing: true,
      },
      {
        id: 'album',
        accessorKey: 'album',
        header: 'Album',
        size: columnSizing['album'] ?? 160,
        minSize: MIN_COLUMN_WIDTHS.album,
        enableResizing: true,
      },
      {
        id: 'date',
        accessorKey: 'year',
        header: 'Date',
        size: columnSizing['date'] ?? 80,
        minSize: MIN_COLUMN_WIDTHS.date,
        enableResizing: true,
      },
      {
        id: 'genre',
        accessorKey: 'genre',
        header: 'Genre',
        size: columnSizing['genre'] ?? 110,
        minSize: MIN_COLUMN_WIDTHS.genre,
        enableResizing: true,
      },
      {
        id: 'duration',
        accessorKey: 'duration_secs',
        header: () => React.createElement(Clock, { className: 'w-4 h-4 text-zinc-400' }),
        size: columnSizing['duration'] ?? 64,
        minSize: MIN_COLUMN_WIDTHS.duration,
        enableResizing: true,
      },
      {
        id: 'favorite',
        header: '',
        size: columnSizing['favorite'] ?? 36,
        minSize: MIN_COLUMN_WIDTHS.favorite,
        enableResizing: false,
      },
      {
        id: 'playNext',
        header: '',
        size: columnSizing['playNext'] ?? 36,
        minSize: MIN_COLUMN_WIDTHS.playNext,
        enableResizing: false,
      },
      {
        id: 'addToQueue',
        header: '',
        size: columnSizing['addToQueue'] ?? 36,
        minSize: MIN_COLUMN_WIDTHS.addToQueue,
        enableResizing: false,
      },
      {
        id: 'actions',
        header: '',
        size: columnSizing['actions'] ?? 36,
        minSize: MIN_COLUMN_WIDTHS.actions,
        enableResizing: false,
      },
    ],
    [columnSizing]
  );

  // TanStack Table Instance
  const table = useReactTable({
    data: tracks,
    columns,
    state: {
      columnVisibility,
      columnOrder,
      columnSizing,
      sorting,
    },
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    onColumnOrderChange: (updater) => {
      const nextOrder = typeof updater === 'function' ? updater(columnOrder) : updater;
      setColumnOrder(nextOrder as TrackColumnId[]);
    },
    onColumnVisibilityChange: (updater) => {
      const nextVis = typeof updater === 'function' ? updater(columnVisibility) : updater;
      const visibleCols = Object.keys(nextVis).filter((k) => nextVis[k]) as TrackColumnId[];
      setVisibleTrackColumns(visibleCols);
    },
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    enableSorting: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();
  const rowHeight = DENSITY_ROW_HEIGHTS[trackGridDensity] || 56;

  // TanStack Row Virtualizer
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => rowHeight, [rowHeight]),
    overscan: 10,
  });

  // Remeasure virtualization whenever density or tracks count changes
  useEffect(() => {
    rowVirtualizer.measure();
  }, [trackGridDensity, tracks.length, rowVirtualizer]);

  // Handle Drag and Drop Column Reordering via dnd-kit
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = active.id as TrackColumnId;
      const overId = over.id as TrackColumnId;

      // Do not allow moving locked columns or placing columns over locked positions
      if (LOCKED_COLUMN_IDS.includes(activeId) || LOCKED_COLUMN_IDS.includes(overId)) {
        return;
      }

      const oldIdx = columnOrder.indexOf(activeId);
      const newIdx = columnOrder.indexOf(overId);
      if (oldIdx !== -1 && newIdx !== -1) {
        const nextOrder = arrayMove(columnOrder, oldIdx, newIdx);
        setColumnOrder(nextOrder);
      }
    },
    [columnOrder, setColumnOrder]
  );

  // Reset entire grid to factory defaults
  const resetGrid = useCallback(() => {
    setColumnSizing({});
    localStorage.removeItem(COLUMN_SIZING_STORAGE_KEY);
    setTrackGridDensity('normal');
    setShowSubArtistUnderTitle(true);
    setVisibleTrackColumns(DEFAULT_VISIBLE_COLUMNS);
    setColumnOrder(ALL_COLUMN_IDS);
    setSorting([]);
  }, [setTrackGridDensity, setShowSubArtistUnderTitle, setVisibleTrackColumns, setColumnOrder]);

  // Build high-performance CSS Grid Template Columns string
  const gridTemplateColumns = useMemo(() => {
    const leafCols = table.getVisibleLeafColumns();
    return leafCols
      .map((col) => {
        const id = col.id as TrackColumnId;
        const minW = MIN_COLUMN_WIDTHS[id] ?? 40;

        // Fixed narrow columns
        if (id === 'order') return `${Math.max(minW, col.getSize())}px`;
        if (id === 'art') {
          const artSizeMap: Record<TrackGridDensity, number> = {
            compact: 32,
            normal: 48,
            large: 60,
            'extra-large': 72,
            huge: 88,
            massive: 108,
          };
          return `${artSizeMap[trackGridDensity]}px`;
        }
        if (['favorite', 'playNext', 'addToQueue', 'actions'].includes(id)) {
          return `${col.getSize()}px`;
        }
        if (id === 'duration') return `${Math.max(minW, col.getSize())}px`;

        // If explicitly resized by user, lock to exact pixel width
        if (columnSizing[id] !== undefined) {
          return `${Math.max(minW, columnSizing[id])}px`;
        }

        // Default flexible responsive scaling using fr units
        if (id === 'title') return `minmax(${minW}px, 4fr)`;
        if (id === 'artist') return `minmax(${minW}px, 3fr)`;
        if (id === 'album') return `minmax(${minW}px, 3fr)`;
        if (id === 'date') return `minmax(${minW}px, 1.2fr)`;
        if (id === 'genre') return `minmax(${minW}px, 2fr)`;

        return `minmax(${minW}px, 1fr)`;
      })
      .join(' ');
  }, [table.getVisibleLeafColumns(), columnSizing, trackGridDensity]);

  return {
    table,
    rows,
    rowVirtualizer,
    rowHeight,
    gridTemplateColumns,
    columnOrder,
    visibleTrackColumns,
    trackGridDensity,
    showSubArtistUnderTitle,
    handleDragEnd,
    resetGrid,
    setTrackGridDensity,
    setShowSubArtistUnderTitle,
    setVisibleTrackColumns,
  };
}
