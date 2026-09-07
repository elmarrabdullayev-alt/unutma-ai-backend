import React, { useEffect, useState } from 'react';

interface AnimatedSplashProps {
  onComplete: () => void;
}

export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({ onComplete }) => {
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const totalDuration = prefersReducedMotion ? 600 : 2200;
    const fadeOutDelay = Math.max(300, totalDuration - 350);

    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, fadeOutDelay);

    const completeTimer = setTimeout(() => {
      onComplete();
    }, totalDuration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] min-h-[100dvh] h-[100dvh] w-full flex flex-col items-center justify-center bg-[#050711] select-none transition-opacity duration-300 ease-out overflow-hidden ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        background: 'radial-gradient(circle at 50% 45%, #180D33 0%, #090518 45%, #04050D 100%)',
      }}
    >
      {/* Background ambient light particles / soft glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-violet-600/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 left-1/3 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl" />
        {/* Subtle decorative stars/dots */}
        <div className="absolute top-[28%] left-[22%] w-1 h-1 bg-violet-300/40 rounded-full animate-ping" />
        <div className="absolute top-[32%] right-[25%] w-1 h-1 bg-indigo-300/50 rounded-full" />
        <div className="absolute bottom-[35%] left-[30%] w-1 h-1 bg-purple-200/30 rounded-full" />
        <div className="absolute bottom-[28%] right-[28%] w-1.5 h-1.5 bg-violet-400/40 rounded-full animate-pulse" />
      </div>

      <div className="relative flex flex-col items-center justify-center">
        {/* SHARED CENTER CONTAINER: Ring, E Monogram, and Unutma AI Icon share identical center point */}
        <div className="relative flex items-center justify-center w-24 h-24">
          {/* 1. Expanding Thin Memory Ring (Wave Pulse) */}
          <div
            className="absolute w-28 h-28 rounded-full border border-violet-500/40 pointer-events-none animate-[splashRing_2s_ease-out_infinite]"
            style={{
              boxShadow: '0 0 25px rgba(139, 92, 246, 0.25)',
            }}
          />

          {/* 2. Central Logo Box with Breathing Glow */}
          <div className="relative z-10 flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-[#1C1538]/90 via-[#130E26]/95 to-[#0D081D] border border-violet-500/30 shadow-[0_0_40px_rgba(139,92,246,0.35)] animate-[splashLogo_1.8s_cubic-bezier(0.16,1,0.3,1)_forwards] overflow-hidden">
            {/* Internal Glow Halo */}
            <div className="absolute inset-0 rounded-3xl bg-violet-500/10 blur-md pointer-events-none" />

            {/* Layer A: Minimal Glowing "E" Monogram (Phase 1 & Phase 2 Dissolve) */}
            <div className="absolute inset-0 flex items-center justify-center animate-[monogramE_2s_cubic-bezier(0.16,1,0.3,1)_forwards] pointer-events-none">
              <svg
                className="w-12 h-12 text-violet-300 drop-shadow-[0_0_12px_rgba(167,139,250,0.85)]"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="monogram_e_grad" x1="16" y1="13" x2="32" y2="35" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#F5F3FF" />
                    <stop offset="0.45" stopColor="#DDD6FE" />
                    <stop offset="1" stopColor="#A855F7" />
                  </linearGradient>
                </defs>

                {/* Subtle orbital guideline */}
                <circle cx="24" cy="24" r="15" stroke="#8B5CF6" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.35" />

                {/* Minimalist Geometric 'E' with thin elegant lines */}
                <path
                  d="M31.5 14H17V34H31.5"
                  stroke="url(#monogram_e_grad)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M17 24H27"
                  stroke="url(#monogram_e_grad)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                {/* Luminous spark nodes at terminal ends */}
                <circle cx="31.5" cy="14" r="1.3" fill="#EDE9FE" />
                <circle cx="27" cy="24" r="1.3" fill="#DDD6FE" />
                <circle cx="31.5" cy="34" r="1.3" fill="#C4B5FD" />
              </svg>
            </div>

            {/* Layer B: Central Unutma AI Symbol (Phase 2 Reveal & Continuation) */}
            <div className="absolute inset-0 flex items-center justify-center animate-[mainIconReveal_2s_cubic-bezier(0.16,1,0.3,1)_forwards]">
              <svg
                className="w-12 h-12 text-violet-300 drop-shadow-[0_0_12px_rgba(167,139,250,0.6)]"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Core Neural Sparkle Symbol */}
                <circle cx="24" cy="24" r="5" fill="url(#splash_core_grad)" />
                {/* Orbital Memory Rings */}
                <path
                  d="M24 6C14.0589 6 6 14.0589 6 24C6 33.9411 14.0589 42 24 42"
                  stroke="url(#splash_ring_grad1)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="4 2"
                />
                <path
                  d="M24 6C33.9411 6 42 14.0589 42 24C42 33.9411 33.9411 42 24 42"
                  stroke="url(#splash_ring_grad2)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {/* Intelligent Spark Nodes */}
                <circle cx="24" cy="12" r="2" fill="#C4B5FD" />
                <circle cx="36" cy="24" r="2" fill="#A78BFA" />
                <circle cx="24" cy="36" r="2" fill="#DDD6FE" />
                <circle cx="12" cy="24" r="2" fill="#8B5CF6" />

                <defs>
                  <linearGradient id="splash_core_grad" x1="19" y1="19" x2="29" y2="29" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#E9D5FF" />
                    <stop offset="1" stopColor="#A855F7" />
                  </linearGradient>
                  <linearGradient id="splash_ring_grad1" x1="6" y1="6" x2="24" y2="42" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#A855F7" />
                    <stop offset="1" stopColor="#6366F1" />
                  </linearGradient>
                  <linearGradient id="splash_ring_grad2" x1="42" y1="6" x2="24" y2="42" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#DDD6FE" />
                    <stop offset="1" stopColor="#8B5CF6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </div>

        {/* Subtle Founder Signature: "by Elmar" */}
        <div
          id="splash-founder-signature"
          className="mt-2.5 flex items-center justify-center animate-[founderSignature_2s_ease-out_forwards]"
        >
          <span className="text-[11px] font-normal tracking-[0.22em] text-violet-300/40 select-none">
            by Elmar
          </span>
        </div>

        {/* App Title & Subtitle Fade-in */}
        <div className="mt-4 flex flex-col items-center animate-[splashText_2s_ease-out_forwards]">
          <h1 className="text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-200 to-violet-400">
            Unutma AI
          </h1>
          <p className="mt-1 text-[11px] font-medium tracking-widest text-violet-300/70 uppercase">
            Ağıllı Yaddaş Köməkçisi
          </p>
        </div>
      </div>

      <style>{`
        @keyframes splashRing {
          0% {
            transform: scale(0.7);
            opacity: 0.9;
          }
          70% {
            transform: scale(1.65);
            opacity: 0.35;
          }
          100% {
            transform: scale(2.0);
            opacity: 0;
          }
        }
        @keyframes splashLogo {
          0% {
            transform: scale(0.65);
            opacity: 0;
          }
          40% {
            transform: scale(1.04);
            opacity: 1;
          }
          70% {
            transform: scale(0.98);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes monogramE {
          0% {
            opacity: 0;
            transform: scale(0.85);
            filter: blur(4px);
          }
          22% {
            opacity: 1;
            transform: scale(1);
            filter: blur(0px);
          }
          38% {
            opacity: 1;
            transform: scale(1);
            filter: blur(0px);
          }
          52% {
            opacity: 0;
            transform: scale(1.18);
            filter: blur(5px);
          }
          100% {
            opacity: 0;
            transform: scale(1.2);
            filter: blur(6px);
          }
        }
        @keyframes mainIconReveal {
          0% {
            opacity: 0;
            transform: scale(0.82);
            filter: blur(6px);
          }
          36% {
            opacity: 0;
            transform: scale(0.82);
            filter: blur(6px);
          }
          54% {
            opacity: 1;
            transform: scale(1.03);
            filter: blur(0px);
          }
          70% {
            opacity: 1;
            transform: scale(0.99);
            filter: blur(0px);
          }
          100% {
            opacity: 1;
            transform: scale(1);
            filter: blur(0px);
          }
        }
        @keyframes founderSignature {
          0% {
            opacity: 0;
            transform: translateY(4px);
          }
          52% {
            opacity: 0;
            transform: translateY(4px);
          }
          72% {
            opacity: 0.85;
            transform: translateY(0);
          }
          100% {
            opacity: 0.85;
            transform: translateY(0);
          }
        }
        @keyframes splashText {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          54% {
            opacity: 0;
            transform: translateY(10px);
          }
          82% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
