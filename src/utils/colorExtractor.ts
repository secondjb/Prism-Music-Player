// Utility to extract dynamic colors from album art image for the Gemini logo & ambient background gradient

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h * 360, s, l];
}

function hslToRgbString(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  h /= 360;
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

// Default smooth, rich Prism color stops (Indigo -> Purple -> Pink -> Fuchsia -> Blue -> Violet)
const DEFAULT_COLOR_STOPS = [
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#D946EF', // Fuchsia
  '#3B82F6', // Blue
  '#818CF8', // Light Indigo
];

/**
 * Fast, zero-dependency YIQ relative luminance calculation to determine
 * whether dark (#09090b) or light (#ffffff) text should be used for optimal contrast.
 */
export function getContrastTextColor(color: string): string {
  let r = 0;
  let g = 0;
  let b = 0;

  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const num = parseInt(hex, 16);
    r = (num >> 16) & 255;
    g = (num >> 8) & 255;
    b = num & 255;
  } else if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      r = parseInt(match[0], 10);
      g = parseInt(match[1], 10);
      b = parseInt(match[2], 10);
    }
  }

  // YIQ luminance formula ((r * 299) + (g * 587) + (b * 114)) / 1000
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 145 ? '#09090b' : '#ffffff';
}

function applyColorStops(stops: string[]): void {
  stops.forEach((color, idx) => {
    const contrastText = getContrastTextColor(color);
    document.documentElement.style.setProperty(`--color-stop-${idx + 1}`, color);
    document.documentElement.style.setProperty(`--color-stop-${idx + 1}-text`, contrastText);
  });
}

let currentExtractRequestId = 0;

export function updateLogoGradientFromImage(imageSrc?: string | null): void {
  const requestId = ++currentExtractRequestId;
  if (!imageSrc) {
    applyColorStops(DEFAULT_COLOR_STOPS);
    return;
  }

  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.onload = () => {
    if (requestId !== currentExtractRequestId) return;
    try {
      const sampleSize = 48;
      const canvas = document.createElement('canvas');
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
      const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;

      // 18 hue bins (each 20 degrees)
      const numBins = 18;
      const bins = Array.from({ length: numBins }, () => ({
        count: 0,
        totalSat: 0,
        totalLight: 0,
        totalHue: 0,
        score: 0,
      }));

      let totalValidVibrant = 0;

      for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        const a = imgData[i + 3];

        if (a < 128) continue;

        const [h, s, l] = rgbToHsl(r, g, b);

        // Ignore near-black, near-white, and muddy grays for vibrant dominant color extraction
        if (l < 0.12 || l > 0.92 || s < 0.14) continue;

        const binIdx = Math.min(numBins - 1, Math.floor(h / (360 / numBins)));
        const bin = bins[binIdx];
        bin.count++;
        bin.totalSat += s;
        bin.totalLight += l;
        bin.totalHue += h;
        // Weight by saturation and balance of lightness (favor vibrant midtones)
        const vibrancyWeight = Math.pow(s, 1.4) * (1 - Math.abs(l - 0.52) * 1.3);
        bin.score += Math.max(0.1, vibrancyWeight);
        totalValidVibrant++;
      }

      // Sort bins by vibrancy score
      const sortedBins = bins
        .filter((b) => b.count > 0)
        .map((b) => ({
          h: b.totalHue / b.count,
          s: b.totalSat / b.count,
          l: b.totalLight / b.count,
          score: b.score,
          count: b.count,
        }))
        .sort((a, b) => b.score - a.score);

      if (sortedBins.length === 0 || totalValidVibrant < 10) {
        // Fallback for monochrome or dark covers: gentle neutral violet/slate
        applyColorStops(DEFAULT_COLOR_STOPS);
        return;
      }

      const primary = sortedBins[0];
      const secondary = sortedBins.length > 1 ? sortedBins[1] : null;
      const tertiary = sortedBins.length > 2 ? sortedBins[2] : null;

      const normSat = Math.min(0.88, Math.max(0.55, primary.s * 1.15));
      const normLight = Math.min(0.62, Math.max(0.46, primary.l));

      // Build 6 harmonic, vivid color stops centered around the true dominant cover color
      const stop1 = hslToRgbString(primary.h, normSat, normLight);
      const stop2 = secondary
        ? hslToRgbString(secondary.h, Math.min(0.85, Math.max(0.5, secondary.s * 1.1)), Math.min(0.6, Math.max(0.45, secondary.l)))
        : hslToRgbString(primary.h + 25, normSat * 0.95, normLight);
      const stop3 = tertiary
        ? hslToRgbString(tertiary.h, Math.min(0.85, Math.max(0.5, tertiary.s * 1.1)), Math.min(0.6, Math.max(0.45, tertiary.l)))
        : hslToRgbString(primary.h - 30, normSat * 0.9, normLight * 1.05);
      const stop4 = hslToRgbString(primary.h + 50, normSat * 0.85, Math.min(0.65, normLight * 1.08));
      const stop5 = hslToRgbString(primary.h - 45, normSat * 0.9, Math.max(0.42, normLight * 0.92));
      const stop6 = hslToRgbString(primary.h + 15, Math.min(0.9, normSat * 1.05), Math.min(0.68, normLight * 1.12));

      const finalStops = [stop1, stop2, stop3, stop4, stop5, stop6];
      applyColorStops(finalStops);
    } catch (e) {
      console.warn('Failed to extract album art colors:', e);
    }
  };
  img.onerror = () => {
    if (requestId !== currentExtractRequestId) return;
    applyColorStops(DEFAULT_COLOR_STOPS);
  };
  img.src = imageSrc;
}
