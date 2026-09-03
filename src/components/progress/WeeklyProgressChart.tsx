import React, { useState } from 'react';
import { DayProgressItem } from '../../types';
import { Sparkles } from 'lucide-react';

interface WeeklyProgressChartProps {
  days: DayProgressItem[];
  overallPercent: number | null;
}

export const WeeklyProgressChart: React.FC<WeeklyProgressChartProps> = ({
  days,
  overallPercent,
}) => {
  const [selectedDay, setSelectedDay] = useState<DayProgressItem | null>(null);

  return (
    <div className="rounded-3xl border border-white/10 bg-[#111625] p-5 shadow-lg space-y-4">
      {/* Header: Title & Overall Progress Badge */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-white tracking-tight">Bu həftə</h3>
          <p className="text-[11px] text-slate-400">Gündəlik aktivlik və icra səviyyəsi</p>
        </div>

        {/* Overall Completion Indicator */}
        <div className="flex items-center gap-2 rounded-2xl border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 shadow-sm">
          <div className="text-right">
            <span className="block text-[9px] font-extrabold uppercase tracking-wider text-violet-300">
              Həftəlik irəliləyiş
            </span>
            <span className="text-sm font-black text-white">
              {overallPercent !== null ? `${overallPercent}%` : '—'}
            </span>
          </div>
          <div className="relative flex h-8 w-8 items-center justify-center">
            {/* SVG Circular Progress Ring */}
            <svg className="h-8 w-8 -rotate-90 transform" viewBox="0 0 36 36">
              <path
                className="text-white/10"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-violet-400 transition-all duration-700 ease-out"
                strokeDasharray={`${overallPercent || 0}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* 7 Days Bar Chart */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 pt-2">
        {days.map((day) => {
          const isSelected = selectedDay?.dateStr === day.dateStr;
          const hasActivity = day.percent > 0;
          const isFull = day.percent >= 100;

          return (
            <button
              key={day.dateStr}
              type="button"
              onClick={() => setSelectedDay(isSelected ? null : day)}
              className={`group flex flex-col items-center rounded-2xl p-1.5 transition-all outline-none ${
                day.isToday
                  ? 'bg-violet-600/15 border border-violet-500/30'
                  : isSelected
                  ? 'bg-white/10 border border-white/15'
                  : 'hover:bg-white/5 border border-transparent'
              }`}
            >
              {/* Percentage label on top */}
              <span
                className={`text-[10px] font-bold mb-1.5 ${
                  day.isFuture
                    ? 'text-slate-400'
                    : isFull
                    ? 'text-emerald-400 font-extrabold'
                    : day.percent > 0
                    ? 'text-violet-300'
                    : 'text-slate-400'
                }`}
              >
                {day.isFuture ? '—' : `${day.percent}%`}
              </span>

              {/* Vertical Progress Bar Track */}
              <div className="relative h-24 w-4 sm:w-5 rounded-full bg-slate-800/60 overflow-hidden flex flex-col justify-end p-0.5 border border-white/5">
                {/* Fill bar */}
                {!day.isFuture && (
                  <div
                    style={{ height: `${Math.max(day.percent > 0 ? 8 : 0, day.percent)}%` }}
                    className={`w-full rounded-full transition-all duration-500 ${
                      isFull
                        ? 'bg-gradient-to-t from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/30'
                        : hasActivity
                        ? 'bg-gradient-to-t from-violet-600 to-indigo-400 shadow-sm shadow-violet-600/30'
                        : 'bg-transparent'
                    }`}
                  />
                )}
              </div>

              {/* Day Name Label */}
              <div className="mt-2 flex flex-col items-center">
                <span
                  className={`text-[11px] font-bold tracking-tight ${
                    day.isToday
                      ? 'text-violet-400 font-extrabold'
                      : day.isFuture
                      ? 'text-slate-400'
                      : 'text-slate-300'
                  }`}
                >
                  {day.dayName}
                </span>
                {day.isToday && (
                  <span className="mt-0.5 h-1 w-1 rounded-full bg-violet-400" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Day Details Card (interactive tooltip replacement) */}
      {selectedDay && (
        <div className="rounded-2xl border border-white/10 bg-[#161D2E] p-3 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between text-xs font-bold text-white mb-1.5">
            <span>{selectedDay.dayFull}</span>
            <span className="text-violet-400">{selectedDay.percent}% tamamlanma</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300">
            <div className="bg-black/20 rounded-xl p-2 text-center">
              <span className="block text-[10px] text-slate-400">İşlər</span>
              <span className="font-bold text-white">{selectedDay.tasksCompleted}</span>
            </div>
            <div className="bg-black/20 rounded-xl p-2 text-center">
              <span className="block text-[10px] text-slate-400">Rutinlər</span>
              <span className="font-bold text-white">{selectedDay.routinesCompleted}</span>
            </div>
            <div className="bg-black/20 rounded-xl p-2 text-center">
              <span className="block text-[10px] text-slate-400">Fokus</span>
              <span className="font-bold text-white">{selectedDay.focusMinutes} dəq</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
