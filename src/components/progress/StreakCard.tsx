import React from 'react';
import { Flame, Award } from 'lucide-react';

interface StreakCardProps {
  currentStreak: number;
  bestStreak: number;
}

export const StreakCard: React.FC<StreakCardProps> = ({ currentStreak, bestStreak }) => {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-violet-500/25 bg-gradient-to-br from-[#121629] via-[#0E1322] to-[#0A0D18] p-5 shadow-xl shadow-violet-950/20">
      {/* Subtle Violet Ambient Glow */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-violet-600/15 blur-2xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-12 h-36 w-36 rounded-full bg-indigo-600/10 blur-2xl" />

      <div className="relative flex items-center justify-between gap-4">
        {/* Left Side: Flame & Current Streak */}
        <div className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/10 shadow-inner">
            <Flame className="h-7 w-7 text-violet-400 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black tracking-tight text-white">
                {currentStreak}
              </span>
              <span className="text-sm font-bold text-violet-300">gün</span>
            </div>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">
              Ardıcıl günlər
            </p>
          </div>
        </div>

        {/* Right Side: Best Streak Badge */}
        <div className="flex flex-col items-end text-right">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-300">
            <Award className="h-3.5 w-3.5 text-violet-400" />
            <span>Ən yaxşı: <strong className="text-white font-bold">{bestStreak} gün</strong></span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1">
            {currentStreak > 0
              ? currentStreak >= bestStreak
                ? 'Yeni rekord! 🌟'
                : `${bestStreak - currentStreak} gün qaldı`
              : 'Davamlılığı qoru'}
          </span>
        </div>
      </div>
    </div>
  );
};
