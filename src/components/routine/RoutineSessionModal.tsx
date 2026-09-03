import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Sparkles,
  Flame,
  Sunrise,
  Moon,
  Sun,
  Clock,
  RotateCcw,
  Pencil,
  Bell,
  CheckCircle2,
} from 'lucide-react';
import { Routine, RoutineType } from '../../types';
import { routineService } from '../../services/routineService';
import { triggerHaptic, playStepTickSound, playSuccessSound } from '../../utils/soundUtils';

interface RoutineSessionModalProps {
  isOpen: boolean;
  routine: Routine | null;
  onClose: () => void;
  onEditRoutine: (routine: Routine) => void;
}

export const RoutineSessionModal: React.FC<RoutineSessionModalProps> = ({
  isOpen,
  routine,
  onClose,
  onEditRoutine,
}) => {
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [justFinished, setJustFinished] = useState(false);

  useEffect(() => {
    if (!routine) return;
    const completed = routineService.getCompletedStepIdsForToday(routine.id);
    setCompletedIds(completed);
    setJustFinished(false);
  }, [routine, isOpen]);

  if (!isOpen || !routine) return null;

  const totalSteps = routine.steps.length;
  const completedCount = completedIds.length;
  const percent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  const isAllDone = totalSteps > 0 && completedCount >= totalSteps;

  const handleToggleStep = (stepId: string) => {
    triggerHaptic('light');
    playStepTickSound();

    const res = routineService.toggleStep(routine.id, stepId);
    setCompletedIds(routineService.getCompletedStepIdsForToday(routine.id));

    if (res.isCompleted100) {
      setJustFinished(true);
      triggerHaptic('success');
      playSuccessSound();
    } else {
      setJustFinished(false);
    }
  };

  const handleReset = () => {
    routineService.resetTodayRoutine(routine.id);
    setCompletedIds([]);
    setJustFinished(false);
    triggerHaptic('medium');
  };

  const getRoutineIcon = (type: RoutineType) => {
    if (type === 'morning') return <Sunrise className="h-5 w-5 text-amber-300" />;
    if (type === 'evening') return <Moon className="h-5 w-5 text-indigo-300" />;
    if (type === 'afternoon') return <Sun className="h-5 w-5 text-yellow-400" />;
    return <Sparkles className="h-5 w-5 text-violet-300" />;
  };

  const streakData = routineService.getStreakData();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md max-h-[92vh] flex flex-col rounded-3xl bg-[#0F1523] border border-violet-500/30 shadow-2xl overflow-hidden text-white animate-scale-up">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#131A2D]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
              {getRoutineIcon(routine.type)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-tight truncate">
                  {routine.title}
                </h2>
                {streakData.currentStreak > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-black shrink-0">
                    <Flame className="h-3 w-3 text-amber-400 fill-amber-400" />
                    {streakData.currentStreak} gün
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-400" />
                  {routine.startTime}
                </span>
                <span>•</span>
                <span>Bugün üçün cədvəl</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onEditRoutine(routine)}
              className="h-8 w-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center transition-all active:scale-95"
              title="Rutini redaktə et"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center transition-all active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Progress Overview Card */}
        <div className="px-5 pt-4 pb-3 bg-[#111728] border-b border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-white tracking-tight">
              {completedCount} / {totalSteps} tamamlandı
            </span>
            <span className={`font-black ${isAllDone ? 'text-emerald-400' : 'text-violet-400'}`}>
              {percent}%
            </span>
          </div>

          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isAllDone
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-gradient-to-r from-violet-500 to-indigo-400'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* 100% Celebration Banner */}
          {(isAllDone || justFinished) && (
            <div className="pt-1.5 flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-teal-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-black animate-fade-in shadow-md">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400 animate-spin" />
                <span>Rutini tamamladın ✨</span>
              </div>
              <button
                onClick={handleReset}
                className="text-[10px] text-slate-400 hover:text-white font-semibold flex items-center gap-1 active:scale-95"
              >
                <RotateCcw className="h-3 w-3" />
                Sıfırla
              </button>
            </div>
          )}
        </div>

        {/* Ordered Steps Checklist */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Addımlar ({totalSteps})</span>
            <span className="text-[10px] lowercase text-slate-400">klikləyərək tamamla</span>
          </div>

          {routine.steps.map((step, index) => {
            const isDone = completedIds.includes(step.id);

            return (
              <div
                key={step.id}
                onClick={() => handleToggleStep(step.id)}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] ${
                  isDone
                    ? 'bg-[#101524]/60 border-emerald-500/30 text-slate-400'
                    : 'bg-[#141B2D] border-white/10 hover:border-violet-500/30 text-white shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Custom animated checkbox */}
                  <div
                    className={`h-6 w-6 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-200 ${
                      isDone
                        ? 'bg-emerald-500 border-emerald-400 text-black shadow-md scale-105'
                        : 'border-white/30 bg-white/5 hover:border-violet-400'
                    }`}
                  >
                    {isDone && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                  </div>

                  {/* Step Title & Index */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-bold leading-snug transition-all truncate ${
                        isDone ? 'line-through text-slate-400' : 'text-white'
                      }`}
                    >
                      {step.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                      <span>#{index + 1}</span>
                      {step.time && <span>• {step.time}</span>}
                      {step.duration && <span>• {step.duration} dəq</span>}
                    </div>
                  </div>
                </div>

                {/* Notification indicator */}
                <div className="shrink-0 pl-2">
                  {step.notificationEnabled && (
                    <Bell className="h-3.5 w-3.5 text-violet-400/60" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-[#121828] flex items-center gap-2">
          {isAllDone ? (
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Əladır, bağla</span>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              Davam etmək üçün saxla
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
