import React, { useState } from 'react';
import { ArrowRight, Calendar, AlertCircle } from 'lucide-react';

interface BirthDateStepProps {
  initialBirthDate: string;
  onNext: (birthDateIso: string) => void;
  onBack: () => void;
}

const AZ_MONTHS = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'İyun',
  'İyul',
  'Avqust',
  'Sentyabr',
  'Oktyabr',
  'Noyabr',
  'Dekabr',
];

export const BirthDateStep: React.FC<BirthDateStepProps> = ({
  initialBirthDate,
  onNext,
  onBack,
}) => {
  // Parse initial date or default to 2000-01-01
  const initialDateObj = initialBirthDate ? new Date(initialBirthDate) : new Date(2000, 0, 15);
  const validInitial = !isNaN(initialDateObj.getTime());

  const [year, setYear] = useState<number>(validInitial ? initialDateObj.getFullYear() : 2000);
  const [month, setMonth] = useState<number>(validInitial ? initialDateObj.getMonth() + 1 : 1);
  const [day, setDay] = useState<number>(validInitial ? initialDateObj.getDate() : 15);
  const [error, setError] = useState<string | null>(null);

  // Generate Year options (from current year down to 1920)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1920 + 1 }, (_, i) => currentYear - i);

  // Calculate days in selected month & year
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Format date preview as DD.MM.YYYY
  const formattedDay = day.toString().padStart(2, '0');
  const formattedMonth = month.toString().padStart(2, '0');
  const formattedPreview = `${formattedDay}.${formattedMonth}.${year}`;

  const handleValidateAndNext = () => {
    // Check if future date
    const selectedDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (selectedDate.getTime() > today.getTime()) {
      setError('Gələcək tarix seçilə bilməz.');
      return;
    }

    if (year < 1920 || isNaN(selectedDate.getTime())) {
      setError('Zəhmət olmasa düzgün doğum tarixi seçin.');
      return;
    }

    setError(null);
    // Format as ISO YYYY-MM-DD
    const isoString = `${year}-${formattedMonth}-${formattedDay}`;
    onNext(isoString);
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
            <span>3</span>
            <span className="text-violet-500">/</span>
            <span>3</span>
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-2 mb-8">
          <h2 className="text-2xl font-black tracking-tight text-white">
            Doğum tarixini qeyd et
          </h2>
          <p className="text-sm text-slate-300/80 leading-relaxed">
            Bu məlumat gələcəkdə təcrübəni daha fərdi etmək üçün istifadə oluna bilər.
          </p>
        </div>

        {/* Date Display Pill */}
        <div className="flex items-center justify-between p-4 mb-6 rounded-2xl bg-violet-500/10 border border-violet-500/30 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/30 text-violet-300">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-violet-300/80">
                Seçilmiş Tarix
              </p>
              <p className="text-lg font-black text-white">{formattedPreview}</p>
            </div>
          </div>
          <div className="text-xs font-semibold text-slate-400">
            {currentYear - year} yaş
          </div>
        </div>

        {/* 3 Mobile Selectors: Gün, Ay, İl */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Day Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Gün
            </label>
            <select
              value={day > daysInMonth ? daysInMonth : day}
              onChange={(e) => {
                setDay(Number(e.target.value));
                if (error) setError(null);
              }}
              className="w-full h-13 px-3 rounded-2xl bg-[#101524] border border-white/10 text-white font-semibold text-base outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 appearance-none cursor-pointer"
            >
              {days.map((d) => (
                <option key={d} value={d} className="bg-[#101524] text-white">
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Month Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Ay
            </label>
            <select
              value={month}
              onChange={(e) => {
                setMonth(Number(e.target.value));
                if (error) setError(null);
              }}
              className="w-full h-13 px-3 rounded-2xl bg-[#101524] border border-white/10 text-white font-semibold text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 appearance-none cursor-pointer truncate"
            >
              {AZ_MONTHS.map((mName, idx) => (
                <option key={idx + 1} value={idx + 1} className="bg-[#101524] text-white">
                  {mName}
                </option>
              ))}
            </select>
          </div>

          {/* Year Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              İl
            </label>
            <select
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value));
                if (error) setError(null);
              }}
              className="w-full h-13 px-3 rounded-2xl bg-[#101524] border border-white/10 text-white font-semibold text-base outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 appearance-none cursor-pointer"
            >
              {years.map((y) => (
                <option key={y} value={y} className="bg-[#101524] text-white">
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* CTA Button */}
      <div className="pt-6">
        <button
          type="button"
          onClick={handleValidateAndNext}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-base shadow-[0_4px_20px_rgba(124,58,237,0.35)] flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all duration-200"
        >
          <span>Davam et</span>
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
