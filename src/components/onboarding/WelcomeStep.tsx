import React from 'react';
import { ArrowRight, Sparkles, ShieldCheck, Zap } from 'lucide-react';

interface WelcomeStepProps {
  onNext: () => void;
}

export const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
  return (
    <div className="relative flex flex-col justify-between flex-1 px-6 py-6 min-h-0 bg-[#090D16] select-none">
      {/* Background ambient glow effect */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header & Symbol */}
      <div className="flex flex-col items-center pt-4 text-center">
        {/* Unutma AI Small Symbol */}
        <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1E163B] via-[#140F29] to-[#0D081D] border border-violet-500/30 shadow-[0_0_25px_rgba(139,92,246,0.3)] mb-6">
          <div className="absolute inset-0 rounded-2xl bg-violet-500/10 blur-sm pointer-events-none" />
          <svg
            className="w-8 h-8 text-violet-300 drop-shadow-[0_0_8px_rgba(167,139,250,0.6)]"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="24" cy="24" r="5" fill="#A855F7" />
            <path
              d="M24 6C14.0589 6 6 14.0589 6 24C6 33.9411 14.0589 42 24 42"
              stroke="#A855F7"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="4 2"
            />
            <path
              d="M24 6C33.9411 6 42 14.0589 42 24C42 33.9411 33.9411 42 24 42"
              stroke="#C4B5FD"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="24" cy="12" r="2" fill="#C4B5FD" />
            <circle cx="36" cy="24" r="2" fill="#A78BFA" />
            <circle cx="24" cy="36" r="2" fill="#DDD6FE" />
            <circle cx="12" cy="24" r="2" fill="#8B5CF6" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-black tracking-tight text-white">
          Xoş gəldin ✨
        </h1>

        {/* Subtitle */}
        <p className="mt-3 text-sm leading-relaxed text-slate-300/90 max-w-xs">
          Unutma AI gündəlik işlərini, xatırlatmalarını və planlarını yadında saxlayan şəxsi köməkçindir.
        </p>
      </div>

      {/* Feature Pills (Subtle, elegant highlights) */}
      <div className="space-y-2.5 my-8">
        <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Təbii Səs və AI Yaddaş</p>
            <p className="text-[11px] text-slate-400">Danış və ya yaz, planlarını anında yadda saxlayır</p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Lokal və İldırım Sürətli</p>
            <p className="text-[11px] text-slate-400">Dərhal işə düşür, gecikməsiz çalışır</p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Məxfi və Təhlükəsiz</p>
            <p className="text-[11px] text-slate-400">Məlumatların yalnız öz cihazında saxlanılır</p>
          </div>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="pt-6 pb-2 mt-auto">
        <button
          onClick={onNext}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 bg-size-200 text-white font-bold text-base shadow-[0_4px_25px_rgba(124,58,237,0.4)] flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all duration-200"
        >
          <span>Başlayaq</span>
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
