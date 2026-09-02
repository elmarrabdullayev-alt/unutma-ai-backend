import React, { useMemo } from 'react';
import './HourglassFocusTimer.css';

export interface HourglassFocusTimerProps {
  totalSeconds: number;
  remainingSeconds: number;
  isPaused: boolean;
  taskTitle?: string;
}

export const HourglassFocusTimer: React.FC<HourglassFocusTimerProps> = ({
  totalSeconds,
  remainingSeconds,
  isPaused,
  taskTitle,
}) => {
  // 1. Calculate Sand Progress (0 to 1)
  const progress = useMemo(() => {
    if (!totalSeconds || totalSeconds <= 0) return 0;
    const ratio = 1 - remainingSeconds / totalSeconds;
    return Math.max(0, Math.min(1, ratio));
  }, [remainingSeconds, totalSeconds]);

  const topSandRatio = 1 - progress;
  const bottomSandRatio = progress;
  const isCompleted = remainingSeconds <= 0;
  const isActivelyStreaming = !isPaused && !isCompleted && topSandRatio > 0.003;

  // Format Time Display (MM:SS)
  const clampedSeconds = Math.max(0, remainingSeconds);
  const minutes = Math.floor(clampedSeconds / 60);
  const seconds = clampedSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Geometry coordinates (ViewBox 0 0 240 310)
  // Upper chamber: Y from 38 to 152 (height = 114px)
  const upperSandY = 38 + (1 - topSandRatio) * 110;
  const upperMeniscusDip = topSandRatio > 0.02 && topSandRatio < 0.98 ? 4 : 1.5;

  // Lower chamber: Y from 274 up to 156 (total height = 118px)
  const lowerSandBaseY = 274 - bottomSandRatio * 110;
  const heapPeakOffset = isCompleted
    ? 2
    : bottomSandRatio > 0.02
    ? Math.min(12, bottomSandRatio * 16)
    : 0;
  const lowerSandPeakY = Math.max(156, lowerSandBaseY - heapPeakOffset);

  // Drop distance for sand stream particles
  const dropDistance = Math.max(18, lowerSandPeakY - 152);

  // Accessible description label
  const ariaLabelText = isCompleted
    ? 'Fokus sessiyası tamamlandı'
    : `Fokus sessiyasında ${minutes} dəqiqə ${seconds} saniyə qalıb${isPaused ? ' (Fasilədə)' : ''}`;

  return (
    <div
      className="flex flex-col items-center justify-center w-full select-none"
      role="timer"
      aria-label={ariaLabelText}
    >
      {/* Task Title Pill (Above Hourglass) */}
      {taskTitle && (
        <div className="max-w-[280px] sm:max-w-xs px-4 py-1.5 rounded-full bg-[#121826]/90 border border-violet-500/20 text-center mb-3 shadow-lg shadow-violet-950/40 backdrop-blur-md flex items-center justify-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-violet-400"></span>
          <p className="text-xs font-bold text-slate-200 truncate">
            {taskTitle}
          </p>
        </div>
      )}

      {/* Main Hourglass SVG Container */}
      <div
        className={`relative flex items-center justify-center ${
          isPaused ? 'hourglass-paused' : ''
        }`}
        style={
          {
            '--drop-distance': `${dropDistance}px`,
          } as React.CSSProperties
        }
      >
        {/* Soft Ambient Violet Glow Behind Hourglass */}
        <div
          className={`absolute inset-0 m-auto w-52 h-64 rounded-full bg-violet-600/20 blur-3xl pointer-events-none transition-opacity duration-700 ${
            isCompleted
              ? 'hourglass-completed-glow bg-violet-500/40'
              : isPaused
              ? 'opacity-20'
              : 'hourglass-ambient-glow'
          }`}
        />

        <svg
          viewBox="0 0 240 310"
          className="w-[220px] sm:w-[250px] max-w-full h-auto filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)] overflow-visible"
        >
          <defs>
            {/* Hourglass Upper & Lower Chamber Clip Paths */}
            <clipPath id="upperChamberClip">
              <path
                d="M 52,38 
                   C 52,38 56,82 78,116 
                   C 90,134 108,149 114,153 
                   L 126,153 
                   C 132,149 150,134 162,116 
                   C 184,82 188,38 188,38 
                   Z"
              />
            </clipPath>

            <clipPath id="lowerChamberClip">
              <path
                d="M 114,157 
                   C 108,161 90,176 78,194 
                   C 56,228 52,272 52,272 
                   L 188,272 
                   C 188,272 184,228 162,194 
                   C 150,176 132,161 126,157 
                   Z"
              />
            </clipPath>

            {/* Sand Linear Gradients */}
            <linearGradient id="sandGradientTop" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#DDD6FE" />
              <stop offset="35%" stopColor="#A78BFA" />
              <stop offset="75%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#5B21B6" />
            </linearGradient>

            <linearGradient id="sandGradientBottom" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#EDE9FE" />
              <stop offset="25%" stopColor="#C4B5FD" />
              <stop offset="65%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#5B21B6" />
            </linearGradient>

            {/* Glass Outline Gradient */}
            <linearGradient id="glassOutlineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.55)" />
              <stop offset="25%" stopColor="rgba(196, 181, 253, 0.45)" />
              <stop offset="50%" stopColor="rgba(167, 139, 250, 0.25)" />
              <stop offset="75%" stopColor="rgba(139, 92, 246, 0.35)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0.5)" />
            </linearGradient>

            {/* Stream Gradient */}
            <linearGradient id="streamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#EDE9FE" stopOpacity="0.95" />
              <stop offset="45%" stopColor="#C4B5FD" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.95" />
            </linearGradient>

            {/* Glass Body Fill Gradient */}
            <linearGradient id="glassInnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(30, 27, 75, 0.4)" />
              <stop offset="50%" stopColor="rgba(15, 23, 42, 0.45)" />
              <stop offset="100%" stopColor="rgba(19, 26, 43, 0.4)" />
            </linearGradient>

            {/* Soft Glow Filter */}
            <filter id="violetGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* LAYER A: Glass Inner Background Tint */}
          <path
            d="M 52,38 
               C 52,38 56,82 78,116 
               C 90,134 108,149 114,153 
               C 108,157 90,172 78,190 
               C 56,224 52,268 52,268 
               L 188,268 
               C 188,268 184,224 162,190 
               C 150,172 132,157 126,153 
               C 132,149 150,134 162,116 
               C 184,82 188,38 188,38 
               Z"
            fill="url(#glassInnerGrad)"
          />

          {/* LAYER B: Upper Sand Chamber */}
          <g clipPath="url(#upperChamberClip)">
            {topSandRatio > 0.001 && (
              <path
                d={`M 40,${upperSandY} 
                    Q 120,${upperSandY + upperMeniscusDip} 200,${upperSandY} 
                    L 200,160 
                    L 40,160 
                    Z`}
                fill="url(#sandGradientTop)"
                className="transition-all duration-300 ease-out"
              />
            )}

            {/* Sand surface sheen highlight */}
            {topSandRatio > 0.03 && (
              <ellipse
                cx="120"
                cy={upperSandY}
                rx={Math.max(10, (1 - (upperSandY - 38) / 114) * 52)}
                ry="2.8"
                fill="#EDE9FE"
                opacity="0.4"
              />
            )}
          </g>

          {/* LAYER C: Lower Sand Chamber */}
          <g clipPath="url(#lowerChamberClip)">
            {bottomSandRatio > 0.001 && (
              <path
                d={`M 40,274 
                    L 40,${lowerSandBaseY} 
                    Q 120,${lowerSandPeakY} 200,${lowerSandBaseY} 
                    L 200,274 
                    Z`}
                fill="url(#sandGradientBottom)"
                className="transition-all duration-300 ease-out"
              />
            )}

            {/* Heap Impact Ripple Glow */}
            {isActivelyStreaming && (
              <ellipse
                cx="120"
                cy={lowerSandPeakY + 1}
                rx="7"
                ry="2.2"
                fill="#F5F3FF"
                className="hourglass-splash"
                filter="url(#violetGlow)"
              />
            )}
          </g>

          {/* LAYER D: Falling Sand Stream & Fine Particles */}
          {isActivelyStreaming && (
            <g className="hourglass-stream-group">
              {/* Continuous Central Stream Ray */}
              <line
                x1="120"
                y1="151"
                x2="120"
                y2={lowerSandPeakY}
                stroke="url(#streamGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="4 2.5"
                className="hourglass-stream-active"
                filter="url(#violetGlow)"
              />

              {/* Falling Sand Spark Grains */}
              <circle
                cx="120"
                cy="153"
                r="1.2"
                fill="#FFFFFF"
                className="hourglass-grain-1"
              />
              <circle
                cx="119.3"
                cy="154"
                r="1.1"
                fill="#EDE9FE"
                className="hourglass-grain-2"
              />
              <circle
                cx="120.7"
                cy="153.5"
                r="1.3"
                fill="#DDD6FE"
                className="hourglass-grain-3"
              />
              <circle
                cx="120"
                cy="155"
                r="1"
                fill="#FFFFFF"
                className="hourglass-grain-4"
              />
            </g>
          )}

          {/* LAYER E: Outer Glass Silhouette & Highlights */}
          <path
            d="M 52,38 
               C 52,38 56,82 78,116 
               C 90,134 108,149 114,153 
               C 108,157 90,172 78,190 
               C 56,224 52,268 52,268 
               L 188,268 
               C 188,268 184,224 162,190 
               C 150,172 132,157 126,153 
               C 132,149 150,134 162,116 
               C 184,82 188,38 188,38 
               Z"
            fill="none"
            stroke="url(#glassOutlineGrad)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />

          {/* Left Glass Specular Reflection Highlight Curve */}
          <path
            d="M 59,50 
               C 59,50 63,85 80,113 
               C 87,125 98,137 101,142"
            fill="none"
            stroke="rgba(255, 255, 255, 0.45)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M 101,164 
               C 98,169 87,181 80,193 
               C 63,221 59,256 59,256"
            fill="none"
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Right Glass Subtle Rim Light */}
          <path
            d="M 181,52 
               C 181,52 177,85 163,110"
            fill="none"
            stroke="rgba(196, 181, 253, 0.25)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M 163,196 
               C 177,221 181,254 181,254"
            fill="none"
            stroke="rgba(196, 181, 253, 0.2)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />

          {/* Top Cap Pedestal */}
          <g>
            <rect
              x="40"
              y="26"
              width="160"
              height="12"
              rx="6"
              fill="#131826"
              stroke="rgba(167, 139, 250, 0.35)"
              strokeWidth="1.5"
            />
            {/* Top metallic bevel light */}
            <line
              x1="48"
              y1="29"
              x2="192"
              y2="29"
              stroke="rgba(255, 255, 255, 0.45)"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </g>

          {/* Bottom Cap Pedestal */}
          <g>
            <rect
              x="40"
              y="268"
              width="160"
              height="12"
              rx="6"
              fill="#131826"
              stroke="rgba(167, 139, 250, 0.35)"
              strokeWidth="1.5"
            />
            {/* Bottom metallic bevel light */}
            <line
              x1="48"
              y1="271"
              x2="192"
              y2="271"
              stroke="rgba(255, 255, 255, 0.3)"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </g>

          {/* Base Ambient Table Reflection Glow */}
          <ellipse
            cx="120"
            cy="290"
            rx="62"
            ry="4.5"
            fill="#8B5CF6"
            opacity={isCompleted ? 0.45 : isPaused ? 0.18 : 0.32}
            filter="url(#violetGlow)"
          />
        </svg>
      </div>

      {/* Large Digital Countdown Display & Label */}
      <div className="flex flex-col items-center justify-center text-center mt-3">
        <div className="text-4xl sm:text-5xl font-black tracking-tight text-white font-mono drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
          {timeFormatted}
        </div>
        <div className="text-[10px] sm:text-[11px] font-bold text-violet-300 mt-1.5 uppercase tracking-[0.25em] flex items-center justify-center gap-1.5">
          {isPaused ? (
            <span className="text-amber-400 font-extrabold">• FASİLƏDƏ •</span>
          ) : isCompleted ? (
            <span className="text-violet-400 font-extrabold">• TAMAMLANDI •</span>
          ) : (
            <span>• QALAN VAXT •</span>
          )}
        </div>
      </div>
    </div>
  );
};

