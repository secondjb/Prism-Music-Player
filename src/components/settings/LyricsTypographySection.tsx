import React from 'react';
import {
  Type as TypeIcon,
  Mic2,
  Activity,
  Languages,
  Download,
  Sparkles,
  Info,
  Waves,
  ChevronDown,
} from 'lucide-react';
import Checkbox from '@mui/material/Checkbox';
import { usePlayerStore } from '../../store/usePlayerStore';
import { M3Selector } from '../M3Selector';

const FONT_OPTIONS = [
  { id: 'system-ui, -apple-system, sans-serif', name: 'System Default', desc: 'Native OS typeface' },
  { id: "'Plus Jakarta Sans', system-ui, sans-serif", name: 'Google Sans / Jakarta', desc: 'Modern geometric sans', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" },
  { id: "'Outfit', system-ui, sans-serif", name: 'Outfit', desc: 'Warm display sans', fontFamily: "'Outfit', system-ui, sans-serif" },
  { id: "'Inter', system-ui, sans-serif", name: 'Inter Clean', desc: 'Neutral high-legibility sans', fontFamily: "'Inter', system-ui, sans-serif" },
  { id: "'Lexend', system-ui, sans-serif", name: 'Lexend', desc: 'Designed for fluid reading', fontFamily: "'Lexend', system-ui, sans-serif" },
  { id: "'Poppins', system-ui, sans-serif", name: 'Poppins', desc: 'Geometric round shapes', fontFamily: "'Poppins', system-ui, sans-serif" },
  { id: "'DM Sans', system-ui, sans-serif", name: 'DM Sans', desc: 'Clean geometric low-contrast', fontFamily: "'DM Sans', system-ui, sans-serif" },
  { id: "'Nunito', system-ui, sans-serif", name: 'Nunito (Rounded)', desc: 'Soft rounded terminals', fontFamily: "'Nunito', system-ui, sans-serif" },
];

const ANIMATION_OPTIONS = [
  { id: 'apple_fluid', name: 'Apple Fluid', desc: 'Dynamic spring & focal tracking' },
  { id: 'karaoke_pulse', name: 'Karaoke Pulse', desc: 'Rhythmic scale pop & jumping text' },
  { id: 'kinetic_slide', name: 'Kinetic Slide', desc: 'Glides smoothly from leading edge' },
  { id: 'cinematic_blur', name: 'Cinematic Focus', desc: 'Soft background depth blur' },
  { id: 'lossless_glow', name: 'Lossless Glow', desc: 'Vibrant neon gradient & glass glow' },
  { id: 'card_pop', name: 'Glass Elevation', desc: '3D floating frosted card lift' },
  { id: 'apple_zoom', name: 'Dynamic Focus Zoom', desc: 'Expanded magnification with push' },
  { id: 'minimal_wave', name: 'Minimal Clean', desc: 'Low-latency opacity transitions' },
] as const;

interface LyricsTypographySectionProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  shouldShow: boolean;
  toTitleCase: (str: string) => string;
}

export const LyricsTypographySection: React.FC<LyricsTypographySectionProps> = ({
  isCollapsed,
  onToggleCollapse,
  shouldShow,
  toTitleCase,
}) => {
  const lyricsFontFamily = usePlayerStore((s) => s.lyricsFontFamily);
  const setLyricsFontFamily = usePlayerStore((s) => s.setLyricsFontFamily);
  const lyricsFontSizePreset = usePlayerStore((s) => s.lyricsFontSizePreset);
  const setLyricsFontSizePreset = usePlayerStore((s) => s.setLyricsFontSizePreset);
  const lyricsAnimationStyle = usePlayerStore((s) => s.lyricsAnimationStyle);
  const setLyricsAnimationStyle = usePlayerStore((s) => s.setLyricsAnimationStyle);

  const isRomanizationEnabled = usePlayerStore((s) => s.isRomanizationEnabled);
  const toggleRomanization = usePlayerStore((s) => s.toggleRomanization);
  const romanizationMode = usePlayerStore((s) => s.romanizationMode);
  const setRomanizationMode = usePlayerStore((s) => s.setRomanizationMode);

  const isTranslationEnabled = usePlayerStore((s) => s.isTranslationEnabled);
  const toggleTranslation = usePlayerStore((s) => s.toggleTranslation);
  const translationMode = usePlayerStore((s) => s.translationMode);
  const setTranslationMode = usePlayerStore((s) => s.setTranslationMode);

  const lrclibAutoFetch = usePlayerStore((s) => s.lrclibAutoFetch);
  const setLrclibAutoFetch = usePlayerStore((s) => s.setLrclibAutoFetch);
  const preferWordSyncedLyrics = usePlayerStore((s) => s.preferWordSyncedLyrics);
  const togglePreferWordSyncedLyrics = usePlayerStore((s) => s.togglePreferWordSyncedLyrics);
  const inferWordSyncedLyrics = usePlayerStore((s) => s.inferWordSyncedLyrics);
  const toggleInferWordSyncedLyrics = usePlayerStore((s) => s.toggleInferWordSyncedLyrics);
  const autoEmbedLyrics = usePlayerStore((s) => s.autoEmbedLyrics);
  const toggleAutoEmbedLyrics = usePlayerStore((s) => s.toggleAutoEmbedLyrics);
  const preferOnlineLyrics = usePlayerStore((s) => s.preferOnlineLyrics);
  const setPreferOnlineLyrics = usePlayerStore((s) => s.setPreferOnlineLyrics);
  const showAudioSpecs = usePlayerStore((s) => s.showAudioSpecs);
  const toggleShowAudioSpecs = usePlayerStore((s) => s.toggleShowAudioSpecs);
  const autoHideLyricsControls = usePlayerStore((s) => s.autoHideLyricsControls);
  const toggleAutoHideLyricsControls = usePlayerStore((s) => s.toggleAutoHideLyricsControls);
  const isWavySeekbarEnabled = usePlayerStore((s) => s.isWavySeekbarEnabled);
  const toggleWavySeekbar = usePlayerStore((s) => s.toggleWavySeekbar);

  const handleRomanizationChange = (targetMode: 'off' | 'below' | 'replace') => {
    if (targetMode === 'off') {
      if (isRomanizationEnabled) toggleRomanization();
    } else {
      if (!isRomanizationEnabled) toggleRomanization();
      setRomanizationMode(targetMode);
    }
  };

  const handleTranslationChange = (targetMode: 'off' | 'below' | 'replace') => {
    if (targetMode === 'off') {
      if (isTranslationEnabled) toggleTranslation();
    } else {
      if (!isTranslationEnabled) toggleTranslation();
      setTranslationMode(targetMode);
    }
  };

  const currentRomanizationState = !isRomanizationEnabled ? 'off' : romanizationMode;
  const currentTranslationState = !isTranslationEnabled ? 'off' : translationMode;

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
            <TypeIcon className="w-4.5 h-4.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-sm font-bold text-white">Lyrics Display, Typography & Sync</h3>
            <p className="text-xs text-zinc-400 truncate">
              Fonts, animation styles, 3-state Romanization & Translation, and LRCLIB sync
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-white/5 border border-white/10 text-zinc-300">
            {toTitleCase(lyricsFontSizePreset)} • {toTitleCase(lyricsAnimationStyle)}
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
            {/* Lyrics Typography Setting */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 gap-2.5 col-span-1 md:col-span-2">
              <div className="flex items-center gap-2.5">
                <TypeIcon className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Lyrics Font Family</span>
                  <span className="text-[11px] text-zinc-400">Typeface for synced & unsynced lyrics</span>
                </div>
              </div>
              <div className="w-full sm:w-72">
                <M3Selector
                  value={lyricsFontFamily}
                  onChange={(val) => setLyricsFontFamily(val)}
                  options={FONT_OPTIONS}
                  size="sm"
                />
              </div>
            </div>

            {/* Lyrics Font Size Preset */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 gap-2.5 col-span-1 md:col-span-2">
              <div className="flex items-center gap-2.5">
                <Mic2 className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Font Size Scaling</span>
                  <span className="text-[11px] text-zinc-400">Default sizing preset for lyrics viewport</span>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
                {(['normal', 'balanced', 'large', 'maximum'] as const).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setLyricsFontSizePreset(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                      lyricsFontSizePreset === preset
                        ? 'text-white shadow-md font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    style={lyricsFontSizePreset === preset ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                  >
                    {preset === 'maximum' ? 'Max' : preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Lyric Animation Style Setting */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 gap-2.5 col-span-1 md:col-span-2">
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Motion & Animation Style</span>
                  <span className="text-[11px] text-zinc-400">Fluid spring motion and focal tracking</span>
                </div>
              </div>
              <div className="w-full sm:w-72">
                <M3Selector
                  value={lyricsAnimationStyle}
                  onChange={(val) => setLyricsAnimationStyle(val as any)}
                  options={ANIMATION_OPTIONS}
                  size="sm"
                />
              </div>
            </div>

            {/* 3-State Romanization Multi-Segment Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 gap-3 col-span-1 md:col-span-2">
              <div className="flex items-center gap-2.5">
                <Languages className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Lyric Romanization</span>
                  <span className="text-[11px] text-zinc-400">Pronunciation for Japanese, Korean & Chinese</span>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
                <button
                  onClick={() => handleRomanizationChange('off')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    currentRomanizationState === 'off'
                      ? 'text-white shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  style={currentRomanizationState === 'off' ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                >
                  Off
                </button>
                <button
                  onClick={() => handleRomanizationChange('below')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    currentRomanizationState === 'below'
                      ? 'text-white shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  style={currentRomanizationState === 'below' ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                >
                  Below Original
                </button>
                <button
                  onClick={() => handleRomanizationChange('replace')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    currentRomanizationState === 'replace'
                      ? 'text-white shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  style={currentRomanizationState === 'replace' ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                >
                  Replace Original
                </button>
              </div>
            </div>

            {/* 3-State Translation Multi-Segment Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 gap-3 col-span-1 md:col-span-2">
              <div className="flex items-center gap-2.5">
                <Languages className="w-4 h-4" style={{ color: 'var(--color-stop-2, #8b5cf6)' }} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">English Translation</span>
                  <span className="text-[11px] text-zinc-400">Display English meaning when translated LRC tags exist</span>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
                <button
                  onClick={() => handleTranslationChange('off')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    currentTranslationState === 'off'
                      ? 'text-white shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  style={currentTranslationState === 'off' ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                >
                  Off
                </button>
                <button
                  onClick={() => handleTranslationChange('below')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    currentTranslationState === 'below'
                      ? 'text-white shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  style={currentTranslationState === 'below' ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                >
                  Below Original
                </button>
                <button
                  onClick={() => handleTranslationChange('replace')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    currentTranslationState === 'replace'
                      ? 'text-white shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  style={currentTranslationState === 'replace' ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                >
                  Replace Original
                </button>
              </div>
            </div>

            {/* Sync & Feature Toggles Grid */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-2.5">
                <Mic2 className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Auto-fetch Online Lyrics</span>
                  <span className="text-[10px] text-zinc-400">Search online providers if embedded is missing</span>
                </div>
              </div>
              <Checkbox
                checked={lrclibAutoFetch}
                onChange={(e) => setLrclibAutoFetch(e.target.checked)}
                size="small"
                sx={{
                  color: 'var(--color-stop-1, #6366f1)',
                  '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                  p: 0.5,
                }}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-2.5">
                <Mic2 className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Prefer Syllable/Word Sync</span>
                  <span className="text-[10px] text-zinc-400">Fetch word-level timestamps when available</span>
                </div>
              </div>
              <Checkbox
                checked={preferWordSyncedLyrics}
                onChange={togglePreferWordSyncedLyrics}
                size="small"
                sx={{
                  color: 'var(--color-stop-1, #6366f1)',
                  '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                  p: 0.5,
                }}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4" style={{ color: 'var(--color-stop-3, #ec4899)' }} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Infer Word-by-Word Sync</span>
                  <span className="text-[10px] text-zinc-400">Estimate word timing for standard LRC lines</span>
                </div>
              </div>
              <Checkbox
                checked={inferWordSyncedLyrics}
                onChange={toggleInferWordSyncedLyrics}
                size="small"
                sx={{
                  color: 'var(--color-stop-1, #6366f1)',
                  '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                  p: 0.5,
                }}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-2.5">
                <Download className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Auto-embed to Audio Files</span>
                  <span className="text-[10px] text-zinc-400">Save fetched lyrics directly to file tags</span>
                </div>
              </div>
              <Checkbox
                checked={autoEmbedLyrics}
                onChange={toggleAutoEmbedLyrics}
                size="small"
                sx={{
                  color: 'var(--color-stop-1, #6366f1)',
                  '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                  p: 0.5,
                }}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-2.5">
                <Mic2 className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Prefer Online Over Embedded</span>
                  <span className="text-[10px] text-zinc-400">Check online providers before embedded tags</span>
                </div>
              </div>
              <Checkbox
                checked={preferOnlineLyrics}
                onChange={(e) => setPreferOnlineLyrics(e.target.checked)}
                size="small"
                sx={{
                  color: 'var(--color-stop-1, #6366f1)',
                  '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                  p: 0.5,
                }}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4" style={{ color: 'var(--color-stop-2, #8b5cf6)' }} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Show Audio Specs Badge</span>
                  <span className="text-[10px] text-zinc-400">Display sample rate (kHz) & bit depth</span>
                </div>
              </div>
              <Checkbox
                checked={showAudioSpecs}
                onChange={() => toggleShowAudioSpecs()}
                size="small"
                sx={{
                  color: 'var(--color-stop-1, #6366f1)',
                  '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                  p: 0.5,
                }}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-2.5">
                <Info className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Auto-hide Lyrics Controls</span>
                  <span className="text-[10px] text-zinc-400">Fade buttons after mouse stops moving</span>
                </div>
              </div>
              <Checkbox
                checked={autoHideLyricsControls}
                onChange={() => toggleAutoHideLyricsControls()}
                size="small"
                sx={{
                  color: 'var(--color-stop-1, #6366f1)',
                  '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                  p: 0.5,
                }}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-2.5">
                <Waves className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Wavy Seekbar</span>
                  <span className="text-[10px] text-zinc-400">Dynamic 3-layer frosted waveform seekbar</span>
                </div>
              </div>
              <Checkbox
                checked={isWavySeekbarEnabled}
                onChange={toggleWavySeekbar}
                size="small"
                sx={{
                  color: 'var(--color-stop-1, #6366f1)',
                  '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                  p: 0.5,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
