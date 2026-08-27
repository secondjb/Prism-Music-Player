import React from 'react';

interface GeminiLogoProps {
  className?: string;
  style?: React.CSSProperties;
}

export const GeminiLogo: React.FC<GeminiLogoProps> = ({ className = 'w-6 h-6', style }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 200"
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id="refraction" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--color-stop-1, #FF3B30)" />
          <stop offset="20%" stopColor="var(--color-stop-2, #FFCC00)" />
          <stop offset="40%" stopColor="var(--color-stop-3, #34C759)" />
          <stop offset="60%" stopColor="var(--color-stop-4, #00C7BE)" />
          <stop offset="80%" stopColor="var(--color-stop-5, #007AFF)" />
          <stop offset="100%" stopColor="var(--color-stop-6, #AF52DE)" />
        </linearGradient>
      </defs>

      {/* Left Input Sine Wave (Solid Silver, Shortened) */}
      <path
        d="M 131.15 100 q 15 -35, 30 0 t 30 0 t 30 0"
        fill="none"
        stroke="#A1A1AA"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Right Output Sine Wave (Vibrant Rainbow / Dynamic Album Art Gradient) */}
      <path
        d="M 278.85 100 q 15 -35, 30 0 t 30 0 t 30 0"
        fill="none"
        stroke="url(#refraction)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Central Grounded Prism (Crisp White) */}
      <polygon
        points="250,50 192.3,150 307.7,150"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
