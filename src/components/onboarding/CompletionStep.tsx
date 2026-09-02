import React from 'react';
import { Check, Sparkles, ArrowRight } from 'lucide-react';

interface CompletionStepProps {
  firstName: string;
  onFinish: () => void;
}

export const CompletionStep: React.FC<CompletionStepProps> = ({
  firstName,
  onFinish,
}) => {
  return (
    <div className="relative flex flex-col justify-between h-full min-h-[80vh] px-6 py-8 select-none text-center">
      {/* Background ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col items-center pt-8">
        {/* Rewarding Success Badge with Ripple Rings */}
        <div className="relative flex items-center justify-center w-24 h-24 mb-8">
          {/* Outer Ripple Rings */}
          <div className="absolute inset-0 rounded-full border border-violet-500/40 animate-ping opacity-30" />
          <div className="absolute -inset-3 rounded-full border border-indigo-500/30 animate-pulse" />

          {/* Central Success Orb */}
          <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-emerald-500 text-white shadow-[0_0_35px_rgba(139,92,246,0.5)]">
            <Check className="h-10 w-10 stroke-[3]" />
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2 flex-wrap">
          <span>Hazırsan, {firstName || 'Dost'}</span>
          <span>✨</span>
        </h1>

        {/* Subtext */}
        <p className="mt-3 text-base text-slate-300 max-w-xs leading-relaxed">
          Unutma AI artıq sənin şəxsi yaddaş köməkçindir.
        </p>

        {/* Personalized Highlight Cards */}
        <div className="w-full mt-8 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm space-y-3 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/20 text-violet-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold text-slate-200">
              Səsli və ya yazılı xatırlatmalar dərhal hazırdır
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
              <Check className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold text-slate-200">
              Profilin və seçimlərin yerli yaddaşda saxlanıldı
            </p>
          </div>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="pt-6">
        <button
          type="button"
          onClick={onFinish}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 bg-size-200 text-white font-bold text-base shadow-[0_4px_25px_rgba(124,58,237,0.4)] flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all duration-200"
        >
          <span>Unutma AI-a daxil ol</span>
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
