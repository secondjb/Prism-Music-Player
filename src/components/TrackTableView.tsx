import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { RevoGrid, Template } from '@revolist/react-datagrid';
import type { ColumnRegular } from '@revolist/revogrid';
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
} from 'lucide-react';

import { Track } from '../types/player';
import { usePlayerStore, TrackColumnId } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
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
  e.dataTransfer.setData(
    'text/plain',
    JSON.stringify({ type: 'tracks', ids: [track.id] })
  );
  e.dataTransfer.effectAllowed = 'copy';

  const ghost = document.createElement('div');
  ghost.style.position = 'absolute';
  ghost.style.top = '-9999px';
  ghost.style.left = '-9999px';
  ghost.className = 'glass-panel text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-2xl z-50 flex items-center gap-2 border border-white/20';
  ghost.style.background = 'rgba(20, 20, 24, 0.95)';
  ghost.innerHTML = `<span>🎵</span> <span style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${track.title || 'Song'}</span>`;

  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 20, 15);
  setTimeout(() => {
    if (document.body.contains(ghost)) {
      document.body.removeChild(ghost);
    }
  }, 0);
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
      className="w-full h-full flex items-center justify-center font-mono text-zinc-400 cursor-grab active:cursor-grabbing"
      onContextMenu={(e) => {
        e.preventDefault();
        const evt = new CustomEvent('prism-open-context-menu', {
          bubbles: true,
          detail: { x: e.clientX, y: e.clientY, track },
        });
        e.currentTarget.dispatchEvent(evt);
      }}
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
            <Play className={`${config.iconClass} hidden group-hover/row:block fill-white text-white ml-0.5`} />
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
      className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
      onContextMenu={(e) => {
        e.preventDefault();
        const evt = new CustomEvent('prism-open-context-menu', {
          bubbles: true,
          detail: { x: e.clientX, y: e.clientY, track },
        });
        e.currentTarget.dispatchEvent(evt);
      }}
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

const TitleCell: React.FC<any> = ({ model }) => {
  const track = (model || {}) as Track;
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const showSubArtistUnderTitle = usePlayerStore((s) => s.showSubArtistUnderTitle);
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);

  if (!track.title || (model as any)?.__isSpacer) return null;
  const isCurrentPlaying = currentTrack?.id === track.id;

  const hasSubArtistLink = Boolean(
    showSubArtistUnderTitle && track.artist && track.artist !== 'Unknown Artist'
  );

  return (
    <div
      draggable={Boolean(track.id)}
      onDragStart={(e) => handleTrackDragStart(e, track)}
      className="flex flex-col justify-center h-full min-w-0 pr-2 w-full select-none cursor-grab active:cursor-grabbing"
      onContextMenu={(e) => {
        e.preventDefault();
        const evt = new CustomEvent('prism-open-context-menu', {
          bubbles: true,
          detail: { x: e.clientX, y: e.clientY, track },
        });
        e.currentTarget.dispatchEvent(evt);
      }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement)?.closest('a') || (e.target as HTMLElement)?.closest('button')) return;
        const evt = new CustomEvent('prism-play-track', {
          bubbles: true,
          detail: { track },
        });
        e.currentTarget.dispatchEvent(evt);
      }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
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
              : track.missing_since
              ? { color: '#a1a1aa' }
              : { color: '#ffffff' }
          }
        >
          {track.title}
        </span>
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
      className="flex items-center h-full w-full min-w-0 overflow-hidden cursor-grab active:cursor-grabbing"
      onContextMenu={(e) => {
        e.preventDefault();
        const evt = new CustomEvent('prism-open-context-menu', {
          bubbles: true,
          detail: { x: e.clientX, y: e.clientY, track },
        });
        e.currentTarget.dispatchEvent(evt);
      }}
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
      className="flex items-center h-full w-full min-w-0 overflow-hidden cursor-grab active:cursor-grabbing"
      onContextMenu={(e) => {
        e.preventDefault();
        const evt = new CustomEvent('prism-open-context-menu', {
          bubbles: true,
          detail: { x: e.clientX, y: e.clientY, track },
        });
        e.currentTarget.dispatchEvent(evt);
      }}
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
      className="flex items-center h-full w-full min-w-0 cursor-grab active:cursor-grabbing"
      onContextMenu={(e) => {
        e.preventDefault();
        const evt = new CustomEvent('prism-open-context-menu', {
          bubbles: true,
          detail: { x: e.clientX, y: e.clientY, track },
        });
        e.currentTarget.dispatchEvent(evt);
      }}
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
      className="flex items-center h-full w-full min-w-0 cursor-grab active:cursor-grabbing"
      onContextMenu={(e) => {
        e.preventDefault();
        const evt = new CustomEvent('prism-open-context-menu', {
          bubbles: true,
          detail: { x: e.clientX, y: e.clientY, track },
        });
        e.currentTarget.dispatchEvent(evt);
      }}
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
      className="flex items-center justify-end h-full w-full pr-2 cursor-grab active:cursor-grabbing"
      onContextMenu={(e) => {
        e.preventDefault();
        const evt = new CustomEvent('prism-open-context-menu', {
          bubbles: true,
          detail: { x: e.clientX, y: e.clientY, track },
        });
        e.currentTarget.dispatchEvent(evt);
      }}
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

const FavoriteCell: React.FC<any> = ({ model }) => {
  const track = (model || {}) as Track;
  const isLiked = usePlayerStore((s) => s.likedTrackIds.includes(track?.id));
  const toggleLikeTrack = usePlayerStore((s) => s.toggleLikeTrack);
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track.id) return null;

  const config = ACTION_DENSITY_CONFIG[trackGridDensity] || ACTION_DENSITY_CONFIG.normal;

  return (
    <div className="w-full h-full flex items-center justify-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleLikeTrack(track.id);
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
  const playNext = usePlayerStore((s) => s.playNext);
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track.id) return null;

  const config = ACTION_DENSITY_CONFIG[trackGridDensity] || ACTION_DENSITY_CONFIG.normal;

  return (
    <div className="w-full h-full flex items-center justify-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          playNext(track);
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
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const trackGridDensity = usePlayerStore((s) => s.trackGridDensity);
  if (!track.id) return null;

  const config = ACTION_DENSITY_CONFIG[trackGridDensity] || ACTION_DENSITY_CONFIG.normal;

  return (
    <div className="w-full h-full flex items-center justify-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          addToQueue(track);
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
          const evt = new CustomEvent('prism-open-context-menu', {
            bubbles: true,
            detail: { x: rect.left, y: rect.bottom + 4, track, openPlaylistSubmenu: true },
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
          const evt = new CustomEvent('prism-open-context-menu', {
            bubbles: true,
            detail: { x: e.clientX, y: e.clientY, track },
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
  const addTrackToPlaylist = usePlayerStore((s) => s.addTrackToPlaylist);
  const createPlaylist = usePlayerStore((s) => s.createPlaylist);

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
  const [newPlaylistTrack, setNewPlaylistTrack] = useState<Track | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    track: Track;
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
  const [containerWidth, setContainerWidth] = useState<number>(() => window.innerWidth);
  const [sortState, setSortState] = useState<{ prop: string; order: 'asc' | 'desc' } | null>(null);

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

    gridEl.addEventListener('beforesorting', handleBeforeSorting);
    gridEl.addEventListener('aftersortingapply', handleAfterSortingApply);
    return () => {
      gridEl.removeEventListener('beforesorting', handleBeforeSorting);
      gridEl.removeEventListener('aftersortingapply', handleAfterSortingApply);
    };
  }, []);

  // ResizeObserver to track container width and dynamically recalculate fractional columns
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth || window.innerWidth);

    return () => ro.disconnect();
  }, []);

  // Listen to custom events bubbled up from RevoGrid cell templates
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleOpenMenu = (e: Event) => {
      const customEvt = e as CustomEvent<{
        x: number;
        y: number;
        track: Track;
        openPlaylistSubmenu?: boolean;
      }>;
      if (customEvt.detail) {
        setContextMenu(customEvt.detail);
        setPlaylistSubmenuOpen(Boolean(customEvt.detail.openPlaylistSubmenu));
      }
    };

    const handlePlayTrackEvt = (e: Event) => {
      const customEvt = e as CustomEvent<{ track: Track }>;
      if (customEvt.detail?.track) {
        playTrack(customEvt.detail.track, tracks);
      }
    };

    container.addEventListener('prism-open-context-menu', handleOpenMenu);
    container.addEventListener('prism-play-track', handlePlayTrackEvt);

    return () => {
      container.removeEventListener('prism-open-context-menu', handleOpenMenu);
      container.removeEventListener('prism-play-track', handlePlayTrackEvt);
    };
  }, [playTrack, tracks]);

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
  const orderCellTemplate = useMemo(() => Template(OrderCell), []);
  const artCellTemplate = useMemo(() => Template(TrackArtCell), []);
  const titleCellTemplate = useMemo(() => Template(TitleCell), []);
  const artistCellTemplate = useMemo(() => Template(ArtistCell), []);
  const albumCellTemplate = useMemo(() => Template(AlbumCell), []);
  const dateCellTemplate = useMemo(() => Template(DateCell), []);
  const genreCellTemplate = useMemo(() => Template(GenreCell), []);
  const durationCellTemplate = useMemo(() => Template(DurationCell), []);
  const columnHeaderTemplate = useMemo(() => Template(ColumnHeader), [sortState]);
  const favoriteCellTemplate = useMemo(() => Template(FavoriteCell), []);
  const playNextCellTemplate = useMemo(() => Template(PlayNextCell), []);
  const addToQueueCellTemplate = useMemo(() => Template(AddToQueueCell), []);
  const addToPlaylistCellTemplate = useMemo(() => Template(AddToPlaylistCell), []);
  const actionsCellTemplate = useMemo(() => Template(ActionsCell), []);

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

  // Data source for RevoGrid with current-playing row classes and bottom padding spacer rows
  const source = useMemo(() => {
    if (tracks.length === 0) return [];
    const baseSource = tracks.map((track, idx) => ({
      ...track,
      order: idx + 1,
      rowIndex: idx,
      rowClass: `group/row select-none ${currentTrack?.id === track.id ? 'is-current-playing' : ''}`,
    }));

    if (autoHeight) {
      return baseSource;
    }

    // Add 2 padding spacer rows at the bottom so the last track is never cut off
    // and user can scroll 1-2 row heights deeper than there are songs
    const spacerRows = [
      {
        id: '',
        title: '',
        artist: '',
        album: '',
        duration_secs: 0,
        year: null,
        genre: '',
        order: 999999999,
        rowIndex: -1,
        __isSpacer: true,
        rowClass: 'spacer-row pointer-events-none opacity-0 select-none !bg-transparent border-none',
      },
      {
        id: '',
        title: '',
        artist: '',
        album: '',
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
  }, [tracks, currentTrack?.id, autoHeight]);

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
  }, [columnOrder, setColumnOrder]);

  // Keyboard navigation: Enter to toggle or play
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (currentTrack) {
          togglePlay();
        } else if (tracks.length > 0) {
          playTrack(tracks[0], tracks);
        }
      }
    },
    [currentTrack, togglePlay, playTrack, tracks]
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
  const calculatedHeight = autoHeight ? 48 + tracks.length * currentDensityHeight : undefined;

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
        className={autoHeight ? 'w-full relative outline-none' : 'flex-1 w-full relative outline-none overflow-hidden'}
        style={autoHeight ? { height: `${calculatedHeight}px`, minHeight: `${calculatedHeight}px` } : { minHeight: 0 }}
      >
        <RevoGrid
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
      </div>

      {/* Context Menu Overlay */}
      {contextMenu && (() => {
        const menuEstimatedHeight = playlistId && onRemoveFromPlaylist ? 360 : 310;
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

        const isLiked = likedTrackIds.includes(contextMenu.track.id);

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
                borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, rgba(255, 255, 255, 0.12))',
                boxShadow:
                  '0 12px 36px -4px rgba(0, 0, 0, 0.7), 0 0 16px color-mix(in srgb, var(--color-stop-1, #6366f1) 18%, transparent)',
                backdropFilter: 'blur(24px)',
              }}
              className="fixed z-50 w-56 border rounded-xl p-1.5 flex flex-col gap-1 text-xs text-zinc-300 animate-in fade-in zoom-in-95 duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="px-2.5 py-1 text-[11px] font-semibold text-zinc-400 border-b truncate"
                style={{
                  borderColor:
                    'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, rgba(255, 255, 255, 0.08))',
                }}
              >
                {contextMenu.track.title}
              </div>

              <button
                type="button"
                onClick={() => {
                  playTrack(contextMenu.track, tracks);
                  setContextMenu(null);
                }}
                onMouseEnter={(e) => handleItemHover(e, true)}
                onMouseLeave={(e) => handleItemHover(e, false)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
              >
                <Play className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <span>Play Now</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playNext(contextMenu.track);
                  setContextMenu(null);
                }}
                onMouseEnter={(e) => handleItemHover(e, true)}
                onMouseLeave={(e) => handleItemHover(e, false)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
              >
                <ListPlus className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <span>Play Next</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  addToQueue(contextMenu.track);
                  setContextMenu(null);
                }}
                onMouseEnter={(e) => handleItemHover(e, true)}
                onMouseLeave={(e) => handleItemHover(e, false)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
              >
                <ListEnd className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <span>Add to Queue</span>
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
                        const inPlaylist = pl.trackIds.includes(contextMenu.track.id);
                        return (
                          <button
                            key={pl.id}
                            type="button"
                            onClick={() => {
                              addTrackToPlaylist(pl.id, contextMenu.track.id);
                              setContextMenu(null);
                            }}
                            onMouseEnter={(e) => handleItemHover(e, true)}
                            onMouseLeave={(e) => handleItemHover(e, false)}
                            className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer text-zinc-200 hover:text-white"
                          >
                            <span className="truncate pr-2">{pl.name}</span>
                            {inPlaylist && (
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
                        setNewPlaylistTrack(contextMenu.track);
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
                  toggleLikeTrack(contextMenu.track.id);
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
                <span>{isLiked ? 'Unlike' : 'Like'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInfoModalTrack(contextMenu.track);
                  setContextMenu(null);
                }}
                onMouseEnter={(e) => handleItemHover(e, true)}
                onMouseLeave={(e) => handleItemHover(e, false)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left font-medium cursor-pointer text-zinc-200 hover:text-white"
              >
                <Info className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <span>Song Details & Specs</span>
              </button>

              {playlistId && onRemoveFromPlaylist && (
                <button
                  type="button"
                  onClick={() => {
                    onRemoveFromPlaylist(contextMenu.track.id);
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
                  <span>Remove from Playlist</span>
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        isOpen={Boolean(newPlaylistTrack)}
        onClose={() => setNewPlaylistTrack(null)}
        onConfirm={(playlistName) => {
          if (newPlaylistTrack) {
            createPlaylist(playlistName);
            setTimeout(() => {
              const latest = usePlayerStore.getState().playlists;
              const created = latest.find((p) => p.name === playlistName);
              if (created) {
                addTrackToPlaylist(created.id, newPlaylistTrack.id);
              }
            }, 50);
            setNewPlaylistTrack(null);
          }
        }}
      />
    </div>
  );
};
