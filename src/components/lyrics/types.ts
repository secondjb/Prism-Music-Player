import { ParsedLyricLine } from '../../utils/lyricsParser';

export const BACKGROUND_OPTIONS = [
  { id: 'dynamic_glow', name: 'Ambient Dynamic Glow', desc: 'Flowing animated gradient synced to album artwork palette' },
  { id: 'album_art_blur', name: 'Album Artwork Blur', desc: 'Subtly blurred and dimmed high-resolution album cover backdrop' },
  { id: 'album_art_color', name: 'Album Art Solid Tint', desc: 'Minimalist solid backdrop derived dynamically from current song artwork' },
  { id: 'custom_photo', name: 'Custom Wallpaper Image', desc: 'Select any custom PNG, JPG or WebP wallpaper photo from your PC' },
  { id: 'solid_color', name: 'Solid Minimal Color', desc: 'Clean, distraction-free solid slate or custom picked hex tint' },
  { id: 'amoled_black', name: 'AMOLED Pure Black', desc: 'Zero-light true black #000000 background for OLED displays' },
] as const;

export const FONT_OPTIONS = [
  { id: 'system-ui, -apple-system, sans-serif', name: 'System Default', desc: 'Native OS typeface' },
  { id: "'Plus Jakarta Sans', system-ui, sans-serif", name: 'Google Sans / Jakarta', desc: 'Modern geometric sans', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" },
  { id: "'Outfit', system-ui, sans-serif", name: 'Outfit', desc: 'Warm display sans', fontFamily: "'Outfit', system-ui, sans-serif" },
  { id: "'Inter', system-ui, sans-serif", name: 'Inter Clean', desc: 'Neutral high-legibility sans', fontFamily: "'Inter', system-ui, sans-serif" },
  { id: "'Lexend', system-ui, sans-serif", name: 'Lexend', desc: 'Designed for fluid reading', fontFamily: "'Lexend', system-ui, sans-serif" },
  { id: "'Poppins', system-ui, sans-serif", name: 'Poppins', desc: 'Geometric round shapes', fontFamily: "'Poppins', system-ui, sans-serif" },
  { id: "'DM Sans', system-ui, sans-serif", name: 'DM Sans', desc: 'Clean geometric low-contrast', fontFamily: "'DM Sans', system-ui, sans-serif" },
  { id: "'Nunito', system-ui, sans-serif", name: 'Nunito (Rounded)', desc: 'Soft rounded terminals', fontFamily: "'Nunito', system-ui, sans-serif" },
];

export const ANIMATION_OPTIONS = [
  { id: 'apple_fluid', name: 'Apple Fluid', desc: 'Smooth spring scaling & dynamic focal tracking' },
  { id: 'karaoke_pulse', name: 'Karaoke Pulse', desc: 'Rhythmic scale pop & jumping text bounce' },
  { id: 'kinetic_slide', name: 'Kinetic Slide', desc: 'Active line glides smoothly from edge' },
  { id: 'cinematic_blur', name: 'Cinematic Focus', desc: 'Soft depth blur on surrounding lines' },
  { id: 'lossless_glow', name: 'Lossless Glow', desc: 'Vibrant neon gradient & glass glow' },
  { id: 'card_pop', name: 'Glass Elevation', desc: '3D floating frosted card lift' },
  { id: 'apple_zoom', name: 'Dynamic Focus Zoom', desc: 'Magnified active line with spring push' },
  { id: 'minimal_wave', name: 'Minimal Clean', desc: 'Low-latency clean opacity transitions' },
] as const;

export const formatTime = (secs: number): string => {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export interface InterludeGap {
  key: string;
  startSecs: number;
  endSecs: number;
  insertIndex: number;
}

export interface ActiveLyricState {
  activeIndex: number;
  activeLinesKey: string;
  activeInterludeKey: string | null;
  isCurrentLinePassed: boolean;
}

export const getLineEndSecs = (line: ParsedLyricLine): number => {
  if (line.syllables && line.syllables.length > 0) {
    const lastSyl = line.syllables[line.syllables.length - 1];
    return Math.max(line.startSecs + 1, (lastSyl.timeMs + lastSyl.durationMs) / 1000);
  }
  const wordsCount = line.content.trim().split(/\s+/).filter(Boolean).length;
  const estimatedSecs = Math.max(2.0, Math.min(line.durationSecs || 4.0, wordsCount * 0.55));
  return line.startSecs + estimatedSecs;
};

export function computeActiveLyricState(
  currentTime: number,
  lines: ParsedLyricLine[],
  interludeList: InterludeGap[]
): ActiveLyricState {
  const activeInterlude =
    interludeList.find((item) => currentTime >= item.startSecs && currentTime < item.endSecs) || null;

  let activeIndex = -1;
  const activeLineIndices = new Set<number>();
  let isCurrentLinePassed = false;

  if (lines.length > 0 && lines[0].startSecs !== -1) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startSecs <= currentTime) {
        activeIndex = i;
      }
      let endSecs = getLineEndSecs(line);
      const interludeAfter = interludeList.find((item) => item.insertIndex === i + 1);
      if (interludeAfter) {
        endSecs = Math.min(endSecs, interludeAfter.startSecs);
      }
      if (currentTime >= line.startSecs && currentTime < endSecs) {
        activeLineIndices.add(i);
      }
    }

    if (activeInterlude) {
      activeLineIndices.clear();
    } else if (activeLineIndices.size === 0 && activeIndex !== -1) {
      const currentLine = lines[activeIndex];
      const endSecs = getLineEndSecs(currentLine);
      if (currentTime < endSecs + 1.2) {
        activeLineIndices.add(activeIndex);
      }
    }

    if (activeIndex >= 0) {
      const curLine = lines[activeIndex];
      isCurrentLinePassed = currentTime >= getLineEndSecs(curLine);
    }
  }

  const activeLinesKey = Array.from(activeLineIndices).sort((a, b) => a - b).join(',');

  return {
    activeIndex,
    activeLinesKey,
    activeInterludeKey: activeInterlude?.key || null,
    isCurrentLinePassed,
  };
}
