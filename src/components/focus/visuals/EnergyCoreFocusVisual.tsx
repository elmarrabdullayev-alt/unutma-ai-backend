import React, { useId } from 'react';
import { FocusVisualProps } from '../../../services/focusVisualPreferences';

export const EnergyCoreFocusVisual: React.FC<FocusVisualProps> = ({ progress, isPaused }) => {
  const uniqueId = useId().replace(/:/g, '');
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const isCompleted = clampedProgress >= 0.999;

  // Pulse intensity driven by progress:
  // Starts calm (3.8s period) and accelerates as focus energy builds (down to 1.6s)
  const pulseDuration = `${(3.8 - clampedProgress * 2.0).toFixed(2)}s`;
  const filamentOpacity = 0.35 + clampedProgress * 0.55;

  const playState = isPaused || isCompleted ? 'paused' : 'running';

  // Core base radius scales up with focus progress
  const coreRadius = 14 + clampedProgress * 8;

  // Track circumference for progress ring (radius = 96)
  const trackRadius = 96;
  const circumference = 2 * Math.PI * trackRadius;
  const strokeDashoffset = circumference * (1 - clampedProgress);

  return (
    <div
      className="relative w-full h-[220px] xs:h-[240px] max-w-[260px] mx-auto flex items-center justify-center select-none"
      role="img"
      aria-label={`Enerji nüvəsi fokus vizualı: ${Math.round(clampedProgress * 100)}% tamamlandı`}
    >
      {/* Scoped CSS Animations */}
      <style>{`
        @keyframes energyPulse_${uniqueId} {
          0%, 100% {
            transform: scale(0.96);
            opacity: 0.75;
          }
          50% {
            transform: scale(1.08);
            opacity: 1;
            filter: drop-shadow(0 0 14px rgba(168, 85, 247, 0.85));
          }
        }

        @keyframes energyShellExpand_${uniqueId} {
          0% {
            transform: scale(0.92);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.8;
          }
          100% {
            transform: scale(0.92);
            opacity: 0.3;
          }
        }

        @keyframes filamentOrbit_${uniqueId} {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes energyCollapseEmit_${uniqueId} {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          30% {
            transform: scale(0.4);
            opacity: 0.6;
          }
          65% {
            transform: scale(1.28);
            opacity: 1;
            filter: drop-shadow(0 0 24px rgba(233, 213, 255, 1));
          }
          100% {
            transform: scale(1);
            opacity: 0.95;
          }
        }

        .energy-core-pulse-${uniqueId} {
          transform-origin: 120px 120px;
          animation: energyPulse_${uniqueId} ${pulseDuration} ease-in-out infinite;
        }

        .energy-shell-${uniqueId} {
          transform-origin: 120px 120px;
          animation: energyShellExpand_${uniqueId} ${pulseDuration} ease-in-out infinite;
        }

        .energy-shell-lag-${uniqueId} {
          transform-origin: 120px 120px;
          animation: energyShellExpand_${uniqueId} ${pulseDuration} ease-in-out infinite;
          animation-delay: -0.7s;
        }

        .energy-filament-orbit-${uniqueId} {
          transform-origin: 120px 120px;
          animation: filamentOrbit_${uniqueId} 16s linear infinite;
        }

        .energy-filament-orbit-rev-${uniqueId} {
          transform-origin: 120px 120px;
          animation: filamentOrbit_${uniqueId} 12s linear infinite reverse;
        }

        .energy-completed-collapse-${uniqueId} {
          transform-origin: 120px 120px;
          animation: energyCollapseEmit_${uniqueId} 2.2s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .energy-core-pulse-${uniqueId},
          .energy-shell-${uniqueId},
          .energy-shell-lag-${uniqueId},
          .energy-filament-orbit-${uniqueId},
          .energy-filament-orbit-rev-${uniqueId},
          .energy-completed-collapse-${uniqueId} {
            animation: none !important;
          }
        }
      `}</style>

      {/* Ambient background energy field */}
      <div
        className={`absolute inset-0 m-auto w-44 h-44 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          isCompleted
            ? 'bg-fuchsia-500/35 opacity-95 scale-110'
            : isPaused
            ? 'bg-violet-600/10 opacity-25'
            : 'bg-violet-600/25 opacity-70'
        }`}
      />

      <svg
        viewBox="0 0 240 240"
        className="w-full h-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          {/* Radial gradient for central glowing orb */}
          <radialGradient id={`coreOrbGrad_${uniqueId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="25%" stopColor="#F5D0FE" />
            <stop offset="55%" stopColor="#C084FC" />
            <stop offset="85%" stopColor="#7E22CE" />
            <stop offset="100%" stopColor="#4C1D95" stopOpacity="0" />
          </radialGradient>

          {/* Plasma ring gradient */}
          <radialGradient id={`shellGrad_${uniqueId}`} cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="#8B5CF6" stopOpacity="0" />
            <stop offset="90%" stopColor="#A855F7" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#C084FC" stopOpacity="0.8" />
          </radialGradient>

          {/* Progress arc gradient */}
          <linearGradient id={`energyProgressGrad_${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="50%" stopColor="#C084FC" />
            <stop offset="100%" stopColor="#F472B6" />
          </linearGradient>

          <filter id={`coreGlow_${uniqueId}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. Base Progress Track */}
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
          stroke={`url(#energyProgressGrad_${uniqueId})`}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 120 120)"
          className="transition-[stroke-dashoffset] duration-500 ease-out"
          filter={`url(#coreGlow_${uniqueId})`}
        />

        {/* 3. Main Energy Container (Animates inward collapse upon completion) */}
        <g
          className={isCompleted ? `energy-completed-collapse-${uniqueId}` : ''}
        >
          {/* Concentric Energy Shells (outer -> inner) */}
          {/* Outer Shell */}
          <g
            className={`energy-shell-${uniqueId}`}
            style={{ animationPlayState: playState }}
          >
            <circle
              cx="120"
              cy="120"
              r="80"
              fill="none"
              stroke="rgba(192, 132, 252, 0.22)"
              strokeWidth="1.5"
              strokeDasharray="8 12"
            />
          </g>

          {/* Middle Shell with phase lag */}
          <g
            className={`energy-shell-lag-${uniqueId}`}
            style={{ animationPlayState: playState }}
          >
            <circle
              cx="120"
              cy="120"
              r="58"
              fill="none"
              stroke="rgba(168, 85, 247, 0.38)"
              strokeWidth="1.8"
              strokeDasharray="14 8 4 8"
            />
          </g>

          {/* Inner Dense Shell */}
          <g
            className={`energy-shell-${uniqueId}`}
            style={{ animationPlayState: playState }}
          >
            <circle
              cx="120"
              cy="120"
              r="38"
              fill="none"
              stroke="rgba(216, 180, 254, 0.55)"
              strokeWidth="1.6"
              strokeDasharray="4 6"
            />
          </g>

          {/* Electric/Light Filaments (Curved energy arcs radiating between shells) */}
          <g
            className={`energy-filament-orbit-${uniqueId}`}
            style={{
              animationPlayState: playState,
              opacity: filamentOpacity,
            }}
          >
            {/* Filament Arc 1 */}
            <path
              d="M 120 40 Q 148 76 120 120"
              fill="none"
              stroke="#E9D5FF"
              strokeWidth="1.4"
              strokeDasharray="6 8"
            />
            {/* Filament Arc 2 */}
            <path
              d="M 200 120 Q 164 148 120 120"
              fill="none"
              stroke="#C084FC"
              strokeWidth="1.2"
              strokeDasharray="4 10"
            />
            {/* Filament Arc 3 */}
            <path
              d="M 120 200 Q 92 164 120 120"
              fill="none"
              stroke="#E9D5FF"
              strokeWidth="1.4"
              strokeDasharray="6 8"
            />
            {/* Filament Arc 4 */}
            <path
              d="M 40 120 Q 76 92 120 120"
              fill="none"
              stroke="#C084FC"
              strokeWidth="1.2"
              strokeDasharray="4 10"
            />
          </g>

          {/* Counter-rotating subtle filaments */}
          <g
            className={`energy-filament-orbit-rev-${uniqueId}`}
            style={{
              animationPlayState: playState,
              opacity: filamentOpacity * 0.75,
            }}
          >
            <path
              d="M 176 64 Q 140 100 120 120"
              fill="none"
              stroke="#A855F7"
              strokeWidth="1.2"
              strokeDasharray="5 7"
            />
            <path
              d="M 64 176 Q 100 140 120 120"
              fill="none"
              stroke="#A855F7"
              strokeWidth="1.2"
              strokeDasharray="5 7"
            />
          </g>

          {/* 4. Central Glowing Violet Orb */}
          <g
            className={`energy-core-pulse-${uniqueId}`}
            style={{ animationPlayState: playState }}
          >
            {/* Outer halo */}
            <circle
              cx="120"
              cy="120"
              r={coreRadius + 14}
              fill={`url(#coreOrbGrad_${uniqueId})`}
              filter={`url(#coreGlow_${uniqueId})`}
            />

            {/* Radiant core sphere */}
            <circle
              cx="120"
              cy="120"
              r={coreRadius}
              fill="#FAF5FF"
              filter={`url(#coreGlow_${uniqueId})`}
              className="transition-all duration-300"
            />

            {/* Bright center hot spot */}
            <circle
              cx="120"
              cy="120"
              r={Math.max(4, coreRadius * 0.45)}
              fill="#FFFFFF"
            />
          </g>
        </g>
      </svg>
    </div>
  );
};
