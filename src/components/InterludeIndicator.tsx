import React, { useMemo } from 'react';

export interface InterludeIndicatorProps {
  id?: string;
  startSecs: number;
  endSecs: number;
  currentTime: number;
  isPlaying: boolean;
  isActive: boolean;
  isPast: boolean;
  distance?: number;
  lyricsFontSizePreset?: string;
  activeFontSize?: number;
  onSeek?: (secs: number) => void;
}

interface AmbientParticle {
  id: number;
  type: 'note' | 'dot';
  char?: string;
  xPercent: number;
  driftX: number;
  duration: number;
  delay: number;
  size: number;
  opacity: number;
}

export const InterludeIndicator: React.FC<InterludeIndicatorProps> = React.memo(({
  id,
  startSecs,
  endSecs,
  currentTime,
  isPlaying,
  isActive,
  isPast,
  distance = 0,
  lyricsFontSizePreset,
  activeFontSize = 36,
  onSeek,
}) => {
  if (lyricsFontSizePreset === 'maximum' && distance > 1) {
    return null;
  }

  const timeRemaining = Math.max(0, endSecs - currentTime);
  const isCountdown = isActive && timeRemaining <= 3.0;
  const isAmbient = isActive && timeRemaining > 3.0;
  const elapsedCountdown = Math.max(0, Math.min(3.0, 3.0 - timeRemaining));

  // Determine which 1-second beat is currently active during Phase 2 (Beat 3 -> Beat 2 -> Beat 1)
  const activeBeat = useMemo(() => {
    if (!isCountdown) return 0;
    if (timeRemaining > 2.0) return 1; // 3.0s -> 2.0s (Beat 3)
    if (timeRemaining > 1.0) return 2; // 2.0s -> 1.0s (Beat 2)
    return 3;                          // 1.0s -> 0.0s (Beat 1, final settle)
  }, [isCountdown, timeRemaining]);

  // Generate 5 lightweight ambient particles once per component mount (zero JS loop overhead)
  const particles: AmbientParticle[] = useMemo(() => [
    { id: 1, type: 'note', char: '♪', xPercent: 22, driftX: -10, duration: 3.4, delay: 0.0, size: 16, opacity: 0.7 },
    { id: 2, type: 'dot', xPercent: 37, driftX: 8, duration: 4.2, delay: 1.1, size: 6, opacity: 0.65 },
    { id: 3, type: 'note', char: '♫', xPercent: 50, driftX: -6, duration: 3.8, delay: 2.0, size: 18, opacity: 0.75 },
    { id: 4, type: 'dot', xPercent: 64, driftX: 12, duration: 4.4, delay: 0.5, size: 7, opacity: 0.6 },
    { id: 5, type: 'note', char: '♪', xPercent: 78, driftX: -12, duration: 3.5, delay: 1.6, size: 15, opacity: 0.65 },
  ], []);

  const dotSize = Math.max(12, Math.min(18, activeFontSize * 0.35));

  const renderDot = (dotIndex: 1 | 2 | 3) => {
    // Each beat in the 3.0s countdown takes 1.0s:
    // Dot 1: starts at 0.0s offset
    // Dot 2: starts at 1.0s offset
    // Dot 3: starts at 2.0s offset
    const beatOffset = (dotIndex - 1) * 1.0;
    const delay = beatOffset - elapsedCountdown;

    const isCurrentBeat = isCountdown && activeBeat === dotIndex;
    const isPastBeat = isCountdown && activeBeat > dotIndex;

    const animStyle: React.CSSProperties = isCountdown
      ? {
          animation: 'interludeCountdownBeat 1.0s cubic-bezier(0.25, 1, 0.5, 1) both',
          animationDelay: `${delay.toFixed(3)}s`,
          animationPlayState: isPlaying ? 'running' : 'paused',
          willChange: 'transform, opacity',
        }
      : isAmbient
      ? {
          transform: 'translateY(0) scale(0.95)',
          opacity: 0.45,
        }
      : {
          transform: 'translateY(0) scale(0.92)',
          opacity: isPast ? 0.25 : 0.4,
        };

    const isHighlighted = isCurrentBeat || isPastBeat;

    return (
      <div
        key={dotIndex}
        className="rounded-full relative z-10"
        style={{
          width: `${dotSize}px`,
          height: `${dotSize}px`,
          background: isHighlighted
            ? 'linear-gradient(135deg, var(--color-stop-1, #6366f1), var(--color-stop-2, #818cf8))'
            : isCountdown
            ? 'rgba(255, 255, 255, 0.5)'
            : isActive
            ? 'rgba(255, 255, 255, 0.45)'
            : 'rgba(255, 255, 255, 0.35)',
          boxShadow: isCurrentBeat
            ? '0 0 16px var(--color-stop-1, #6366f1), 0 0 28px color-mix(in srgb, var(--color-stop-2, #818cf8) 60%, transparent)'
            : 'none',
          transition: 'background 0.25s ease, box-shadow 0.25s ease',
          ...animStyle,
        }}
      />
    );
  };

  return (
    <div
      id={id}
      onClick={() => onSeek?.(startSecs)}
      className="relative text-center cursor-pointer max-w-[90vw] w-full min-h-[70px] py-4 flex items-center justify-center transition-all duration-300 select-none overflow-visible"
      style={{
        opacity: isActive ? 1 : isPast ? 0.3 : 0.45,
      }}
      title={`Interlude (${(endSecs - startSecs).toFixed(1)}s)`}
    >
      {/* Phase 1: Ambient Drifting Music Notes & Glowing Bubbles (timeRemaining > 3.0s) */}
      <div
        className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible transition-opacity duration-500 ease-out"
        style={{
          opacity: isAmbient ? 1 : 0,
        }}
      >
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute select-none pointer-events-none"
            style={{
              left: `${p.xPercent}%`,
              bottom: '12px',
              ['--drift-x' as string]: `${p.driftX}px`,
              ['--particle-opacity' as string]: p.opacity,
              animation: isAmbient
                ? `ambientDriftUp ${p.duration}s cubic-bezier(0.35, 0, 0.25, 1) infinite`
                : 'none',
              animationDelay: `${p.delay}s`,
              animationPlayState: isPlaying ? 'running' : 'paused',
              willChange: 'transform, opacity',
            }}
          >
            {p.type === 'note' ? (
              <span
                className="font-bold inline-block"
                style={{
                  fontSize: `${p.size}px`,
                  color: 'var(--color-stop-1, #a5b4fc)',
                  textShadow: '0 0 10px color-mix(in srgb, var(--color-stop-1, #6366f1) 50%, transparent)',
                }}
              >
                {p.char}
              </span>
            ) : (
              <div
                className="rounded-full inline-block"
                style={{
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  background: 'radial-gradient(circle, var(--color-stop-1, #c7d2fe), var(--color-stop-2, #6366f1))',
                  boxShadow: '0 0 10px color-mix(in srgb, var(--color-stop-1, #6366f1) 70%, transparent)',
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Phase 2 (and Resting): 3 Prominent Dots */}
      <div className="flex items-center justify-center gap-4 relative z-10">
        {renderDot(1)}
        {renderDot(2)}
        {renderDot(3)}
      </div>
    </div>
  );
});