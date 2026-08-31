import React, { useState, useRef, useCallback } from 'react';

interface AudioSliderProps {
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

export const AudioSlider: React.FC<AudioSliderProps> = ({
  value,
  min = 0,
  max = 100,
  step = 1,
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

  const percent = Math.max(0, Math.min(100, ((value - min) / (max - min || 1)) * 100));

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / (rect.width || 1)));
      const rawVal = min + ratio * (max - min);
      setHoverVal(rawVal);
      setTooltipX(clickX);
    },
    [min, max]
  );

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setHoverVal(null);
  }, []);

  const displayTooltipVal = isDragging && hoverVal !== null ? hoverVal : isHovered && hoverVal !== null ? hoverVal : value;
  const tooltipText = formatTooltip
    ? formatTooltip(displayTooltipVal)
    : `${Math.round(((displayTooltipVal - min) / (max - min || 1)) * 100)}%`;

  const trackHeightClass = size === 'sm' ? 'h-1.5 group-hover:h-2.5' : 'h-2 group-hover:h-3';

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative flex items-center group cursor-pointer select-none ${className}`}
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

      {/* HTML Range Input */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={(e) => {
          setIsDragging(false);
          if (onChangeCommitted) {
            onChangeCommitted(parseFloat((e.target as HTMLInputElement).value));
          }
        }}
        onChange={(e) => {
          const val = parseFloat(e.target.value);
          onChange(val);
        }}
        style={{
          background: `linear-gradient(to right, var(--color-stop-1, #6366f1) 0%, var(--color-stop-2, #818cf8) ${percent}%, #27272a ${percent}%)`,
        }}
        className={`w-full ${trackHeightClass} rounded-full appearance-none cursor-pointer transition-all duration-150 slider-m3 shadow-sm hover:brightness-125`}
      />
    </div>
  );
};
