import React from 'react';
import { Header, flexRender } from '@tanstack/react-table';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Track } from '../types/player';
import {
  LOCKED_COLUMN_IDS,
  TrackColumnId,
  Breakpoint,
  getColumnFlexStyle,
} from '../hooks/useTrackTableState';

interface DraggableHeaderProps {
  header: Header<Track, unknown>;
  isResized?: boolean;
  breakpoint: Breakpoint;
  isArtistVisible: boolean;
  isAlbumVisible: boolean;
}

export const DraggableHeader: React.FC<DraggableHeaderProps> = ({
  header,
  isResized = false,
  breakpoint,
  isArtistVisible,
  isAlbumVisible,
}) => {
  const colId = header.id as TrackColumnId;
  const isLocked = LOCKED_COLUMN_IDS.includes(colId);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: colId,
    disabled: isLocked,
  });

  const flexStyle = getColumnFlexStyle({
    colId: header.id,
    size: header.getSize(),
    isResized,
    breakpoint,
    isArtistVisible,
    isAlbumVisible,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : 1,
    position: 'relative',
    ...flexStyle,
  };

  const sorted = header.column.getIsSorted();
  const canSort = ['title', 'artist', 'album', 'date', 'genre', 'duration'].includes(colId);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/header flex items-center justify-between px-2 py-2 select-none text-[11px] font-semibold uppercase tracking-wider text-[#b3b3b3] hover:text-white transition-colors relative overflow-hidden min-w-0 ${
        isDragging ? 'bg-white/10 rounded-md shadow-lg' : ''
      }`}
    >
      {/* Header Label and Sort Controls */}
      <div
        {...(!isLocked ? attributes : {})}
        {...(!isLocked ? listeners : {})}
        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
        className={`flex items-center gap-1.5 min-w-0 truncate ${
          canSort ? 'cursor-pointer hover:text-white' : ''
        } ${!isLocked ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <span className="truncate">
          {flexRender(header.column.columnDef.header, header.getContext())}
        </span>

        {sorted === 'asc' && (
          <ChevronUp
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: 'var(--color-stop-1, #6366f1)' }}
          />
        )}
        {sorted === 'desc' && (
          <ChevronDown
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: 'var(--color-stop-1, #6366f1)' }}
          />
        )}
      </div>

      {/* TanStack Column Resizer Handle */}
      {header.column.getCanResize() && (
        <div
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          onClick={(e) => e.stopPropagation()}
          className={`absolute right-0 top-1/2 -translate-y-1/2 h-4 w-1.5 cursor-col-resize z-30 group/resizer flex items-center justify-center ${
            header.column.getIsResizing() ? 'opacity-100' : 'opacity-0 group-hover/header:opacity-100'
          }`}
        >
          <div
            className="w-0.5 h-full rounded-full transition-all"
            style={
              header.column.getIsResizing()
                ? { backgroundColor: 'var(--color-stop-1, #6366f1)', transform: 'scaleX(1.5)' }
                : { backgroundColor: 'rgba(255,255,255,0.3)' }
            }
          />
        </div>
      )}
    </div>
  );
};
