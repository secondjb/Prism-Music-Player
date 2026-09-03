import { useCallback, useState } from 'react';
import { usePlayerStore, TrackColumnId, TrackGridDensity } from '../store/usePlayerStore';

export type { TrackColumnId, TrackGridDensity };

export const COLUMN_SIZING_STORAGE_KEY = 'prism_track_table_column_sizing_v2';

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

export const DEFAULT_COLUMN_WIDTHS: Record<TrackColumnId, number> = {
  order: 44,
  art: 56,
  title: 280,
  artist: 160,
  album: 160,
  date: 80,
  genre: 110,
  duration: 64,
  favorite: 36,
  playNext: 36,
  addToQueue: 36,
  actions: 36,
};

export const MIN_COLUMN_WIDTHS: Record<TrackColumnId, number> = {
  order: 44,
  art: 40,
  title: 140,
  artist: 100,
  album: 100,
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

export const ART_COLUMN_WIDTHS: Record<TrackGridDensity, number> = {
  compact: 40,
  normal: 56,
  large: 64,
  'extra-large': 76,
  huge: 96,
  massive: 116,
};

export const ACTION_DENSITY_CONFIG: Record<
  TrackGridDensity,
  { buttonClass: string; iconClass: string; colWidth: number }
> = {
  compact: {
    buttonClass: 'p-1',
    iconClass: 'w-3.5 h-3.5',
    colWidth: 36,
  },
  normal: {
    buttonClass: 'p-1.5',
    iconClass: 'w-4 h-4',
    colWidth: 42,
  },
  large: {
    buttonClass: 'p-1.5',
    iconClass: 'w-4.5 h-4.5',
    colWidth: 46,
  },
  'extra-large': {
    buttonClass: 'p-2',
    iconClass: 'w-5 h-5',
    colWidth: 52,
  },
  huge: {
    buttonClass: 'p-2.5',
    iconClass: 'w-6 h-6',
    colWidth: 60,
  },
  massive: {
    buttonClass: 'p-3',
    iconClass: 'w-7 h-7',
    colWidth: 70,
  },
};

export const ORDER_DENSITY_CONFIG: Record<
  TrackGridDensity,
  { buttonClass: string; iconClass: string; textClass: string }
> = {
  compact: { buttonClass: 'w-5 h-5', iconClass: 'w-3 h-3', textClass: 'text-xs' },
  normal: { buttonClass: 'w-6 h-6', iconClass: 'w-3.5 h-3.5', textClass: 'text-xs' },
  large: { buttonClass: 'w-7 h-7', iconClass: 'w-4 h-4', textClass: 'text-sm' },
  'extra-large': { buttonClass: 'w-8 h-8', iconClass: 'w-4.5 h-4.5', textClass: 'text-sm' },
  huge: { buttonClass: 'w-9 h-9', iconClass: 'w-5 h-5', textClass: 'text-base' },
  massive: { buttonClass: 'w-11 h-11', iconClass: 'w-6 h-6', textClass: 'text-lg' },
};

export const FLEX_COLUMN_WEIGHTS: Partial<Record<TrackColumnId, number>> = {
  title: 2,
  artist: 1,
  album: 1,
};

export const FIXED_WIDTH_COLUMNS: TrackColumnId[] = [
  'order',
  'art',
  'favorite',
  'playNext',
  'addToQueue',
  'actions',
];

/**
 * Calculates fractional/auto-sizing column widths to fill available container width
 * without creating horizontal overflow.
 */
export function calculateColumnWidths(
  containerWidth: number,
  visibleCols: TrackColumnId[],
  density: TrackGridDensity,
  savedSizing: Record<string, number> = {}
): Record<TrackColumnId, number> {
  const widths: Partial<Record<TrackColumnId, number>> = {};
  const effectiveContainerWidth = Math.max(containerWidth, 400);

  // 1. Assign fixed column widths based on density
  const artWidth = ART_COLUMN_WIDTHS[density] || 56;
  const actionWidth = ACTION_DENSITY_CONFIG[density]?.colWidth || 42;

  let fixedTotal = 0;
  visibleCols.forEach((colId) => {
    if (colId === 'order') {
      widths.order = savedSizing.order ?? MIN_COLUMN_WIDTHS.order;
      fixedTotal += widths.order;
    } else if (colId === 'art') {
      widths.art = artWidth;
      fixedTotal += artWidth;
    } else if (['favorite', 'playNext', 'addToQueue', 'actions'].includes(colId)) {
      widths[colId] = actionWidth;
      fixedTotal += actionWidth;
    } else if (!FLEX_COLUMN_WEIGHTS[colId]) {
      // Date, Genre, Duration: fixed or manual
      const minW = MIN_COLUMN_WIDTHS[colId] || 60;
      const defW = DEFAULT_COLUMN_WIDTHS[colId] || 80;
      const w = savedSizing[colId] ? Math.max(minW, savedSizing[colId]) : defW;
      widths[colId] = w;
      fixedTotal += w;
    }
  });

  // 2. Identify flexible columns (Title, Artist, Album) that are visible
  const flexCols = visibleCols.filter((colId) => Boolean(FLEX_COLUMN_WEIGHTS[colId]));
  const unsizedFlexCols: TrackColumnId[] = [];
  let sizedFlexTotal = 0;

  flexCols.forEach((colId) => {
    if (savedSizing[colId]) {
      const minW = MIN_COLUMN_WIDTHS[colId] || 100;
      const w = Math.max(minW, savedSizing[colId]);
      widths[colId] = w;
      sizedFlexTotal += w;
    } else {
      unsizedFlexCols.push(colId);
    }
  });

  // 3. Distribute remaining width to unsized flex columns proportionally
  const remainingWidth = Math.max(0, effectiveContainerWidth - fixedTotal - sizedFlexTotal);
  if (unsizedFlexCols.length > 0) {
    const totalWeight = unsizedFlexCols.reduce(
      (sum, colId) => sum + (FLEX_COLUMN_WEIGHTS[colId] || 1),
      0
    );

    let allocatedTotal = 0;
    unsizedFlexCols.forEach((colId, index) => {
      const isLast = index === unsizedFlexCols.length - 1;
      const minW = MIN_COLUMN_WIDTHS[colId] || 100;
      if (isLast) {
        // Last flexible column absorbs any rounding remainder
        const w = Math.max(minW, remainingWidth - allocatedTotal);
        widths[colId] = Math.floor(w);
      } else {
        const weight = FLEX_COLUMN_WEIGHTS[colId] || 1;
        const rawW = (weight / totalWeight) * remainingWidth;
        const w = Math.max(minW, Math.floor(rawW));
        widths[colId] = w;
        allocatedTotal += w;
      }
    });
  } else if (flexCols.length > 0 && remainingWidth > 0) {
    // If all flex columns had saved sizes but there is still space, expand Title
    if (widths.title) {
      widths.title += remainingWidth;
    }
  }

  return widths as Record<TrackColumnId, number>;
}

/**
 * Strict "Brick Wall" constraint:
 * When resizing a column, absorbs excess width into resizable columns to the right down to their minSize.
 * Clamps the column if dragging further would push the grid past container clientWidth.
 */
export function enforceBrickWallResize(
  activeColId: TrackColumnId,
  requestedNewWidth: number,
  currentWidths: Record<TrackColumnId, number>,
  displayedCols: TrackColumnId[],
  containerWidth: number
): { updatedWidths: Record<TrackColumnId, number>; clampedWidth: number } {
  const minW = MIN_COLUMN_WIDTHS[activeColId] || 40;
  const initialActiveW = currentWidths[activeColId] || minW;
  const targetW = Math.max(minW, requestedNewWidth);
  const delta = targetW - initialActiveW;

  const resultWidths: Record<TrackColumnId, number> = { ...currentWidths };
  if (delta === 0) {
    return { updatedWidths: resultWidths, clampedWidth: initialActiveW };
  }

  const activeIndex = displayedCols.indexOf(activeColId);
  if (activeIndex === -1) {
    return { updatedWidths: resultWidths, clampedWidth: targetW };
  }

  // Calculate current total width of all displayed columns
  let totalWidth = 0;
  displayedCols.forEach((col) => {
    totalWidth += currentWidths[col] || DEFAULT_COLUMN_WIDTHS[col] || 40;
  });

  const projectedTotal = totalWidth + delta;
  const overflow = projectedTotal - containerWidth;

  if (overflow <= 0) {
    // Fits comfortably within container
    resultWidths[activeColId] = targetW;
    return { updatedWidths: resultWidths, clampedWidth: targetW };
  }

  // Find resizable columns to the right of the active column
  const rightResizableCols = displayedCols.slice(activeIndex + 1).filter((colId) => {
    return !FIXED_WIDTH_COLUMNS.includes(colId);
  });

  let remainingOverflow = overflow;
  for (const rCol of rightResizableCols) {
    const currentW = resultWidths[rCol] || DEFAULT_COLUMN_WIDTHS[rCol] || 100;
    const rMinW = MIN_COLUMN_WIDTHS[rCol] || 60;
    const shrinkable = currentW - rMinW;

    if (shrinkable > 0) {
      const shrinkBy = Math.min(shrinkable, remainingOverflow);
      resultWidths[rCol] = currentW - shrinkBy;
      remainingOverflow -= shrinkBy;
      if (remainingOverflow <= 0) break;
    }
  }

  // Hard stop ("brick wall"): clamp active column if overflow cannot be absorbed
  const finalActiveW = Math.max(minW, targetW - remainingOverflow);
  resultWidths[activeColId] = finalActiveW;

  return { updatedWidths: resultWidths, clampedWidth: finalActiveW };
}

export function useTrackTableState() {
  const visibleTrackColumns = usePlayerStore((s) => s.visibleTrackColumns);
  const setVisibleTrackColumns = usePlayerStore((s) => s.setVisibleTrackColumns);
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  const setTrackGridDensity = usePlayerStore((s) => s.setTrackGridDensity);
  const columnOrder = usePlayerStore((s) => s.columnOrder);
  const setColumnOrder = usePlayerStore((s) => s.setColumnOrder);
  const showSubArtistUnderTitle = usePlayerStore((s) => s.showSubArtistUnderTitle);
  const setShowSubArtistUnderTitle = usePlayerStore((s) => s.setShowSubArtistUnderTitle);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(COLUMN_SIZING_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const resetGrid = useCallback(() => {
    localStorage.removeItem(COLUMN_SIZING_STORAGE_KEY);
    setColumnWidths({});
    setTrackGridDensity('normal');
    setShowSubArtistUnderTitle(true);
    setVisibleTrackColumns(DEFAULT_VISIBLE_COLUMNS);
    setColumnOrder(ALL_COLUMN_IDS);
  }, [setTrackGridDensity, setShowSubArtistUnderTitle, setVisibleTrackColumns, setColumnOrder]);

  const saveColumnWidths = useCallback((widths: Record<string, number>) => {
    setColumnWidths((prev) => {
      const updated = { ...prev, ...widths };
      try {
        localStorage.setItem(COLUMN_SIZING_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  return {
    visibleTrackColumns,
    setVisibleTrackColumns,
    trackGridDensity,
    setTrackGridDensity,
    columnOrder,
    setColumnOrder,
    showSubArtistUnderTitle,
    setShowSubArtistUnderTitle,
    resetGrid,
    COLUMN_SIZING_STORAGE_KEY,
    columnWidths,
    saveColumnWidths,
  };
}
