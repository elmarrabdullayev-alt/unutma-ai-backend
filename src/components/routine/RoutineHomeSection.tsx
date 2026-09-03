import React, { useState, useEffect } from 'react';
import {
  Sun,
  Sunrise,
  Moon,
  Sparkles,
  Flame,
  CheckCircle2,
  Plus,
  ChevronRight,
  Clock,
  ArrowRight,
  Trophy,
} from 'lucide-react';
import { Routine, RoutineType } from '../../types';
import { routineService } from '../../services/routineService';

interface RoutineHomeSectionProps {
  onOpenRoutineSession: (routine: Routine) => void;
  onOpenCreateRoutine: (initialType?: RoutineType) => void;
}

export const RoutineHomeSection: React.FC<RoutineHomeSectionProps> = ({
  onOpenRoutineSession,
  onOpenCreateRoutine,
}) => {
  const [routines, setRoutines] = useState<Routine[]>(() => routineService.getAll());
  const [streakData, setStreakData] = useState(() => routineService.getStreakData());

  useEffect(() => {
    const unsub = routineService.subscribe(() => {
      setRoutines([...routineService.getAll()]);
      setStreakData({ ...routineService.getStreakData() });
    });
    return unsub;
  }, []);

  const today = new Date();
  const todayRoutines = routineService.getTodayRoutines(today);
  const displayRoutines = todayRoutines.length > 0 ? todayRoutines : routines.slice(0, 3);

  const getRoutineIcon = (routine: Routine) => {
    if (routine.type === 'morning') return <Sunrise className="h-4 w-4 text-amber-300" />;
    if (routine.type === 'evening') return <Moon className="h-4 w-4 text-indigo-300" />;
    if (routine.type === 'afternoon') return <Sun className="h-4 w-4 text-yellow-400" />;
    return <Sparkles className="h-4 w-4 text-violet-300" />;
  };

  const getRoutineBgColor = (type: RoutineType) => {
    if (type === 'morning') return 'from-amber-950/30 to-orange-950/20 border-amber-500/20';
    if (type === 'evening') return 'from-indigo-950/30 to-purple-950/20 border-indigo-500/20';
    if (type === 'afternoon') return 'from-yellow-950/30 to-amber-950/20 border-yellow-500/20';
    return 'from-violet-950/30 to-indigo-950/20 border-violet-500/20';
  };

  return (
    <section className="space-y-3 pt-1">
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
            <span className="text-base">✨</span>
            Rutinlərim
          </h2>

          {/* Streak Badge */}
          {streakData.currentStreak > 0 ? (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-black animate-pulse">
              <Flame className="h-3 w-3 text-amber-400 fill-amber-400" />
              <span>{streakData.currentStreak} gün streak</span>
            </div>
          ) : streakData.bestStreak > 0 ? (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[10px] font-semibold">
              <Trophy className="h-2.5 w-2.5 text-amber-400" />
              <span>Rekord: {streakData.bestStreak}</span>
            </div>
          ) : null}
        </div>

        {/* Add Routine Button */}
        <button
          onClick={() => onOpenCreateRoutine()}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-400 hover:text-violet-300 active:scale-95 transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Yeni rutin</span>
        </button>
      </div>

      {/* Routine Cards Horizontal / Stacked */}
      <div className="space-y-2.5">
        {displayRoutines.length === 0 ? (
          <div className="p-4 rounded-2xl bg-[#111726] border border-white/5 text-center space-y-2">
            <p className="text-xs text-slate-400 font-medium">Hələ heç bir rutin yaradılmayıb.</p>
            <button
              onClick={() => onOpenCreateRoutine('morning')}
              className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow-sm"
            >
              + Səhər rutini yarat
            </button>
          </div>
        ) : (
          displayRoutines.map((routine) => {
            const progress = routineService.getRoutineProgress(routine);
            const isFinished = progress.isCompleted;

            return (
              <div
                key={routine.id}
                onClick={() => onOpenRoutineSession(routine)}
                className={`p-3.5 rounded-2xl bg-gradient-to-r ${getRoutineBgColor(
                  routine.type
                )} bg-[#121828] border shadow-sm cursor-pointer hover:border-violet-500/40 active:scale-[0.99] transition-all group`}
              >
                {/* Routine Card Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      {getRoutineIcon(routine)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black text-white truncate tracking-tight">
                          {routine.title}
                        </h3>
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-400 font-semibold shrink-0">
                          <Clock className="h-2.5 w-2.5 text-slate-400" />
                          {routine.startTime}
                        </span>
                      </div>

                      {/* Progress Text */}
                      <p className="text-[11px] font-medium text-slate-300 mt-0.5 flex items-center gap-1.5">
                        <span className={isFinished ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                          {progress.completed} / {progress.total} tamamlandı
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          ({progress.percent}%)
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Status / Action Button */}
                  <div className="shrink-0">
                    {isFinished ? (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        <span>Tamamlandı</span>
                      </div>
                    ) : (
                      <div className="h-7 px-2.5 rounded-xl bg-white/10 group-hover:bg-violet-600 text-slate-200 group-hover:text-white text-[11px] font-bold flex items-center gap-1 transition-all">
                        <span>{progress.completed > 0 ? 'Davam et' : 'Başla'}</span>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-2.5 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      isFinished
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : 'bg-gradient-to-r from-violet-500 to-indigo-400'
                    }`}
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>

                {/* Next Step Preview */}
                {!isFinished && progress.nextStep && (
                  <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 truncate text-slate-300">
                      <span className="text-violet-400 font-bold">Növbəti:</span>
                      <span className="truncate">{progress.nextStep.title}</span>
                    </span>
                    {progress.nextStep.time && (
                      <span className="text-[10px] text-slate-400 font-medium shrink-0 pl-1">
                        {progress.nextStep.time}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
