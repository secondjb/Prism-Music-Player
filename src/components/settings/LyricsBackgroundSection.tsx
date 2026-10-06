import React from 'react';
import {
  Palette,
  Columns,
  ChevronDown,
} from 'lucide-react';
import Slider from '@mui/material/Slider';
import { usePlayerStore } from '../../store/usePlayerStore';
import { M3Selector } from '../M3Selector';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';

const BACKGROUND_OPTIONS = [
  { id: 'dynamic_glow', name: 'Dynamic Ambient Glow (Default)', desc: 'Vibrant animated gradient matching active album art colors' },
  { id: 'album_art_blur', name: 'Blurred Album Artwork', desc: 'Full-bleed frosted glass cover art with custom blur & dimming' },
  { id: 'album_art_color', name: 'Album Art Dynamic Solid Tint', desc: 'Minimalist solid background derived from current album art colors' },
  { id: 'custom_photo', name: 'Custom Wallpaper / Image', desc: 'Custom local photo background with adjustable blur & opacity' },
  { id: 'solid_color', name: 'Solid Color Theme', desc: 'Clean single-shade minimalist background' },
  { id: 'amoled_black', name: 'AMOLED Pure Black (#000000)', desc: 'Zero glow pure black for OLED displays & maximum battery saving' },
] as const;

interface LyricsBackgroundSectionProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  shouldShow: boolean;
}

export const LyricsBackgroundSection: React.FC<LyricsBackgroundSectionProps> = ({
  isCollapsed,
  onToggleCollapse,
  shouldShow,
}) => {
  const backgroundType = usePlayerStore((s) => s.backgroundType);
  const setBackgroundType = usePlayerStore((s) => s.setBackgroundType);
  const customBgPath = usePlayerStore((s) => s.customBgPath);
  const setCustomBgPath = usePlayerStore((s) => s.setCustomBgPath);
  const customBgColor = usePlayerStore((s) => s.customBgColor);
  const setCustomBgColor = usePlayerStore((s) => s.setCustomBgColor);
  const bgBlurAmount = usePlayerStore((s) => s.bgBlurAmount);
  const setBgBlurAmount = usePlayerStore((s) => s.setBgBlurAmount);
  const bgDimOpacity = usePlayerStore((s) => s.bgDimOpacity);
  const setBgDimOpacity = usePlayerStore((s) => s.setBgDimOpacity);
  const lyricsLayoutMode = usePlayerStore((s) => s.lyricsLayoutMode);
  const setLyricsLayoutMode = usePlayerStore((s) => s.setLyricsLayoutMode);

  if (!shouldShow) return null;

  return (
    <div className="glass-card rounded-2xl border border-white/10 shadow-xl transition-all shrink-0">
      {/* Accordion Header */}
      <div
        onClick={onToggleCollapse}
        className={`flex items-center justify-between p-5 cursor-pointer hover:bg-white/[0.02] transition-colors select-none ${
          isCollapsed ? 'rounded-2xl' : 'rounded-t-2xl'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 pr-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
              borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
              color: 'var(--color-stop-1, #6366f1)',
            }}
          >
            <Palette className="w-4.5 h-4.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-sm font-bold text-white">Lyrics Atmosphere & Background Theme</h3>
            <p className="text-xs text-zinc-400 truncate">
              Dynamic ambient mesh, frosted cover artwork, custom wallpapers & layout modes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-white/5 border border-white/10 text-zinc-300">
            {backgroundType} • {lyricsLayoutMode}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
              !isCollapsed ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {/* Accordion Content */}
      {!isCollapsed && (
        <div className="p-5 pt-0 border-t border-white/5 flex flex-col gap-4 mt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
            {/* Background Style Selector */}
            <div className="flex flex-col p-3 rounded-xl bg-white/5 border border-white/5 gap-2.5 col-span-1 md:col-span-2">
              <div className="flex items-center gap-2.5">
                <Palette className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Lyrics Background Style</span>
                  <span className="text-[11px] text-zinc-400">Atmospheric backdrop rendering</span>
                </div>
              </div>
              <div className="w-full">
                <M3Selector
                  value={backgroundType}
                  onChange={(val) => setBackgroundType(val as any)}
                  options={BACKGROUND_OPTIONS}
                  size="sm"
                />
              </div>
            </div>

            {/* Custom Photo Picker */}
            {backgroundType === 'custom_photo' && (
              <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-white/5 border border-white/5 col-span-1 md:col-span-2">
                <span className="text-xs font-semibold text-white">Custom Wallpaper File</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={customBgPath || 'No wallpaper chosen'}
                    className="flex-1 px-3 py-1.5 text-xs font-mono bg-zinc-900 border border-white/10 rounded-xl text-zinc-300 truncate"
                  />
                  <button
                    onClick={async () => {
                      try {
                        const selected = await open({
                          multiple: false,
                          filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif'] }],
                        });
                        if (selected && typeof selected === 'string') {
                          const assetUrl = (window as any).__TAURI_INTERNALS__ ? convertFileSrc(selected) : selected;
                          setCustomBgPath(assetUrl);
                        }
                      } catch (e) {
                        console.warn('Pick background image error:', e);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl text-white text-xs font-semibold shadow-md transition-transform hover:scale-105 cursor-pointer shrink-0"
                    style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
                  >
                    Choose Photo...
                  </button>
                </div>
              </div>
            )}

            {/* Solid Color Picker & Presets */}
            {backgroundType === 'solid_color' && (
              <div className="flex flex-col gap-2.5 p-3.5 rounded-xl bg-white/5 border border-white/5 col-span-1 md:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Palette className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                    <span className="text-xs font-semibold text-white">Solid Color Palette</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customBgColor}
                      onChange={(e) => setCustomBgColor(e.target.value)}
                      className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={customBgColor}
                      onChange={(e) => setCustomBgColor(e.target.value)}
                      className="w-20 px-2 py-0.5 text-xs font-mono bg-zinc-900 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-white/5 flex-wrap">
                  {['#0f172a', '#18181b', '#000000', '#0a0a0c', '#1e1b4b', '#1e1e2f', '#022c22', '#1f1300', '#3b0764'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setCustomBgColor(c)}
                      className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${
                        customBgColor.toLowerCase() === c.toLowerCase() ? 'border-white scale-110 shadow-lg' : 'border-white/20'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Blur & Dimming controls */}
            {(backgroundType === 'album_art_blur' || backgroundType === 'custom_photo') && (
              <>
                <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">Background Blur</span>
                    <span className="font-mono text-xs text-zinc-300">{bgBlurAmount}px</span>
                  </div>
                  <Slider
                    value={bgBlurAmount}
                    min={0}
                    max={60}
                    step={2}
                    onChange={(_, val) => setBgBlurAmount(val as number)}
                    valueLabelDisplay="auto"
                  />
                </div>

                <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">Background Dimming</span>
                    <span className="font-mono text-xs text-zinc-300">{Math.round(bgDimOpacity * 100)}%</span>
                  </div>
                  <Slider
                    value={bgDimOpacity}
                    min={0}
                    max={0.9}
                    step={0.05}
                    onChange={(_, val) => setBgDimOpacity(val as number)}
                    valueLabelDisplay="auto"
                  />
                </div>
              </>
            )}

            {/* Lyrics View Layout Mode Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 gap-3 col-span-1 md:col-span-2">
              <div className="flex items-center gap-2.5">
                <Columns className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Lyrics View Layout</span>
                  <span className="text-[11px] text-zinc-400">Centered lines vs. side-by-side album artwork split</span>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
                <button
                  onClick={() => setLyricsLayoutMode('centered')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    lyricsLayoutMode === 'centered'
                      ? 'text-white shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  style={lyricsLayoutMode === 'centered' ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                >
                  Centered Focus
                </button>
                <button
                  onClick={() => setLyricsLayoutMode('split')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    lyricsLayoutMode === 'split'
                      ? 'text-white shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  style={lyricsLayoutMode === 'split' ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                >
                  Side-by-Side Split
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
