import React, { useRef, useEffect, useState, useCallback } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';

interface WavyAudioSliderProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  onChangeCommitted?: (val: number) => void;
  formatTooltip?: (val: number) => string;
  className?: string;
  title?: string;
}

export const WavyAudioSlider: React.FC<WavyAudioSliderProps> = ({
  value,
  min = 0,
  max = 100,
  onChange,
  onChangeCommitted,
  formatTooltip,
  className = '',
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
      setHoverVal(rawVal);
      setTooltipX(clickX);
      if (isDragging) {
        onChange(rawVal);
      }
    },
    [min, max, isDragging, onChange]
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
      onChange(rawVal);
    },
    [min, max, onChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    if (onChangeCommitted && hoverVal !== null) {
      onChangeCommitted(hoverVal);
    }
  }, [onChangeCommitted, hoverVal]);

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
    let time = 0;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      
      const width = rect.width;
      const height = rect.height;
      const centerY = height / 2;
      const thumbX = percent * width;

      ctx.clearRect(0, 0, width, height);

      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();

      if (thumbX > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, thumbX, height);
        ctx.clip();

        const drawWave = (
          wavelength: number,
          amp: number,
          phase: number,
          color: string,
          lineWidth: number
        ) => {
          ctx.beginPath();
          ctx.moveTo(0, centerY);
          for (let x = 0; x <= thumbX; x += 2) {
            let envelope = 1;
            const transitionLen = 40;
            if (x < transitionLen) {
              const t = x / transitionLen;
              envelope = t * t * (3 - 2 * t);
            }
            if (thumbX - x < transitionLen) {
              const t = (thumbX - x) / transitionLen;
              envelope = Math.min(envelope, t * t * (3 - 2 * t));
            }

            const angle = (x / wavelength) * Math.PI * 2 - phase;
            const y = centerY - Math.sin(angle) * amp * envelope;
            ctx.lineTo(x, y);
          }
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth;
          ctx.lineCap = 'round';
          ctx.stroke();
        };

        const ampBase1 = isDragging ? 2 : 12;
        const ampBase2 = isDragging ? 2 : 9;
        const ampBase3 = isDragging ? 2 : 6;

        drawWave(150, ampBase1, time * 2 + 2.2, 'rgba(99, 102, 241, 0.4)', 1.5);
        drawWave(120, ampBase2, time * 2.5 + 1.2, 'rgba(129, 140, 248, 0.6)', 2);
        drawWave(90, ampBase3, time * 3, 'rgba(99, 102, 241, 0.95)', 2.5);

        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(thumbX, centerY);
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();

        ctx.beginPath();
        ctx.arc(thumbX, centerY, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#818cf8';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(thumbX, centerY, 10, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(129, 140, 248, 0.3)';
        ctx.fill();
      }

      if (isPlaying && !isDragging) {
        time += 0.02;
      }
      animationFrameId = requestAnimationFrame(render);
    };
    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [percent, isPlaying, isDragging]);

  const displayTooltipVal = isDragging && hoverVal !== null ? hoverVal : isHovered && hoverVal !== null ? hoverVal : value;
  const tooltipText = formatTooltip
    ? formatTooltip(displayTooltipVal)
    : ${Math.round(((displayTooltipVal - min) / (max - min || 1)) * 100)}%;

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      className={elative flex items-center cursor-pointer select-none }
      title={title}
      style={{ height: '30px' }}
    >
      {(isHovered || isDragging) && (
        <div
          style={{
            left: ${tooltipX}px,
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
