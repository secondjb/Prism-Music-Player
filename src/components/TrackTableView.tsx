import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Column } from '@tanstack/react-table';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
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
} from 'lucide-react';

import { Track } from '../types/player';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { useTrackTableState, TrackColumnId } from '../hooks/useTrackTableState';
import { DraggableHeader } from './DraggableHeader';
import { ColumnConfigModal } from './ColumnConfigModal';

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

const TrackArtCell: React.FC<{ track: Track; density: string }> = ({ track, density }) => {
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

  const parentRef = useRef<HTMLDivElement>(null);

  const {
    table,
    rows,
    rowVirtualizer,
    gridTemplateColumns,
    trackGridDensity,
    showSubArtistUnderTitle,
    handleDragEnd,
    resetGrid,
    setTrackGridDensity,
    setShowSubArtistUnderTitle,
  } = useTrackTableState({ tracks, parentRef });

  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: Track } | null>(null);

  // DnD Sensors setup
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Keyboard navigation logic
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (rows.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.min(prev + 1, rows.length - 1);
          rowVirtualizer.scrollToIndex(next, { align: 'auto' });
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.max(prev - 1, 0);
          rowVirtualizer.scrollToIndex(next, { align: 'auto' });
          return next;
        });
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < rows.length) {
          e.preventDefault();
          const targetTrack = rows[selectedIndex].original;
          if (currentTrack?.id === targetTrack.id) {
            togglePlay();
          } else {
            playTrack(targetTrack, tracks);
          }
        }
      }
    },
    [rows, selectedIndex, currentTrack, togglePlay, playTrack, tracks, rowVirtualizer]
  );

  // Context menu trigger handler
  const handleContextMenu = useCallback((e: React.MouseEvent, track: Track) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, track });
  }, []);

  const visibleLeafColumns = table.getVisibleLeafColumns();
  const visibleColumnIds = useMemo(
    () => visibleLeafColumns.map((c) => c.id as TrackColumnId),
    [visibleLeafColumns]
  );

  // Empty state rendering
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
    <div
      className="w-full h-full flex flex-col overflow-hidden relative select-none outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
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

          {/* Grid Customization Popover Anchor */}
          <div className="relative">
            <button
              onClick={() => setShowConfigModal((p) => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer shadow-sm active:scale-95"
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)',
                color: 'var(--color-stop-1, #6366f1)',
                borderColor:
                  'color-mix(in srgb, var(--color-stop-1, #6366f1) 30%, transparent)',
              }}
            >
              <SlidersHorizontal
                className="w-3.5 h-3.5"
                style={{ color: 'var(--color-stop-1, #6366f1)' }}
              />
              <span className="text-white">Grid Customization</span>
            </button>

            {/* Settings Popover */}
            <ColumnConfigModal
              isOpen={showConfigModal}
              onClose={() => setShowConfigModal(false)}
              columns={table.getAllLeafColumns() as Column<Track, unknown>[]}
              density={trackGridDensity}
              onDensityChange={setTrackGridDensity}
              showSubArtistUnderTitle={showSubArtistUnderTitle}
              onToggleSubArtist={setShowSubArtistUnderTitle}
              onResetGrid={resetGrid}
            />
          </div>
        </div>
      )}

      {/* Main Table Scroll Container */}
      <div
        ref={parentRef}
        className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar w-full relative"
      >
        <div className="min-w-full inline-block align-middle">
          {/* Sticky Header with CSS Grid */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToHorizontalAxis]}
          >
            <div
              style={{ display: 'grid', gridTemplateColumns }}
              className="sticky top-0 z-30 bg-zinc-950/40 backdrop-blur-xl border-b border-white/10 px-2 shadow-sm"
            >
              <SortableContext
                items={visibleColumnIds}
                strategy={horizontalListSortingStrategy}
              >
                {table.getHeaderGroups().map((hg) =>
                  hg.headers.map((header) => (
                    <DraggableHeader key={header.id} header={header} />
                  ))
                )}
              </SortableContext>
            </div>
          </DndContext>

          {/* Virtualized Body Rows */}
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: 'relative',
              width: '100%',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;

              const track = row.original;
              const isCurrentPlaying = currentTrack?.id === track.id;
              const isRowSelected = selectedIndex === virtualRow.index;

              return (
                <div
                  key={row.id}
                  onClick={() => setSelectedIndex(virtualRow.index)}
                  onDoubleClick={() => playTrack(track, tracks)}
                  onContextMenu={(e) => handleContextMenu(e, track)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    ...(isCurrentPlaying
                      ? {
                          backgroundColor:
                            'color-mix(in srgb, var(--color-stop-1, #6366f1) 18%, transparent)',
                        }
                      : {}),
                  }}
                  className={`group px-2 items-center text-xs transition-colors cursor-pointer border-b border-white/[0.02] ${
                    isCurrentPlaying
                      ? 'font-semibold'
                      : isRowSelected
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-300 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  {row.getVisibleCells().map((cell) => {
                    const colId = cell.column.id as TrackColumnId;

                    return (
                      <div
                        key={cell.id}
                        className="flex items-center min-w-0 px-1 py-1 truncate"
                      >
                        {colId === 'order' && (
                          <div className="w-full text-center font-mono text-zinc-400 flex items-center justify-center">
                            {/* Spotify Hover Play Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isCurrentPlaying) {
                                  togglePlay();
                                } else {
                                  playTrack(track, tracks);
                                }
                              }}
                              className="w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-105"
                            >
                              {isCurrentPlaying ? (
                                isPlaying ? (
                                  <Pause
                                    className="w-4 h-4 fill-current"
                                    style={{ color: 'var(--color-stop-1, #6366f1)' }}
                                  />
                                ) : (
                                  <Play
                                    className="w-4 h-4 fill-current ml-0.5"
                                    style={{ color: 'var(--color-stop-1, #6366f1)' }}
                                  />
                                )
                              ) : (
                                <>
                                  <span className="group-hover:hidden text-zinc-400 font-medium">
                                    {virtualRow.index + 1}
                                  </span>
                                  <Play className="w-3.5 h-3.5 hidden group-hover:block fill-white text-white ml-0.5" />
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {colId === 'art' && (
                          <div className="w-full flex items-center justify-center">
                            <TrackArtCell track={track} density={trackGridDensity} />
                          </div>
                        )}

                        {colId === 'title' && (
                          <div className="flex flex-col justify-center truncate min-w-0 pr-2">
                            <span
                              title={track.title}
                              className={`truncate font-medium ${
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
                              <span
                                title={track.artist}
                                onClick={(e) => {
                                  if (track.artist && track.artist !== 'Unknown Artist') {
                                    e.stopPropagation();
                                    usePlayerStore.getState().navigateToArtist(track.artist);
                                  }
                                }}
                                className={`text-zinc-400 truncate hover:underline hover:text-indigo-400 cursor-pointer ${
                                  trackGridDensity === 'massive'
                                    ? 'text-sm mt-0.5'
                                    : trackGridDensity === 'huge'
                                    ? 'text-xs mt-0.5'
                                    : 'text-[11px]'
                                }`}
                              >
                                {track.artist}
                              </span>
                            )}
                          </div>
                        )}

                        {colId === 'artist' && (
                          <span
                            title={track.artist}
                            onClick={(e) => {
                              if (track.artist && track.artist !== 'Unknown Artist') {
                                e.stopPropagation();
                                usePlayerStore.getState().navigateToArtist(track.artist);
                              }
                            }}
                            className={`truncate text-zinc-300 hover:underline hover:text-indigo-400 cursor-pointer ${
                              trackGridDensity === 'massive'
                                ? 'text-base'
                                : trackGridDensity === 'huge'
                                ? 'text-sm'
                                : 'text-xs'
                            }`}
                          >
                            {track.artist}
                          </span>
                        )}

                        {colId === 'album' && (
                          <span
                            title={track.album}
                            onClick={(e) => {
                              if (track.album && track.album !== 'Unknown Album') {
                                e.stopPropagation();
                                usePlayerStore.getState().navigateToAlbum(track.album);
                              }
                            }}
                            className={`truncate text-zinc-400 hover:underline hover:text-indigo-400 cursor-pointer ${
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

                        {colId === 'date' && (
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
                        )}

                        {colId === 'genre' && (
                          <span
                            title={track.genre || undefined}
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
                        )}

                        {colId === 'duration' && (
                          <span
                            className={`font-mono text-zinc-400 text-right w-full pr-1 ${
                              trackGridDensity === 'massive'
                                ? 'text-base'
                                : trackGridDensity === 'huge'
                                ? 'text-sm'
                                : 'text-xs'
                            }`}
                          >
                            {formatDuration(track.duration_secs)}
                          </span>
                        )}

                        {colId === 'favorite' && (
                          <div className="w-full flex items-center justify-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLikeTrack(track.id);
                              }}
                              className={`p-1 rounded transition-all ${
                                likedTrackIds.includes(track.id)
                                  ? 'text-pink-500 hover:scale-110'
                                  : 'text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-white'
                              }`}
                              title={likedTrackIds.includes(track.id) ? 'Unlike' : 'Like'}
                            >
                              <Heart
                                className={`w-3.5 h-3.5 ${
                                  likedTrackIds.includes(track.id) ? 'fill-pink-500' : ''
                                }`}
                              />
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
                              className="p-1 rounded text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-white transition-all"
                              title="Play Next"
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
                              className="p-1 rounded text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-white transition-all"
                              title="Add to Queue"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {colId === 'actions' && (
                          <div className="w-full flex items-center justify-center">
                            <button
                              onClick={(e) => handleContextMenu(e, track)}
                              className="p-1 rounded text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-white transition-all"
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
              );
            })}
          </div>
        </div>
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
