import React, { useState, useRef, useCallback, useMemo, useEffect, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { RevoGrid } from '@revolist/react-datagrid';
import type { ColumnRegular } from '@revolist/revogrid';

// Custom React Cell Template adapter with dynamic entity keying.
// By placing a unique key on the returned span (derived from the track's ID or row index),
// Stencil's virtual DOM creates a fresh DOM element and invokes the ref callback whenever
// the underlying track changes, preventing stale or blank cell renders when clearing searches.
const createReactCellTemplate = (ReactComponent: React.ComponentType<any>, customProps?: any) => {
  return (h: any, p: any, addition: any) => {
    const props = customProps ? { ...customProps, ...p } : p;
    props.addition = addition;
    const trackId = p.model?.id || `row-${p.rowIndex || 0}`;
    const key = `${p.prop}-${trackId}`;
    return h('span', {
      key,
      ref: (el: any) => {
        if (!el) {
          if (el?._root) {
            el._root.unmount();
            el._root = undefined;
          }
        } else {
          if (!el._root) {
            el._root = createRoot(el);
          }
          const vNode = createElement(ReactComponent, { ...props, key });
          el._root.render(vNode);
        }
      },
    });
  };
};
import {
  Play,
  Pause,
  Heart,
  ListPlus,
  ListEnd,
  PlusCircle,
  MoreVertical,
  Info,
  SlidersHorizontal,
  Music,
  Clock,
  ChevronUp,
  ChevronDown,
  Check,
  Plus,
  Link2,
  Unlink,
  X,
} from 'lucide-react';

import { Track } from '../types/player';
import { usePlayerStore, TrackColumnId } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  useTrackTableState,
  calculateColumnWidths,
  enforceBrickWallResize,
  DENSITY_ROW_HEIGHTS,
  DEFAULT_COLUMN_WIDTHS,
  MIN_COLUMN_WIDTHS,
  ACTION_DENSITY_CONFIG,
  ORDER_DENSITY_CONFIG,
  DEFAULT_COLUMN_ORDER,
} from '../hooks/useTrackTableState';
import { ColumnConfigModal } from './ColumnConfigModal';
import { CreatePlaylistModal } from './CreatePlaylistModal';

interface TrackTableViewProps {
  tracks: Track[];
  playlistId?: string;
  onRemoveFromPlaylist?: (trackId: string) => void;
  hideControls?: boolean;
  autoHeight?: boolean;
}

const formatDuration = (secs: number) => {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const handleTrackDragStart = (e: React.DragEvent, track: Track) => {
  if (!track || !track.id) return;
  const store = usePlayerStore.getState();
  const selectedTrackIds = store.selectedTrackIds || [];
  const isMulti = selectedTrackIds.includes(track.id) && selectedTrackIds.length > 1;
  const idsToDrag = isMulti ? selectedTrackIds : [track.id];

  e.dataTransfer.setData(
    'text/plain',
    JSON.stringify({ type: 'tracks', ids: idsToDrag })
  );
  e.dataTransfer.effectAllowed = 'copy';

  const ghost = document.createElement('div');
  ghost.style.position = 'absolute';
  ghost.style.top = '-9999px';
  ghost.style.left = '-9999px';
  ghost.className =
    'glass-panel text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-2xl z-50 flex items-center gap-2.5 border border-white/20';
  ghost.style.background = 'rgba(18, 18, 24, 0.95)';

  if (isMulti) {
    ghost.innerHTML = `<span>🎵</span> <span style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;">${idsToDrag.length} Songs Selected</span>`;
  } else {
    ghost.innerHTML = `<span>🎵</span> <span style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${track.title || 'Song'}</span>`;
  }

  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 20, 15);
  setTimeout(() => {
    if (document.body.contains(ghost)) {
      document.body.removeChild(ghost);
    }
  }, 0);
};

const handleCellClick = (e: React.MouseEvent, track: Track) => {
  if (!track || !track.id) return;
  if ((e.target as HTMLElement)?.closest('button') || (e.target as HTMLElement)?.closest('a')) {
    return;
  }
  const evt = new CustomEvent('prism-row-select', {
    bubbles: true,
    detail: {
      track,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey || e.metaKey,
    },
  });
  e.currentTarget.dispatchEvent(evt);
};

const handleCellContextMenu = (e: React.MouseEvent, track: Track, openPlaylistSubmenu = false) => {
  e.preventDefault();
  if (!track || !track.id) return;
  const store = usePlayerStore.getState();
  const selectedTrackIds = store.selectedTrackIds || [];
  const tracksList = store.tracks || [];

  let contextTracks: Track[] = [track];
  if (selectedTrackIds.includes(track.id) && selectedTrackIds.length > 1) {
    contextTracks = selectedTrackIds
      .map((id) => tracksList.find((t) => t.id === id) || (track.id === id ? track : null))
      .filter((t): t is Track => Boolean(t));
  } else if (!selectedTrackIds.includes(track.id)) {
    store.selectSingleTrack(track.id);
  }

  const evt = new CustomEvent('prism-open-context-menu', {
    bubbles: true,
    detail: {
      x: e.clientX,
      y: e.clientY,
      tracks: contextTracks,
      openPlaylistSubmenu,
    },
  });
  e.currentTarget.dispatchEvent(evt);
};

const PROP_TO_COL_ID: Record<string, TrackColumnId> = {
  order: 'order',
  art: 'art',
  title: 'title',
  artist: 'artist',
  album: 'album',
  year: 'date',
  genre: 'genre',
  duration_secs: 'duration',
  bit_rate_kbps: 'bitrate',
  sample_rate: 'sampleRate',
  bit_depth: 'bitDepth',
  favorite: 'favorite',
  playNext: 'playNext',
  addToQueue: 'addToQueue',
  addToPlaylist: 'addToPlaylist',
  actions: 'actions',
};

// Custom Cell & Header Components for RevoGrid Templates

const ColumnHeader: React.FC<any> = (props) => {
  const isDuration = props.prop === 'duration_secs';
  const isOrder = props.prop === 'order';
  const order = props.order; // 'asc' | 'desc' | undefined

  if (isDuration) {
    return (
      <div
        className="relative flex items-center justify-end w-full h-full select-none text-zinc-400 hover:text-white transition-colors cursor-pointer pr-3 overflow-visible"
        title="Sort by Duration"
      >
        <span className="flex items-center pointer-events-none">
          <Clock className="w-3.5 h-3.5 text-zinc-400 hover:text-white transition-colors" />
        </span>
        {order && (
          <span
            className="absolute -right-1 flex items-center pointer-events-none"
            style={{ color: 'var(--color-stop-1, #6366f1)' }}
          >
            {order === 'asc' ? (
              <ChevronUp className="w-3.5 h-3.5 pointer-events-none" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 pointer-events-none" />
            )}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1.5 w-full h-full select-none text-[11px] font-semibold uppercase tracking-wider text-[#b3b3b3] hover:text-white transition-colors ${
        props.sortable ? 'cursor-pointer' : ''
      } ${isOrder ? 'justify-center' : 'justify-start'}`}
    >
      {isOrder ? (
        <span className="pointer-events-none">#</span>
      ) : (
        <span className="truncate pointer-events-none">{props.name}</span>
      )}

      {order === 'asc' && (
        <ChevronUp
          className="w-3.5 h-3.5 shrink-0 pointer-events-none"
          style={{ color: 'var(--color-stop-1, #6366f1)' }}
        />
      )}
      {order === 'desc' && (
        <ChevronDown
          className="w-3.5 h-3.5 shrink-0 pointer-events-none"
          style={{ color: 'var(--color-stop-1, #6366f1)' }}
        />
      )}
    </div>
  );
};

const OrderCell: React.FC<any> = ({ model, rowIndex }) => {
  const track = (model || {}) as Track;
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  const tracks = usePlayerStore((s) => s.tracks);

  if (!track.id || (model as any)?.__isSpacer) return null;
  const isCurrentPlaying = currentTrack?.id === track.id;
  const config = ORDER_DENSITY_CONFIG[trackGridDensity] || ORDER_DENSITY_CONFIG.normal;

  return (
    <div
      draggable={Boolean(track.id)}
      onDragStart={(e) => handleTrackDragStart(e, track)}
      onClick={(e) => handleCellClick(e, track)}
      onContextMenu={(e) => handleCellContextMenu(e, track)}
      className="w-full h-full flex items-center justify-center font-mono text-zinc-400 cursor-grab active:cursor-grabbing"
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement)?.closest('button')) return;
        const evt = new CustomEvent('prism-play-track', {
          bubbles: true,
          detail: { track },
        });
        e.currentTarget.dispatchEvent(evt);
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (isCurrentPlaying) {
            togglePlay();
          } else {
            playTrack(track, tracks);
          }
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        className={`${config.buttonClass} rounded-full flex items-center justify-center transition-transform hover:scale-105 cursor-pointer`}
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
              {model?.order ?? ((rowIndex ?? 0) + 1)}
            </span>
            <Play 
              className={`${config.iconClass} hidden group-hover/row:block fill-current ml-0.5`} 
              style={{ color: 'var(--color-stop-1, #6366f1)' }}
            />
          </>
        )}
      </button>
    </div>
  );
};

const TrackArtCell: React.FC<any> = ({ model }) => {
  const track = (model || {}) as Track;
  if (!track.id || (model as any)?.__isSpacer) return null;
  const density = usePlayerStore((s) => s.trackGridDensity);
  const art = useTrackArt(track, { thumbnail: true, maxSize: 96 });

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
    <div
      draggable={Boolean(track.id)}
      onDragStart={(e) => handleTrackDragStart(e, track)}
      onClick={(e) => handleCellClick(e, track)}
      onContextMenu={(e) => handleCellContextMenu(e, track)}
      className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
      onDoubleClick={(e) => {
        const evt = new CustomEvent('prism-play-track', {
          bubbles: true,
          detail: { track },
        });
        e.currentTarget.dispatchEvent(evt);
      }}
    >
      <div
        className={`${sizeClass} overflow-hidden shrink-0 bg-zinc-800 border border-white/10 shadow-sm flex items-center justify-center pointer-events-none`}
      >
        {art ? (
          <img src={art} alt={track.title || ''} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-950/60 to-purple-950/60 flex items-center justify-center text-indigo-400">
            <Music className={iconClass} />
          </div>
        )}
      </div>
    </div>
  );
};

const TitleCell: React.FC<any> = ({ model, value }) => {
  const track = (model || {}) as Track;
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const showSubArtistUnderTitle = usePlayerStore((s) => s.showSubArtistUnderTitle);
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  const linkedTracks = usePlayerStore((s) => s.linkedTracks);

  const title = track.title || (typeof value === 'string' ? value : '');
  if (!title || !title.trim() || (model as any)?.__isSpacer) return null;
  const isCurrentPlaying = currentTrack?.id === track.id;
  const isLinked = Boolean(
    (linkedTracks[track.id] && linkedTracks[track.id].length > 0) ||
    Object.values(linkedTracks).some((targets) => targets.includes(track.id))
  );

  const hasSubArtistLink = Boolean(
    showSubArtistUnderTitle && track.artist && track.artist !== 'Unknown Artist'
  );

  const searchQuery = usePlayerStore((s) => s.searchQuery);

  const matchedLyricSnippet = useMemo(() => {
    if (!searchQuery || !searchQuery.trim() || !track.unsynced_lyrics) return null;
    const q = searchQuery.trim().toLowerCase();
    // Do not brand with lyrics match if the song title, artist, or album matches the query
    if (track.title?.toLowerCase().includes(q)) return null;
    if (track.artist?.toLowerCase().includes(q)) return null;
    if (track.album?.toLowerCase().includes(q)) return null;

    const lines = track.unsynced_lyrics.split(/\r?\n/);
    for (const rawLine of lines) {
      const clean = rawLine.replace(/\[\d+:\d+(\.\d+)?\]/g, '').trim();
      if (clean && clean.toLowerCase().includes(q)) {
        return clean;
      }
    }
    return null;
  }, [searchQuery, track.unsynced_lyrics, track.title, track.artist, track.album]);

  return (
    <div
      draggable={Boolean(track.id)}
      onDragStart={(e) => handleTrackDragStart(e, track)}
      onClick={(e) => handleCellClick(e, track)}
      onContextMenu={(e) => handleCellContextMenu(e, track)}
      className="flex flex-col justify-center h-full min-w-0 pr-2 w-full select-none cursor-grab active:cursor-grabbing"
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement)?.closest('a') || (e.target as HTMLElement)?.closest('button')) return;
        const evt = new CustomEvent('prism-play-track', {
          bubbles: true,
          detail: { track },
        });
        e.currentTarget.dispatchEvent(evt);
      }}
    >
      {matchedLyricSnippet && (
        <span
          className="text-[10px] text-zinc-400 font-medium tracking-tight truncate leading-tight select-none mb-0.5"
          title={`Lyrics match: "${matchedLyricSnippet}"`}
        >
          Lyrics match
        </span>
      )}

      <div className="flex items-center gap-1.5 min-w-0">
        <span
          title={title}
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
              : track.missing_since
              ? { color: '#a1a1aa' }
              : { color: '#ffffff' }
          }
        >
          {title}
        </span>
        {isLinked && (
          <span
            className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold border shrink-0 leading-tight gap-1"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
              borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
              color: 'var(--color-stop-1, #6366f1)',
            }}
            title="Linked song pair (queues together in shuffle & transitions gaplessly)"
          >
            <Link2 className="w-2.5 h-2.5" />
            <span>Linked</span>
          </span>
        )}
        {track.missing_since && (
          <span
            className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold border shrink-0 leading-tight"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-stop-3, #ec4899) 20%, transparent)',
              borderColor: 'color-mix(in srgb, var(--color-stop-3, #ec4899) 40%, transparent)',
              color: 'var(--color-stop-3, #ec4899)',
            }}
            title="Audio file is currently missing on disk (retained for 24h before automatic deletion)"
          >
            Missing
          </span>
        )}
      </div>

      {showSubArtistUnderTitle && (
        <div className="flex items-center min-w-0 leading-none -mt-0.5">
          {hasSubArtistLink ? (
            <span
              title={track.artist}
              onClick={(e) => {
                e.stopPropagation();
                usePlayerStore.getState().navigateToArtist(track.artist);
              }}
              className={`text-zinc-400 truncate hover:underline hover:text-indigo-400 cursor-pointer shrink-0 max-w-full leading-tight ${
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

const ArtistCell: React.FC<any> = ({ model }) => {
  const track = (model || {}) as Track;
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track.id) return null;

  const hasArtistLink = Boolean(track.artist && track.artist !== 'Unknown Artist');

  return (
    <div
      draggable={Boolean(track.id)}
      onDragStart={(e) => handleTrackDragStart(e, track)}
      onClick={(e) => handleCellClick(e, track)}
      onContextMenu={(e) => handleCellContextMenu(e, track)}
      className="flex items-center h-full w-full min-w-0 overflow-hidden cursor-grab active:cursor-grabbing"
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement)?.closest('a') || (e.target as HTMLElement)?.closest('button')) return;
        const evt = new CustomEvent('prism-play-track', {
          bubbles: true,
          detail: { track },
        });
        e.currentTarget.dispatchEvent(evt);
      }}
    >
      {hasArtistLink ? (
        <span
          title={track.artist}
          onClick={(e) => {
            e.stopPropagation();
            usePlayerStore.getState().navigateToArtist(track.artist);
          }}
          className={`truncate text-zinc-300 hover:underline hover:text-indigo-400 cursor-pointer shrink-0 max-w-full ${
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

const AlbumCell: React.FC<any> = ({ model }) => {
  const track = (model || {}) as Track;
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track.id) return null;

  const hasAlbumLink = Boolean(track.album && track.album !== 'Unknown Album');

  return (
    <div
      draggable={Boolean(track.id)}
      onDragStart={(e) => handleTrackDragStart(e, track)}
      onClick={(e) => handleCellClick(e, track)}
      onContextMenu={(e) => handleCellContextMenu(e, track)}
      className="flex items-center h-full w-full min-w-0 overflow-hidden cursor-grab active:cursor-grabbing"
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement)?.closest('a') || (e.target as HTMLElement)?.closest('button')) return;
        const evt = new CustomEvent('prism-play-track', {
          bubbles: true,
          detail: { track },
        });
        e.currentTarget.dispatchEvent(evt);
      }}
    >
      {hasAlbumLink ? (
        <span
          title={track.album}
          onClick={(e) => {
            e.stopPropagation();
            usePlayerStore.getState().navigateToAlbum(track.album);
          }}
          className={`truncate text-zinc-400 hover:underline hover:text-indigo-400 cursor-pointer shrink-0 max-w-full ${
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

const DateCell: React.FC<any> = ({ model }) => {
  const track = (model || {}) as Track;
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track.id) return null;

  return (
    <div
      draggable={Boolean(track.id)}
      onDragStart={(e) => handleTrackDragStart(e, track)}
      onClick={(e) => handleCellClick(e, track)}
      onContextMenu={(e) => handleCellContextMenu(e, track)}
      className="flex items-center h-full w-full min-w-0 cursor-grab active:cursor-grabbing"
      onDoubleClick={() => {
        const evt = new CustomEvent('prism-play-track', {
          bubbles: true,
          detail: { track },
        });
        window.dispatchEvent(evt);
      }}
    >
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

const GenreCell: React.FC<any> = ({ model }) => {
  const track = (model || {}) as Track;
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track.id) return null;

  return (
    <div
      draggable={Boolean(track.id)}
      onDragStart={(e) => handleTrackDragStart(e, track)}
      onClick={(e) => handleCellClick(e, track)}
      onContextMenu={(e) => handleCellContextMenu(e, track)}
      className="flex items-center h-full w-full min-w-0 cursor-grab active:cursor-grabbing"
      onDoubleClick={() => {
        const evt = new CustomEvent('prism-play-track', {
          bubbles: true,
          detail: { track },
        });
        window.dispatchEvent(evt);
      }}
    >
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

const DurationCell: React.FC<any> = ({ model }) => {
  const track = (model || {}) as Track;
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track.id) return null;

  return (
    <div
      draggable={Boolean(track.id)}
      onDragStart={(e) => handleTrackDragStart(e, track)}
      onClick={(e) => handleCellClick(e, track)}
      onContextMenu={(e) => handleCellContextMenu(e, track)}
      className="flex items-center justify-end h-full w-full pr-2 cursor-grab active:cursor-grabbing"
      onDoubleClick={() => {
        const evt = new CustomEvent('prism-play-track', {
          bubbles: true,
          detail: { track },
        });
        window.dispatchEvent(evt);
      }}
    >
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

const BitrateCell: React.FC<any> = ({ model }) => {
  const track = (model || {}) as Track;
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track.id) return null;

  return (
    <div
      draggable={Boolean(track.id)}
      onDragStart={(e) => handleTrackDragStart(e, track)}
      onClick={(e) => handleCellClick(e, track)}
      onContextMenu={(e) => handleCellContextMenu(e, track)}
      className="flex items-center h-full w-full min-w-0 cursor-grab active:cursor-grabbing"
      onDoubleClick={() => {
        const evt = new CustomEvent('prism-play-track', {
          bubbles: true,
          detail: { track },
        });
        window.dispatchEvent(evt);
      }}
    >
      <span
        className={`font-mono text-zinc-400 truncate ${
          trackGridDensity === 'massive'
            ? 'text-base'
            : trackGridDensity === 'huge'
            ? 'text-sm'
            : 'text-xs'
        }`}
      >
        {track.bit_rate_kbps ? `${track.bit_rate_kbps} kbps` : '—'}
      </span>
    </div>
  );
};

const SampleRateCell: React.FC<any> = ({ model }) => {
  const track = (model || {}) as Track;
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track.id) return null;

  return (
    <div
      draggable={Boolean(track.id)}
      onDragStart={(e) => handleTrackDragStart(e, track)}
      onClick={(e) => handleCellClick(e, track)}
      onContextMenu={(e) => handleCellContextMenu(e, track)}
      className="flex items-center h-full w-full min-w-0 cursor-grab active:cursor-grabbing"
      onDoubleClick={() => {
        const evt = new CustomEvent('prism-play-track', {
          bubbles: true,
          detail: { track },
        });
        window.dispatchEvent(evt);
      }}
    >
      <span
        className={`font-mono text-zinc-400 truncate ${
          trackGridDensity === 'massive'
            ? 'text-base'
            : trackGridDensity === 'huge'
            ? 'text-sm'
            : 'text-xs'
        }`}
      >
        {track.sample_rate ? `${(track.sample_rate / 1000).toFixed(1)} kHz` : '—'}
      </span>
    </div>
  );
};

const BitDepthCell: React.FC<any> = ({ model }) => {
  const track = (model || {}) as Track;
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track.id) return null;

  return (
    <div
      draggable={Boolean(track.id)}
      onDragStart={(e) => handleTrackDragStart(e, track)}
      onClick={(e) => handleCellClick(e, track)}
      onContextMenu={(e) => handleCellContextMenu(e, track)}
      className="flex items-center h-full w-full min-w-0 cursor-grab active:cursor-grabbing"
      onDoubleClick={() => {
        const evt = new CustomEvent('prism-play-track', {
          bubbles: true,
          detail: { track },
        });
        window.dispatchEvent(evt);
      }}
    >
      <span
        className={`font-mono text-zinc-400 truncate ${
          trackGridDensity === 'massive'
            ? 'text-base'
            : trackGridDensity === 'huge'
            ? 'text-sm'
            : 'text-xs'
        }`}
      >
        {track.bit_depth ? `${track.bit_depth}-bit` : '—'}
      </span>
    </div>
  );
};

const FavoriteCell: React.FC<any> = ({ model }) => {
  const track = (model || {}) as Track;
  const isLiked = usePlayerStore((s) => s.likedTrackIds.includes(track?.id));
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track.id) return null;

  const config = ACTION_DENSITY_CONFIG[trackGridDensity] || ACTION_DENSITY_CONFIG.normal;

  return (
    <div className="w-full h-full flex items-center justify-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const store = usePlayerStore.getState();
          const selectedTrackIds = store.selectedTrackIds || [];
          if (selectedTrackIds.includes(track.id) && selectedTrackIds.length > 1) {
            const allLiked = selectedTrackIds.every((id) => store.likedTrackIds.includes(id));
            store.likeMultipleTracks(selectedTrackIds, !allLiked);
          } else {
            store.toggleLikeTrack(track.id);
          }
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        className={`${config.buttonClass} rounded-lg transition-all cursor-pointer flex items-center justify-center ${
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

const PlayNextCell: React.FC<any> = ({ model }) => {
  const track = (model || {}) as Track;
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track.id) return null;

  const config = ACTION_DENSITY_CONFIG[trackGridDensity] || ACTION_DENSITY_CONFIG.normal;

  return (
    <div className="w-full h-full flex items-center justify-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const store = usePlayerStore.getState();
          const selectedTrackIds = store.selectedTrackIds || [];
          const allTracks = store.tracks || [];
          if (selectedTrackIds.includes(track.id) && selectedTrackIds.length > 1) {
            const selectedTracks = selectedTrackIds
              .map((id) => allTracks.find((t) => t.id === id) || (track.id === id ? track : null))
              .filter((t): t is Track => Boolean(t));
            store.playNextTracks(selectedTracks);
          } else {
            store.playNext(track);
          }
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        className={`${config.buttonClass} rounded-lg text-zinc-400 opacity-0 group-hover/row:opacity-100 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center justify-center`}
        title="Play Next"
      >
        <ListPlus className={config.iconClass} />
      </button>
    </div>
  );
};

const AddToQueueCell: React.FC<any> = ({ model }) => {
  const track = (model || {}) as Track;
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track.id) return null;

  const config = ACTION_DENSITY_CONFIG[trackGridDensity] || ACTION_DENSITY_CONFIG.normal;

  return (
    <div className="w-full h-full flex items-center justify-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const store = usePlayerStore.getState();
          const selectedTrackIds = store.selectedTrackIds || [];
          const allTracks = store.tracks || [];
          if (selectedTrackIds.includes(track.id) && selectedTrackIds.length > 1) {
            const selectedTracks = selectedTrackIds
              .map((id) => allTracks.find((t) => t.id === id) || (track.id === id ? track : null))
              .filter((t): t is Track => Boolean(t));
            store.addTracksToQueue(selectedTracks);
          } else {
            store.addToQueue(track);
          }
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        className={`${config.buttonClass} rounded-lg text-zinc-400 opacity-0 group-hover/row:opacity-100 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center justify-center`}
        title="Add to Queue"
      >
        <ListEnd className={config.iconClass} />
      </button>
    </div>
  );
};

const AddToPlaylistCell: React.FC<any> = ({ model }) => {
  const track = (model || {}) as Track;
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track.id) return null;

  const config = ACTION_DENSITY_CONFIG[trackGridDensity] || ACTION_DENSITY_CONFIG.normal;

  return (
    <div className="w-full h-full flex items-center justify-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          const store = usePlayerStore.getState();
          const selectedTrackIds = store.selectedTrackIds || [];
          const allTracks = store.tracks || [];
          let contextTracks: Track[] = [track];
          if (selectedTrackIds.includes(track.id) && selectedTrackIds.length > 1) {
            contextTracks = selectedTrackIds
              .map((id) => allTracks.find((t) => t.id === id) || (track.id === id ? track : null))
              .filter((t): t is Track => Boolean(t));
          }
          const evt = new CustomEvent('prism-open-context-menu', {
            bubbles: true,
            detail: { x: rect.left, y: rect.bottom + 4, tracks: contextTracks, openPlaylistSubmenu: true },
          });
          e.currentTarget.dispatchEvent(evt);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        className={`${config.buttonClass} rounded-lg text-zinc-400 opacity-0 group-hover/row:opacity-100 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center justify-center`}
        title="Add to Playlist"
      >
        <PlusCircle className={config.iconClass} />
      </button>
    </div>
  );
};

const ActionsCell: React.FC<any> = ({ model }) => {
  const track = (model || {}) as Track;
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track.id) return null;

  const config = ACTION_DENSITY_CONFIG[trackGridDensity] || ACTION_DENSITY_CONFIG.normal;

  return (
    <div className="w-full h-full flex items-center justify-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          const store = usePlayerStore.getState();
          const selectedTrackIds = store.selectedTrackIds || [];
          const allTracks = store.tracks || [];
          let contextTracks: Track[] = [track];
          if (selectedTrackIds.includes(track.id) && selectedTrackIds.length > 1) {
            contextTracks = selectedTrackIds
              .map((id) => allTracks.find((t) => t.id === id) || (track.id === id ? track : null))
              .filter((t): t is Track => Boolean(t));
          }
          const evt = new CustomEvent('prism-open-context-menu', {
            bubbles: true,
            detail: { x: rect.left, y: rect.bottom + 4, tracks: contextTracks },
          });
          e.currentTarget.dispatchEvent(evt);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        className={`${config.buttonClass} rounded-lg text-zinc-400 opacity-0 group-hover/row:opacity-100 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center justify-center`}
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
  autoHeight = false,
}) => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const likedTrackIds = usePlayerStore((s) => s.likedTrackIds);
  const toggleLikeTrack = usePlayerStore((s) => s.toggleLikeTrack);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const playNext = usePlayerStore((s) => s.playNext);
  const setInfoModalTrack = usePlayerStore((s) => s.setInfoModalTrack);
  const playlists = usePlayerStore((s) => s.playlists);
  const addTracksToPlaylist = usePlayerStore((s) => s.addTracksToPlaylist);
  const createPlaylist = usePlayerStore((s) => s.createPlaylist);
  const activeTab = usePlayerStore((s) => s.activeTab);
  const linkTracks = usePlayerStore((s) => s.linkTracks);
  const unlinkTrack = usePlayerStore((s) => s.unlinkTrack);

  // Multi-Selection state & actions
  const selectedTrackIds = usePlayerStore((s) => s.selectedTrackIds);
  const selectSingleTrack = usePlayerStore((s) => s.selectSingleTrack);
  const toggleSelectTrack = usePlayerStore((s) => s.toggleSelectTrack);
  const selectTrackRange = usePlayerStore((s) => s.selectTrackRange);
  const selectAllTracks = usePlayerStore((s) => s.selectAllTracks);
  const clearSelection = usePlayerStore((s) => s.clearSelection);
  const addTracksToQueue = usePlayerStore((s) => s.addTracksToQueue);
  const playNextTracks = usePlayerStore((s) => s.playNextTracks);
  const likeMultipleTracks = usePlayerStore((s) => s.likeMultipleTracks);
  const removeTracksFromPlaylistStore = usePlayerStore((s) => s.removeTracksFromPlaylist);

  const {
    visibleTrackColumns,
    trackGridDensity,
    showSubArtistUnderTitle,
    resetGrid,
    setTrackGridDensity,
    setShowSubArtistUnderTitle,
    columnOrder,
    setColumnOrder,
    setVisibleTrackColumns,
    columnWidths,
    saveColumnWidths,
  } = useTrackTableState();

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [newPlaylistTracks, setNewPlaylistTracks] = useState<Track[] | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tracks: Track[];
    openPlaylistSubmenu?: boolean;
  } | null>(null);
  const [playlistSubmenuOpen, setPlaylistSubmenuOpen] = useState(false);
  const playlistSubmenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePlaylistSubmenuEnter = useCallback(() => {
    if (playlistSubmenuTimerRef.current) {
      clearTimeout(playlistSubmenuTimerRef.current);
      playlistSubmenuTimerRef.current = null;
    }
    setPlaylistSubmenuOpen(true);
  }, []);

  const handlePlaylistSubmenuLeave = useCallback(() => {
    if (playlistSubmenuTimerRef.current) {
      clearTimeout(playlistSubmenuTimerRef.current);
    }
    playlistSubmenuTimerRef.current = setTimeout(() => {
      setPlaylistSubmenuOpen(false);
    }, 250);
  }, []);

  useEffect(() => {
    return () => {
      if (playlistSubmenuTimerRef.current) {
        clearTimeout(playlistSubmenuTimerRef.current);
      }
    };
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<any>(null);
  const lastScrollYRef = useRef<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return Math.max(400, window.innerWidth - 320);
    }
    return 1200;
  });
  const [sortState, setSortState] = useState<{ prop: string; order: 'asc' | 'desc' } | null>(null);

  const searchQuery = usePlayerStore((s) => s.searchQuery);
  const isSearchActive = Boolean(searchQuery && searchQuery.trim());

  const gridKey = useMemo(() => {
    return `rg-${containerWidth}-${trackGridDensity}-${visibleTrackColumns.length}-${columnOrder.join(',')}-${isSearchActive ? 'search' : 'all'}`;
  }, [containerWidth, trackGridDensity, visibleTrackColumns.length, columnOrder, isSearchActive]);

  // Synchronize RevoGrid sorting lifecycle with React state to maintain and toggle sort orders correctly
  useEffect(() => {
    const gridEl = gridRef.current;
    if (!gridEl) return;

    const handleBeforeSorting = (e: any) => {
      const { column, order } = e.detail || {};
      if (column?.prop) {
        if (order === 'asc' || order === 'desc') {
          setSortState({ prop: column.prop, order });
        } else {
          setSortState(null);
        }
      }
    };

    const handleAfterSortingApply = (e: any) => {
      const sorting = e.detail?.sorting;
      if (sorting && typeof sorting === 'object') {
        const prop = Object.keys(sorting)[0];
        const order = sorting[prop];
        if (prop && (order === 'asc' || order === 'desc')) {
          setSortState({ prop, order });
          return;
        }
      }
      setSortState(null);
    };

    const handleViewportScroll = (e: any) => {
      if (e?.detail?.dimension === 'rgRow' && typeof e.detail.coordinate === 'number') {
        lastScrollYRef.current = e.detail.coordinate;
      }
    };

    gridEl.addEventListener('beforesorting', handleBeforeSorting);
    gridEl.addEventListener('aftersortingapply', handleAfterSortingApply);
    gridEl.addEventListener('viewportscroll', handleViewportScroll);
    return () => {
      gridEl.removeEventListener('beforesorting', handleBeforeSorting);
      gridEl.removeEventListener('aftersortingapply', handleAfterSortingApply);
      gridEl.removeEventListener('viewportscroll', handleViewportScroll);
    };
  }, [gridKey]);

  // Restore vertical scroll position after grid remounts on window/container resize
  useEffect(() => {
    if (lastScrollYRef.current > 0 && gridRef.current) {
      const timer = setTimeout(() => {
        gridRef.current?.scrollToCoordinate?.({ y: lastScrollYRef.current });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [gridKey]);

  // Track container width via ResizeObserver, window resize, and Tauri window events
  useEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (el && el.clientWidth > 0) {
        const w = Math.round(el.clientWidth);
        setContainerWidth((prev) => (Math.abs(prev - w) > 2 ? w : prev));
      } else if (typeof window !== 'undefined') {
        const fallback = Math.max(400, window.innerWidth - 320);
        setContainerWidth((prev) => (Math.abs(prev - fallback) > 2 ? fallback : prev));
      }
    };

    measure();

    const el = containerRef.current;
    let ro: ResizeObserver | null = null;
    if (el) {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w > 0) {
            const rounded = Math.round(w);
            setContainerWidth((prev) => (Math.abs(prev - rounded) > 2 ? rounded : prev));
          }
        }
      });
      ro.observe(el);
    }

    const handleResize = () => {
      measure();
      requestAnimationFrame(measure);
    };

    window.addEventListener('resize', handleResize);

    let unlistenTauri: (() => void) | undefined;
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      getCurrentWindow()
        .onResized(() => {
          handleResize();
        })
        .then((unlisten) => {
          unlistenTauri = unlisten;
        })
        .catch(() => {});
    }

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', handleResize);
      if (unlistenTauri) unlistenTauri();
    };
  }, [tracks.length === 0]);

  // Listen to custom events bubbled up from RevoGrid cell templates
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleOpenMenu = (e: Event) => {
      const customEvt = e as CustomEvent<{
        x: number;
        y: number;
        track?: Track;
        tracks?: Track[];
        openPlaylistSubmenu?: boolean;
      }>;
      if (customEvt.detail) {
        const menuTracks =
          customEvt.detail.tracks || (customEvt.detail.track ? [customEvt.detail.track] : []);
        if (menuTracks.length > 0) {
          setContextMenu({
            x: customEvt.detail.x,
            y: customEvt.detail.y,
            tracks: menuTracks,
            openPlaylistSubmenu: customEvt.detail.openPlaylistSubmenu,
          });
          setPlaylistSubmenuOpen(Boolean(customEvt.detail.openPlaylistSubmenu));
        }
      }
    };

    const handlePlayTrackEvt = (e: Event) => {
      const customEvt = e as CustomEvent<{ track: Track }>;
      if (customEvt.detail?.track) {
        playTrack(customEvt.detail.track, tracks);
      }
    };

    const handleRowSelectEvt = (e: Event) => {
      const customEvt = e as CustomEvent<{
        track: Track;
        shiftKey: boolean;
        ctrlKey: boolean;
      }>;
      if (customEvt.detail?.track) {
        const { track, shiftKey, ctrlKey } = customEvt.detail;
        if (shiftKey) {
          selectTrackRange(track.id, tracks, ctrlKey);
        } else if (ctrlKey) {
          toggleSelectTrack(track.id);
        } else {
          selectSingleTrack(track.id);
        }
      }
    };

    container.addEventListener('prism-open-context-menu', handleOpenMenu);
    container.addEventListener('prism-play-track', handlePlayTrackEvt);
    container.addEventListener('prism-row-select', handleRowSelectEvt);

    return () => {
      container.removeEventListener('prism-open-context-menu', handleOpenMenu);
      container.removeEventListener('prism-play-track', handlePlayTrackEvt);
      container.removeEventListener('prism-row-select', handleRowSelectEvt);
    };
  }, [playTrack, tracks, selectTrackRange, toggleSelectTrack, selectSingleTrack]);

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

  // Cell Template instances memoized
  const orderCellTemplate = useMemo(() => createReactCellTemplate(OrderCell), []);
  const artCellTemplate = useMemo(() => createReactCellTemplate(TrackArtCell), []);
  const titleCellTemplate = useMemo(() => createReactCellTemplate(TitleCell), []);
  const artistCellTemplate = useMemo(() => createReactCellTemplate(ArtistCell), []);
  const albumCellTemplate = useMemo(() => createReactCellTemplate(AlbumCell), []);
  const dateCellTemplate = useMemo(() => createReactCellTemplate(DateCell), []);
  const genreCellTemplate = useMemo(() => createReactCellTemplate(GenreCell), []);
  const durationCellTemplate = useMemo(() => createReactCellTemplate(DurationCell), []);
  const bitrateCellTemplate = useMemo(() => createReactCellTemplate(BitrateCell), []);
  const sampleRateCellTemplate = useMemo(() => createReactCellTemplate(SampleRateCell), []);
  const bitDepthCellTemplate = useMemo(() => createReactCellTemplate(BitDepthCell), []);
  const columnHeaderTemplate = useMemo(() => createReactCellTemplate(ColumnHeader), [sortState]);
  const favoriteCellTemplate = useMemo(() => createReactCellTemplate(FavoriteCell), []);
  const playNextCellTemplate = useMemo(() => createReactCellTemplate(PlayNextCell), []);
  const addToQueueCellTemplate = useMemo(() => createReactCellTemplate(AddToQueueCell), []);
  const addToPlaylistCellTemplate = useMemo(() => createReactCellTemplate(AddToPlaylistCell), []);
  const actionsCellTemplate = useMemo(() => createReactCellTemplate(ActionsCell), []);

  // Ordered visible column IDs: order and art are pinned start, all other columns follow columnOrder
  const orderedVisibleColumnIds = useMemo(() => {
    const isVisible = (id: TrackColumnId) => visibleTrackColumns.includes(id);
    const pinnedStartIds: TrackColumnId[] = ['order', 'art'];
    const effectiveOrder = columnOrder && columnOrder.length > 0 ? columnOrder : DEFAULT_COLUMN_ORDER;

    const left: TrackColumnId[] = pinnedStartIds.filter(isVisible);
    const middle: TrackColumnId[] = effectiveOrder.filter(
      (id) => !pinnedStartIds.includes(id) && isVisible(id)
    );

    const allOtherIds: TrackColumnId[] = [
      'title',
      'artist',
      'album',
      'date',
      'genre',
      'duration',
      'bitrate',
      'sampleRate',
      'bitDepth',
      'favorite',
      'playNext',
      'addToQueue',
      'addToPlaylist',
      'actions',
    ];
    allOtherIds.forEach((id) => {
      if (!middle.includes(id) && isVisible(id)) {
        middle.push(id);
      }
    });

    return [...left, ...middle];
  }, [visibleTrackColumns, columnOrder]);

  // Helper to ensure spacer padding rows always stay at the very bottom during column sorts
  const createSpacerAwareCompare = useCallback((prop: string) => {
    return function (this: { order?: 'asc' | 'desc'; column?: any }, propOrA: any, aOrB: any, bOrUndefined?: any) {
      const itemA = bOrUndefined !== undefined ? aOrB : propOrA;
      const itemB = bOrUndefined !== undefined ? bOrUndefined : aOrB;
      const propName = typeof propOrA === 'string' ? propOrA : prop;
      const isDesc = this?.order === 'desc';

      if (itemA?.__isSpacer && itemB?.__isSpacer) return 0;
      if (itemA?.__isSpacer) return isDesc ? -1 : 1;
      if (itemB?.__isSpacer) return isDesc ? 1 : -1;

      const aVal = itemA?.[propName];
      const bVal = itemB?.[propName];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return aVal - bVal;
      }
      return String(aVal ?? '').toLowerCase().localeCompare(String(bVal ?? '').toLowerCase(), undefined, { numeric: true });
    };
  }, []);

  // Column definitions with fractional auto-sizing and strict layout boundaries
  const columns: ColumnRegular[] = useMemo(() => {
    const availableWidth = containerWidth - 14;
    const widths = calculateColumnWidths(
      availableWidth,
      visibleTrackColumns,
      trackGridDensity,
      columnWidths
    );

    const colMap: Record<TrackColumnId, ColumnRegular> = {
      order: {
        prop: 'order',
        name: '#',
        readonly: true,
        size: widths.order,
        minSize: MIN_COLUMN_WIDTHS.order,
        sortable: true,
        order: sortState?.prop === 'order' ? sortState.order : undefined,
        filter: false,
        columnTemplate: columnHeaderTemplate,
        cellTemplate: orderCellTemplate,
        cellCompare: createSpacerAwareCompare('order'),
      },
      art: {
        prop: 'art',
        name: '',
        readonly: true,
        size: widths.art,
        minSize: MIN_COLUMN_WIDTHS.art,
        sortable: false,
        filter: false,
        cellTemplate: artCellTemplate,
      },
      title: {
        prop: 'title',
        name: 'Title',
        readonly: true,
        size: widths.title,
        minSize: MIN_COLUMN_WIDTHS.title,
        sortable: true,
        order: sortState?.prop === 'title' ? sortState.order : undefined,
        filter: false,
        columnTemplate: columnHeaderTemplate,
        cellTemplate: titleCellTemplate,
        cellCompare: createSpacerAwareCompare('title'),
      },
      artist: {
        prop: 'artist',
        name: 'Artist',
        readonly: true,
        size: widths.artist,
        minSize: MIN_COLUMN_WIDTHS.artist,
        sortable: true,
        order: sortState?.prop === 'artist' ? sortState.order : undefined,
        filter: false,
        columnTemplate: columnHeaderTemplate,
        cellTemplate: artistCellTemplate,
        cellCompare: createSpacerAwareCompare('artist'),
      },
      album: {
        prop: 'album',
        name: 'Album',
        readonly: true,
        size: widths.album,
        minSize: MIN_COLUMN_WIDTHS.album,
        sortable: true,
        order: sortState?.prop === 'album' ? sortState.order : undefined,
        filter: false,
        columnTemplate: columnHeaderTemplate,
        cellTemplate: albumCellTemplate,
        cellCompare: createSpacerAwareCompare('album'),
      },
      date: {
        prop: 'year',
        name: 'Date',
        readonly: true,
        size: widths.date,
        minSize: MIN_COLUMN_WIDTHS.date,
        sortable: true,
        order: sortState?.prop === 'year' ? sortState.order : undefined,
        filter: false,
        columnTemplate: columnHeaderTemplate,
        cellTemplate: dateCellTemplate,
        cellCompare: createSpacerAwareCompare('year'),
      },
      genre: {
        prop: 'genre',
        name: 'Genre',
        readonly: true,
        size: widths.genre,
        minSize: MIN_COLUMN_WIDTHS.genre,
        sortable: true,
        order: sortState?.prop === 'genre' ? sortState.order : undefined,
        filter: false,
        columnTemplate: columnHeaderTemplate,
        cellTemplate: genreCellTemplate,
        cellCompare: createSpacerAwareCompare('genre'),
      },
      duration: {
        prop: 'duration_secs',
        name: 'Duration',
        readonly: true,
        size: widths.duration,
        minSize: MIN_COLUMN_WIDTHS.duration,
        sortable: true,
        order: sortState?.prop === 'duration_secs' ? sortState.order : undefined,
        filter: false,
        columnTemplate: columnHeaderTemplate,
        cellTemplate: durationCellTemplate,
        cellCompare: createSpacerAwareCompare('duration_secs'),
      },
      bitrate: {
        prop: 'bit_rate_kbps',
        name: 'Bitrate',
        readonly: true,
        size: widths.bitrate,
        minSize: MIN_COLUMN_WIDTHS.bitrate,
        sortable: true,
        order: sortState?.prop === 'bit_rate_kbps' ? sortState.order : undefined,
        filter: false,
        columnTemplate: columnHeaderTemplate,
        cellTemplate: bitrateCellTemplate,
        cellCompare: createSpacerAwareCompare('bit_rate_kbps'),
      },
      sampleRate: {
        prop: 'sample_rate',
        name: 'Sample Rate',
        readonly: true,
        size: widths.sampleRate,
        minSize: MIN_COLUMN_WIDTHS.sampleRate,
        sortable: true,
        order: sortState?.prop === 'sample_rate' ? sortState.order : undefined,
        filter: false,
        columnTemplate: columnHeaderTemplate,
        cellTemplate: sampleRateCellTemplate,
        cellCompare: createSpacerAwareCompare('sample_rate'),
      },
      bitDepth: {
        prop: 'bit_depth',
        name: 'Bit Depth',
        readonly: true,
        size: widths.bitDepth,
        minSize: MIN_COLUMN_WIDTHS.bitDepth,
        sortable: true,
        order: sortState?.prop === 'bit_depth' ? sortState.order : undefined,
        filter: false,
        columnTemplate: columnHeaderTemplate,
        cellTemplate: bitDepthCellTemplate,
        cellCompare: createSpacerAwareCompare('bit_depth'),
      },
      favorite: {
        prop: 'favorite',
        name: '',
        readonly: true,
        size: widths.favorite,
        minSize: MIN_COLUMN_WIDTHS.favorite,
        sortable: false,
        filter: false,
        cellTemplate: favoriteCellTemplate,
      },
      playNext: {
        prop: 'playNext',
        name: '',
        readonly: true,
        size: widths.playNext,
        minSize: MIN_COLUMN_WIDTHS.playNext,
        sortable: false,
        filter: false,
        cellTemplate: playNextCellTemplate,
      },
      addToQueue: {
        prop: 'addToQueue',
        name: '',
        readonly: true,
        size: widths.addToQueue,
        minSize: MIN_COLUMN_WIDTHS.addToQueue,
        sortable: false,
        filter: false,
        cellTemplate: addToQueueCellTemplate,
      },
      addToPlaylist: {
        prop: 'addToPlaylist',
        name: '',
        readonly: true,
        size: widths.addToPlaylist,
        minSize: MIN_COLUMN_WIDTHS.addToPlaylist,
        sortable: false,
        filter: false,
        cellTemplate: addToPlaylistCellTemplate,
      },
      actions: {
        prop: 'actions',
        name: '',
        readonly: true,
        size: widths.actions,
        minSize: MIN_COLUMN_WIDTHS.actions,
        sortable: false,
        filter: false,
        cellTemplate: actionsCellTemplate,
      },
    };

    return orderedVisibleColumnIds.map((id) => colMap[id]).filter(Boolean);
  }, [
    orderedVisibleColumnIds,
    containerWidth,
    visibleTrackColumns,
    trackGridDensity,
    columnWidths,
    sortState,
    createSpacerAwareCompare,
    columnHeaderTemplate,
    orderCellTemplate,
    artCellTemplate,
    titleCellTemplate,
    artistCellTemplate,
    albumCellTemplate,
    dateCellTemplate,
    genreCellTemplate,
    durationCellTemplate,
    favoriteCellTemplate,
    playNextCellTemplate,
    addToQueueCellTemplate,
    addToPlaylistCellTemplate,
    actionsCellTemplate,
  ]);

  // Explicitly update grid instance columns when column sizing/structure changes
  useEffect(() => {
    if (gridRef.current?.updateColumns && columns.length > 0) {
      gridRef.current.updateColumns(columns);
    }
  }, [columns]);

  // Data source for RevoGrid with current-playing row classes and bottom padding spacer rows
  const source = useMemo(() => {
    if (tracks.length === 0) return [];
    const baseSource = tracks.map((track, idx) => ({
      ...track,
      order: idx + 1,
      rowIndex: idx,
      rowClass: `group/row select-none ${currentTrack?.id === track.id ? 'is-current-playing' : ''} ${
        selectedTrackIds.includes(track.id) ? 'is-selected-row' : ''
      }`,
    }));

    if (autoHeight) {
      return baseSource;
    }

    // Add 2 padding spacer rows at the bottom so the last track is never cut off
    // and user can scroll 1-2 row heights deeper than there are songs
    const spacerRows = [
      {
        id: `__spacer_1_${tracks.length}`,
        title: ' ',
        artist: ' ',
        album: ' ',
        duration_secs: 0,
        year: null,
        genre: '',
        order: 999999999,
        rowIndex: -1,
        __isSpacer: true,
        rowClass: 'spacer-row pointer-events-none opacity-0 select-none !bg-transparent border-none',
      },
      {
        id: `__spacer_2_${tracks.length}`,
        title: ' ',
        artist: ' ',
        album: ' ',
        duration_secs: 0,
        year: null,
        genre: '',
        order: 999999999,
        rowIndex: -1,
        __isSpacer: true,
        rowClass: 'spacer-row pointer-events-none opacity-0 select-none !bg-transparent border-none',
      },
    ];

    return [...baseSource, ...spacerRows];
  }, [tracks, currentTrack?.id, selectedTrackIds, autoHeight]);

  // Handle column resizing with strict "brick wall" right boundary constraint
  const onAfterColumnResize = useCallback(
    (e: any) => {
      const detail = e.detail;
      if (!detail || !containerRef.current) return;
      const containerW = containerRef.current.clientWidth;

      let resizedCol: ColumnRegular | null = null;
      if (Array.isArray(detail)) {
        resizedCol = detail[0];
      } else if (typeof detail === 'object') {
        const keys = Object.keys(detail);
        if (keys.length > 0) {
          resizedCol = detail[keys[0]];
        }
      }

      if (resizedCol && resizedCol.prop) {
        let colId: TrackColumnId | null = null;
        if (resizedCol.prop === 'year') colId = 'date';
        else if (resizedCol.prop === 'duration_secs') colId = 'duration';
        else colId = resizedCol.prop as TrackColumnId;

        if (colId) {
          const newWidth = resizedCol.size || DEFAULT_COLUMN_WIDTHS[colId] || 100;
          const currentWidths = calculateColumnWidths(
            containerW,
            visibleTrackColumns,
            trackGridDensity,
            columnWidths
          );
          const { updatedWidths } = enforceBrickWallResize(
            colId,
            newWidth,
            currentWidths,
            orderedVisibleColumnIds,
            containerW
          );
          saveColumnWidths(updatedWidths);
        }
      }
    },
    [visibleTrackColumns, trackGridDensity, columnWidths, orderedVisibleColumnIds, saveColumnWidths]
  );

  // Handle drag-and-drop column reordering and persist order
  useEffect(() => {
    const gridEl = gridRef.current;
    if (!gridEl) return;

    const handleColumnDragEnd = (e: any) => {
      const detail = e.detail;
      if (detail && Array.isArray(detail.columns) && detail.columns.length > 0) {
        const reorderedIds: TrackColumnId[] = detail.columns
          .map((c: any) => PROP_TO_COL_ID[c.prop])
          .filter(Boolean);

        if (reorderedIds.length > 0) {
          const pinnedStart: TrackColumnId[] = ['order', 'art'];
          const remaining = columnOrder.filter(
            (id) => !pinnedStart.includes(id) && !reorderedIds.includes(id)
          );
          const newOrder = [...pinnedStart, ...reorderedIds, ...remaining];
          setColumnOrder(newOrder);
        }
      }
    };

    gridEl.addEventListener('columndragend', handleColumnDragEnd);
    return () => {
      gridEl.removeEventListener('columndragend', handleColumnDragEnd);
    };
  }, [gridKey, columnOrder, setColumnOrder]);

  // Selected tracks resolved from tracks array
  const selectedTracksList = useMemo(() => {
    return selectedTrackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((t): t is Track => Boolean(t));
  }, [selectedTrackIds, tracks]);

  const allSelectedLiked = useMemo(() => {
    if (selectedTrackIds.length === 0) return false;
    return selectedTrackIds.every((id) => likedTrackIds.includes(id));
  }, [selectedTrackIds, likedTrackIds]);

  // Keyboard navigation & Shortcuts
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        selectAllTracks(tracks);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        clearSelection();
        setContextMenu(null);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedTracksList.length > 0) {
          playTrack(selectedTracksList[0], tracks);
        } else if (currentTrack) {
          togglePlay();
        } else if (tracks.length > 0) {
          playTrack(tracks[0], tracks);
        }
        return;
      }

      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        playlistId &&
        selectedTrackIds.length > 0
      ) {
        e.preventDefault();
        if (onRemoveFromPlaylist) {
          selectedTrackIds.forEach((id) => onRemoveFromPlaylist(id));
        } else {
          removeTracksFromPlaylistStore(playlistId, selectedTrackIds);
        }
        clearSelection();
        return;
      }
    },
    [
      currentTrack,
      togglePlay,
      playTrack,
      tracks,
      selectedTracksList,
      selectedTrackIds,
      selectAllTracks,
      clearSelection,
      playlistId,
      onRemoveFromPlaylist,
      removeTracksFromPlaylistStore,
    ]
  );

  const isLikedView = activeTab === 'liked' || playlistId === '__liked__';
  const currentDensityHeight = DENSITY_ROW_HEIGHTS[trackGridDensity] || 56;
  const calculatedHeight = autoHeight && tracks.length > 0 ? 48 + tracks.length * currentDensityHeight : undefined;

  // Batch actions from floating bar
  const handleBatchPlay = () => {
    if (selectedTracksList.length > 0) {
      playTrack(selectedTracksList[0], tracks);
    }
  };

  const handleBatchAddToQueue = () => {
    if (selectedTracksList.length > 0) {
      addTracksToQueue(selectedTracksList);
    }
  };

  const handleBatchPlayNext = () => {
    if (selectedTracksList.length > 0) {
      playNextTracks(selectedTracksList);
    }
  };

  const handleBatchToggleLike = () => {
    if (selectedTrackIds.length > 0) {
      likeMultipleTracks(selectedTrackIds, !allSelectedLiked);
    }
  };

  const handleBatchRemoveFromPlaylist = () => {
    if (playlistId && selectedTrackIds.length > 0) {
      if (onRemoveFromPlaylist) {
        selectedTrackIds.forEach((id) => onRemoveFromPlaylist(id));
      } else if (removeTracksFromPlaylistStore) {
        removeTracksFromPlaylistStore(playlistId, selectedTrackIds);
      }
      clearSelection();
    }
  };

  return (
    <div className={`w-full ${autoHeight ? '' : 'h-full flex-1'} flex flex-col overflow-hidden relative select-none`}>
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
            {selectedTrackIds.length > 0 && (
              <span
                className="px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)',
                  color: 'var(--color-stop-1, #6366f1)',
                  border: '1px solid color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
                }}
              >
                <span>{selectedTrackIds.length} selected</span>
                <button
                  type="button"
                  onClick={() => clearSelection()}
                  className="hover:opacity-75 cursor-pointer ml-0.5"
                  title="Clear Selection"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
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

      {/* Main RevoGrid Container with strict boundary constraints */}
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onClick={(e) => {
          if (
            e.target === containerRef.current ||
            (e.target as HTMLElement)?.classList.contains('main-viewport') ||
            (e.target as HTMLElement)?.classList.contains('content-wrapper')
          ) {
            clearSelection();
          }
        }}
        className={autoHeight ? 'w-full relative outline-none auto-height-grid' : 'flex-1 w-full relative outline-none overflow-hidden'}
        style={calculatedHeight ? { height: `${calculatedHeight}px`, minHeight: `${calculatedHeight}px` } : { minHeight: 0 }}
      >
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3 glass-card rounded-2xl border border-dashed border-white/10 my-4 select-none">
            <div className="w-14 h-14 rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-500">
              {isLikedView ? (
                <Heart className="w-8 h-8 fill-pink-500/20" style={{ color: 'var(--color-stop-1, #ec4899)' }} />
              ) : (
                <Music className="w-8 h-8" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                {isLikedView ? 'No liked songs yet' : 'No tracks available'}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                {isLikedView
                  ? 'Songs you mark as favorite will appear here.'
                  : 'There are no songs to display in this list.'}
              </p>
            </div>
          </div>
        ) : (
          <RevoGrid
            key={gridKey}
            ref={gridRef}
            theme="darkMaterial"
            source={source}
            columns={columns}
            rowSize={currentDensityHeight}
            readonly={true}
            editors={{}}
            resize={true}
            canFocus={true}
            accessible={true}
            filter={false}
            autoSizeColumn={false}
            range={false}
            canMoveColumns={true}
            rowClass="rowClass"
            onAftercolumnresize={onAfterColumnResize}
          />
        )}

        {/* Floating Batch Actions Pill for Multi-Selected Songs */}
        {selectedTrackIds.length > 1 && (
          <div
            className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl shadow-2xl border backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-3 duration-150"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 14%, #121216)',
              borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, rgba(255, 255, 255, 0.15))',
              boxShadow:
                '0 12px 36px -4px rgba(0, 0, 0, 0.8), 0 0 20px color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)',
            }}
          >
            <div className="flex items-center gap-2 pr-2.5 border-r border-white/10 text-xs font-bold text-white">
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
              />
              <span>{selectedTrackIds.length} Songs</span>
            </div>

            <button
              type="button"
              onClick={handleBatchPlay}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer hover:scale-105 active:scale-95"
              title="Play Selection"
            >
              <Play className="w-3.5 h-3.5 fill-current" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
              <span>Play</span>
            </button>

            <button
              type="button"
              onClick={handleBatchAddToQueue}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer hover:scale-105 active:scale-95"
              title="Add to Queue"
            >
              <ListEnd className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
              <span>Queue</span>
            </button>

            <button
              type="button"
              onClick={handleBatchPlayNext}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer hover:scale-105 active:scale-95"
              title="Play Next"
            >
              <ListPlus className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
              <span>Next</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setContextMenu({
                  x: rect.left,
                  y: rect.top - 8,
                  tracks: selectedTracksList,
                  openPlaylistSubmenu: true,
                });
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer hover:scale-105 active:scale-95"
              title="Add to Playlist"
            >
              <PlusCircle className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
              <span>Playlist</span>
            </button>

            <button
              type="button"
              onClick={handleBatchToggleLike}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer hover:scale-105 active:scale-95"
              title={allSelectedLiked ? 'Unlike Selected' : 'Like Selected'}
            >
              <Heart
                className={`w-3.5 h-3.5 ${
                  allSelectedLiked ? 'fill-pink-500 text-pink-500' : 'text-zinc-300'
                }`}
              />
              <span>{allSelectedLiked ? 'Unlike' : 'Like'}</span>
            </button>

            {playlistId && (
              <button
                type="button"
                onClick={handleBatchRemoveFromPlaylist}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-all cursor-pointer hover:scale-105 active:scale-95"
                title="Remove Selected from Playlist"
              >
                <span>Remove</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => clearSelection()}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors ml-0.5 cursor-pointer"
              title="Deselect All (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Context Menu Overlay */}
      {contextMenu && (() => {
        const isMulti = contextMenu.tracks.length > 1;
        const primaryTrack = contextMenu.tracks[0];
        const menuEstimatedHeight = isMulti
          ? 280
          : playlistId && onRemoveFromPlaylist
          ? 360
          : 310;
        const openUpward = contextMenu.y > window.innerHeight - (menuEstimatedHeight + 80);
        const left = Math.min(contextMenu.x, window.innerWidth - 250);
        const isNearRightEdge = left > window.innerWidth - 480;
        const posStyle: React.CSSProperties = openUpward
          ? {
              bottom: Math.max(16, window.innerHeight - contextMenu.y),
              left,
              transformOrigin: 'bottom left',
            }
          : {
              top: Math.min(contextMenu.y, window.innerHeight - 100),
              left,
              transformOrigin: 'top left',
            };

        const handleItemHover = (e: React.MouseEvent<HTMLElement>, isHover: boolean) => {
          e.currentTarget.style.backgroundColor = isHover
            ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 22%, transparent)'
            : '';
        };

        const isLiked = isMulti
          ? contextMenu.tracks.every((t) => likedTrackIds.includes(t.id))
          : likedTrackIds.includes(primaryTrack.id);

        return (
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
                ...posStyle,
                backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 8%, #141416)',
                borderColor:
                  'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, rgba(255, 255, 255, 0.12))',
                boxShadow:
                  '0 12px 36px -4px rgba(0, 0, 0, 0.7), 0 0 16px color-mix(in srgb, var(--color-stop-1, #6366f1) 18%, transparent)',
                backdropFilter: 'blur(24px)',
              }}
              className="fixed z-50 w-56 border rounded-xl p-1.5 flex flex-col gap-1 text-xs text-zinc-300 animate-in fade-in zoom-in-95 duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="px-2.5 py-1 text-[11px] font-bold text-zinc-300 border-b truncate flex items-center justify-between"
                style={{
                  borderColor:
                    'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, rgba(255, 255, 255, 0.08))',
                }}
              >
                <span className="truncate">
                  {isMulti ? `${contextMenu.tracks.length} Songs Selected` : primaryTrack.title}
                </span>
                {isMulti && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 font-mono text-zinc-400">
                    {contextMenu.tracks.length}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (isMulti) {
                    playTrack(contextMenu.tracks[0], tracks);
                  } else {
                    playTrack(primaryTrack, tracks);
                  }
                  setContextMenu(null);
                }}
                onMouseEnter={(e) => handleItemHover(e, true)}
                onMouseLeave={(e) => handleItemHover(e, false)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
              >
                <Play className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <span>{isMulti ? 'Play Selection' : 'Play Now'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isMulti) {
                    addTracksToQueue(contextMenu.tracks);
                  } else {
                    addToQueue(primaryTrack);
                  }
                  setContextMenu(null);
                }}
                onMouseEnter={(e) => handleItemHover(e, true)}
                onMouseLeave={(e) => handleItemHover(e, false)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
              >
                <ListEnd className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <span>{isMulti ? `Add ${contextMenu.tracks.length} to Queue` : 'Add to Queue'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isMulti) {
                    playNextTracks(contextMenu.tracks);
                  } else {
                    playNext(primaryTrack);
                  }
                  setContextMenu(null);
                }}
                onMouseEnter={(e) => handleItemHover(e, true)}
                onMouseLeave={(e) => handleItemHover(e, false)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
              >
                <ListPlus className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <span>{isMulti ? `Play ${contextMenu.tracks.length} Next` : 'Play Next'}</span>
              </button>

              {/* Add to Playlist with Submenu */}
              <div
                className="relative"
                onMouseEnter={handlePlaylistSubmenuEnter}
                onMouseLeave={handlePlaylistSubmenuLeave}
              >
                <button
                  type="button"
                  onClick={() => setPlaylistSubmenuOpen((p) => !p)}
                  onMouseEnter={(e) => handleItemHover(e, true)}
                  onMouseLeave={(e) => handleItemHover(e, false)}
                  className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
                >
                  <div className="flex items-center gap-2.5">
                    <PlusCircle
                      className="w-4 h-4"
                      style={{ color: 'var(--color-stop-1, #6366f1)' }}
                    />
                    <span>Add to Playlist</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 -rotate-90 text-zinc-400" />
                </button>

                {playlistSubmenuOpen && (
                  <div
                    onMouseEnter={handlePlaylistSubmenuEnter}
                    onMouseLeave={handlePlaylistSubmenuLeave}
                    style={{
                      backgroundColor:
                        'color-mix(in srgb, var(--color-stop-1, #6366f1) 10%, #141416)',
                      borderColor:
                        'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, rgba(255, 255, 255, 0.12))',
                      boxShadow:
                        '0 12px 36px -4px rgba(0, 0, 0, 0.7), 0 0 16px color-mix(in srgb, var(--color-stop-1, #6366f1) 18%, transparent)',
                      backdropFilter: 'blur(24px)',
                    }}
                    className={`absolute top-0 ${
                      isNearRightEdge
                        ? 'right-full mr-1 before:absolute before:-right-3 before:inset-y-0 before:w-3 before:content-[\'\']'
                        : 'left-full ml-1 before:absolute before:-left-3 before:inset-y-0 before:w-3 before:content-[\'\']'
                    } w-48 border rounded-xl p-1.5 flex flex-col gap-0.5 text-xs text-zinc-300 z-50 shadow-2xl max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className="px-2 py-1 text-[10px] font-semibold text-zinc-400 border-b uppercase tracking-wider"
                      style={{
                        borderColor:
                          'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, rgba(255, 255, 255, 0.08))',
                      }}
                    >
                      Your Playlists
                    </div>

                    {playlists.length === 0 ? (
                      <div className="px-2 py-2 text-zinc-500 italic text-[11px]">
                        No playlists yet
                      </div>
                    ) : (
                      playlists.map((pl) => {
                        const allInPlaylist = contextMenu.tracks.every((t) =>
                          pl.trackIds.includes(t.id)
                        );
                        return (
                          <button
                            key={pl.id}
                            type="button"
                            onClick={() => {
                              addTracksToPlaylist(
                                pl.id,
                                contextMenu.tracks.map((t) => t.id)
                              );
                              setContextMenu(null);
                            }}
                            onMouseEnter={(e) => handleItemHover(e, true)}
                            onMouseLeave={(e) => handleItemHover(e, false)}
                            className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer text-zinc-200 hover:text-white"
                          >
                            <span className="truncate pr-2">{pl.name}</span>
                            {allInPlaylist && (
                              <span className="flex items-center justify-center shrink-0 w-4 h-4 ml-1.5 translate-y-[0.5px]">
                                <Check
                                  className="w-3.5 h-3.5"
                                  style={{ color: 'var(--color-stop-1, #6366f1)' }}
                                />
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}

                    <div
                      className="border-t my-0.5"
                      style={{
                        borderColor:
                          'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, rgba(255, 255, 255, 0.08))',
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => {
                        setNewPlaylistTracks(contextMenu.tracks);
                        setContextMenu(null);
                        setPlaylistSubmenuOpen(false);
                      }}
                      onMouseEnter={(e) => handleItemHover(e, true)}
                      onMouseLeave={(e) => handleItemHover(e, false)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer font-medium"
                      style={{ color: 'var(--color-stop-1, #6366f1)' }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Playlist...</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (isMulti) {
                    likeMultipleTracks(
                      contextMenu.tracks.map((t) => t.id),
                      !isLiked
                    );
                  } else {
                    toggleLikeTrack(primaryTrack.id);
                  }
                  setContextMenu(null);
                }}
                onMouseEnter={(e) => handleItemHover(e, true)}
                onMouseLeave={(e) => handleItemHover(e, false)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
              >
                <Heart
                  className={`w-4 h-4 ${
                    isLiked ? 'fill-pink-500 text-pink-500' : 'text-zinc-400'
                  }`}
                  style={!isLiked ? { color: 'var(--color-stop-1, #6366f1)' } : undefined}
                />
                <span>
                  {isMulti
                    ? isLiked
                      ? 'Unlike All'
                      : 'Like All'
                    : isLiked
                    ? 'Unlike'
                    : 'Like'}
                </span>
              </button>

              {/* Single-song actions (Details & Linking) */}
              {!isMulti && (
                <>
                  {(() => {
                    const isTrackLinked = usePlayerStore.getState().isTrackLinked;
                    const currentIdx = tracks.findIndex((t) => t.id === primaryTrack.id);
                    const nextTrack =
                      currentIdx >= 0 && currentIdx < tracks.length - 1
                        ? tracks[currentIdx + 1]
                        : null;
                    const isLinkedSong = isTrackLinked(primaryTrack.id);

                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setInfoModalTrack(primaryTrack);
                            setContextMenu(null);
                          }}
                          onMouseEnter={(e) => handleItemHover(e, true)}
                          onMouseLeave={(e) => handleItemHover(e, false)}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
                          title="Open track details and search any song to link"
                        >
                          <Link2 className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                          <span className="truncate">Link to Song...</span>
                        </button>

                        {nextTrack && (
                          <button
                            type="button"
                            onClick={() => {
                              linkTracks(primaryTrack.id, nextTrack.id);
                              setContextMenu(null);
                            }}
                            onMouseEnter={(e) => handleItemHover(e, true)}
                            onMouseLeave={(e) => handleItemHover(e, false)}
                            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
                            title={`Link to play seamlessly before "${nextTrack.title}"`}
                          >
                            <Link2 className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                            <span className="truncate">Link to Next Song</span>
                          </button>
                        )}

                        {isLinkedSong && (
                          <button
                            type="button"
                            onClick={() => {
                              unlinkTrack(primaryTrack.id);
                              setContextMenu(null);
                            }}
                            onMouseEnter={(e) => handleItemHover(e, true)}
                            onMouseLeave={(e) => handleItemHover(e, false)}
                            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
                          >
                            <Unlink className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                            <span>Unlink Song Pair</span>
                          </button>
                        )}
                      </>
                    );
                  })()}

                  <button
                    type="button"
                    onClick={() => {
                      setInfoModalTrack(primaryTrack);
                      setContextMenu(null);
                    }}
                    onMouseEnter={(e) => handleItemHover(e, true)}
                    onMouseLeave={(e) => handleItemHover(e, false)}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
                  >
                    <Info className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                    <span>Song Details & Specs</span>
                  </button>
                </>
              )}

              {playlistId && (
                <button
                  type="button"
                  onClick={() => {
                    if (isMulti) {
                      if (onRemoveFromPlaylist) {
                        contextMenu.tracks.forEach((t) => onRemoveFromPlaylist(t.id));
                      } else {
                        removeTracksFromPlaylistStore(
                          playlistId,
                          contextMenu.tracks.map((t) => t.id)
                        );
                      }
                      clearSelection();
                    } else {
                      if (onRemoveFromPlaylist) {
                        onRemoveFromPlaylist(primaryTrack.id);
                      } else {
                        removeTracksFromPlaylistStore(playlistId, [primaryTrack.id]);
                      }
                    }
                    setContextMenu(null);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '';
                  }}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-red-400 border-t mt-1 pt-2"
                  style={{
                    borderColor:
                      'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, rgba(255, 255, 255, 0.08))',
                  }}
                >
                  <span>
                    {isMulti
                      ? `Remove ${contextMenu.tracks.length} from Playlist`
                      : 'Remove from Playlist'}
                  </span>
                </button>
              )}

              {isMulti && (
                <button
                  type="button"
                  onClick={() => {
                    clearSelection();
                    setContextMenu(null);
                  }}
                  onMouseEnter={(e) => handleItemHover(e, true)}
                  onMouseLeave={(e) => handleItemHover(e, false)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-400 hover:text-white border-t mt-0.5 pt-1.5"
                  style={{
                    borderColor:
                      'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, rgba(255, 255, 255, 0.08))',
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Deselect All</span>
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        isOpen={Boolean(newPlaylistTracks && newPlaylistTracks.length > 0)}
        onClose={() => setNewPlaylistTracks(null)}
        onConfirm={(playlistName) => {
          if (newPlaylistTracks && newPlaylistTracks.length > 0) {
            const trackIdsToAdd = newPlaylistTracks.map((t) => t.id);
            createPlaylist(playlistName);
            setTimeout(() => {
              const latest = usePlayerStore.getState().playlists;
              const created = latest.find((p) => p.name === playlistName);
              if (created) {
                usePlayerStore.getState().addTracksToPlaylist(created.id, trackIdsToAdd);
              }
            }, 50);
            setNewPlaylistTracks(null);
          }
        }}
      />
    </div>
  );
};
