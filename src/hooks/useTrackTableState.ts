import { useCallback } from 'react';
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

export const MIN_COLUMN_WIDTHS: Partial<Record<TrackColumnId, number>> = {
  order: 40,
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

export function useTrackTableState() {
  const visibleTrackColumns = usePlayerStore((s) => s.visibleTrackColumns);
  const setVisibleTrackColumns = usePlayerStore((s) => s.setVisibleTrackColumns);
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  const setTrackGridDensity = usePlayerStore((s) => s.setTrackGridDensity);
  const columnOrder = usePlayerStore((s) => s.columnOrder);
  const setColumnOrder = usePlayerStore((s) => s.setColumnOrder);
  const showSubArtistUnderTitle = usePlayerStore((s) => s.showSubArtistUnderTitle);
  const setShowSubArtistUnderTitle = usePlayerStore((s) => s.setShowSubArtistUnderTitle);

  const resetGrid = useCallback(() => {
    localStorage.removeItem(COLUMN_SIZING_STORAGE_KEY);
    setTrackGridDensity('normal');
    setShowSubArtistUnderTitle(true);
    setVisibleTrackColumns(DEFAULT_VISIBLE_COLUMNS);
    setColumnOrder(ALL_COLUMN_IDS);
  }, [setTrackGridDensity, setShowSubArtistUnderTitle, setVisibleTrackColumns, setColumnOrder]);

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
  };
}
