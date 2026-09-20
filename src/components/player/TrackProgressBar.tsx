import React, { useState, useRef, useEffect, memo } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { AudioSlider } from '../AudioSlider';
import { WavyAudioSlider } from '../WavyAudioSlider';

const formatTime = (secs: number): string => {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

interface TrackProgressBarProps {
  isLyricsActive?: boolean;
}

/**
 * Isolated high-frequency seekbar component.
 * Subscribes directly to `currentTime` so position polling (10-60Hz) only
 * re-renders this component, completely shielding the parent BottomBar
 * and sibling playback controls from wasted re-renders.
 */
export const TrackProgressBar: React.FC<TrackProgressBarProps> = memo(({ isLyricsActive = false }) => {
  const renderStartTime = performance.now();

  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const seek = usePlayerStore((s) => s.seek);
  const isWavySeekbarEnabled = usePlayerStore((s) => s.isWavySeekbarEnabled);

  // Local drag state for butter-smooth seeking
  const [dragSeekVal, setDragSeekVal] = useState<number | null>(null);

  // Performance tracking
  const perfRef = useRef({
    renderCount: 0,
    accumulatedRenderMs: 0,
    windowStart: performance.now(),
  });

  perfRef.current.renderCount++;

  useEffect(() => {
    const renderEndTime = performance.now();
    const renderDuration = renderEndTime - renderStartTime;
    perfRef.current.accumulatedRenderMs += renderDuration;

    const elapsedSecs = (renderEndTime - perfRef.current.windowStart) / 1000;
    if (elapsedSecs >= 5) {
      const fps = (perfRef.current.renderCount / elapsedSecs).toFixed(1);
      const avgDuration = (
        perfRef.current.accumulatedRenderMs / perfRef.current.renderCount
      ).toFixed(2);
      console.log(
        `[Perf:TrackProgressBar] Rate=${fps} renders/sec, AvgRenderTime=${avgDuration}ms (${perfRef.current.renderCount} renders in ${elapsedSecs.toFixed(1)}s)`
      );
      perfRef.current = {
        renderCount: 0,
        accumulatedRenderMs: 0,
        windowStart: performance.now(),
      };
    }
  });

  const displayTime = dragSeekVal !== null ? dragSeekVal : currentTime;

  return (
    <div className="w-full flex items-center gap-3 text-xs font-mono text-zinc-400">
      <span>{formatTime(displayTime)}</span>
      {isWavySeekbarEnabled ? (
        <WavyAudioSlider
          value={displayTime}
          min={0}
          max={duration || 100}
          step={0.1}
          onChange={(val) => setDragSeekVal(val)}
          onChangeCommitted={(val) => {
            seek(val);
            setDragSeekVal(null);
          }}
          formatTooltip={(val) => formatTime(val)}
          className="flex-1"
          active={!isLyricsActive}
        />
      ) : (
        <AudioSlider
          value={displayTime}
          min={0}
          max={duration || 100}
          step={0.1}
          onChange={(val) => setDragSeekVal(val)}
          onChangeCommitted={(val) => {
            seek(val);
            setDragSeekVal(null);
          }}
          formatTooltip={(val) => formatTime(val)}
          className="flex-1"
        />
      )}
      <span>{formatTime(duration)}</span>
    </div>
  );
});

TrackProgressBar.displayName = 'TrackProgressBar';
