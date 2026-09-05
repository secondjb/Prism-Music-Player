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
  size?: 'sm' | 'md';
  title?: string;
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
    let phase1 = 2.2;
    let phase2 = 1.2;
    let phase3 = 0.0;

    const smootherstep = (t: number) => {
      const c = Math.max(0, Math.min(1, t));
      return c * c * c * (c * (c * 6 - 15) + 10);
    };

    const render = () => {
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
      const centerY = height / 2 + (size === 'sm' ? 1 : 2);
      const thumbX = Math.max(0, Math.min(width, percent * width));

      ctx.clearRect(0, 0, width, height);

      // 1. Inactive background track capsule bar
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = size === 'sm' ? 3.5 : 4.5;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 2. Active 3-Layer Material Frosted Glass Waves with Dynamic Counter-Gradients
      if (thumbX > 0) {
        ctx.save();
        // Clip to active region up to thumbX with rounded cap
        ctx.beginPath();
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
          lineWidth: number
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
          ctx.lineWidth = lineWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
        };

        const amp1 = isDragging ? 1.5 : size === 'sm' ? 8 : 12;
        const amp2 = isDragging ? 1.5 : size === 'sm' ? 6 : 9;
        const amp3 = isDragging ? 1.5 : size === 'sm' ? 4.5 : 7;

        // Layer 1: Soft organic wave (Light -> Dark)
        populateWave(160, amp1, phase1, 'rgba(129, 140, 248, 0.42)', 'rgba(99, 102, 241, 0.28)', 1.2);

        // Layer 2: Medium harmonic wave (Dark -> Light counter-gradient)
        populateWave(125, amp2, phase2, 'rgba(99, 102, 241, 0.65)', 'rgba(129, 140, 248, 0.55)', 1.5);

        // Layer 3: Vibrant foreground wave
        populateWave(95, amp3, phase3, 'rgba(165, 180, 252, 0.95)', 'rgba(99, 102, 241, 0.88)', 2.0);

        // 3. Crisp Baseline Active Bar
        const baseGrad = ctx.createLinearGradient(0, centerY, thumbX, centerY);
        baseGrad.addColorStop(0, 'var(--color-stop-2, #818cf8)');
        baseGrad.addColorStop(1, 'var(--color-stop-1, #6366f1)');
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(thumbX, centerY);
        ctx.strokeStyle = baseGrad;
        ctx.lineWidth = size === 'sm' ? 3.5 : 4.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.restore();

        // 4. Leading Thumb Indicator with soft glow halo
        const thumbRadius = size === 'sm' ? 5.5 : 7;
        // Glow Halo
        ctx.beginPath();
        ctx.arc(thumbX, centerY, thumbRadius + 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.28)';
        ctx.fill();

        // Solid Center Thumb
        ctx.beginPath();
        ctx.arc(thumbX, centerY, thumbRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      if (isPlaying && !isDragging) {
        phase1 += (2 * Math.PI) / (2400 / 16.6);
        phase2 += (2 * Math.PI) / (1800 / 16.6);
        phase3 += (2 * Math.PI) / (1300 / 16.6);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [percent, isPlaying, isDragging, size]);

  const displayTooltipVal =
    isDragging && hoverVal !== null ? hoverVal : isHovered && hoverVal !== null ? hoverVal : value;
  const tooltipText = formatTooltip
    ? formatTooltip(displayTooltipVal)
    : `${Math.round(((displayTooltipVal - min) / (max - min || 1)) * 100)}%`;

  const containerHeight = size === 'sm' ? 'h-5' : 'h-8';

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      className={`relative flex items-center cursor-pointer select-none group ${containerHeight} ${className}`}
      title={title}
    >
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
      <canvas ref={canvasRef} className="w-full h-full pointer-events-none" />
    </div>
  );
};
