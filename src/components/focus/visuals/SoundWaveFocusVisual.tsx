import React, { useId } from 'react';
import { FocusVisualProps } from '../../../services/focusVisualPreferences';

export const SoundWaveFocusVisual: React.FC<FocusVisualProps> = ({ progress, isPaused }) => {
  const uniqueId = useId().replace(/:/g, '');
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const isCompleted = clampedProgress >= 0.999;

  const playState = isPaused || isCompleted ? 'paused' : 'running';

  // Progress gradually narrows the outer pulse radius
  // Starts wide at 88px and narrows down to 42px as focus concentrates
  const narrowedOuterRadius = 88 - clampedProgress * 46;
  const middleRadius = narrowedOuterRadius * 0.7;
  const innerRadius = narrowedOuterRadius * 0.42;

  // Track circumference for outer progress arc (radius = 96)
  const trackRadius = 96;
  const circumference = 2 * Math.PI * trackRadius;
  const strokeDashoffset = circumference * (1 - clampedProgress);

  // Equalizer frequency bars configuration (15 symmetric bars)
  const barCount = 15;
  const barWidth = 3;
  const barGap = 6;
  const totalWidth = barCount * barWidth + (barCount - 1) * barGap;
  const startX = 120 - totalWidth / 2;

  // Relative max heights for each bar (envelope curve)
  const barHeights = [
    6, 12, 18, 26, 32, 38, 44, 46, 44, 38, 32, 26, 18, 12, 6,
  ];

  return (
    <div
      className="relative w-full h-[220px] xs:h-[240px] max-w-[260px] mx-auto flex items-center justify-center select-none"
      role="img"
      aria-label={`Səs dalğası fokus vizualı: ${Math.round(clampedProgress * 100)}% tamamlandı`}
    >
      {/* Scoped CSS Animations */}
      <style>{`
        @keyframes soundWaveScroll_${uniqueId} {
          0% { transform: translateX(0); }
          100% { transform: translateX(-80px); }
        }

        @keyframes soundPulseRing_${uniqueId} {
          0% {
            r: 22px;
            opacity: 0.8;
          }
          50% {
            opacity: 0.5;
          }
          100% {
            r: ${narrowedOuterRadius}px;
            opacity: 0;
          }
        }

        @keyframes freqBarDance_${uniqueId} {
          0%, 100% {
            transform: scaleY(0.35);
          }
          50% {
            transform: scaleY(1);
          }
        }

        @keyframes calmCenterPulse_${uniqueId} {
          0%, 100% {
            opacity: 0.85;
            filter: drop-shadow(0 0 6px rgba(192, 132, 252, 0.7));
          }
          50% {
            opacity: 1;
            filter: drop-shadow(0 0 16px rgba(233, 213, 255, 1));
          }
        }

        .sound-wave-stream-${uniqueId} {
          animation: soundWaveScroll_${uniqueId} 2.8s linear infinite;
        }

        .sound-pulse-ring-${uniqueId} {
          animation: soundPulseRing_${uniqueId} 3.2s cubic-bezier(0.2, 0.8, 0.4, 1) infinite;
        }

        .sound-pulse-ring-lag-${uniqueId} {
          animation: soundPulseRing_${uniqueId} 3.2s cubic-bezier(0.2, 0.8, 0.4, 1) infinite;
          animation-delay: -1.6s;
        }

        .sound-calm-center-${uniqueId} {
          animation: calmCenterPulse_${uniqueId} 2.4s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .sound-wave-stream-${uniqueId},
          .sound-pulse-ring-${uniqueId},
          .sound-pulse-ring-lag-${uniqueId},
          .sound-calm-center-${uniqueId},
          .freq-bar-${uniqueId} {
            animation: none !important;
          }
        }
      `}</style>

      {/* Ambient background glow */}
      <div
        className={`absolute inset-0 m-auto w-40 h-40 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          isCompleted
            ? 'bg-violet-500/40 opacity-90'
            : isPaused
            ? 'bg-violet-600/10 opacity-25'
            : 'bg-indigo-600/25 opacity-65'
        }`}
      />

      <svg
        viewBox="0 0 240 240"
        className="w-full h-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          {/* Wave linear gradient */}
          <linearGradient id={`soundWaveGrad_${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#818CF8" stopOpacity="0.3" />
            <stop offset="25%" stopColor="#C084FC" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#FAF5FF" stopOpacity="1" />
            <stop offset="75%" stopColor="#C084FC" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#818CF8" stopOpacity="0.3" />
          </linearGradient>

          {/* Progress arc gradient */}
          <linearGradient id={`soundProgressGrad_${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="50%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#E879F9" />
          </linearGradient>

          <filter id={`soundGlow_${uniqueId}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Clip path for waveform viewport */}
          <clipPath id={`waveClip_${uniqueId}`}>
            <circle cx="120" cy="120" r={trackRadius - 4} />
          </clipPath>
        </defs>

        {/* 1. Base Track */}
        <circle
          cx="120"
          cy="120"
          r={trackRadius}
          fill="none"
          stroke="rgba(139, 92, 246, 0.12)"
          strokeWidth="3.5"
        />

        {/* 2. Outer Progress Arc */}
        <circle
          cx="120"
          cy="120"
          r={trackRadius}
          fill="none"
          stroke={`url(#soundProgressGrad_${uniqueId})`}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 120 120)"
          className="transition-[stroke-dashoffset] duration-500 ease-out"
          filter={`url(#soundGlow_${uniqueId})`}
        />

        {/* 3. Circular Pulse Rings (progress narrows outer radius) */}
        {!isCompleted && (
          <g>
            {/* Outermost Narrowing Boundary Ring (Subtle guideline) */}
            <circle
              cx="120"
              cy="120"
              r={narrowedOuterRadius}
              fill="none"
              stroke="rgba(168, 85, 247, 0.18)"
              strokeWidth="1"
              strokeDasharray="3 5"
              className="transition-[r] duration-500 ease-out"
            />
            {/* Middle Boundary Ring */}
            <circle
              cx="120"
              cy="120"
              r={middleRadius}
              fill="none"
              stroke="rgba(192, 132, 252, 0.15)"
              strokeWidth="1"
              className="transition-[r] duration-500 ease-out"
            />
            {/* Inner Boundary Ring */}
            <circle
              cx="120"
              cy="120"
              r={innerRadius}
              fill="none"
              stroke="rgba(216, 180, 254, 0.2)"
              strokeWidth="1"
              className="transition-[r] duration-500 ease-out"
            />

            {/* Pulsing Ripple Rings */}
            <circle
              cx="120"
              cy="120"
              r={middleRadius}
              fill="none"
              stroke="#A855F7"
              strokeWidth="1.5"
              className={`sound-pulse-ring-${uniqueId}`}
              style={{ animationPlayState: playState }}
            />
            <circle
              cx="120"
              cy="120"
              r={innerRadius}
              fill="none"
              stroke="#C084FC"
              strokeWidth="1.2"
              className={`sound-pulse-ring-lag-${uniqueId}`}
              style={{ animationPlayState: playState }}
            />
          </g>
        )}

        {/* 4. Small Animated Frequency Bars */}
        <g opacity={isCompleted ? 0.3 : 0.85} className="transition-opacity duration-500">
          {barHeights.map((maxH, index) => {
            const x = startX + index * (barWidth + barGap);
            const height = isCompleted ? 2 : Math.max(4, maxH * (1 - clampedProgress * 0.4));
            const y = 120 - height / 2;
            const delay = `${((index % 5) * 0.18).toFixed(2)}s`;
            const duration = `${(1.2 + (index % 3) * 0.3).toFixed(2)}s`;

            return (
              <rect
                key={index}
                x={x}
                y={y}
                width={barWidth}
                height={height}
                rx={1.5}
                fill={index % 2 === 0 ? '#C084FC' : '#818CF8'}
                opacity={0.8}
                className={`freq-bar-${uniqueId}`}
                style={{
                  transformOrigin: `${x + barWidth / 2}px 120px`,
                  animation: !isCompleted
                    ? `freqBarDance_${uniqueId} ${duration} ease-in-out infinite alternate`
                    : 'none',
                  animationDelay: delay,
                  animationPlayState: playState,
                }}
              />
            );
          })}
        </g>

        {/* 5. Central Waveform / Calm Center Line */}
        <g clipPath={`url(#waveClip_${uniqueId})`}>
          {isCompleted ? (
            /* Settles into a calm glowing horizontal center line upon completion */
            <g className={`sound-calm-center-${uniqueId}`}>
              <line
                x1="35"
                y1="120"
                x2="205"
                y2="120"
                stroke="url(#soundWaveGrad_${uniqueId})"
                strokeWidth="3.5"
                strokeLinecap="round"
                filter={`url(#soundGlow_${uniqueId})`}
              />
              {/* Central Calm Beacon Node */}
              <circle
                cx="120"
                cy="120"
                r="6"
                fill="#FAF5FF"
                filter={`url(#soundGlow_${uniqueId})`}
              />
            </g>
          ) : (
            /* Moving continuous violet waveform across the center */
            <g
              className={`sound-wave-stream-${uniqueId}`}
              style={{ animationPlayState: playState }}
            >
              {/* Repeated seamless sine pattern: 80px per period */}
              <path
                d="
                  M 0 120
                  q 20 -18 40 0 t 40 0
                  q 20 -18 40 0 t 40 0
                  q 20 -18 40 0 t 40 0
                  q 20 -18 40 0 t 40 0
                  q 20 -18 40 0 t 40 0
                "
                fill="none"
                stroke={`url(#soundWaveGrad_${uniqueId})`}
                strokeWidth="2.8"
                strokeLinecap="round"
                filter={`url(#soundGlow_${uniqueId})`}
              />

              {/* Secondary delicate harmonics wave (phase-shifted) */}
              <path
                d="
                  M 0 120
                  q 20 12 40 0 t 40 0
                  q 20 12 40 0 t 40 0
                  q 20 12 40 0 t 40 0
                  q 20 12 40 0 t 40 0
                  q 20 12 40 0 t 40 0
                "
                fill="none"
                stroke="rgba(233, 213, 255, 0.65)"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </g>
          )}
        </g>

        {/* 6. Central Glowing Focus Node */}
        <circle
          cx="120"
          cy="120"
          r={isCompleted ? 7 : 4}
          fill="#FAF5FF"
          filter={`url(#soundGlow_${uniqueId})`}
          className="transition-all duration-300"
        />
      </svg>
    </div>
  );
};
