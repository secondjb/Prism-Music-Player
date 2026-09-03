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
  order: 36,
  art: 36,
  title: 60,
  artist: 50,
  album: 50,
  date: 50,
  genre: 60,
  duration: 48,
  favorite: 30,
  playNext: 30,
  addToQueue: 30,
  actions: 36,
};

export type Breakpoint = 'sm' | 'md' | 'lg';

export function getBreakpoint(width: number): Breakpoint {
  if (width < 768) return 'sm';
  if (width < 1024) return 'md';
  return 'lg';
}

export const BREAKPOINT_COLUMNS: Record<Breakpoint, TrackColumnId[]> = {
  sm: ['order', 'art', 'title', 'actions'],
  md: ['order', 'art', 'title', 'artist', 'duration', 'favorite', 'playNext', 'addToQueue', 'actions'],
  lg: ALL_COLUMN_IDS,
};

export function getColumnFlexStyle({
  colId,
  size,
  isResized,
  isArtistVisible,
  isAlbumVisible,
}: {
  colId: string;
  size: number;
  isResized: boolean;
  breakpoint: Breakpoint;
  isArtistVisible: boolean;
  isAlbumVisible: boolean;
}): React.CSSProperties {
  // If explicitly resized by the user, lock strictly to pixel width
  if (isResized) {
    return {
      width: `${size}px`,
      flex: `0 0 ${size}px`,
      minWidth: 0,
      maxWidth: '100%',
      boxSizing: 'border-box',
    };
  }

  // Fluid fr units: title, artist, album
  if (colId === 'title') {
    const fr = isArtistVisible ? (isAlbumVisible ? 4 : 3) : 1;
    return {
      flex: `${fr} 1 0px`,
      minWidth: 0,
      boxSizing: 'border-box',
    };
  }

  if (colId === 'artist') {
    return {
      flex: '2 1 0px',
      minWidth: 0,
      boxSizing: 'border-box',
    };
  }

  if (colId === 'album') {
    return {
      flex: '2 1 0px',
      minWidth: 0,
      boxSizing: 'border-box',
    };
  }

  if (colId === 'spacer') {
    return {
      flex: '0 0 0px',
      minWidth: 0,
      boxSizing: 'border-box',
    };
  }

  // Fixed narrow columns
  return {
    width: `${size}px`,
    flex: `0 0 ${size}px`,
    minWidth: 0,
    boxSizing: 'border-box',
  };
}

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

  // Window resize listener
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );
  const [containerWidth, setContainerWidth] = useState(1200);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Parent container resize observer
  useEffect(() => {
    if (!parentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width);
      }
    });
    observer.observe(parentRef.current);
    return () => observer.disconnect();
  }, [parentRef]);

  const effectiveWidth = containerWidth > 0 ? containerWidth : windowWidth;
  const breakpoint = useMemo<Breakpoint>(() => getBreakpoint(effectiveWidth), [effectiveWidth]);

  // Derived column visibility map for TanStack Table
  const columnVisibility = useMemo<VisibilityState>(() => {
    const vis: VisibilityState = {};
    const allowed = BREAKPOINT_COLUMNS[breakpoint];

    ALL_COLUMN_IDS.forEach((id) => {
      // Must be enabled by user in visibleTrackColumns AND permitted in the current breakpoint
      vis[id] = visibleTrackColumns.includes(id) && allowed.includes(id);
    });

    vis['spacer'] = true;
    return vis;
  }, [visibleTrackColumns, breakpoint]);

  // Columns definition (minimal layout data; cells rendered in component)
  const columns = useMemo<ColumnDef<Track>[]>(
    () => {
      const artSizeMap: Record<TrackGridDensity, number> = {
        compact: breakpoint === 'sm' ? 24 : 32,
        normal: breakpoint === 'sm' ? 36 : 48,
        large: breakpoint === 'sm' ? 44 : 60,
        'extra-large': 72,
        huge: 88,
        massive: 108,
      };

      return [
        {
          id: 'order',
          accessorFn: (_row, idx) => (idx !== undefined ? idx + 1 : 1),
          header: '#',
          size: columnSizing['order'] ?? (breakpoint === 'sm' ? 32 : 40),
          minSize: MIN_COLUMN_WIDTHS.order,
          enableResizing: false,
        },
        {
          id: 'art',
          accessorKey: 'embedded_art_base64',
          header: '',
          size: artSizeMap[trackGridDensity] || 48,
          minSize: MIN_COLUMN_WIDTHS.art,
          enableResizing: false,
        },
        {
          id: 'title',
          accessorKey: 'title',
          header: 'Title',
          size: columnSizing['title'] ?? (breakpoint === 'sm' ? 180 : 240),
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
          size: columnSizing['date'] ?? 70,
          minSize: MIN_COLUMN_WIDTHS.date,
          enableResizing: true,
        },
        {
          id: 'genre',
          accessorKey: 'genre',
          header: 'Genre',
          size: columnSizing['genre'] ?? 90,
          minSize: MIN_COLUMN_WIDTHS.genre,
          enableResizing: true,
        },
        {
          id: 'duration',
          accessorKey: 'duration_secs',
          header: () => React.createElement(Clock, { className: 'w-4 h-4 text-zinc-400' }),
          size: columnSizing['duration'] ?? 54,
          minSize: MIN_COLUMN_WIDTHS.duration,
          enableResizing: true,
        },
        {
          id: 'favorite',
          header: '',
          size: columnSizing['favorite'] ?? 32,
          minSize: MIN_COLUMN_WIDTHS.favorite,
          enableResizing: false,
        },
        {
          id: 'playNext',
          header: '',
          size: columnSizing['playNext'] ?? 32,
          minSize: MIN_COLUMN_WIDTHS.playNext,
          enableResizing: false,
        },
        {
          id: 'addToQueue',
          header: '',
          size: columnSizing['addToQueue'] ?? 32,
          minSize: MIN_COLUMN_WIDTHS.addToQueue,
          enableResizing: false,
        },
        {
          id: 'actions',
          header: '',
          size: columnSizing['actions'] ?? 36,
          minSize: MIN_COLUMN_WIDTHS.actions,
          enableResizing: true,
        },
        {
          id: 'spacer',
          header: '',
          size: columnSizing['spacer' as TrackColumnId] ?? 0,
          minSize: 0,
          enableResizing: true,
        } as ColumnDef<Track>,
      ];
    },
    [columnSizing, trackGridDensity, breakpoint]
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
    onColumnSizingChange: (updater) => {
      setColumnSizing((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;

        const containerW = parentRef.current?.clientWidth || containerWidth || windowWidth;
        if (!containerW || containerW <= 0) return next;

        // Find which column is being resized
        let changedColId: string | null = null;
        for (const k of Object.keys(next)) {
          if (next[k] !== prev[k]) {
            changedColId = k;
            break;
          }
        }

        if (!changedColId) return next;

        // Calculate total width of all other visible columns
        const visibleCols = table.getVisibleLeafColumns();
        let otherColsWidth = 0;

        visibleCols.forEach((col) => {
          if (col.id !== changedColId) {
            const minW = MIN_COLUMN_WIDTHS[col.id as TrackColumnId] ?? 36;
            const currentSize = next[col.id] !== undefined ? next[col.id] : minW;
            otherColsWidth += currentSize;
          }
        });

        const minAllowed = MIN_COLUMN_WIDTHS[changedColId as TrackColumnId] ?? 36;
        // Mathematical clamp: column width cannot push total table width beyond container width
        const maxAllowed = Math.max(minAllowed, containerW - otherColsWidth);

        if (next[changedColId] > maxAllowed) {
          return {
            ...next,
            [changedColId]: maxAllowed,
          };
        }

        if (next[changedColId] < minAllowed) {
          return {
            ...next,
            [changedColId]: minAllowed,
          };
        }

        return next;
      });
    },
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

  // Auto-clamp column sizes whenever containerWidth or breakpoint shrinks
  useEffect(() => {
    const containerW = parentRef.current?.clientWidth || containerWidth || windowWidth;
    if (!containerW || containerW <= 0) return;

    setColumnSizing((prev) => {
      const visibleCols = table.getVisibleLeafColumns();
      let totalSizedWidth = 0;

      visibleCols.forEach((col) => {
        const id = col.id;
        const minW = MIN_COLUMN_WIDTHS[id as TrackColumnId] ?? 36;
        const size = prev[id] !== undefined ? prev[id] : minW;
        totalSizedWidth += size;
      });

      if (totalSizedWidth > containerW) {
        let overflow = totalSizedWidth - containerW;
        const next = { ...prev };
        let hasChange = false;

        const resizedIds = Object.keys(next).filter((id) =>
          visibleCols.some((c) => c.id === id)
        );

        for (const id of resizedIds) {
          const minW = MIN_COLUMN_WIDTHS[id as TrackColumnId] ?? 36;
          const current = next[id];
          const maxShrink = current - minW;
          if (maxShrink > 0) {
            const shrinkBy = Math.min(maxShrink, overflow);
            next[id] = current - shrinkBy;
            overflow -= shrinkBy;
            hasChange = true;
            if (overflow <= 0) break;
          }
        }

        return hasChange ? next : prev;
      }

      return prev;
    });
  }, [effectiveWidth, table]);

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

  return {
    table,
    rows,
    rowVirtualizer,
    rowHeight,
    columnOrder,
    columnSizing,
    visibleTrackColumns,
    trackGridDensity,
    showSubArtistUnderTitle,
    breakpoint,
    containerWidth: effectiveWidth,
    handleDragEnd,
    resetGrid,
    setTrackGridDensity,
    setShowSubArtistUnderTitle,
    setVisibleTrackColumns,
  };
}
