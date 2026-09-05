import React, { useState, useRef, useCallback, useEffect } from 'react';

interface AudioSliderProps {
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

export const AudioSlider: React.FC<AudioSliderProps> = ({
  value,
  min = 0,
  max = 100,
  step = 0.01,
  onChange,
  onChangeCommitted,
  formatTooltip,
  className = '',
  size = 'md',
  title,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverVal, setHoverVal] = useState<number | null>(null);
  const [tooltipX, setTooltipX] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const paddingX = size === 'sm' ? 8 : size === 'lg' ? 12 : 10;
  const effectiveVal = isDragging && hoverVal !== null ? hoverVal : value;
  const percent = Math.max(0, Math.min(100, ((effectiveVal - min) / (max - min || 1)) * 100));

  const updateFromPointer = useCallback(
    (clientX: number, isCommit = false) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left - paddingX;
      const availableWidth = Math.max(1, rect.width - 2 * paddingX);
      const ratio = Math.max(0, Math.min(1, clickX / availableWidth));
      const rawVal = min + ratio * (max - min);
      const steppedVal = Math.round(rawVal / step) * step;
      const clampedVal = Math.max(min, Math.min(max, steppedVal));
      setHoverVal(clampedVal);
      setTooltipX(clientX - rect.left);
      onChange(clampedVal);
      if (isCommit && onChangeCommitted) {
        onChangeCommitted(clampedVal);
      }
    },
    [min, max, step, paddingX, onChange, onChangeCommitted]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left - paddingX;
      const availableWidth = Math.max(1, rect.width - 2 * paddingX);
      const ratio = Math.max(0, Math.min(1, clickX / availableWidth));
      const rawVal = min + ratio * (max - min);
      const steppedVal = Math.round(rawVal / step) * step;
      const clampedVal = Math.max(min, Math.min(max, steppedVal));
      setHoverVal(clampedVal);
      setTooltipX(e.clientX - rect.left);
      if (isDragging) {
        onChange(clampedVal);
      }
    },
    [min, max, step, paddingX, isDragging, onChange]
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

  const displayTooltipVal = isDragging && hoverVal !== null ? hoverVal : isHovered && hoverVal !== null ? hoverVal : value;
  const tooltipText = formatTooltip
    ? formatTooltip(displayTooltipVal)
    : `${Math.round(((displayTooltipVal - min) / (max - min || 1)) * 100)}%`;

  const trackHeightClass = size === 'sm' ? 'h-[3.5px]' : size === 'lg' ? 'h-[5px]' : 'h-[4px]';
  const containerHeightClass = size === 'sm' ? 'h-7' : size === 'lg' ? 'h-10' : 'h-8';
  const haloSizeClass = size === 'sm' ? 'w-4 h-4 -ml-2 -mt-2' : size === 'lg' ? 'w-6 h-6 -ml-3 -mt-3' : 'w-5 h-5 -ml-2.5 -mt-2.5';
  const thumbSizeClass = size === 'sm' ? 'w-2.5 h-2.5 -ml-[5px] -mt-[5px]' : size === 'lg' ? 'w-3.5 h-3.5 -ml-[7px] -mt-[7px]' : 'w-3 h-3 -ml-1.5 -mt-1.5';

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

      {/* Material 3 Capsule Inactive Background Track with Horizontal Padding Margin */}
      <div
        className="w-full relative"
        style={{ paddingLeft: `${paddingX}px`, paddingRight: `${paddingX}px` }}
      >
        <div className={`w-full ${trackHeightClass} rounded-full bg-white/15 relative overflow-hidden`}>
          {/* Material 3 Active Capsule Fill with Dynamic Theme Gradient */}
          <div
            className={`h-full rounded-full`}
            style={{
              width: `${percent}%`,
              background: 'linear-gradient(to right, var(--color-stop-1, #6366f1), var(--color-stop-2, #818cf8))',
            }}
          />
        </div>
      </div>

      {/* Material 3 Leading Thumb Indicator with Frosted Glow Halo */}
      <div
        className="absolute top-1/2 pointer-events-none z-10"
        style={{
          left: `calc(${paddingX}px + (${percent} * (100% - ${2 * paddingX}px) / 100))`,
        }}
      >
        {/* Soft Theme Glow Halo */}
        <div
          className={`absolute top-0 left-0 rounded-full transition-transform duration-100 ${haloSizeClass} ${
            isHovered || isDragging ? 'scale-125 opacity-100' : 'opacity-85'
          }`}
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
          }}
        />
        {/* Solid Center Thumb */}
        <div
          className={`absolute top-0 left-0 rounded-full bg-white shadow-md transition-transform duration-100 ${thumbSizeClass} ${
            isHovered || isDragging ? 'scale-110' : ''
          }`}
        />
      </div>
    </div>
  );
};
