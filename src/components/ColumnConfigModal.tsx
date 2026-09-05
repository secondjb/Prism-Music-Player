import React from 'react';
import Slider from '@mui/material/Slider';
import { RefreshCw, Check, X, SlidersHorizontal } from 'lucide-react';
import {
  COLUMN_LABELS,
  TrackColumnId,
  TrackGridDensity,
  ALL_COLUMN_IDS,
  LOCKED_COLUMN_IDS,
} from '../hooks/useTrackTableState';

interface ColumnConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  density: TrackGridDensity;
  onDensityChange: (density: TrackGridDensity) => void;
  showSubArtistUnderTitle: boolean;
  onToggleSubArtist: (show: boolean) => void;
  onResetGrid: () => void;
  visibleTrackColumns: TrackColumnId[];
  onToggleColumn: (col: TrackColumnId) => void;
}

export const ColumnConfigModal: React.FC<ColumnConfigModalProps> = ({
  isOpen,
  onClose,
  density,
  onDensityChange,
  showSubArtistUnderTitle,
  onToggleSubArtist,
  onResetGrid,
  visibleTrackColumns,
  onToggleColumn,
}) => {
  if (!isOpen) return null;

  const densities: { key: TrackGridDensity; label: string; height: string }[] = [
    { key: 'compact', label: 'Compact', height: '36px' },
    { key: 'normal', label: 'Normal', height: '56px' },
    { key: 'large', label: 'Large', height: '68px' },
    { key: 'extra-large', label: 'XL', height: '80px' },
    { key: 'huge', label: 'Huge', height: '96px' },
    { key: 'massive', label: 'Massive', height: '120px' },
  ];

  const densitySteps: TrackGridDensity[] = ['compact', 'normal', 'large', 'extra-large', 'huge', 'massive'];
  const currentStepIndex = Math.max(0, densitySteps.indexOf(density));

  return (
    <>
      {/* Invisible backdrop to dismiss popover without dimming the screen */}
      <div className="fixed inset-0 z-40 bg-transparent" onClick={onClose} />

      {/* Popover Card floating fixed in viewport so it never clips under scroll containers */}
      <div className="fixed right-8 top-20 w-84 glass-panel border border-white/10 rounded-2xl shadow-2xl p-4 z-50 flex flex-col gap-3.5 text-xs max-h-[34rem] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150 bg-[#121212]/95 text-white">
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

        {/* Item Density Discrete Slider & Buttons */}
        <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 font-semibold text-[11px] uppercase tracking-wider">
              Row Density Slider
            </span>
            <span
              className="text-xs font-mono font-bold capitalize"
              style={{ color: 'var(--color-stop-1, #6366f1)' }}
            >
              {density.replace('-', ' ')}
            </span>
          </div>

          <div className="px-3 pt-1 pb-2">
            <Slider
              value={currentStepIndex}
              min={0}
              max={5}
              step={1}
              marks={[
                { value: 0, label: '36p' },
                { value: 1, label: '56p' },
                { value: 2, label: '68p' },
                { value: 3, label: '80p' },
                { value: 4, label: '96p' },
                { value: 5, label: '120p' },
              ]}
              onChange={(_, val) => {
                const idx = Array.isArray(val) ? val[0] : val;
                if (densitySteps[idx]) onDensityChange(densitySteps[idx]);
              }}
              sx={{
                color: 'var(--color-stop-1, #6366f1)',
                '& .MuiSlider-markLabel': {
                  fontSize: '9px',
                  color: '#a1a1aa',
                },
                '& .MuiSlider-thumb': {
                  width: 14,
                  height: 14,
                },
              }}
            />
          </div>

          <div className="grid grid-cols-6 gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
            {densities.map((d) => {
              const active = density === d.key;
              return (
                <button
                  key={d.key}
                  onClick={() => onDensityChange(d.key)}
                  className={`py-1.5 px-0.5 rounded-lg text-[10px] font-medium transition-all text-center cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                    active
                      ? 'text-white shadow-md font-semibold'
                      : 'text-zinc-400 hover:text-white hover:bg-white/10'
                  }`}
                  style={active ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                >
                  <span className="truncate w-full text-center">{d.label}</span>
                  <span className="text-[8px] opacity-75 font-mono">{d.height}</span>
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
          <div className="flex flex-col gap-1 max-h-44 overflow-y-auto custom-scrollbar pr-1">
            {ALL_COLUMN_IDS.map((colId) => {
              if (LOCKED_COLUMN_IDS.includes(colId)) return null;
              const isVisible = visibleTrackColumns.includes(colId);
              const label = COLUMN_LABELS[colId];

              return (
                <button
                  key={colId}
                  onClick={() => onToggleColumn(colId)}
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
