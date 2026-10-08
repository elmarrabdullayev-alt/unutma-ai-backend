import React, { useState, useEffect } from 'react';
import {
  Sunrise,
  Moon,
  Flame,
  CheckCircle2,
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

  // Morning and Evening routine lookup
  const morningRoutine = routines.find((r) => r.type === 'morning') || routines[0];
  const eveningRoutine = routines.find((r) => r.type === 'evening') || routines[1];

  const targetRoutines = [
    { type: 'morning' as RoutineType, defaultTitle: 'Səhər rutini', routine: morningRoutine },
    { type: 'evening' as RoutineType, defaultTitle: 'Axşam rutini', routine: eveningRoutine },
  ];

  return (
    <section className="space-y-2.5">
      {/* Section Header */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
            Rutinlərim
          </h2>

          {streakData.currentStreak > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-medium">
              <Flame className="h-2.5 w-2.5 fill-amber-400/20" />
              <span>{streakData.currentStreak} gün</span>
            </span>
          )}
        </div>
      </div>

      {/* Səhər və Axşam rutinləri: İki kompakt kart yan-yana */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {targetRoutines.map(({ type, defaultTitle, routine }) => {
          const isMorning = type === 'morning';
          const title = routine?.title || defaultTitle;
          const progress = routine
            ? routineService.getRoutineProgress(routine)
            : { completed: 0, total: 3, percent: 0, isCompleted: false };
          const isComplete = progress.isCompleted;

          return (
            <div
              key={type}
              id={`routine-card-${type}`}
              onClick={() => {
                if (routine) {
                  onOpenRoutineSession(routine);
                } else {
                  onOpenCreateRoutine(type);
                }
              }}
              className="p-3.5 rounded-[18px] bg-[#121827] border border-white/[0.06] hover:border-[#7C3AED]/30 cursor-pointer active:scale-[0.98] transition-all flex flex-col justify-between group min-h-[102px]"
            >
              {/* İkon və Vaxt */}
              <div className="flex items-center justify-between">
                <div
                  className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isMorning
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  }`}
                >
                  {isMorning ? (
                    <Sunrise className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </div>

                {routine?.startTime && (
                  <span className="text-[10px] text-[#94A3B8] font-normal">
                    {routine.startTime}
                  </span>
                )}
              </div>

              {/* Rutin adı və Tamamlanma Göstəricisi */}
              <div className="mt-2.5 space-y-1.5">
                <h3 className="text-xs font-semibold text-[#F5F6FA] tracking-tight truncate">
                  {title}
                </h3>

                <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
                  {isComplete ? (
                    <span className="inline-flex items-center gap-1 text-[#10B981] font-medium text-[10px]">
                      <CheckCircle2 className="h-3 w-3" />
                      Tamamlandı
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#94A3B8]">
                      {progress.completed}/{progress.total} tamamlandı
                    </span>
                  )}
                </div>

                {/* Zərif Tamamlanma Zolağı */}
                <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isComplete
                        ? 'bg-[#10B981]'
                        : isMorning
                        ? 'bg-gradient-to-r from-amber-400 to-amber-300'
                        : 'bg-gradient-to-r from-[#7C3AED] to-[#A78BFA]'
                    }`}
                    style={{ width: `${isComplete ? 100 : progress.percent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
