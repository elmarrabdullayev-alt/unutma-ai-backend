import React, { useState } from 'react';
import { ArrowRight, Check, User, Heart, HelpCircle, Shield } from 'lucide-react';
import { UserGender } from '../../types';

interface GenderStepProps {
  initialGender: UserGender;
  onNext: (gender: UserGender) => void;
  onBack: () => void;
}

interface GenderOption {
  id: UserGender;
  label: string;
  sublabel: string;
  icon: React.ElementType;
}

const GENDER_OPTIONS: GenderOption[] = [
  {
    id: 'male',
    label: 'Kişi',
    sublabel: 'Bəy',
    icon: User,
  },
  {
    id: 'female',
    label: 'Qadın',
    sublabel: 'Xanım',
    icon: Heart,
  },
  {
    id: 'other',
    label: 'Digər',
    sublabel: 'Fərdi seçim',
    icon: HelpCircle,
  },
  {
    id: 'prefer_not_to_say',
    label: 'Demək istəmirəm',
    sublabel: 'Məxfi saxlansın',
    icon: Shield,
  },
];

export const GenderStep: React.FC<GenderStepProps> = ({
  initialGender,
  onNext,
  onBack,
}) => {
  const [selectedGender, setSelectedGender] = useState<UserGender>(initialGender);

  const handleSelect = (id: UserGender) => {
    setSelectedGender(id);
  };

  const handleContinue = () => {
    onNext(selectedGender);
  };

  return (
    <div className="relative flex flex-col justify-between h-full min-h-[80vh] px-6 py-8 select-none">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div>
        {/* Progress Bar & Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            ← Geri
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[11px] font-bold text-violet-300">
            <span>2</span>
            <span className="text-violet-500">/</span>
            <span>3</span>
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-2 mb-6">
          <h2 className="text-2xl font-black tracking-tight text-white">
            Səni necə tanıyaq?
          </h2>
          <p className="text-sm text-slate-300/80 leading-relaxed">
            Müraciət formasını və tətbiq təcrübəsini sənə uyğunlaşdırırıq.
          </p>
        </div>

        {/* 4 Selectable Cards */}
        <div className="grid grid-cols-1 gap-3">
          {GENDER_OPTIONS.map((opt) => {
            const isSelected = selectedGender === opt.id;
            const Icon = opt.icon;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt.id)}
                className={`relative flex items-center justify-between p-4 rounded-2xl border text-left transition-all duration-200 active:scale-[0.99] min-h-[64px] ${
                  isSelected
                    ? 'bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border-violet-500/80 shadow-[0_0_20px_rgba(139,92,246,0.2)]'
                    : 'bg-[#101524] border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-200 ${
                      isSelected
                        ? 'bg-violet-600 text-white shadow-md'
                        : 'bg-white/5 text-slate-400'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className={`text-base font-bold ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-slate-400">{opt.sublabel}</p>
                  </div>
                </div>

                {/* Selection Indicator */}
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border transition-all duration-200 ${
                    isSelected
                      ? 'bg-violet-600 border-violet-500 text-white'
                      : 'border-white/20 bg-white/5'
                  }`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CTA Button */}
      <div className="pt-6">
        <button
          type="button"
          onClick={handleContinue}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-base shadow-[0_4px_20px_rgba(124,58,237,0.35)] flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all duration-200"
        >
          <span>Davam et</span>
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
