import React, { useEffect, useRef, useState } from 'react';
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

  // Smooth local time tracking with RAF for fluid 60/120fps interpolation
  const [animTime, setAnimTime] = useState(currentTime);
  const syncRef = useRef({ time: currentTime, perf: performance.now() });

  useEffect(() => {
    syncRef.current = { time: currentTime, perf: performance.now() };
    setAnimTime(currentTime);
  }, [currentTime]);

  useEffect(() => {
    if (!isActive || !isPlaying) {
      setAnimTime(currentTime);
      return;
    }

    let rafId: number;
    const loop = () => {
      const elapsedSecs = (performance.now() - syncRef.current.perf) / 1000;
      if (!document.hidden) {
        setAnimTime(syncRef.current.time + elapsedSecs);
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [isActive, isPlaying, currentTime]);

  // Duration & phase calculations
  const COUNTDOWN_SECS = 3.0;
  const totalGap = Math.max(0.1, endSecs - startSecs);
  const countdownDuration = Math.min(COUNTDOWN_SECS, totalGap);
  const countdownStart = endSecs - countdownDuration;

  const timeRemaining = Math.max(0, endSecs - animTime);
  const isCountdown = isActive && timeRemaining <= countdownDuration;
  const isAmbient = isActive && timeRemaining > countdownDuration;

  // Countdown progress across the final countdown window [0, 1]
  const clampedTime = Math.max(countdownStart, Math.min(endSecs, animTime));
  const countdownProgress = Math.max(0, Math.min(1, (clampedTime - countdownStart) / countdownDuration));

  // Dynamic sizing based on active font size
  const jumpHeight = Math.max(16, Math.min(26, activeFontSize * 0.45));
  const dotSize = Math.max(14, Math.min(20, activeFontSize * 0.4));

  // Smooth sine-wave jumping for each of the 3 countdown balls:
  // Phase 1 (first third: 3.0s -> 2.0s): Ball 1 rises and lands
  let y1 = 0;
  let p1 = 0;
  if (countdownProgress >= 0 && countdownProgress < 1 / 3) {
    p1 = countdownProgress * 3;
    y1 = -Math.sin(p1 * Math.PI) * jumpHeight;
  }

  // Phase 2 (middle third: 2.0s -> 1.0s): Ball 2 rises and lands
  let y2 = 0;
  let p2 = 0;
  if (countdownProgress >= 1 / 3 && countdownProgress < 2 / 3) {
    p2 = (countdownProgress - 1 / 3) * 3;
    y2 = -Math.sin(p2 * Math.PI) * jumpHeight;
  }

  // Phase 3 (final third: 1.0s -> 0.0s): Ball 3 rises and lands completely right as vocals start
  let y3 = 0;
  let p3 = 0;
  if (countdownProgress >= 2 / 3 && countdownProgress <= 1) {
    p3 = (countdownProgress - 2 / 3) * 3;
    y3 = -Math.sin(p3 * Math.PI) * jumpHeight;
  }

  const dot1Active = p1 > 0 && p1 < 1;
  const dot2Active = p2 > 0 && p2 < 1;
  const dot3Active = p3 > 0 && p3 < 1;

  const dot1Completed = countdownProgress >= 1 / 3;
  const dot2Completed = countdownProgress >= 2 / 3;
  const dot3Completed = countdownProgress >= 1.0;

  const renderCountdownBall = (
    y: number,
    isJumping: boolean,
    hasCompleted: boolean,
    key: number
  ) => {
    const scale = isJumping ? 1.3 : hasCompleted ? 1.05 : 0.95;
    const opacity = isJumping ? 1.0 : hasCompleted ? 0.85 : 0.35;

    return (
      <div
        key={key}
        className="rounded-full transition-all duration-150 ease-out"
        style={{
          width: `${dotSize}px`,
          height: `${dotSize}px`,
          transform: `translate3d(0, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(2)})`,
          opacity,
          background: isJumping || hasCompleted
            ? 'linear-gradient(135deg, #ffffff 10%, var(--color-stop-1, #6366f1) 90%)'
            : 'rgba(255, 255, 255, 0.35)',
          willChange: 'transform',
        }}
      />
    );
  };

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
      className="relative text-center cursor-pointer max-w-[90vw] w-full min-h-[72px] py-2 flex items-center justify-center transition-all duration-300 select-none overflow-visible"
      title={`Interlude (${(endSecs - startSecs).toFixed(1)}s)`}
    >
      <div className="relative w-full h-[64px] flex items-center justify-center">
        {/* Phase 1: PixelPlayer-Style Ambient Dancing Notes & Bubbles (Enlarged, no glow) */}
        <div
          className="absolute inset-0 flex items-center justify-center gap-8 select-none pointer-events-none transition-all duration-200 ease-out"
          style={{
            opacity: isAmbient ? 1 : 0,
            transform: isAmbient ? 'scale(1)' : 'scale(0.65)',
            pointerEvents: 'none',
          }}
        >
          {/* Element 1: Single Musical Note ♪ (~2x size, crisp, no glow) */}
          <div
            className="flex items-center justify-center"
            style={{
              animation: 'pixelPlayerDance 3.2s ease-in-out infinite',
              animationDelay: '0s',
              animationPlayState: isPlaying ? 'running' : 'paused',
              willChange: 'transform, opacity',
            }}
          >
            <span
              className="text-3xl font-extrabold leading-none select-none"
              style={{
                color: 'var(--color-stop-1, #a5b4fc)',
              }}
            >
              ♪
            </span>
          </div>

          {/* Element 2: Beamed Musical Notes ♫ (~2x size, crisp, no glow) */}
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
              className="text-4xl font-extrabold leading-none select-none"
              style={{
                color: 'var(--color-stop-1, #a5b4fc)',
              }}
            >
              ♫
            </span>
          </div>

          {/* Element 3: Single Musical Note ♪ (~2x size, crisp, no glow) */}
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
              className="text-3xl font-extrabold leading-none select-none"
              style={{
                color: 'var(--color-stop-1, #a5b4fc)',
              }}
            >
              ♪
            </span>
          </div>
        </div>

        {/* Phase 2: Synced 3-2-1 Lead-in Countdown Jumping Balls */}
        <div
          className="absolute inset-0 flex items-center justify-center gap-5 select-none pointer-events-none transition-all duration-200 ease-out"
          style={{
            opacity: isCountdown ? 1 : 0,
            transform: isCountdown ? 'scale(1)' : 'scale(1.1)',
            pointerEvents: 'none',
          }}
        >
          {renderCountdownBall(y1, dot1Active, dot1Completed, 1)}
          {renderCountdownBall(y2, dot2Active, dot2Completed, 2)}
          {renderCountdownBall(y3, dot3Active, dot3Completed, 3)}
        </div>
      </div>
    </div>
  );
});