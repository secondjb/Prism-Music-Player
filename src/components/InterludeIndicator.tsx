import React, { useMemo } from 'react';
import { Music } from 'lucide-react';

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

export const InterludeIndicator: React.FC<InterludeIndicatorProps> = React.memo(({
  id,
  startSecs,
  endSecs,
  currentTime,
  isPlaying,
  isActive,
  isPast: _isPast,
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

  // Determine active beat in the final 3-second countdown (3.0s -> 2.0s -> 1.0s -> 0.0s)
  const activeBeat = useMemo(() => {
    if (!isCountdown) return 0;
    if (timeRemaining > 2.0) return 1; // 3s -> 2s (Beat 3)
    if (timeRemaining > 1.0) return 2; // 2s -> 1s (Beat 2)
    return 3;                          // 1s -> 0s (Beat 1)
  }, [isCountdown, timeRemaining]);

  const dotSize = Math.max(12, Math.min(18, activeFontSize * 0.35));

  // Inactive state (upcoming or past instrumental break when not currently playing)
  if (!isActive) {
    return (
      <div
        id={id}
        onClick={() => onSeek?.(startSecs)}
        className="relative text-center cursor-pointer max-w-[90vw] w-full min-h-[44px] py-2 flex items-center justify-center transition-all duration-300 select-none group"
        title={`Instrumental Break (${(endSecs - startSecs).toFixed(1)}s) - Click to seek`}
      >
        <div className="flex items-center justify-center gap-2 opacity-20 group-hover:opacity-60 transition-opacity duration-300">
          <span className="text-xs text-zinc-500 font-medium tracking-wider select-none">···</span>
          <Music className="w-3.5 h-3.5 text-zinc-400 select-none" />
          <span className="text-xs text-zinc-500 font-medium tracking-wider select-none">···</span>
        </div>
      </div>
    );
  }

  return (
    <div
      id={id}
      onClick={() => onSeek?.(startSecs)}
      className="relative text-center cursor-pointer max-w-[90vw] w-full min-h-[64px] py-3 flex items-center justify-center transition-all duration-300 select-none overflow-visible"
      title={`Interlude (${(endSecs - startSecs).toFixed(1)}s)`}
    >
      {/* Phase 1: PixelPlayer-Style Ambient Dancing Notes & Bubbles (Tightly clustered in center) */}
      {isAmbient && (
        <div className="flex items-center justify-center gap-6 h-[48px] px-4 select-none pointer-events-none animate-in fade-in zoom-in-95 duration-200">
          {/* Element 1: Glowing Bubble / Dot */}
          <div
            className="flex items-center justify-center"
            style={{
              animation: 'pixelPlayerDance 3.2s ease-in-out infinite',
              animationDelay: '0s',
              animationPlayState: isPlaying ? 'running' : 'paused',
              willChange: 'transform, opacity',
            }}
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{
                background: 'radial-gradient(circle, #ffffff 15%, var(--color-stop-1, #6366f1) 85%)',
                boxShadow: '0 0 12px var(--color-stop-1, #6366f1), 0 0 20px color-mix(in srgb, var(--color-stop-2, #818cf8) 50%, transparent)',
              }}
            />
          </div>

          {/* Element 2: Beamed Musical Notes ♫ */}
          <div
            className="flex items-center justify-center"
            style={{
              animation: 'pixelPlayerDance 3.2s ease-in-out infinite',
              animationDelay: '-1.07s',
              animationPlayState: isPlaying ? 'running' : 'paused',
              willChange: 'transform, opacity',
            }}
          >
            <span
              className="text-xl font-bold leading-none select-none"
              style={{
                color: 'var(--color-stop-1, #a5b4fc)',
                textShadow: '0 0 14px color-mix(in srgb, var(--color-stop-1, #6366f1) 80%, transparent), 0 0 24px color-mix(in srgb, var(--color-stop-2, #818cf8) 50%, transparent)',
              }}
            >
              ♫
            </span>
          </div>

          {/* Element 3: Single Musical Note ♪ */}
          <div
            className="flex items-center justify-center"
            style={{
              animation: 'pixelPlayerDance 3.2s ease-in-out infinite',
              animationDelay: '-2.13s',
              animationPlayState: isPlaying ? 'running' : 'paused',
              willChange: 'transform, opacity',
            }}
          >
            <span
              className="text-lg font-bold leading-none select-none"
              style={{
                color: 'var(--color-stop-1, #a5b4fc)',
                textShadow: '0 0 14px color-mix(in srgb, var(--color-stop-1, #6366f1) 80%, transparent), 0 0 24px color-mix(in srgb, var(--color-stop-2, #818cf8) 50%, transparent)',
              }}
            >
              ♪
            </span>
          </div>
        </div>
      )}

      {/* Phase 2: Synced 3-2-1 Lead-in Countdown Dots (ONLY visible during final 3 seconds) */}
      {isCountdown && (
        <div className="flex items-center justify-center gap-4 h-[48px] relative z-10 animate-in fade-in zoom-in-95 duration-200">
          {[1, 2, 3].map((dotIndex) => {
            const isCurrentBeat = activeBeat === dotIndex;
            const isPastBeat = activeBeat > dotIndex;
            const isHighlighted = isCurrentBeat || isPastBeat;

            return (
              <div
                key={dotIndex}
                className="rounded-full transition-all duration-200 ease-out"
                style={{
                  width: `${dotSize}px`,
                  height: `${dotSize}px`,
                  background: isHighlighted
                    ? 'linear-gradient(135deg, #ffffff 0%, var(--color-stop-1, #6366f1) 100%)'
                    : 'rgba(255, 255, 255, 0.25)',
                  transform: isCurrentBeat
                    ? 'translateY(-8px) scale(1.35)'
                    : isPastBeat
                    ? 'translateY(0) scale(1)'
                    : 'translateY(0) scale(0.9)',
                  boxShadow: isCurrentBeat
                    ? '0 0 18px var(--color-stop-1, #6366f1), 0 0 32px color-mix(in srgb, var(--color-stop-2, #818cf8) 70%, transparent)'
                    : isPastBeat
                    ? '0 0 8px color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)'
                    : 'none',
                  opacity: isHighlighted ? 1 : 0.4,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});