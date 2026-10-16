import React, { useState, useEffect } from 'react';
import {
  Sunrise,
  Moon,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Routine, RoutineType } from '../../types';
import { springPress } from '../../utils/motion';
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
    <section aria-labelledby="routines-heading">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="routines-heading" className="text-[17px] font-semibold text-ink-50">
          Rutinlər
        </h2>
        {streakData.currentStreak > 0 && (
          <span className="inline-flex items-center gap-1 text-[13px] text-zer-300 tabular">
            <Flame className="h-3.5 w-3.5" />
            {streakData.currentStreak} gün ardıcıl
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {targetRoutines.map(({ type, defaultTitle, routine }) => {
          const isMorning = type === 'morning';
          const title = routine?.title || defaultTitle;
          const progress = routine
            ? routineService.getRoutineProgress(routine)
            : { completed: 0, total: 3, percent: 0, isCompleted: false };
          const isComplete = progress.isCompleted;
          const pct = isComplete ? 100 : progress.percent;
          const R = 17;
          const C = 2 * Math.PI * R;

          return (
            <motion.button
              key={type}
              type="button"
              id={`routine-card-${type}`}
              whileTap={{ scale: 0.96 }}
              transition={springPress}
              onClick={() => (routine ? onOpenRoutineSession(routine) : onOpenCreateRoutine(type))}
              className="surface relative flex min-h-[132px] flex-col justify-between overflow-hidden rounded-card p-4 text-left"
              aria-label={`${title}, ${progress.completed} / ${progress.total} addım tamamlanıb`}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl"
                style={{ background: isMorning ? 'rgb(236 183 74 / 0.16)' : 'rgb(172 151 230 / 0.16)' }}
              />
              <div className="relative flex items-start justify-between">
                {/* progress ring with the icon inside */}
                <span className="relative flex h-11 w-11 items-center justify-center">
                  <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden="true">
                    <circle cx="20" cy="20" r={R} fill="none" stroke="rgb(255 240 225 / 0.08)" strokeWidth="3" />
                    <motion.circle
                      cx="20"
                      cy="20"
                      r={R}
                      fill="none"
                      stroke={isComplete ? 'var(--color-pista-400)' : isMorning ? 'var(--color-zer-400)' : 'var(--color-lilac-400)'}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={C}
                      initial={false}
                      animate={{ strokeDashoffset: C * (1 - pct / 100) }}
                      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                    />
                  </svg>
                  {isComplete ? (
                    <CheckCircle2 className="h-[18px] w-[18px] text-pista-300" />
                  ) : isMorning ? (
                    <Sunrise className="h-[18px] w-[18px] text-zer-300" />
                  ) : (
                    <Moon className="h-[18px] w-[18px] text-lilac-300" />
                  )}
                </span>
                {routine?.startTime && <span className="tabular text-[13px] text-ink-300">{routine.startTime}</span>}
              </div>

              <div className="relative mt-3">
                <h3 className="truncate text-[15px] font-semibold text-ink-50">{title}</h3>
                <p className={`mt-0.5 text-[13px] tabular ${isComplete ? 'text-pista-300' : 'text-ink-300'}`}>
                  {isComplete ? 'Bu gün tamamlandı' : `${progress.completed} / ${progress.total} addım`}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
};
