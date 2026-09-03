import React, { useState, useRef, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry, AllCommunityModule, CellKeyDownEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { Play, Pause, Heart, ListPlus, PlusCircle, MoreVertical, Info, SlidersHorizontal, Music } from 'lucide-react';

import { Track } from '../types/player';
import { usePlayerStore, TrackColumnId } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { useTrackTableState, DENSITY_ROW_HEIGHTS } from '../hooks/useTrackTableState';
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

const TrackArtCell = (props: any) => {
  const track = props.data as Track;
  const density = props.density;
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
    <div className={`${sizeClass} overflow-hidden shrink-0 bg-zinc-800 border border-white/10 shadow-sm flex items-center justify-center`}>
      {art ? (
        <img src={art} alt={track.title} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-indigo-950/60 to-purple-950/60 flex items-center justify-center text-indigo-400">
          <Music className={iconClass} />
        </div>
      )}
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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: Track } | null>(null);

  const gridRef = useRef<AgGridReact<Track>>(null);

  // Keyboard navigation
  const onCellKeyDown = useCallback((e: CellKeyDownEvent<Track>) => {
    const keyEvent = e.event as KeyboardEvent;
    if (keyEvent.key === 'Enter' && e.data) {
      keyEvent.preventDefault();
      if (currentTrack?.id === e.data.id) {
        togglePlay();
      } else {
        playTrack(e.data, tracks);
      }
    }
  }, [currentTrack, togglePlay, playTrack, tracks]);

  // Context menu
  const onCellContextMenu = useCallback((e: any) => {
    e.event.preventDefault();
    if (e.data) {
      setContextMenu({ x: e.event.clientX, y: e.event.clientY, track: e.data });
    }
  }, []);

  const onGridSizeChanged = useCallback((params: any) => {
    params.api.sizeColumnsToFit();
  }, []);

  // Save layout logic
  const saveColumnState = useCallback(() => {
    if (!gridRef.current || !gridRef.current.api) return;
    const state = gridRef.current.api.getColumnState();
    
    // Save order
    const orderedIds = state.map((c: any) => c.colId as TrackColumnId);
    setColumnOrder(orderedIds);
    
    // Save sizing
    const sizingMap: Record<string, number> = {};
    state.forEach((c: any) => {
      sizingMap[c.colId] = c.width;
    });
    localStorage.setItem(COLUMN_SIZING_STORAGE_KEY, JSON.stringify(sizingMap));
  }, [setColumnOrder, COLUMN_SIZING_STORAGE_KEY]);

  const onColumnMoved = saveColumnState;
  const onColumnResized = saveColumnState;

  // Toggle visibility helper function
  const handleToggleColumn = useCallback((colId: TrackColumnId) => {
    const isVisible = visibleTrackColumns.includes(colId);
    const updated = isVisible
      ? visibleTrackColumns.filter((c) => c !== colId)
      : [...visibleTrackColumns, colId];
    setVisibleTrackColumns(updated);
  }, [visibleTrackColumns, setVisibleTrackColumns]);

  // Dynamic row height
  const getRowHeight = useCallback(() => {
    return DENSITY_ROW_HEIGHTS[trackGridDensity] || 56;
  }, [trackGridDensity]);

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
        field: 'id', // placeholder
        width: savedSizing['order'] ?? 50,
        minWidth: 40,
        suppressSizeToFit: true,
        resizable: false,
        hide: !isVisible('order'),
        cellRenderer: (params: any) => {
          const track = params.data as Track;
          if (!track) return null;
          const isCurrentPlaying = currentTrack?.id === track.id;
          
          return (
            <div className="w-full h-full text-center font-mono text-zinc-400 flex items-center justify-center group/row">
              {isCurrentPlaying ? (
                isPlaying ? (
                  <Pause className="w-4 h-4 fill-current text-indigo-500 cursor-pointer" onClick={(e) => { e.stopPropagation(); togglePlay(); }} />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5 text-indigo-500 cursor-pointer" onClick={(e) => { e.stopPropagation(); togglePlay(); }} />
                )
              ) : (
                <>
                  <span className="group-hover/row:hidden">{params.node.rowIndex + 1}</span>
                  <Play className="w-4 h-4 fill-current ml-0.5 text-zinc-300 hidden group-hover/row:block cursor-pointer" onClick={(e) => { e.stopPropagation(); playTrack(track, tracks); }} />
                </>
              )}
            </div>
          );
        }
      },
      {
        colId: 'art',
        headerName: '',
        width: savedSizing['art'] ?? 60,
        minWidth: 40,
        suppressSizeToFit: true,
        resizable: false,
        hide: !isVisible('art'),
        cellRenderer: (params: any) => {
          if (!params.data) return null;
          return <div className="w-full h-full flex items-center justify-center"><TrackArtCell data={params.data} density={trackGridDensity} /></div>;
        }
      },
      {
        colId: 'title',
        headerName: 'Title',
        field: 'title',
        flex: 1,
        minWidth: 140,
        hide: !isVisible('title'),
        cellRenderer: (params: any) => {
          const track = params.data as Track;
          if (!track) return null;
          const isCurrentPlaying = currentTrack?.id === track.id;
          return (
            <div className="flex flex-col justify-center truncate min-w-0 pr-2 h-full">
              <span className={`truncate font-medium min-w-0 w-full ${
                  trackGridDensity === 'massive' ? 'text-xl' : trackGridDensity === 'huge' ? 'text-lg' : trackGridDensity === 'extra-large' ? 'text-base' : 'text-sm'
                }`} style={isCurrentPlaying ? { color: 'var(--color-stop-1, #6366f1)', fontWeight: 700 } : { color: '#ffffff' }}>
                {track.title}
              </span>
              {showSubArtistUnderTitle && (
                <span onClick={(e) => {
                  if (track.artist && track.artist !== 'Unknown Artist') {
                    e.stopPropagation();
                    usePlayerStore.getState().navigateToArtist(track.artist);
                  }
                }} className={`text-zinc-400 truncate min-w-0 w-full hover:underline hover:text-indigo-400 cursor-pointer ${
                  trackGridDensity === 'massive' ? 'text-sm mt-0.5' : trackGridDensity === 'huge' ? 'text-xs mt-0.5' : 'text-[11px]'
                }`}>
                  {track.artist}
                </span>
              )}
            </div>
          );
        }
      },
      {
        colId: 'artist',
        headerName: 'Artist',
        field: 'artist',
        flex: 1,
        minWidth: 100,
        hide: !isVisible('artist'),
        cellRenderer: (params: any) => {
          const track = params.data as Track;
          if (!track) return null;
          return (
            <div className="flex items-center h-full">
              <span onClick={(e) => {
                if (track.artist && track.artist !== 'Unknown Artist') {
                  e.stopPropagation();
                  usePlayerStore.getState().navigateToArtist(track.artist);
                }
              }} className={`truncate text-zinc-300 min-w-0 w-full hover:underline hover:text-indigo-400 cursor-pointer ${
                  trackGridDensity === 'massive' ? 'text-base' : trackGridDensity === 'huge' ? 'text-sm' : 'text-xs'
                }`}>
                {track.artist}
              </span>
            </div>
          );
        }
      },
      {
        colId: 'album',
        headerName: 'Album',
        field: 'album',
        flex: 1,
        minWidth: 100,
        hide: !isVisible('album'),
        cellRenderer: (params: any) => {
          const track = params.data as Track;
          if (!track) return null;
          return (
            <div className="flex items-center h-full">
              <span onClick={(e) => {
                if (track.album && track.album !== 'Unknown Album') {
                  e.stopPropagation();
                  usePlayerStore.getState().navigateToAlbum(track.album);
                }
              }} className={`truncate text-zinc-400 min-w-0 w-full hover:underline hover:text-indigo-400 cursor-pointer ${
                  trackGridDensity === 'massive' ? 'text-base' : trackGridDensity === 'huge' ? 'text-sm' : 'text-xs'
                }`}>
                {track.album || '—'}
              </span>
            </div>
          );
        }
      },
      {
        colId: 'date',
        headerName: 'Date',
        field: 'year',
        width: savedSizing['date'] ?? 80,
        minWidth: 60,
        hide: !isVisible('date'),
        cellRenderer: (params: any) => {
          const track = params.data as Track;
          if (!track) return null;
          return (
            <div className="flex items-center h-full">
              <span className={`font-mono text-zinc-400 truncate ${trackGridDensity === 'massive' ? 'text-base' : trackGridDensity === 'huge' ? 'text-sm' : 'text-xs'}`}>
                {track.year || '—'}
              </span>
            </div>
          );
        }
      },
      {
        colId: 'genre',
        headerName: 'Genre',
        field: 'genre',
        width: savedSizing['genre'] ?? 110,
        minWidth: 80,
        hide: !isVisible('genre'),
        cellRenderer: (params: any) => {
          const track = params.data as Track;
          if (!track) return null;
          return (
            <div className="flex items-center h-full">
              <span className={`truncate text-zinc-400 ${trackGridDensity === 'massive' ? 'text-base' : trackGridDensity === 'huge' ? 'text-sm' : 'text-xs'}`}>
                {track.genre || '—'}
              </span>
            </div>
          );
        }
      },
      {
        colId: 'duration',
        headerName: 'Duration',
        field: 'duration_secs',
        width: savedSizing['duration'] ?? 80,
        minWidth: 60,
        suppressSizeToFit: true,
        hide: !isVisible('duration'),
        cellRenderer: (params: any) => {
          const track = params.data as Track;
          if (!track) return null;
          return (
            <div className="flex items-center h-full justify-end pr-2">
              <span className={`font-mono text-zinc-400 text-right ${trackGridDensity === 'massive' ? 'text-base' : trackGridDensity === 'huge' ? 'text-sm' : 'text-xs'}`}>
                {formatDuration(track.duration_secs)}
              </span>
            </div>
          );
        }
      },
      {
        colId: 'favorite',
        headerName: '',
        width: savedSizing['favorite'] ?? 44,
        minWidth: 36,
        suppressSizeToFit: true,
        resizable: false,
        hide: !isVisible('favorite'),
        cellRenderer: (params: any) => {
          const track = params.data as Track;
          if (!track) return null;
          const isLiked = likedTrackIds.includes(track.id);
          return (
            <div className="w-full h-full flex items-center justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLikeTrack(track.id);
                }}
                className={`p-1 rounded transition-all ${isLiked ? 'text-pink-500 hover:scale-110' : 'text-zinc-500 opacity-50 hover:opacity-100 hover:text-white'}`}
                title={isLiked ? 'Unlike' : 'Like'}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-pink-500' : ''}`} />
              </button>
            </div>
          );
        }
      },
      {
        colId: 'playNext',
        headerName: '',
        width: savedSizing['playNext'] ?? 44,
        minWidth: 36,
        suppressSizeToFit: true,
        resizable: false,
        hide: !isVisible('playNext'),
        cellRenderer: (params: any) => {
          const track = params.data as Track;
          if (!track) return null;
          return (
            <div className="w-full h-full flex items-center justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playNext(track);
                }}
                className="p-1 rounded text-zinc-400 opacity-50 hover:opacity-100 hover:text-white transition-all"
                title="Play Next"
              >
                <ListPlus className="w-4 h-4" />
              </button>
            </div>
          );
        }
      },
      {
        colId: 'addToQueue',
        headerName: '',
        width: savedSizing['addToQueue'] ?? 44,
        minWidth: 36,
        suppressSizeToFit: true,
        resizable: false,
        hide: !isVisible('addToQueue'),
        cellRenderer: (params: any) => {
          const track = params.data as Track;
          if (!track) return null;
          return (
            <div className="w-full h-full flex items-center justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addToQueue(track);
                }}
                className="p-1 rounded text-zinc-400 opacity-50 hover:opacity-100 hover:text-white transition-all"
                title="Add to Queue"
              >
                <PlusCircle className="w-4 h-4" />
              </button>
            </div>
          );
        }
      },
      {
        colId: 'actions',
        headerName: '',
        width: savedSizing['actions'] ?? 44,
        minWidth: 36,
        suppressSizeToFit: true,
        resizable: false,
        hide: !isVisible('actions'),
        cellRenderer: (params: any) => {
          const track = params.data as Track;
          if (!track) return null;
          return (
            <div className="w-full h-full flex items-center justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenu({ x: e.clientX, y: e.clientY, track });
                }}
                className="p-1 rounded text-zinc-400 opacity-50 hover:opacity-100 hover:text-white transition-all"
                title="More Options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          );
        }
      },
    ];
  }, [
    visibleTrackColumns, 
    trackGridDensity, 
    showSubArtistUnderTitle, 
    currentTrack, 
    isPlaying, 
    likedTrackIds,
    COLUMN_SIZING_STORAGE_KEY,
    toggleLikeTrack,
    playNext,
    addToQueue,
    tracks,
    playTrack,
    togglePlay
  ]);

  // Order columns based on store
  const orderedColDefs = useMemo(() => {
    const ordered: ColDef<Track>[] = [];
    const colDefMap = new Map<string, ColDef<Track>>();
    colDefs.forEach((c) => colDefMap.set(c.colId as string, c));

    columnOrder.forEach((id) => {
      if (colDefMap.has(id)) {
        ordered.push(colDefMap.get(id)!);
      }
    });

    return ordered;
  }, [colDefs, columnOrder]);

  const onRowDoubleClicked = useCallback((e: any) => {
    if (e.data) {
      playTrack(e.data, tracks);
    }
  }, [playTrack, tracks]);

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
              onResetGrid={resetGrid}
              visibleTrackColumns={visibleTrackColumns}
              onToggleColumn={handleToggleColumn}
            />
          </div>
        </div>
      )}

      {/* Main AG Grid Container */}
      <div className="flex-1 w-full relative ag-theme-quartz-dark custom-ag-grid" style={{
        '--ag-background-color': 'transparent',
        '--ag-header-background-color': 'rgba(9, 9, 11, 0.4)',
        '--ag-border-color': 'rgba(255, 255, 255, 0.05)',
        '--ag-row-border-color': 'rgba(255, 255, 255, 0.02)',
        '--ag-row-hover-color': 'rgba(255, 255, 255, 0.06)',
        '--ag-font-size': '12px',
        '--ag-font-family': 'inherit',
        '--ag-header-column-separator-color': 'transparent',
        '--ag-header-column-resize-handle-color': 'var(--color-stop-1, #6366f1)',
      } as any}>
        <AgGridReact
          ref={gridRef}
          rowData={tracks}
          columnDefs={orderedColDefs}
          getRowHeight={getRowHeight}
          suppressHorizontalScroll={true}
          onGridSizeChanged={onGridSizeChanged}
          onCellKeyDown={onCellKeyDown}
          onCellContextMenu={onCellContextMenu}
          onRowDoubleClicked={onRowDoubleClicked}
          onColumnMoved={onColumnMoved}
          onColumnResized={onColumnResized}
          rowSelection="single"
          animateRows={true}
          headerHeight={40}
          defaultColDef={{
            sortable: true,
            resizable: true,
          }}
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
