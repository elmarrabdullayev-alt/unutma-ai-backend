import React, { useState, useEffect } from 'react';
import {
  Sunrise,
  Moon,
  Sun,
  Sparkles,
  Flame,
  Plus,
  ChevronRight,
  Clock,
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
  const activeRoutines = todayRoutines.length > 0 ? todayRoutines : routines.filter((r) => r.isActive);

  // Calculate progress for all active routines
  const routinesWithProgress = activeRoutines.map((routine) => ({
    routine,
    progress: routineService.getRoutineProgress(routine),
  }));

  const getRoutineIcon = (routine: Routine) => {
    if (routine.type === 'morning') return <Sunrise className="h-4 w-4 text-amber-300" />;
    if (routine.type === 'evening') return <Moon className="h-4 w-4 text-indigo-300" />;
    if (routine.type === 'afternoon') return <Sun className="h-4 w-4 text-amber-300" />;
    return <Sparkles className="h-4 w-4 text-violet-300" />;
  };

  // Unified Routine Card Component:
  // Guarantees identical dimensions, padding, button size, icon size, and typography for both "Səhər rutini" and "Axşam rutini"
  const renderRoutineCard = (item: typeof routinesWithProgress[0]) => {
    const { routine, progress } = item;
    const isComplete = progress.isCompleted;

    return (
      <div
        key={routine.id}
        id={`routine-card-${routine.id}`}
        onClick={() => onOpenRoutineSession(routine)}
        className="p-3.5 rounded-2xl bg-[#111726] border border-white/[0.06] hover:border-violet-500/30 cursor-pointer active:scale-[0.99] transition-all shadow-sm group"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              {getRoutineIcon(routine)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-white tracking-tight truncate">
                  {routine.title}
                </h3>
                <span className="flex items-center gap-0.5 text-[10px] text-slate-400 font-medium shrink-0">
                  <Clock className="h-2.5 w-2.5" />
                  {routine.startTime}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {progress.completed} / {progress.total} tamamlandı
              </p>
            </div>
          </div>

          <button
            className={`h-7 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-1 transition-all shrink-0 ${
              isComplete
                ? 'bg-white/10 text-emerald-300 hover:bg-white/15'
                : 'bg-violet-600 group-hover:bg-violet-500 text-white shadow-sm'
            }`}
          >
            <span>{isComplete ? 'Bax' : progress.completed > 0 ? 'Davam et' : 'Başla'}</span>
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-2.5 h-1 w-full rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isComplete
                ? 'bg-emerald-500'
                : 'bg-gradient-to-r from-violet-500 to-indigo-400'
            }`}
            style={{ width: `${isComplete ? 100 : progress.percent}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-2.5">
      {/* Section Header */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Rutinlərim
          </h2>

          {streakData.currentStreak > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold">
              <Flame className="h-2.5 w-2.5 fill-amber-400/20" />
              <span>{streakData.currentStreak} gün</span>
            </span>
          )}
        </div>

        <button
          onClick={() => onOpenCreateRoutine()}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-400 hover:text-violet-300 active:scale-95 transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Yeni rutin</span>
        </button>
      </div>

      {/* Routine Cards List - Equal height and component structure */}
      <div className="space-y-2">
        {activeRoutines.length === 0 ? (
          <div className="p-3.5 rounded-2xl bg-[#111726] border border-white/[0.06] text-center space-y-2">
            <p className="text-xs text-slate-400 font-medium">Hələ heç bir rutin yaradılmayıb.</p>
            <button
              onClick={() => onOpenCreateRoutine('morning')}
              className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-all shadow-sm"
            >
              + Səhər rutini yarat
            </button>
          </div>
        ) : (
          routinesWithProgress.map(renderRoutineCard)
        )}
      </div>
    </section>
  );
};
