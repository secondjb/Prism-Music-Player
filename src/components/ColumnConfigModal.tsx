import React from 'react';
import { Column } from '@tanstack/react-table';
import { RefreshCw, Check, X, SlidersHorizontal } from 'lucide-react';
import { Track } from '../types/player';
import {
  COLUMN_LABELS,
  TrackColumnId,
  TrackGridDensity,
} from '../hooks/useTrackTableState';

interface ColumnConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: Column<Track, unknown>[];
  density: TrackGridDensity;
  onDensityChange: (density: TrackGridDensity) => void;
  showSubArtistUnderTitle: boolean;
  onToggleSubArtist: (show: boolean) => void;
  onResetGrid: () => void;
}

export const ColumnConfigModal: React.FC<ColumnConfigModalProps> = ({
  isOpen,
  onClose,
  columns,
  density,
  onDensityChange,
  showSubArtistUnderTitle,
  onToggleSubArtist,
  onResetGrid,
}) => {
  if (!isOpen) return null;

  const densities: { key: TrackGridDensity; label: string; height: string }[] = [
    { key: 'compact', label: 'Compact', height: '36px' },
    { key: 'normal', label: 'Normal', height: '56px' },
    { key: 'large', label: 'Large', height: '68px' },
    { key: 'extra-large', label: 'XL', height: '80px' },
  ];

  return (
    <>
      {/* Invisible backdrop to dismiss popover without dimming the screen */}
      <div className="fixed inset-0 z-40 bg-transparent" onClick={onClose} />

      {/* Popover Card anchored near the Grid Customization button */}
      <div className="absolute right-0 top-11 w-72 glass-panel border border-white/10 rounded-2xl shadow-2xl p-4 z-50 flex flex-col gap-3.5 text-xs max-h-[30rem] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150 bg-[#121212]/95 text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2 font-bold text-sm text-white">
            <SlidersHorizontal
              className="w-4 h-4"
              style={{ color: 'var(--color-stop-1, #6366f1)' }}
            />
            <span>Table Customization</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Reset Grid Button */}
        <button
          onClick={onResetGrid}
          className="w-full py-2 px-3 rounded-xl font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer shadow-sm active:scale-[0.98]"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 18%, transparent)',
            color: 'var(--color-stop-1, #6366f1)',
            borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Grid Defaults</span>
        </button>

        {/* Item Density Selector */}
        <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
          <span className="text-zinc-400 font-semibold text-[11px] uppercase tracking-wider">
            Row Density
          </span>
          <div className="grid grid-cols-4 gap-1.5 bg-white/5 p-1 rounded-xl border border-white/5">
            {densities.map((d) => {
              const active = density === d.key;
              return (
                <button
                  key={d.key}
                  onClick={() => onDensityChange(d.key)}
                  className={`py-1.5 px-1 rounded-lg text-xs font-medium transition-all text-center cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                    active
                      ? 'text-white shadow-md font-semibold'
                      : 'text-zinc-400 hover:text-white hover:bg-white/10'
                  }`}
                  style={active ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                >
                  <span>{d.label}</span>
                  <span className="text-[9px] opacity-75 font-mono">{d.height}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Compact Layout Toggle: Sub-artist under title */}
        <div className="flex items-center justify-between py-2 border-t border-b border-white/10">
          <div className="flex flex-col">
            <span className="text-zinc-200 font-medium text-xs">Artist under Song Title</span>
            <span className="text-[10px] text-zinc-400">Merges title + artist into a single cell</span>
          </div>
          <input
            type="checkbox"
            checked={showSubArtistUnderTitle}
            onChange={(e) => onToggleSubArtist(e.target.checked)}
            className="w-4 h-4 rounded cursor-pointer"
            style={{ accentColor: 'var(--color-stop-1, #6366f1)' }}
          />
        </div>

        {/* Column Visibility Checklist */}
        <div className="flex flex-col gap-1.5 min-h-0 flex-1">
          <span className="text-zinc-400 font-semibold text-[11px] uppercase tracking-wider">
            Visible Columns
          </span>
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto custom-scrollbar pr-1">
            {columns.map((col) => {
              const colId = col.id as TrackColumnId;
              const isVisible = col.getIsVisible();
              const label = COLUMN_LABELS[colId as keyof typeof COLUMN_LABELS] || col.id;

              return (
                <button
                  key={col.id}
                  onClick={col.getToggleVisibilityHandler()}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-xl transition-all text-left cursor-pointer border ${
                    isVisible
                      ? 'text-white font-medium'
                      : 'text-zinc-400 border-transparent hover:bg-white/5 hover:text-zinc-200'
                  }`}
                  style={
                    isVisible
                      ? {
                          backgroundColor:
                            'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)',
                          borderColor:
                            'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
                        }
                      : undefined
                  }
                >
                  <span>{label}</span>
                  {isVisible && (
                    <Check
                      className="w-4 h-4 shrink-0"
                      style={{ color: 'var(--color-stop-1, #6366f1)' }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};
