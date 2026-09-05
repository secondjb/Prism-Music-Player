import React, { useRef, useEffect, useState, useCallback } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';

interface WavyAudioSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  onChangeCommitted?: (val: number) => void;
  formatTooltip?: (val: number) => string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  title?: string;
}

// Convert CSS hex or rgb string to [r, g, b] in 0-255
function parseRgb(colorStr: string, fallback: [number, number, number] = [99, 102, 241]): [number, number, number] {
  try {
    const s = colorStr.trim();
    if (s.startsWith('#')) {
      let hex = s.slice(1);
      if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
      const n = parseInt(hex, 16);
      if (!isNaN(n)) return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    } else if (s.startsWith('rgb')) {
      const match = s.match(/\(([^)]+)\)/);
      if (match) {
        const parts = match[1].split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
        if (parts.length >= 3) return [parts[0], parts[1], parts[2]];
      }
    }
  } catch {
    // ignore
  }
  return fallback;
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (max !== min) {
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
  return [h * 360, s, v];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor((h / 60) % 6);
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0, g = 0, b = 0;
  switch (i) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function shiftTonalRgba(rgb: [number, number, number], lightnessDelta: number, saturationScale: number = 1.0, alpha: number = 1.0): string {
  const [h, s, v] = rgbToHsv(rgb[0], rgb[1], rgb[2]);
  const newS = Math.max(0.15, Math.min(1.0, s * saturationScale));
  const newV = Math.max(0.15, Math.min(1.0, v + lightnessDelta));
  const [outR, outG, outB] = hsvToRgb(h, newS, newV);
  return `rgba(${outR}, ${outG}, ${outB}, ${alpha.toFixed(3)})`;
}

export const WavyAudioSlider: React.FC<WavyAudioSliderProps> = ({
  value,
  min = 0,
  max = 100,
  step = 0.1,
  onChange,
  onChangeCommitted,
  formatTooltip,
  className = '',
  size = 'md',
  title,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverVal, setHoverVal] = useState<number | null>(null);
  const [tooltipX, setTooltipX] = useState<number>(0);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const percent = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / (rect.width || 1)));
      const rawVal = min + ratio * (max - min);
      const steppedVal = Math.round(rawVal / step) * step;
      setHoverVal(steppedVal);
      setTooltipX(clickX);
      if (isDragging) {
        onChange(steppedVal);
      }
    },
    [min, max, step, isDragging, onChange]
  );

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setHoverVal(null);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setIsDragging(true);
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / (rect.width || 1)));
      const rawVal = min + ratio * (max - min);
      const steppedVal = Math.round(rawVal / step) * step;
      onChange(steppedVal);
    },
    [min, max, step, onChange]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      if (onChangeCommitted && hoverVal !== null) {
        onChangeCommitted(hoverVal);
      }
    }
  }, [isDragging, onChangeCommitted, hoverVal]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isDragging, handleMouseUp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    let accumulatedTime = 0;

    const smootherstep = (t: number) => {
      const c = Math.max(0, Math.min(1, t));
      return c * c * c * (c * (c * 6 - 15) + 10);
    };

    const render = (now: number) => {
      const dt = Math.min(100, Math.max(0, now - lastTime));
      lastTime = now;
      if (isPlaying && !isDragging) {
        accumulatedTime += dt;
      }

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }
      ctx.resetTransform?.();
      ctx.scale(dpr, dpr);

      const width = rect.width;
      const height = rect.height;

      // Sizing configurations aligned with LastWave-native 50dp specs
      let centerY: number;
      let baseAmp1: number;
      let baseAmp2: number;
      let baseAmp3: number;
      let trackThickness: number;
      let thumbRadius: number;

      if (size === 'lg') {
        centerY = height / 2 + 7;
        baseAmp1 = 14;
        baseAmp2 = 10.5;
        baseAmp3 = 7.5;
        trackThickness = 4.5;
        thumbRadius = 7.5;
      } else if (size === 'sm') {
        centerY = height / 2 + 3.5;
        baseAmp1 = 7.5;
        baseAmp2 = 5.5;
        baseAmp3 = 4;
        trackThickness = 3.5;
        thumbRadius = 5.5;
      } else {
        centerY = height / 2 + 5;
        baseAmp1 = 11;
        baseAmp2 = 8;
        baseAmp3 = 6;
        trackThickness = 4;
        thumbRadius = 6.5;
      }

      const thumbX = Math.max(0, Math.min(width, percent * width));

      // Resolve computed dynamic theme colors
      let rawColor1 = '#6366f1';
      let rawColor2 = '#818cf8';
      try {
        const rootStyle = getComputedStyle(document.documentElement);
        const c1 = rootStyle.getPropertyValue('--color-stop-1').trim();
        const c2 = rootStyle.getPropertyValue('--color-stop-2').trim();
        if (c1 && !c1.startsWith('var(')) rawColor1 = c1;
        if (c2 && !c2.startsWith('var(')) rawColor2 = c2;
      } catch {
        // fallback
      }

      const primaryRgb = parseRgb(rawColor1, [99, 102, 241]);
      const secondaryRgb = parseRgb(rawColor2, [129, 140, 248]);
      const tertiaryRgb = secondaryRgb;

      // LastWave-native tonal shift palette
      const layer1Light = shiftTonalRgba(tertiaryRgb, +0.18, 0.85, 0.42);
      const layer1Dark = shiftTonalRgba(tertiaryRgb, -0.15, 1.30, 0.30);
      const layer2Dark = shiftTonalRgba(secondaryRgb, -0.16, 1.30, 0.68);
      const layer2Light = shiftTonalRgba(secondaryRgb, +0.18, 0.85, 0.58);
      const layer3Light = shiftTonalRgba(primaryRgb, +0.20, 0.90, 0.98);
      const layer3Dark = shiftTonalRgba(primaryRgb, -0.14, 1.35, 0.90);
      const thumbGlowColor = shiftTonalRgba(primaryRgb, -0.10, 1.25, 0.32);
      const thumbSolidColor = shiftTonalRgba(primaryRgb, +0.15, 0.95, 1.0);

      // Methodical, slow, hypnotic wave cycles (delta-time based, refresh-rate independent)
      // Cycles: 4800ms, 3600ms, 2600ms
      const phase1 = ((accumulatedTime % 4800) / 4800) * 2 * Math.PI + 2.2;
      const phase2 = ((accumulatedTime % 3600) / 3600) * 2 * Math.PI + 1.2;
      const phase3 = ((accumulatedTime % 2600) / 2600) * 2 * Math.PI;

      ctx.clearRect(0, 0, width, height);

      // 1. Inactive background track: Full smooth capsule bar with rounded ends
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = trackThickness;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 2. Active 3-Layer Material Frosted Glass Waves with Dynamic Counter-Gradients
      if (thumbX > 0) {
        ctx.save();
        ctx.beginPath();
        // Clip to active region up to thumbX
        ctx.rect(0, 0, thumbX, height);
        ctx.clip();

        const transitionLength = Math.min(44, thumbX * 0.48);
        const invTransition = transitionLength > 0 ? 1 / transitionLength : 0;

        const populateWave = (
          wavelength: number,
          amplitude: number,
          phase: number,
          strokeColor1: string,
          strokeColor2: string,
          strokeWidth: number
        ) => {
          ctx.beginPath();
          ctx.moveTo(0, centerY);

          const invWavelength2Pi = (2 * Math.PI) / wavelength;
          for (let x = 0; x <= thumbX; x += 1.5) {
            const startEnv = invTransition > 0 ? smootherstep(x * invTransition) : 1;
            const endEnv = invTransition > 0 ? smootherstep((thumbX - x) * invTransition) : 1;
            const envelope = startEnv * endEnv;

            const angle = x * invWavelength2Pi - phase;
            const waveHeight = (0.5 + 0.5 * Math.sin(angle)) * amplitude * envelope;
            const y = centerY - waveHeight;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(thumbX, centerY);

          const grad = ctx.createLinearGradient(0, centerY, thumbX, centerY);
          grad.addColorStop(0, strokeColor1);
          grad.addColorStop(1, strokeColor2);

          ctx.strokeStyle = grad;
          ctx.lineWidth = strokeWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
        };

        const amp1 = isDragging ? 1.5 : baseAmp1;
        const amp2 = isDragging ? 1.5 : baseAmp2;
        const amp3 = isDragging ? 1.5 : baseAmp3;

        // Layer 1: Soft organic wave (wavelength 160px)
        populateWave(160, amp1, phase1, layer1Light, layer1Dark, size === 'sm' ? 1.0 : 1.2);

        // Layer 2: Medium harmonic wave (wavelength 125px)
        populateWave(125, amp2, phase2, layer2Dark, layer2Light, size === 'sm' ? 1.2 : 1.5);

        // Layer 3: Vibrant foreground wave (wavelength 95px)
        populateWave(95, amp3, phase3, layer3Light, layer3Dark, size === 'sm' ? 1.6 : 2.0);

        // 3. Crisp Baseline Bar with Light -> Dark dynamic gradient
        const baseGrad = ctx.createLinearGradient(0, centerY, thumbX, centerY);
        baseGrad.addColorStop(0, layer3Light);
        baseGrad.addColorStop(1, layer3Dark);
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(thumbX, centerY);
        ctx.strokeStyle = baseGrad;
        ctx.lineWidth = trackThickness;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.restore();

        // 4. Leading Thumb Indicator (Soft glow halo + solid center circle)
        // Outer soft glow halo
        ctx.beginPath();
        ctx.arc(thumbX, centerY, thumbRadius + 3.5, 0, Math.PI * 2);
        ctx.fillStyle = thumbGlowColor;
        ctx.fill();

        // Inner solid thumb circle
        ctx.beginPath();
        ctx.arc(thumbX, centerY, thumbRadius, 0, Math.PI * 2);
        ctx.fillStyle = thumbSolidColor;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [percent, isPlaying, isDragging, size]);

  const displayTooltipVal =
    isDragging && hoverVal !== null ? hoverVal : isHovered && hoverVal !== null ? hoverVal : value;
  const tooltipText = formatTooltip
    ? formatTooltip(displayTooltipVal)
    : `${Math.round(((displayTooltipVal - min) / (max - min || 1)) * 100)}%`;

  const containerHeightClass = size === 'lg' ? 'h-11' : size === 'sm' ? 'h-7' : 'h-9';

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      className={`relative flex items-center group cursor-pointer select-none ${containerHeightClass} ${className}`}
      title={title}
    >
      {/* Floating Hover/Drag Tooltip */}
      {(isHovered || isDragging) && (
        <div
          style={{
            left: `${tooltipX}px`,
            backgroundColor: 'var(--color-stop-1, #6366f1)',
            borderColor: 'var(--color-stop-2, #818cf8)',
          }}
          className="absolute -top-7 transform -translate-x-1/2 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold text-white shadow-lg pointer-events-none z-30 whitespace-nowrap border animate-in fade-in duration-75"
        >
          {tooltipText}
        </div>
      )}

      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
