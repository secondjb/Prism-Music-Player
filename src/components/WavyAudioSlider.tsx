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
  active?: boolean;
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
  step: _step = 0.1,
  onChange,
  onChangeCommitted,
  formatTooltip,
  className = '',
  size = 'md',
  title,
  active = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverVal, setHoverVal] = useState<number | null>(null);
  const [tooltipX, setTooltipX] = useState<number>(0);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const activeRef = useRef(active);
  activeRef.current = active;
  const requestTickRef = useRef<(() => void) | null>(null);

  // Persistent references so the animation and interpolation loops NEVER restart when props update
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const isDraggingRef = useRef(isDragging);
  isDraggingRef.current = isDragging;

  const hoverValRef = useRef(hoverVal);
  hoverValRef.current = hoverVal;

  const minRef = useRef(min);
  minRef.current = min;

  const maxRef = useRef(max);
  maxRef.current = max;

  const sizeRef = useRef(size);
  sizeRef.current = size;

  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipTextRef = useRef<HTMLSpanElement>(null);

  const syncRef = useRef({ val: value, timestamp: performance.now() });
  useEffect(() => {
    syncRef.current = { val: value, timestamp: performance.now() };
    requestTickRef.current?.();
  }, [value]);

  useEffect(() => {
    requestTickRef.current?.();
  }, [isPlaying, isDragging, active]);

  const thumbRadius = size === 'sm' ? 5.0 : size === 'lg' ? 7.0 : 6.0;
  const paddingX = thumbRadius + 4;

  const formatDisplay = useCallback(
    (val: number) => {
      if (formatTooltip) return formatTooltip(val);
      return `${Math.round(((val - min) / (max - min || 1)) * 100)}%`;
    },
    [formatTooltip, min, max]
  );

  const updateFromPointer = useCallback(
    (clientX: number, isCommit = false) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left - paddingX;
      const availableWidth = Math.max(1, rect.width - 2 * paddingX);
      const ratio = Math.max(0, Math.min(1, clickX / availableWidth));
      
      // Continuous precision during dragging for fluid analog movement
      const rawVal = min + ratio * (max - min);
      const clampedVal = Math.max(min, Math.min(max, rawVal));

      const rawCursorX = clientX - rect.left;
      const clampedCursorX = Math.max(0, Math.min(rect.width, rawCursorX));

      // Synchronous, zero-latency DOM updates for instantaneous cursor tracking
      if (tooltipRef.current) {
        tooltipRef.current.style.left = `${clampedCursorX}px`;
      }
      if (tooltipTextRef.current) {
        tooltipTextRef.current.textContent = formatDisplay(clampedVal);
      }

      setHoverVal(clampedVal);
      setTooltipX(clampedCursorX);
      onChange(clampedVal);

      if (isCommit && onChangeCommitted) {
        onChangeCommitted(clampedVal);
      }
    },
    [min, max, paddingX, formatDisplay, onChange, onChangeCommitted]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left - paddingX;
      const availableWidth = Math.max(1, rect.width - 2 * paddingX);
      const ratio = Math.max(0, Math.min(1, clickX / availableWidth));
      const rawVal = min + ratio * (max - min);
      const clampedVal = Math.max(min, Math.min(max, rawVal));

      const rawCursorX = e.clientX - rect.left;
      const clampedCursorX = Math.max(0, Math.min(rect.width, rawCursorX));

      if (tooltipRef.current) {
        tooltipRef.current.style.left = `${clampedCursorX}px`;
      }
      if (tooltipTextRef.current) {
        tooltipTextRef.current.textContent = formatDisplay(clampedVal);
      }

      setHoverVal(clampedVal);
      setTooltipX(clampedCursorX);

      if (isDragging) {
        onChange(clampedVal);
      }
    },
    [min, max, paddingX, isDragging, formatDisplay, onChange]
  );

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (!isDragging) setHoverVal(null);
  }, [isDragging]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setIsDragging(true);
      updateFromPointer(e.clientX, false);
    },
    [updateFromPointer]
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        setIsDragging(false);
        updateFromPointer(e.clientX, true);
      }
    },
    [isDragging, updateFromPointer]
  );

  const handleGlobalMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        updateFromPointer(e.clientX, false);
      }
    },
    [isDragging, updateFromPointer]
  );

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleGlobalMouseMove, handleMouseUp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    let accumulatedWaveTime = 0;
    let cachedWidth = Math.max(1, canvas.clientWidth || 300);
    let cachedHeight = Math.max(1, canvas.clientHeight || 24);

    const smootherstep = (t: number) => {
      const c = Math.max(0, Math.min(1, t));
      return c * c * c * (c * (c * 6 - 15) + 10);
    };

    const render = (now: number) => {
      const dt = Math.min(100, Math.max(0, now - lastTime));
      lastTime = now;
      if (isPlayingRef.current && !isDraggingRef.current) {
        accumulatedWaveTime += dt;
      }

      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.round(cachedWidth * dpr);
      const targetH = Math.round(cachedHeight * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      ctx.resetTransform?.();
      ctx.scale(dpr, dpr);

      const width = cachedWidth;
      const height = cachedHeight;
      const centerY = height / 2;
      const currentSize = sizeRef.current;

      let baseAmp1: number;
      let baseAmp2: number;
      let baseAmp3: number;
      let trackThickness: number;
      let currentThumbRadius: number;

      if (currentSize === 'lg') {
        baseAmp1 = 12.0;
        baseAmp2 = 9.0;
        baseAmp3 = 6.5;
        trackThickness = 4.5;
        currentThumbRadius = 7.0;
      } else if (currentSize === 'sm') {
        baseAmp1 = 6.5;
        baseAmp2 = 4.8;
        baseAmp3 = 3.5;
        trackThickness = 3.5;
        currentThumbRadius = 5.0;
      } else {
        baseAmp1 = 9.5;
        baseAmp2 = 7.0;
        baseAmp3 = 5.0;
        trackThickness = 4.0;
        currentThumbRadius = 6.0;
      }

      const currentPaddingX = currentThumbRadius + 4;

      // Smooth continuous position interpolation across all screen refresh rates
      let currentVal = syncRef.current.val;
      if (isDraggingRef.current && hoverValRef.current !== null) {
        currentVal = hoverValRef.current;
      } else if (isPlayingRef.current) {
        const elapsedSec = (now - syncRef.current.timestamp) / 1000;
        const currentMax = maxRef.current || 1;
        const currentMin = minRef.current || 0;
        currentVal = Math.min(currentMax, Math.max(currentMin, syncRef.current.val + elapsedSec));
      }

      const currentMax = maxRef.current || 1;
      const currentMin = minRef.current || 0;
      const percent = Math.max(0, Math.min(1, (currentVal - currentMin) / (currentMax - currentMin || 1)));

      const activeTrackWidth = Math.max(1, width - 2 * currentPaddingX);
      const thumbX = currentPaddingX + percent * activeTrackWidth;

      // Dynamic theme colors
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

      const layer1Light = shiftTonalRgba(tertiaryRgb, +0.18, 0.85, 0.42);
      const layer1Dark = shiftTonalRgba(tertiaryRgb, -0.15, 1.30, 0.30);
      const layer2Dark = shiftTonalRgba(secondaryRgb, -0.16, 1.30, 0.68);
      const layer2Light = shiftTonalRgba(secondaryRgb, +0.18, 0.85, 0.58);
      const layer3Light = shiftTonalRgba(primaryRgb, +0.20, 0.90, 0.98);
      const layer3Dark = shiftTonalRgba(primaryRgb, -0.14, 1.35, 0.90);
      const thumbGlowColor = shiftTonalRgba(primaryRgb, -0.10, 1.25, 0.32);
      const thumbSolidColor = shiftTonalRgba(primaryRgb, +0.15, 0.95, 1.0);

      // LastWave-native continuous wave phases (2400ms, 1800ms, 1300ms)
      const phase1 = ((accumulatedWaveTime % 2400) / 2400) * 2 * Math.PI + 2.2;
      const phase2 = ((accumulatedWaveTime % 1800) / 1800) * 2 * Math.PI + 1.2;
      const phase3 = ((accumulatedWaveTime % 1300) / 1300) * 2 * Math.PI;

      ctx.clearRect(0, 0, width, height);

      // 1. Inactive background track
      ctx.beginPath();
      ctx.moveTo(currentPaddingX, centerY);
      ctx.lineTo(width - currentPaddingX, centerY);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = trackThickness;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 2. Active Waves
      if (thumbX > currentPaddingX) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(currentPaddingX - trackThickness, 0, thumbX - currentPaddingX + 2 * trackThickness, height);
        ctx.clip();

        const activeSpan = thumbX - currentPaddingX;
        const transitionLength = Math.min(44, activeSpan * 0.48);
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
          ctx.moveTo(currentPaddingX, centerY);

          const invWavelength2Pi = (2 * Math.PI) / wavelength;
          for (let x = currentPaddingX; x <= thumbX; x += 1.5) {
            const relX = x - currentPaddingX;
            const startEnv = invTransition > 0 ? smootherstep(relX * invTransition) : 1;
            const endEnv = invTransition > 0 ? smootherstep((activeSpan - relX) * invTransition) : 1;
            const envelope = startEnv * endEnv;

            const angle = relX * invWavelength2Pi - phase;
            const waveHeight = (0.5 + 0.5 * Math.sin(angle)) * amplitude * envelope;
            const y = centerY - waveHeight;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(thumbX, centerY);

          const grad = ctx.createLinearGradient(currentPaddingX, centerY, thumbX, centerY);
          grad.addColorStop(0, strokeColor1);
          grad.addColorStop(1, strokeColor2);

          ctx.strokeStyle = grad;
          ctx.lineWidth = strokeWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
        };

        const amp1 = isDraggingRef.current ? 1.5 : baseAmp1;
        const amp2 = isDraggingRef.current ? 1.5 : baseAmp2;
        const amp3 = isDraggingRef.current ? 1.5 : baseAmp3;

        populateWave(160, amp1, phase1, layer1Light, layer1Dark, currentSize === 'sm' ? 1.0 : 1.2);
        populateWave(125, amp2, phase2, layer2Dark, layer2Light, currentSize === 'sm' ? 1.2 : 1.5);
        populateWave(95, amp3, phase3, layer3Light, layer3Dark, currentSize === 'sm' ? 1.6 : 2.0);

        // 3. Crisp Baseline Bar
        const baseGrad = ctx.createLinearGradient(currentPaddingX, centerY, thumbX, centerY);
        baseGrad.addColorStop(0, layer3Light);
        baseGrad.addColorStop(1, layer3Dark);
        ctx.beginPath();
        ctx.moveTo(currentPaddingX, centerY);
        ctx.lineTo(thumbX, centerY);
        ctx.strokeStyle = baseGrad;
        ctx.lineWidth = trackThickness;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.restore();

        // 4. Leading Thumb Indicator
        ctx.beginPath();
        ctx.arc(thumbX, centerY, currentThumbRadius + 3.5, 0, Math.PI * 2);
        ctx.fillStyle = thumbGlowColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(thumbX, centerY, currentThumbRadius, 0, Math.PI * 2);
        ctx.fillStyle = thumbSolidColor;
        ctx.fill();
      }
    };

    let isLoopRunning = false;

    const loop = (now: number) => {
      if (!activeRef.current) {
        isLoopRunning = false;
        return;
      }
      render(now);
      if (isPlayingRef.current || isDraggingRef.current) {
        animationFrameId = requestAnimationFrame(loop);
      } else {
        isLoopRunning = false;
      }
    };

    const requestTick = () => {
      if (!activeRef.current) return;
      if (!isLoopRunning) {
        isLoopRunning = true;
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(loop);
      }
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          cachedWidth = Math.max(1, Math.round(entry.contentRect.width));
          cachedHeight = Math.max(1, Math.round(entry.contentRect.height));
          requestTick();
        }
      }
    });
    resizeObserver.observe(canvas);

    requestTickRef.current = requestTick;
    requestTick();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, []);

  const displayTooltipVal =
    isDragging && hoverVal !== null ? hoverVal : isHovered && hoverVal !== null ? hoverVal : value;
  const initialTooltipText = formatDisplay(displayTooltipVal);

  const containerHeightClass = size === 'sm' ? 'h-5' : size === 'lg' ? 'h-8' : 'h-6';

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
      {/* Floating Hover/Drag Tooltip - Zero Latency Hardware/DOM Sync */}
      {(isHovered || isDragging) && (
        <div
          ref={tooltipRef}
          style={{
            left: `${tooltipX}px`,
            backgroundColor: 'var(--color-stop-1, #6366f1)',
            borderColor: 'var(--color-stop-2, #818cf8)',
          }}
          className="absolute -top-7 transform -translate-x-1/2 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold text-white shadow-lg pointer-events-none z-30 whitespace-nowrap border"
        >
          <span ref={tooltipTextRef}>{initialTooltipText}</span>
        </div>
      )}

      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
