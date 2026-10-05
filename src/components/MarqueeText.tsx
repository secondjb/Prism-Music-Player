import React, { useRef, useState, useEffect } from 'react';
import { motion, useAnimationControls } from 'framer-motion';

interface MarqueeTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  speed?: number; // pixels per second (default 32)
  startDelay?: number; // seconds to pause at start (default 2.5)
  endDelay?: number; // seconds to pause at end (default 2.0)
}

export const MarqueeText: React.FC<MarqueeTextProps> = ({
  text,
  className = '',
  style,
  speed = 32,
  startDelay = 2.5,
  endDelay = 2.0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);
  const controls = useAnimationControls();
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current || !textRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const textWidth = textRef.current.scrollWidth;
      const diff = textWidth - containerWidth;
      setOverflow(diff > 4 ? diff : 0);
    };

    measure();

    const resizeObserver = new ResizeObserver(() => {
      measure();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    if (textRef.current) {
      resizeObserver.observe(textRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [text]);

  useEffect(() => {
    if (overflow <= 0) {
      controls.stop();
      controls.set({ x: 0 });
      return;
    }

    const scrollDuration = Math.max(1, overflow / speed);
    const returnDuration = Math.min(2, Math.max(0.8, overflow / (speed * 1.8)));
    const totalDuration = startDelay + scrollDuration + endDelay + returnDuration;

    const t0 = 0;
    const t1 = startDelay / totalDuration;
    const t2 = (startDelay + scrollDuration) / totalDuration;
    const t3 = (startDelay + scrollDuration + endDelay) / totalDuration;
    const t4 = 1;

    controls.start({
      x: [0, 0, -overflow, -overflow, 0],
      transition: {
        duration: totalDuration,
        times: [t0, t1, t2, t3, t4],
        ease: ['linear', 'easeInOut', 'linear', 'easeInOut'],
        repeat: Infinity,
        repeatType: 'loop',
      },
    });
  }, [overflow, speed, startDelay, endDelay, text, controls]);

  return (
    <div
      ref={containerRef}
      title={text}
      onMouseEnter={() => {
        if (overflow > 0) {
          setIsPaused(true);
        }
      }}
      onMouseLeave={() => {
        if (overflow > 0) {
          setIsPaused(false);
        }
      }}
      className="w-full min-w-0 overflow-hidden relative select-none"
      style={{
        maskImage:
          overflow > 0
            ? 'linear-gradient(to right, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)'
            : undefined,
        WebkitMaskImage:
          overflow > 0
            ? 'linear-gradient(to right, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)'
            : undefined,
      }}
    >
      <motion.span
        ref={textRef}
        animate={controls}
        style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          animationPlayState: isPaused ? 'paused' : 'running',
          ...style,
        }}
        className={className}
      >
        {text}
      </motion.span>
    </div>
  );
};
