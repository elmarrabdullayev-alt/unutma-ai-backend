import React from 'react';
import { ArrowRight, Sparkles, ShieldCheck, Zap } from 'lucide-react';
import { BrandMark } from '../ui/BrandMark';

interface WelcomeStepProps {
  onNext: () => void;
}

export const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
  return (
    <div className="relative flex flex-col justify-between flex-1 px-6 py-6 min-h-0 select-none">
      {/* Background ambient glow effect */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-zer-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header & Symbol */}
      <div className="flex flex-col items-center pt-4 text-center">
        <div className="relative mb-6">
          <span aria-hidden="true" className="absolute inset-0 -m-6 rounded-full" style={{ background: 'radial-gradient(circle, rgb(236 183 74 / 0.22), transparent 65%)' }} />
          <BrandMark size={84} />
        </div>

        {/* Title */}
        <h1 className="font-display text-[34px] leading-[1.08] font-normal text-ink-50">
          Xoş gəldin
        </h1>

        {/* Subtitle */}
        <p className="mt-3 text-sm leading-relaxed text-ink-300/90 max-w-xs">
          Unutma AI gündəlik işlərini, xatırlatmalarını və planlarını yadında saxlayan şəxsi köməkçindir.
        </p>
      </div>

      {/* Feature Pills (Subtle, elegant highlights) */}
      <div className="space-y-2.5 my-8">
        <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zer-500/15 text-zer-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Təbii Səs və AI Yaddaş</p>
            <p className="text-[13px] text-ink-400">Danış və ya yaz, planlarını anında yadda saxlayır</p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zer-500/15 text-zer-400">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Lokal və İldırım Sürətli</p>
            <p className="text-[13px] text-ink-400">Dərhal işə düşür, gecikməsiz çalışır</p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pista-500/15 text-pista-400">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Məxfi və Təhlükəsiz</p>
            <p className="text-[13px] text-ink-400">Məlumatların yalnız öz cihazında saxlanılır</p>
          </div>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="pt-6 pb-2 mt-auto">
        <button
          onClick={onNext}
          className="w-full h-14 rounded-2xl btn-gold text-ink-950 font-bold text-base flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all duration-200"
        >
          <span>Başlayaq</span>
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
