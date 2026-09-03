import React, { useId } from 'react';
import { FocusVisualProps } from '../../../services/focusVisualPreferences';

export const MemoryRingFocusVisual: React.FC<FocusVisualProps> = ({ progress, isPaused }) => {
  const uniqueId = useId().replace(/:/g, '');
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const isCompleted = clampedProgress >= 0.999;

  // Track circumference for progress arc (radius = 94)
  const trackRadius = 94;
  const circumference = 2 * Math.PI * trackRadius;
  const strokeDashoffset = circumference * (1 - clampedProgress);

  // Progressive contraction of orbital rings (0 -> 1 shrinks radius slightly toward core)
  // Max contraction factor: 0.20 (rings contract by up to 20% as focus deepens)
  const contractionScale = 1 - clampedProgress * 0.2;

  // Running state dictates whether CSS rotation runs or freezes
  const playState = isPaused || isCompleted ? 'paused' : 'running';

  return (
    <div
      className="relative w-full h-[220px] xs:h-[240px] max-w-[260px] mx-auto flex items-center justify-center select-none"
      role="img"
      aria-label={`Yaddaş halqası fokus vizualı: ${Math.round(clampedProgress * 100)}% tamamlandı`}
    >
      {/* Scoped CSS Animations with prefers-reduced-motion support */}
      <style>{`
        @keyframes memRingSpinCW_${uniqueId} {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes memRingSpinCCW_${uniqueId} {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes memCoreBreath_${uniqueId} {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.1); opacity: 1; }
        }
        @keyframes memCompletePulse_${uniqueId} {
          0% { transform: scale(0.95); opacity: 0.9; }
          50% { transform: scale(1.15); opacity: 1; filter: drop-shadow(0 0 16px rgba(192, 132, 252, 0.9)); }
          100% { transform: scale(0.95); opacity: 0.9; }
        }

        .mem-spin-cw-${uniqueId} {
          transform-origin: 120px 120px;
          animation: memRingSpinCW_${uniqueId} 28s linear infinite;
        }
        .mem-spin-ccw-${uniqueId} {
          transform-origin: 120px 120px;
          animation: memRingSpinCCW_${uniqueId} 20s linear infinite;
        }
        .mem-spin-slow-${uniqueId} {
          transform-origin: 120px 120px;
          animation: memRingSpinCW_${uniqueId} 42s linear infinite;
        }
        .mem-core-breath-${uniqueId} {
          transform-origin: 120px 120px;
          animation: memCoreBreath_${uniqueId} 3.6s ease-in-out infinite;
        }
        .mem-complete-pulse-${uniqueId} {
          transform-origin: 120px 120px;
          animation: memCompletePulse_${uniqueId} 2s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .mem-spin-cw-${uniqueId},
          .mem-spin-ccw-${uniqueId},
          .mem-spin-slow-${uniqueId},
          .mem-core-breath-${uniqueId},
          .mem-complete-pulse-${uniqueId} {
            animation: none !important;
          }
        }
      `}</style>

      {/* Ambient background glow */}
      <div
        className={`absolute inset-0 m-auto w-40 h-40 rounded-full blur-3xl pointer-events-none transition-opacity duration-700 ${
          isCompleted
            ? 'bg-violet-500/40 opacity-90'
            : isPaused
            ? 'bg-violet-600/10 opacity-30'
            : 'bg-violet-600/20 opacity-60'
        }`}
      />

      <svg
        viewBox="0 0 240 240"
        className="w-full h-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          {/* Radial gradient for central memory core */}
          <radialGradient id={`memCoreGrad_${uniqueId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FAF5FF" stopOpacity="1" />
            <stop offset="35%" stopColor="#C084FC" stopOpacity="0.95" />
            <stop offset="70%" stopColor="#7C3AED" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#4C1D95" stopOpacity="0" />
          </radialGradient>

          {/* Linear gradient for glowing orbital stroke */}
          <linearGradient id={`memOrbitalGrad_${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C084FC" />
            <stop offset="50%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>

          {/* Progress arc gradient */}
          <linearGradient id={`memProgressGrad_${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#A855F7" />
            <stop offset="50%" stopColor="#C084FC" />
            <stop offset="100%" stopColor="#E9D5FF" />
          </linearGradient>

          {/* Glow filter for core */}
          <filter id={`memGlow_${uniqueId}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. Base Progress Track (Subtle Violet Ring) */}
        <circle
          cx="120"
          cy="120"
          r={trackRadius}
          fill="none"
          stroke="rgba(139, 92, 246, 0.14)"
          strokeWidth="3.5"
        />

        {/* 2. Active Progress Arc (Shows exact completion, contracts gently) */}
        <circle
          cx="120"
          cy="120"
          r={trackRadius}
          fill="none"
          stroke={`url(#memProgressGrad_${uniqueId})`}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 120 120)"
          className="transition-[stroke-dashoffset] duration-500 ease-out"
          filter={`url(#memGlow_${uniqueId})`}
        />

        {/* 3. Layered Orbital Rings Group (Contracts as progress increases) */}
        <g
          transform={`translate(120, 120) scale(${contractionScale}) translate(-120, -120)`}
          className="transition-transform duration-700 ease-out"
        >
          {/* Outer Layer Orbital Ring (Clockwise) */}
          <g
            className={`mem-spin-cw-${uniqueId}`}
            style={{ animationPlayState: playState }}
          >
            <circle
              cx="120"
              cy="120"
              r="82"
              fill="none"
              stroke="rgba(167, 139, 250, 0.28)"
              strokeWidth="1.2"
              strokeDasharray="4 8"
            />
            {/* Satellite Nodes */}
            <circle cx="202" cy="120" r="3" fill="#C084FC" filter={`url(#memGlow_${uniqueId})`} />
            <circle cx="38" cy="120" r="2" fill="#8B5CF6" opacity="0.8" />
            <circle cx="120" cy="38" r="1.5" fill="#A78BFA" opacity="0.6" />
          </g>

          {/* Middle Layer Orbital Ring (Counter-Clockwise) */}
          <g
            className={`mem-spin-ccw-${uniqueId}`}
            style={{ animationPlayState: playState }}
          >
            <ellipse
              cx="120"
              cy="120"
              rx="64"
              ry="60"
              fill="none"
              stroke={`url(#memOrbitalGrad_${uniqueId})`}
              strokeWidth="1.4"
              strokeDasharray="2 10"
              transform="rotate(25 120 120)"
              opacity="0.65"
            />
            {/* Satellite Nodes */}
            <circle cx="184" cy="120" r="2.5" fill="#DDD6FE" />
            <circle cx="120" cy="180" r="2" fill="#A855F7" />
          </g>

          {/* Inner Layer Orbital Ring (Slow Clockwise) */}
          <g
            className={`mem-spin-slow-${uniqueId}`}
            style={{ animationPlayState: playState }}
          >
            <circle
              cx="120"
              cy="120"
              r="44"
              fill="none"
              stroke="rgba(192, 132, 252, 0.35)"
              strokeWidth="1"
              strokeDasharray="8 6 2 6"
            />
            <circle cx="164" cy="120" r="2" fill="#E9D5FF" />
            <circle cx="76" cy="120" r="1.5" fill="#C084FC" />
          </g>

          {/* Inner Filament Circle */}
          <circle
            cx="120"
            cy="120"
            r="30"
            fill="none"
            stroke="rgba(139, 92, 246, 0.25)"
            strokeWidth="1"
            strokeDasharray="3 5"
          />
        </g>

        {/* 4. Central Glowing Memory Core */}
        <g
          className={
            isCompleted
              ? `mem-complete-pulse-${uniqueId}`
              : !isPaused
              ? `mem-core-breath-${uniqueId}`
              : ''
          }
        >
          {/* Soft outer glow halo */}
          <circle
            cx="120"
            cy="120"
            r="24"
            fill={`url(#memCoreGrad_${uniqueId})`}
            filter={`url(#memGlow_${uniqueId})`}
          />

          {/* Solid radiant core */}
          <circle
            cx="120"
            cy="120"
            r={isCompleted ? 14 : 10}
            fill="#FAF5FF"
            className="transition-all duration-500"
            filter={`url(#memGlow_${uniqueId})`}
          />

          {/* Inner luminous highlight */}
          <circle
            cx="118"
            cy="118"
            r="4"
            fill="#FFFFFF"
            opacity="0.9"
          />
        </g>
      </svg>
    </div>
  );
};
