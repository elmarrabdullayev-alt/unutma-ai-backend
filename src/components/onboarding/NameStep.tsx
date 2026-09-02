import React, { useState } from 'react';
import { ArrowRight, User } from 'lucide-react';

interface NameStepProps {
  initialFirstName: string;
  initialLastName: string;
  onNext: (firstName: string, lastName: string) => void;
  onBack?: () => void;
}

export const NameStep: React.FC<NameStepProps> = ({
  initialFirstName,
  initialLastName,
  onNext,
  onBack,
}) => {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [touched, setTouched] = useState({ first: false, last: false });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setTouched({ first: true, last: true });

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst) {
      setError('Zəhmət olmasa adınızı qeyd edin.');
      return;
    }
    if (!trimmedLast) {
      setError('Zəhmət olmasa soyadınızı qeyd edin.');
      return;
    }

    setError(null);
    onNext(trimmedFirst, trimmedLast);
  };

  const isFirstValid = firstName.trim().length > 0;
  const isLastValid = lastName.trim().length > 0;

  return (
    <div className="relative flex flex-col justify-between h-full min-h-[80vh] px-6 py-8 select-none">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div>
        {/* Progress Bar & Header */}
        <div className="flex items-center justify-between mb-6">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              ← Geri
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[11px] font-bold text-violet-300">
            <span>1</span>
            <span className="text-violet-500">/</span>
            <span>3</span>
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-2 mb-8">
          <h2 className="text-2xl font-black tracking-tight text-white">
            Sənə necə müraciət edək?
          </h2>
          <p className="text-sm text-slate-300/80 leading-relaxed">
            Səni daha fərdi qarşılamaq üçün adını qeyd et.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* First Name Field */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Ad
            </label>
            <div className="relative">
              <input
                type="text"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (error) setError(null);
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, first: true }))}
                placeholder="Məsələn: Elmar"
                autoFocus
                className={`w-full h-14 px-4 pl-11 rounded-2xl bg-[#101524] border text-white placeholder-slate-500 text-base font-medium outline-none transition-all duration-200 ${
                  touched.first && !isFirstValid
                    ? 'border-rose-500/60 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                    : 'border-white/10 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25'
                }`}
              />
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
            </div>
            {touched.first && !isFirstValid && (
              <p className="mt-1.5 text-[11px] text-rose-400 font-medium">
                Ad xanası boş buraxıla bilməz
              </p>
            )}
          </div>

          {/* Last Name Field */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Soyad
            </label>
            <div className="relative">
              <input
                type="text"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (error) setError(null);
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, last: true }))}
                placeholder="Məsələn: Abdullayev"
                className={`w-full h-14 px-4 pl-11 rounded-2xl bg-[#101524] border text-white placeholder-slate-500 text-base font-medium outline-none transition-all duration-200 ${
                  touched.last && !isLastValid
                    ? 'border-rose-500/60 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                    : 'border-white/10 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25'
                }`}
              />
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
            </div>
            {touched.last && !isLastValid && (
              <p className="mt-1.5 text-[11px] text-rose-400 font-medium">
                Soyad xanası boş buraxıla bilməz
              </p>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              {error}
            </div>
          )}
        </form>
      </div>

      {/* CTA Button */}
      <div className="pt-6">
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={!firstName.trim() || !lastName.trim()}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-base shadow-[0_4px_20px_rgba(124,58,237,0.35)] flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none transition-all duration-200"
        >
          <span>Davam et</span>
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
