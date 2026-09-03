import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  ModuleRegistry,
  AllCommunityModule,
  CellKeyDownEvent,
  ColumnResizedEvent,
  ColumnMovedEvent,
  GridReadyEvent,
  themeQuartz,
  colorSchemeDark,
} from 'ag-grid-community';
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
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

import { Track } from '../types/player';
import { usePlayerStore, TrackColumnId, TrackGridDensity } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import {
  useTrackTableState,
  DENSITY_ROW_HEIGHTS,
  DEFAULT_COLUMN_WIDTHS,
  MIN_COLUMN_WIDTHS,
} from '../hooks/useTrackTableState';
import { ColumnConfigModal } from './ColumnConfigModal';

ModuleRegistry.registerModules([AllCommunityModule]);

interface TrackTableViewProps {
  tracks: Track[];
  playlistId?: string;
  onRemoveFromPlaylist?: (trackId: string) => void;
  hideControls?: boolean;
}

const formatDuration = (secs: number) => {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const ART_COLUMN_WIDTHS: Record<TrackGridDensity, number> = {
  compact: 40,
  normal: 56,
  large: 64,
  'extra-large': 76,
  huge: 96,
  massive: 116,
};

const ACTION_DENSITY_CONFIG: Record<
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

const ORDER_DENSITY_CONFIG: Record<
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

// Custom Header Component matching legacy styling
const CustomHeader: React.FC<any> = (props) => {
  const [sort, setSort] = useState<'asc' | 'desc' | null>(props.column.getSort());

  useEffect(() => {
    const onSortChanged = () => {
      setSort(props.column.getSort());
    };
    props.column.addEventListener('sortChanged', onSortChanged);
    return () => {
      props.column.removeEventListener('sortChanged', onSortChanged);
    };
  }, [props.column]);

  const onHeaderClick = (e: React.MouseEvent) => {
    if (props.enableSorting) {
      props.progressSort(e.shiftKey);
    }
  };

  const colId = props.column.getColId();
  if (['art', 'favorite', 'playNext', 'addToQueue', 'actions', 'buffer'].includes(colId)) {
    return null;
  }

  const isDuration = colId === 'duration';
  const isOrder = colId === 'order';

  return (
    <div
      onClick={onHeaderClick}
      className={`flex items-center gap-1.5 w-full h-full select-none text-[11px] font-semibold uppercase tracking-wider text-[#b3b3b3] hover:text-white transition-colors ${
        props.enableSorting ? 'cursor-pointer' : ''
      } ${isDuration ? 'justify-end pr-1' : isOrder ? 'justify-center' : ''}`}
    >
      {isDuration ? (
        <span title="Duration" className="flex items-center">
          <Clock className="w-3.5 h-3.5 text-zinc-400 hover:text-white transition-colors" />
        </span>
      ) : (
        <span className="truncate">{props.displayName}</span>
      )}

      {sort === 'asc' && (
        <ChevronUp
          className="w-3.5 h-3.5 shrink-0"
          style={{ color: 'var(--color-stop-1, #6366f1)' }}
        />
      )}
      {sort === 'desc' && (
        <ChevronDown
          className="w-3.5 h-3.5 shrink-0"
          style={{ color: 'var(--color-stop-1, #6366f1)' }}
        />
      )}
    </div>
  );
};

// Custom Cell Renderers
const OrderCell: React.FC<any> = ({ data, node }) => {
  const track = data as Track;
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  const tracks = usePlayerStore((s) => s.tracks);

  if (!track) return null;
  const isCurrentPlaying = currentTrack?.id === track.id;
  const config = ORDER_DENSITY_CONFIG[trackGridDensity] || ORDER_DENSITY_CONFIG.normal;

  return (
    <div className="w-full h-full flex items-center justify-center font-mono text-zinc-400 pointer-events-none">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isCurrentPlaying) {
            togglePlay();
          } else {
            playTrack(track, tracks);
          }
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        className={`${config.buttonClass} rounded-full flex items-center justify-center transition-transform hover:scale-105 cursor-pointer pointer-events-auto`}
      >
        {isCurrentPlaying ? (
          isPlaying ? (
            <Pause
              className={`${config.iconClass} fill-current`}
              style={{ color: 'var(--color-stop-1, #6366f1)' }}
            />
          ) : (
            <Play
              className={`${config.iconClass} fill-current ml-0.5`}
              style={{ color: 'var(--color-stop-1, #6366f1)' }}
            />
          )
        ) : (
          <>
            <span className={`group-hover/row:hidden text-zinc-400 font-medium ${config.textClass}`}>
              {node.rowIndex + 1}
            </span>
            <Play className={`${config.iconClass} hidden group-hover/row:block fill-white text-white ml-0.5`} />
          </>
        )}
      </button>
    </div>
  );
};

const TrackArtCell: React.FC<{ data: Track; density: string }> = ({ data, density }) => {
  const track = data;
  const art = useTrackArt(track);
  const artSizes: Record<string, string> = {
    compact: 'w-6 h-6 rounded',
    normal: 'w-10 h-10 rounded-md',
    large: 'w-12 h-12 rounded-lg',
    'extra-large': 'w-14 h-14 rounded-xl',
    huge: 'w-20 h-20 rounded-xl',
    massive: 'w-24 h-24 rounded-2xl',
  };
  const iconSizes: Record<string, string> = {
    compact: 'w-3 h-3',
    normal: 'w-4 h-4',
    large: 'w-5 h-5',
    'extra-large': 'w-6 h-6',
    huge: 'w-8 h-8',
    massive: 'w-10 h-10',
  };
  const sizeClass = artSizes[density] || artSizes.normal;
  const iconClass = iconSizes[density] || iconSizes.normal;

  return (
    <div className="w-full h-full flex items-center justify-center pointer-events-none">
      <div
        className={`${sizeClass} overflow-hidden shrink-0 bg-zinc-800 border border-white/10 shadow-sm flex items-center justify-center`}
      >
        {art ? (
          <img src={art} alt={track.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-950/60 to-purple-950/60 flex items-center justify-center text-indigo-400">
            <Music className={iconClass} />
          </div>
        )}
      </div>
    </div>
  );
};

const TitleCell: React.FC<any> = ({ data }) => {
  const track = data as Track;
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const showSubArtistUnderTitle = usePlayerStore((s) => s.showSubArtistUnderTitle);
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);

  if (!track) return null;
  const isCurrentPlaying = currentTrack?.id === track.id;

  const hasSubArtistLink = Boolean(
    showSubArtistUnderTitle && track.artist && track.artist !== 'Unknown Artist'
  );

  return (
    <div className="flex flex-col justify-center h-full min-w-0 pr-2 w-full select-none">
      <span
        title={track.title}
        className={`truncate font-medium min-w-0 leading-snug pb-0.5 ${
          trackGridDensity === 'massive'
            ? 'text-xl'
            : trackGridDensity === 'huge'
            ? 'text-lg'
            : trackGridDensity === 'extra-large'
            ? 'text-base'
            : 'text-sm'
        }`}
        style={
          isCurrentPlaying
            ? {
                color: 'var(--color-stop-1, #6366f1)',
                fontWeight: 700,
              }
            : { color: '#ffffff' }
        }
      >
        {track.title}
      </span>
      {showSubArtistUnderTitle && (
        <div className="flex items-center min-w-0 pointer-events-none leading-none -mt-0.5">
          {hasSubArtistLink ? (
            <span
              title={track.artist}
              onClick={(e) => {
                e.stopPropagation();
                usePlayerStore.getState().navigateToArtist(track.artist);
              }}
              className={`text-zinc-400 truncate hover:underline hover:text-indigo-400 cursor-pointer pointer-events-auto shrink-0 max-w-full leading-tight ${
                trackGridDensity === 'massive'
                  ? 'text-sm'
                  : trackGridDensity === 'huge'
                  ? 'text-xs'
                  : 'text-[11px]'
              }`}
            >
              {track.artist}
            </span>
          ) : (
            <span
              className={`text-zinc-500 truncate leading-tight ${
                trackGridDensity === 'massive'
                  ? 'text-sm'
                  : trackGridDensity === 'huge'
                  ? 'text-xs'
                  : 'text-[11px]'
              }`}
            >
              {track.artist}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

const ArtistCell: React.FC<any> = ({ data }) => {
  const track = data as Track;
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track) return null;

  const hasArtistLink = Boolean(track.artist && track.artist !== 'Unknown Artist');

  return (
    <div className="flex items-center h-full w-full min-w-0 overflow-hidden pointer-events-none">
      {hasArtistLink ? (
        <span
          title={track.artist}
          onClick={(e) => {
            e.stopPropagation();
            usePlayerStore.getState().navigateToArtist(track.artist);
          }}
          className={`truncate text-zinc-300 hover:underline hover:text-indigo-400 cursor-pointer pointer-events-auto shrink-0 max-w-full ${
            trackGridDensity === 'massive'
              ? 'text-base'
              : trackGridDensity === 'huge'
              ? 'text-sm'
              : 'text-xs'
          }`}
        >
          {track.artist}
        </span>
      ) : (
        <span
          className={`truncate text-zinc-400 ${
            trackGridDensity === 'massive'
              ? 'text-base'
              : trackGridDensity === 'huge'
              ? 'text-sm'
              : 'text-xs'
          }`}
        >
          {track.artist || '—'}
        </span>
      )}
    </div>
  );
};

const AlbumCell: React.FC<any> = ({ data }) => {
  const track = data as Track;
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track) return null;

  const hasAlbumLink = Boolean(track.album && track.album !== 'Unknown Album');

  return (
    <div className="flex items-center h-full w-full min-w-0 overflow-hidden pointer-events-none">
      {hasAlbumLink ? (
        <span
          title={track.album}
          onClick={(e) => {
            e.stopPropagation();
            usePlayerStore.getState().navigateToAlbum(track.album);
          }}
          className={`truncate text-zinc-400 hover:underline hover:text-indigo-400 cursor-pointer pointer-events-auto shrink-0 max-w-full ${
            trackGridDensity === 'massive'
              ? 'text-base'
              : trackGridDensity === 'huge'
              ? 'text-sm'
              : 'text-xs'
          }`}
        >
          {track.album}
        </span>
      ) : (
        <span
          className={`truncate text-zinc-500 ${
            trackGridDensity === 'massive'
              ? 'text-base'
              : trackGridDensity === 'huge'
              ? 'text-sm'
              : 'text-xs'
          }`}
        >
          {track.album || '—'}
        </span>
      )}
    </div>
  );
};

const DateCell: React.FC<any> = ({ data }) => {
  const track = data as Track;
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track) return null;

  return (
    <div className="flex items-center h-full w-full min-w-0 pointer-events-none">
      <span
        className={`font-mono text-zinc-400 truncate ${
          trackGridDensity === 'massive'
            ? 'text-base'
            : trackGridDensity === 'huge'
            ? 'text-sm'
            : 'text-xs'
        }`}
      >
        {track.year || '—'}
      </span>
    </div>
  );
};

const GenreCell: React.FC<any> = ({ data }) => {
  const track = data as Track;
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track) return null;

  return (
    <div className="flex items-center h-full w-full min-w-0 pointer-events-none">
      <span
        className={`truncate text-zinc-400 ${
          trackGridDensity === 'massive'
            ? 'text-base'
            : trackGridDensity === 'huge'
            ? 'text-sm'
            : 'text-xs'
        }`}
      >
        {track.genre || '—'}
      </span>
    </div>
  );
};

const DurationCell: React.FC<any> = ({ data }) => {
  const track = data as Track;
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track) return null;

  return (
    <div className="flex items-center justify-end h-full w-full pr-1 pointer-events-none">
      <span
        className={`font-mono text-zinc-400 text-right ${
          trackGridDensity === 'massive'
            ? 'text-base'
            : trackGridDensity === 'huge'
            ? 'text-sm'
            : 'text-xs'
        }`}
      >
        {formatDuration(track.duration_secs)}
      </span>
    </div>
  );
};

const FavoriteCell: React.FC<any> = ({ data }) => {
  const track = data as Track;
  const isLiked = usePlayerStore((s) => s.likedTrackIds.includes(track?.id));
  const toggleLikeTrack = usePlayerStore((s) => s.toggleLikeTrack);
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track) return null;

  const config = ACTION_DENSITY_CONFIG[trackGridDensity] || ACTION_DENSITY_CONFIG.normal;

  return (
    <div className="w-full h-full flex items-center justify-center pointer-events-none">
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleLikeTrack(track.id);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        className={`${config.buttonClass} rounded-lg transition-all cursor-pointer pointer-events-auto flex items-center justify-center ${
          isLiked
            ? 'text-pink-500 hover:scale-110'
            : 'text-zinc-500 opacity-0 group-hover/row:opacity-100 hover:text-white hover:bg-white/10'
        }`}
        title={isLiked ? 'Unlike' : 'Like'}
      >
        <Heart className={`${config.iconClass} ${isLiked ? 'fill-pink-500' : ''}`} />
      </button>
    </div>
  );
};

const PlayNextCell: React.FC<any> = ({ data }) => {
  const track = data as Track;
  const playNext = usePlayerStore((s) => s.playNext);
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track) return null;

  const config = ACTION_DENSITY_CONFIG[trackGridDensity] || ACTION_DENSITY_CONFIG.normal;

  return (
    <div className="w-full h-full flex items-center justify-center pointer-events-none">
      <button
        onClick={(e) => {
          e.stopPropagation();
          playNext(track);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        className={`${config.buttonClass} rounded-lg text-zinc-400 opacity-0 group-hover/row:opacity-100 hover:text-white hover:bg-white/10 transition-all cursor-pointer pointer-events-auto flex items-center justify-center`}
        title="Play Next"
      >
        <ListPlus className={config.iconClass} />
      </button>
    </div>
  );
};

const AddToQueueCell: React.FC<any> = ({ data }) => {
  const track = data as Track;
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track) return null;

  const config = ACTION_DENSITY_CONFIG[trackGridDensity] || ACTION_DENSITY_CONFIG.normal;

  return (
    <div className="w-full h-full flex items-center justify-center pointer-events-none">
      <button
        onClick={(e) => {
          e.stopPropagation();
          addToQueue(track);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        className={`${config.buttonClass} rounded-lg text-zinc-400 opacity-0 group-hover/row:opacity-100 hover:text-white hover:bg-white/10 transition-all cursor-pointer pointer-events-auto flex items-center justify-center`}
        title="Add to Queue"
      >
        <PlusCircle className={config.iconClass} />
      </button>
    </div>
  );
};

const ActionsCell: React.FC<any> = ({ data, onContextMenu }) => {
  const track = data as Track;
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track) return null;

  const config = ACTION_DENSITY_CONFIG[trackGridDensity] || ACTION_DENSITY_CONFIG.normal;

  return (
    <div className="w-full h-full flex items-center justify-center pointer-events-none">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onContextMenu(e, track);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        className={`${config.buttonClass} rounded-lg text-zinc-400 opacity-0 group-hover/row:opacity-100 hover:text-white hover:bg-white/10 transition-all cursor-pointer pointer-events-auto flex items-center justify-center`}
        title="More Options"
      >
        <MoreVertical className={config.iconClass} />
      </button>
    </div>
  );
};

export const TrackTableView: React.FC<TrackTableViewProps> = ({
  tracks,
  playlistId,
  onRemoveFromPlaylist,
  hideControls = false,
}) => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const likedTrackIds = usePlayerStore((s) => s.likedTrackIds);
  const toggleLikeTrack = usePlayerStore((s) => s.toggleLikeTrack);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const playNext = usePlayerStore((s) => s.playNext);
  const setInfoModalTrack = usePlayerStore((s) => s.setInfoModalTrack);

  const {
    visibleTrackColumns,
    trackGridDensity,
    showSubArtistUnderTitle,
    resetGrid,
    setTrackGridDensity,
    setShowSubArtistUnderTitle,
    COLUMN_SIZING_STORAGE_KEY,
    setColumnOrder,
    columnOrder,
    setVisibleTrackColumns,
  } = useTrackTableState();

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: Track } | null>(
    null
  );

  const gridRef = useRef<AgGridReact<Track>>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<any>(null);
  const [isScrolling, setIsScrolling] = useState(false);

  const onBodyScroll = useCallback(() => {
    setIsScrolling(true);
    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
    }
    scrollTimerRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 1000);
  }, []);

  // AG Grid v32 Native Theme API
  const playerTheme = useMemo(() => {
    return themeQuartz.withPart(colorSchemeDark).withParams({
      backgroundColor: 'transparent',
      wrapperBackgroundColor: 'transparent',
      headerBackgroundColor: 'rgba(9, 9, 11, 0.45)',
      rowHoverColor: 'rgba(255, 255, 255, 0.06)',
      borderColor: 'transparent',
    });
  }, []);

  // Keyboard navigation
  const onCellKeyDown = useCallback(
    (e: CellKeyDownEvent<Track>) => {
      const keyEvent = e.event as KeyboardEvent;
      if (keyEvent.key === 'Enter' && e.data) {
        keyEvent.preventDefault();
        if (currentTrack?.id === e.data.id) {
          togglePlay();
        } else {
          playTrack(e.data, tracks);
        }
      }
    },
    [currentTrack, togglePlay, playTrack, tracks]
  );

  // Context menu triggered from right-click anywhere on row/cell
  const onCellContextMenu = useCallback((e: any) => {
    e.event.preventDefault();
    if (e.data) {
      setContextMenu({ x: e.event.clientX, y: e.event.clientY, track: e.data });
    }
  }, []);

  // Save column resize, dynamically absorb overflow into adjacent columns, and enforce "Brick Wall" (hard stop)
  const onColumnResized = useCallback(
    (params: ColumnResizedEvent) => {
      const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
      const api = params.api;

      if (!params.finished) {
        if (params.column) {
          const activeCol = params.column;
          const displayedCols = api.getAllDisplayedColumns();

          // Calculate total width of all visible columns except buffer
          let totalWidth = 0;
          displayedCols.forEach((col) => {
            if (col.getColId() !== 'buffer') {
              totalWidth += col.getActualWidth();
            }
          });

          // If total width attempts to exceed container width, absorb into right columns
          let overflow = totalWidth - containerWidth;
          if (overflow > 0) {
            const activeIndex = displayedCols.indexOf(activeCol);
            const rightResizableCols = displayedCols
              .slice(activeIndex + 1)
              .filter(
                (col) =>
                  col.isResizable() &&
                  col.getColId() !== 'buffer' &&
                  col.getActualWidth() > (col.getMinWidth() || 40)
              );

            const updates: { key: string; newWidth: number }[] = [];

            // Shrink resizable columns to the right down to their minWidth
            for (const rCol of rightResizableCols) {
              const currentW = rCol.getActualWidth();
              const minW = rCol.getMinWidth() || 40;
              const shrinkable = currentW - minW;

              if (shrinkable > 0) {
                const shrinkBy = Math.min(shrinkable, overflow);
                const newW = currentW - shrinkBy;
                updates.push({ key: rCol.getColId(), newWidth: newW });
                overflow -= shrinkBy;
                if (overflow <= 0) break;
              }
            }

            if (updates.length > 0) {
              api.setColumnWidths(updates);
            }

            // If there is still overflow after shrinking all right columns to minWidth,
            // strictly clamp the active column at the physical right edge
            if (overflow > 0) {
              const currentActiveW = activeCol.getActualWidth();
              const minW = activeCol.getMinWidth() || 40;
              const clampedActiveW = Math.max(minW, currentActiveW - overflow);
              api.setColumnWidths([{ key: activeCol.getColId(), newWidth: clampedActiveW }]);
            }
          }
        }
        return;
      }

      // Drag finished: save column widths to localStorage
      const state = api.getColumnState();
      const sizingMap: Record<string, number> = {};
      state.forEach((c) => {
        if (c.width && c.colId && c.colId !== 'buffer') {
          sizingMap[c.colId] = c.width;
        }
      });
      localStorage.setItem(COLUMN_SIZING_STORAGE_KEY, JSON.stringify(sizingMap));

      // Clear any temporary maxWidth to prevent columns from being permanently locked
      const allCols = api.getAllDisplayedColumns();
      allCols.forEach((col) => {
        delete (col as any).maxWidth;
        if (col.getColDef()) {
          delete (col.getColDef() as any).maxWidth;
        }
      });
    },
    [COLUMN_SIZING_STORAGE_KEY]
  );

  // Save column order when drag is finished
  const onColumnMoved = useCallback(
    (params: ColumnMovedEvent) => {
      if (!params.finished) return;
      const state = params.api.getColumnState();
      const nonMovable = ['order', 'art', 'favorite', 'playNext', 'addToQueue', 'actions', 'buffer'];
      const orderedIds = state
        .map((c) => c.colId as TrackColumnId)
        .filter((id) => !nonMovable.includes(id as string));
      setColumnOrder(orderedIds);
    },
    [setColumnOrder]
  );

  // Dynamic row height mapping from density
  const getRowHeight = useCallback(() => {
    return DENSITY_ROW_HEIGHTS[trackGridDensity] || 56;
  }, [trackGridDensity]);

  // Recalculate row heights, art column width, and action column widths when density changes
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.resetRowHeights();
      const newArtWidth = ART_COLUMN_WIDTHS[trackGridDensity] || 56;
      const newActionWidth = ACTION_DENSITY_CONFIG[trackGridDensity]?.colWidth || 42;
      gridRef.current.api.setColumnWidths([
        { key: 'art', newWidth: newArtWidth },
        { key: 'favorite', newWidth: newActionWidth },
        { key: 'playNext', newWidth: newActionWidth },
        { key: 'addToQueue', newWidth: newActionWidth },
        { key: 'actions', newWidth: newActionWidth },
      ]);
      gridRef.current.api.redrawRows();
    }
  }, [trackGridDensity]);

  // Redraw rows on track change to re-apply theme tint & play icons
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.redrawRows();
    }
  }, [currentTrack?.id, isPlaying]);

  // Row styling for currently playing track
  const getRowStyle = useCallback(
    (params: any) => {
      if (params.data && currentTrack?.id === params.data.id) {
        return {
          backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 18%, transparent)',
        };
      }
      return undefined;
    },
    [currentTrack?.id]
  );

  // Toggle visibility helper
  const handleToggleColumn = useCallback(
    (colId: TrackColumnId) => {
      const isVisible = visibleTrackColumns.includes(colId);
      const updated = isVisible
        ? visibleTrackColumns.filter((c) => c !== colId)
        : [...visibleTrackColumns, colId];
      setVisibleTrackColumns(updated);
    },
    [visibleTrackColumns, setVisibleTrackColumns]
  );

  // Reset Grid handler
  const handleResetGrid = useCallback(() => {
    resetGrid();
    if (gridRef.current?.api) {
      gridRef.current.api.resetColumnState();
      gridRef.current.api.resetRowHeights();
    }
  }, [resetGrid]);

  const defaultColDef = useMemo(
    () => ({
      headerComponent: CustomHeader,
      suppressMovable: false,
    }),
    []
  );

  // Column definitions with initial/saved widths, flex distribution, and buffer column
  const colDefs = useMemo<ColDef<Track>[]>(() => {
    let savedSizing: Record<string, number> = {};
    try {
      const saved = localStorage.getItem(COLUMN_SIZING_STORAGE_KEY);
      if (saved) savedSizing = JSON.parse(saved);
    } catch {}

    const isVisible = (id: TrackColumnId) => visibleTrackColumns.includes(id);

    return [
      {
        colId: 'order',
        headerName: '#',
        width: savedSizing['order'] ?? DEFAULT_COLUMN_WIDTHS.order,
        minWidth: MIN_COLUMN_WIDTHS.order,
        resizable: false,
        sortable: false,
        suppressMovable: true,
        lockPosition: 'left',
        hide: !isVisible('order'),
        cellStyle: { padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
        cellRenderer: OrderCell,
      },
      {
        colId: 'art',
        headerName: '',
        width: ART_COLUMN_WIDTHS[trackGridDensity] || 56,
        minWidth: MIN_COLUMN_WIDTHS.art,
        resizable: false,
        sortable: false,
        suppressMovable: true,
        lockPosition: 'left',
        hide: !isVisible('art'),
        cellStyle: { padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
        cellRenderer: (params: any) =>
          params.data ? <TrackArtCell data={params.data} density={trackGridDensity} /> : null,
      },
      {
        colId: 'title',
        headerName: 'Title',
        field: 'title',
        width: savedSizing['title'] ?? DEFAULT_COLUMN_WIDTHS.title,
        flex: savedSizing['title'] ? undefined : 2,
        minWidth: MIN_COLUMN_WIDTHS.title,
        sortable: true,
        resizable: true,
        hide: !isVisible('title'),
        cellRenderer: TitleCell,
      },
      {
        colId: 'artist',
        headerName: 'Artist',
        field: 'artist',
        width: savedSizing['artist'] ?? DEFAULT_COLUMN_WIDTHS.artist,
        flex: savedSizing['artist'] ? undefined : 1,
        minWidth: MIN_COLUMN_WIDTHS.artist,
        sortable: true,
        resizable: true,
        hide: !isVisible('artist'),
        cellRenderer: ArtistCell,
      },
      {
        colId: 'album',
        headerName: 'Album',
        field: 'album',
        width: savedSizing['album'] ?? DEFAULT_COLUMN_WIDTHS.album,
        flex: savedSizing['album'] ? undefined : 1,
        minWidth: MIN_COLUMN_WIDTHS.album,
        sortable: true,
        resizable: true,
        hide: !isVisible('album'),
        cellRenderer: AlbumCell,
      },
      {
        colId: 'date',
        headerName: 'Date',
        field: 'year',
        width: savedSizing['date'] ?? DEFAULT_COLUMN_WIDTHS.date,
        minWidth: MIN_COLUMN_WIDTHS.date,
        sortable: true,
        resizable: true,
        hide: !isVisible('date'),
        cellRenderer: DateCell,
      },
      {
        colId: 'genre',
        headerName: 'Genre',
        field: 'genre',
        width: savedSizing['genre'] ?? DEFAULT_COLUMN_WIDTHS.genre,
        minWidth: MIN_COLUMN_WIDTHS.genre,
        sortable: true,
        resizable: true,
        hide: !isVisible('genre'),
        cellRenderer: GenreCell,
      },
      {
        colId: 'duration',
        headerName: 'Duration',
        field: 'duration_secs',
        width: savedSizing['duration'] ?? DEFAULT_COLUMN_WIDTHS.duration,
        minWidth: MIN_COLUMN_WIDTHS.duration,
        sortable: true,
        resizable: true,
        hide: !isVisible('duration'),
        cellRenderer: DurationCell,
      },
      {
        colId: 'favorite',
        headerName: '',
        width: ACTION_DENSITY_CONFIG[trackGridDensity]?.colWidth || 42,
        minWidth: 32,
        resizable: false,
        sortable: false,
        suppressMovable: true,
        lockPosition: 'right',
        hide: !isVisible('favorite'),
        cellStyle: { padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
        cellRenderer: FavoriteCell,
      },
      {
        colId: 'playNext',
        headerName: '',
        width: ACTION_DENSITY_CONFIG[trackGridDensity]?.colWidth || 42,
        minWidth: 32,
        resizable: false,
        sortable: false,
        suppressMovable: true,
        lockPosition: 'right',
        hide: !isVisible('playNext'),
        cellStyle: { padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
        cellRenderer: PlayNextCell,
      },
      {
        colId: 'addToQueue',
        headerName: '',
        width: ACTION_DENSITY_CONFIG[trackGridDensity]?.colWidth || 42,
        minWidth: 32,
        resizable: false,
        sortable: false,
        suppressMovable: true,
        lockPosition: 'right',
        hide: !isVisible('addToQueue'),
        cellStyle: { padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
        cellRenderer: AddToQueueCell,
      },
      {
        colId: 'actions',
        headerName: '',
        width: ACTION_DENSITY_CONFIG[trackGridDensity]?.colWidth || 42,
        minWidth: 32,
        resizable: false,
        sortable: false,
        suppressMovable: true,
        lockPosition: 'right',
        hide: !isVisible('actions'),
        cellStyle: { padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
        cellRenderer: (params: any) =>
          params.data ? (
            <ActionsCell
              data={params.data}
              onContextMenu={(e: any, track: Track) => {
                setContextMenu({ x: e.clientX, y: e.clientY, track });
              }}
            />
          ) : null,
      },
      // Invisible Buffer Column to act as a shock absorber and prevent right-overflow
      {
        colId: 'buffer',
        headerName: '',
        flex: 1,
        minWidth: 0,
        resizable: false,
        sortable: false,
        suppressMovable: true,
        lockPosition: 'right',
        cellRenderer: () => null,
      },
    ];
  }, [visibleTrackColumns, trackGridDensity, COLUMN_SIZING_STORAGE_KEY]);

  // Guarantee: order & art locked left, title/artist/album in middle, actions all the way right, buffer at end
  const orderedColDefs = useMemo(() => {
    const leftCols: ColDef<Track>[] = [];
    const middleCols: ColDef<Track>[] = [];
    const rightCols: ColDef<Track>[] = [];
    const colDefMap = new Map<string, ColDef<Track>>();
    colDefs.forEach((c) => colDefMap.set(c.colId as string, c));

    const leftIds: TrackColumnId[] = ['order', 'art'];
    const rightIds: TrackColumnId[] = ['favorite', 'playNext', 'addToQueue', 'actions'];

    // 1. Collect left columns (#, art)
    leftIds.forEach((id) => {
      if (colDefMap.has(id)) leftCols.push(colDefMap.get(id)!);
    });

    // 2. Collect middle content columns according to columnOrder
    columnOrder.forEach((id) => {
      if (!leftIds.includes(id) && !rightIds.includes(id) && (id as string) !== 'buffer') {
        if (colDefMap.has(id)) {
          middleCols.push(colDefMap.get(id)!);
        }
      }
    });

    // Fallback: any content columns (title, artist, album, date, genre, duration) missing from columnOrder
    const contentIds: TrackColumnId[] = ['title', 'artist', 'album', 'date', 'genre', 'duration'];
    contentIds.forEach((id) => {
      if (!middleCols.some((c) => c.colId === id) && colDefMap.has(id)) {
        middleCols.push(colDefMap.get(id)!);
      }
    });

    // 3. Collect right action columns in fixed order (all the way to the right)
    rightIds.forEach((id) => {
      if (colDefMap.has(id)) rightCols.push(colDefMap.get(id)!);
    });

    // 4. Buffer column at very end
    const bufferCol = colDefMap.get('buffer');

    return [...leftCols, ...middleCols, ...rightCols, ...(bufferCol ? [bufferCol] : [])];
  }, [colDefs, columnOrder]);

  const handlePlayRow = useCallback(
    (track: Track) => {
      if (track) {
        playTrack(track, tracks);
      }
    },
    [playTrack, tracks]
  );

  const onRowDoubleClicked = useCallback(
    (e: any) => {
      if (e.event?.target?.closest('button') || e.event?.target?.closest('a')) {
        return;
      }
      if (e.data) {
        handlePlayRow(e.data);
      }
    },
    [handlePlayRow]
  );

  const onCellDoubleClicked = useCallback(
    (e: any) => {
      if (e.event?.target?.closest('button') || e.event?.target?.closest('a')) {
        return;
      }
      if (e.data) {
        handlePlayRow(e.data);
      }
    },
    [handlePlayRow]
  );

  const onGridReady = useCallback(
    (params: GridReadyEvent) => {
      try {
        const saved = localStorage.getItem(COLUMN_SIZING_STORAGE_KEY);
        if (saved) {
          const sizing = JSON.parse(saved);
          const state = params.api.getColumnState().map((col) => {
            if (sizing[col.colId] && col.colId !== 'buffer') {
              return { ...col, width: sizing[col.colId], flex: undefined };
            }
            return col;
          });
          params.api.applyColumnState({ state, applyOrder: false });
        }
      } catch {}
    },
    [COLUMN_SIZING_STORAGE_KEY]
  );

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3 glass-card rounded-2xl border border-dashed border-white/10 my-4 select-none">
        <div className="w-14 h-14 rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-500">
          <Music className="w-8 h-8 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">No tracks available</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm">There are no songs to display in this list.</p>
        </div>
      </div>
    );
  }

  const currentDensityHeight = DENSITY_ROW_HEIGHTS[trackGridDensity] || 56;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative select-none">
      {/* Table Header Bar / Controls */}
      {!hideControls && (
        <div className="flex items-center justify-between px-4 py-2 bg-transparent shrink-0 border-b border-white/5 z-40">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Songs
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-white/10 text-zinc-300">
              {tracks.length}
            </span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowConfigModal((p) => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer shadow-sm active:scale-95"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)',
                color: 'var(--color-stop-1, #6366f1)',
                borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 30%, transparent)',
              }}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
              <span className="text-white">Grid Customization</span>
            </button>

            <ColumnConfigModal
              isOpen={showConfigModal}
              onClose={() => setShowConfigModal(false)}
              density={trackGridDensity}
              onDensityChange={setTrackGridDensity}
              showSubArtistUnderTitle={showSubArtistUnderTitle}
              onToggleSubArtist={setShowSubArtistUnderTitle}
              onResetGrid={handleResetGrid}
              visibleTrackColumns={visibleTrackColumns}
              onToggleColumn={handleToggleColumn}
            />
          </div>
        </div>
      )}

      {/* Main AG Grid Container using native theme API */}
      <div
        ref={containerRef}
        className={`flex-1 w-full relative ${isScrolling ? 'ag-grid-is-scrolling' : ''}`}
      >
        <AgGridReact
          ref={gridRef}
          theme={playerTheme}
          rowData={tracks}
          columnDefs={orderedColDefs}
          defaultColDef={defaultColDef}
          rowHeight={currentDensityHeight}
          getRowHeight={getRowHeight}
          getRowStyle={getRowStyle}
          rowClass="group/row"
          suppressHorizontalScroll={true}
          scrollbarWidth={0}
          onGridReady={onGridReady}
          onBodyScroll={onBodyScroll}
          onCellKeyDown={onCellKeyDown}
          onCellContextMenu={onCellContextMenu}
          onRowDoubleClicked={onRowDoubleClicked}
          onCellDoubleClicked={onCellDoubleClicked}
          onColumnMoved={onColumnMoved}
          onColumnResized={onColumnResized}
          rowSelection="single"
          animateRows={false}
          headerHeight={36}
          suppressCellFocus={true}
        />
      </div>

      {/* Context Menu Overlay */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu(null);
          }}
        >
          <div
            style={{
              top: Math.min(contextMenu.y, window.innerHeight - 260),
              left: Math.min(contextMenu.x, window.innerWidth - 220),
            }}
            className="fixed z-50 w-56 glass-panel border border-white/10 rounded-xl shadow-2xl p-1.5 flex flex-col gap-1 text-xs text-zinc-300 animate-in fade-in zoom-in-95 duration-100 bg-[#181818]/95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2.5 py-1 text-[11px] font-semibold text-zinc-400 border-b border-white/10 truncate">
              {contextMenu.track.title}
            </div>
            <button
              onClick={() => {
                playTrack(contextMenu.track, tracks);
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
              <ListPlus className="w-4 h-4 text-indigo-400" />
              <span>Play Next</span>
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
                className={`w-4 h-4 ${
                  likedTrackIds.includes(contextMenu.track.id)
                    ? 'fill-pink-500 text-pink-500'
                    : 'text-zinc-400'
                }`}
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
