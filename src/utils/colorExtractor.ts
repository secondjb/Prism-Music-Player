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

export function updateLogoGradientFromImage(imageSrc?: string | null): void {
  if (!imageSrc) {
    DEFAULT_COLOR_STOPS.forEach((color, idx) => {
      document.documentElement.style.setProperty(`--color-stop-${idx + 1}`, color);
    });
    return;
  }

  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 6;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, 6, 1);
      const imgData = ctx.getImageData(0, 0, 6, 1).data;

      for (let i = 0; i < 6; i++) {
        const r = imgData[i * 4];
        const g = imgData[i * 4 + 1];
        const b = imgData[i * 4 + 2];

        // Smooth, elegant color normalization for dark UI (never oversaturated or overly bright)
        const [h, s, l] = rgbToHsl(r, g, b);
        const smoothColor = hslToRgbString(
          h,
          Math.min(0.75, Math.max(0.4, s)),
          Math.min(0.6, Math.max(0.45, l))
        );

        document.documentElement.style.setProperty(`--color-stop-${i + 1}`, smoothColor);
      }
    } catch (e) {
      console.warn('Failed to extract album art colors:', e);
    }
  };
  img.onerror = () => {
    DEFAULT_COLOR_STOPS.forEach((color, idx) => {
      document.documentElement.style.setProperty(`--color-stop-${idx + 1}`, color);
    });
  };
  img.src = imageSrc;
}
