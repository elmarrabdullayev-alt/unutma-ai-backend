import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Repeat,
  Flame,
  Award,
  AlertCircle,
  TrendingUp,
  Sparkles,
  Play,
  Plus,
} from 'lucide-react';
import { progressService } from '../../services/progressService';
import { ProgressDashboardData, RoutineStreakItem } from '../../types';
import { StreakCard } from './StreakCard';
import { MetricCard } from './MetricCard';
import { WeeklyProgressChart } from './WeeklyProgressChart';
import { MilestoneCelebration } from './MilestoneCelebration';

interface ProgressDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFocus?: () => void;
  onOpenRoutines?: () => void;
  onOpenManualAdd?: () => void;
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({
  isOpen,
  onClose,
  onOpenFocus,
  onOpenRoutines,
  onOpenManualAdd,
}) => {
  const [data, setData] = useState<ProgressDashboardData>(() =>
    progressService.getProgressData()
  );
  const [activeMilestone, setActiveMilestone] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const refresh = () => {
      const updated = progressService.getProgressData();
      setData(updated);
      if (updated.milestoneToCelebrate && !activeMilestone) {
        setActiveMilestone(updated.milestoneToCelebrate);
      }
    };

    refresh();
    const unsub = progressService.subscribe(refresh);
    return unsub;
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDismissMilestone = () => {
    if (activeMilestone) {
      progressService.markMilestoneShown(activeMilestone);
      setActiveMilestone(null);
    }
  };

  // Helper for human-readable focus duration (e.g. "3 saat 30 dəq" or "50 dəq")
  const formatDuration = (totalMinutes: number): string => {
    if (!totalMinutes || totalMinutes <= 0) return '0 dəq';
    if (totalMinutes < 60) return `${totalMinutes} dəq`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hours} saat ${mins} dəq` : `${hours} saat`;
  };

  const hasHistory = data.hasAnyHistory;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#090D16] text-white overflow-hidden animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-white/5 bg-[#0C111E]/95 px-4 py-3.5 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 active:scale-95 transition-all"
            title="Geri"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-base font-black tracking-tight text-white">İrəliləyişin</h1>
            <p className="text-[10px] font-medium text-slate-400">Kiçik addımlar böyük nəticələr yaradır.</p>
          </div>
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 max-w-lg mx-auto w-full pb-20">
        {/* TOP SUMMARY: 1. Cari ardıcıl günlər */}
        <StreakCard
          currentStreak={data.streakSummary.currentStreak}
          bestStreak={data.streakSummary.bestStreak}
        />

        {/* TOP SUMMARY: 2. Bu həftə tamamlanan işlər & 3. Fokus vaxtı */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/5 bg-[#111726]/80 p-3.5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold text-slate-400">Bu həftə tamamlanan</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-white">{data.weeklyMetrics.completedTasks}</span>
              <span className="text-xs font-semibold text-slate-400">iş</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-[#111726]/80 p-3.5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
                <Clock className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold text-slate-400">Fokus vaxtı</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-white">{formatDuration(data.weeklyMetrics.focusMinutes)}</span>
            </div>
          </div>
        </div>

        {/* IF NO ACTIVITY YET: Clean non-zero empty state */}
        {!hasHistory ? (
          <div className="rounded-3xl border border-violet-500/20 bg-gradient-to-br from-[#15122B]/80 to-[#101524]/90 p-6 text-center space-y-3">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600/20 text-violet-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">İrəliləyişin fəaliyyət etdikcə burada görünəcək.</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                İlk rutinini və ya fokus sessiyanı başlat, vərdişlərini addım-addım möhkəmləndir.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-2">
              {onOpenFocus && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenFocus();
                  }}
                  className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 active:scale-95 transition-all shadow-md shadow-violet-600/30"
                >
                  Fokuslan
                </button>
              )}
              {onOpenManualAdd && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenManualAdd();
                  }}
                  className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/20 active:scale-95 transition-all"
                >
                  Xatırlatma yarat
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* ROUTINES (Rutinlərim) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Rutinlərim
                </h2>
                <span className="text-[10px] text-slate-400">Aktiv rutinlər</span>
              </div>

              {data.routineStreaks.length > 0 ? (
                <div className="space-y-2">
                  {data.routineStreaks.map((item: RoutineStreakItem) => (
                    <div
                      key={item.routineId}
                      className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#111726]/80 p-3.5 shadow-sm hover:border-violet-500/20 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-500/25 text-violet-400 shrink-0">
                          <Repeat className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Bu həftə: <span className="text-violet-300 font-semibold">{item.thisWeekRate}%</span> ({item.completedDaysThisWeek}/{item.scheduledDaysThisWeek} gün)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-1 text-xs font-black text-amber-400">
                            <Flame className="h-3.5 w-3.5" />
                            <span>{item.currentStreak} gün</span>
                          </div>
                          <span className="text-[9px] text-slate-400 block">
                            Ən yaxşı: {item.bestStreak} gün
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-[#111726]/40 p-4 text-center">
                  <p className="text-xs text-slate-400">Hələ aktiv rutin qurulmayıb.</p>
                  {onOpenRoutines && (
                    <button
                      onClick={onOpenRoutines}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-violet-600/20 px-3 py-1 text-[11px] font-bold text-violet-300 hover:bg-violet-600 hover:text-white transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>İlk rutinini yarat</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* WEEKLY GRAPH */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Bu həftənin qrafiki
                </h2>
              </div>
              <WeeklyProgressChart
                days={data.weeklyProgress.days}
                overallPercent={data.weeklyProgress.overallPercent}
              />
            </div>

            {/* PERSONAL BESTS */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Şəxsi rekordlar
                </h2>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#111726]/80 p-4 space-y-3">
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-violet-500/15 flex items-center justify-center text-violet-400">
                      <Clock className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-300">Ən uzun fokus sessiyası</span>
                  </div>
                  <span className="text-xs font-black text-white">
                    {data.personalBests.longestFocusMinutes !== null
                      ? `${data.personalBests.longestFocusMinutes} dəq`
                      : '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
                      <Flame className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-300">Ən yaxşı rutin seriyası</span>
                  </div>
                  <span className="text-xs font-black text-white">
                    {data.personalBests.bestRoutineStreak !== null
                      ? `${data.personalBests.bestRoutineStreak} gün`
                      : '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-300">Bir gündə ən çox tamamlanan iş</span>
                  </div>
                  <span className="text-xs font-black text-white">
                    {data.personalBests.maxTasksInOneDay !== null
                      ? `${data.personalBests.maxTasksInOneDay} iş`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MILESTONE CELEBRATION MODAL */}
      {activeMilestone && (
        <MilestoneCelebration
          milestone={activeMilestone}
          onDismiss={handleDismissMilestone}
        />
      )}
    </div>
  );
};
