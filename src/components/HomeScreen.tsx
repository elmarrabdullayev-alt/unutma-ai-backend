import React, { useState, useEffect } from 'react';
import {
  Bell,
  Plus,
  Flame,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Clock3,
} from 'lucide-react';
import { Reminder, UserProfile, FocusSession, Routine, RoutineType } from '../types';
import { MobileReminderCard } from './MobileReminderCard';
import { RoutineHomeSection } from './routine/RoutineHomeSection';
import {
  getGreetingAz,
  getFormattedTodayAz,
  isReminderToday,
  isReminderPast,
  isNearDue,
} from '../utils/dateUtils';
import { userProfileService } from '../services/userProfileService';
import { progressService } from '../services/progressService';
import { routineService } from '../services/routineService';

interface HomeScreenProps {
  reminders: Reminder[];
  userProfile?: UserProfile | null;
  onNavigateToProfile?: () => void;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  onSnooze: (id: string, minutes: number) => void;
  onOpenVoice: () => void;
  onOpenManualAdd: () => void;
  onOpenFocus?: (reminder?: Reminder) => void;
  onOpenPlanner?: () => void;
  onOpenProgress?: () => void;
  onOpenRoutineSession?: (routine: Routine) => void;
  onOpenCreateRoutine?: (initialType?: RoutineType) => void;
  activeFocusSession?: FocusSession | null;
  notificationPermission?: NotificationPermission;
  onRequestNotificationPermission?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  reminders,
  userProfile,
  onNavigateToProfile,
  onToggleComplete,
  onDelete,
  onEdit,
  onSnooze,
  onOpenVoice,
  onOpenManualAdd,
  onOpenFocus,
  onOpenPlanner,
  onOpenProgress,
  onOpenRoutineSession,
  onOpenCreateRoutine,
  activeFocusSession,
  notificationPermission,
  onRequestNotificationPermission,
}) => {
  const [filterMode, setFilterMode] = useState<'active' | 'completed'>('active');
  const [progressData, setProgressData] = useState(() => progressService.getProgressData());

  useEffect(() => {
    const unsub = progressService.subscribe(() => {
      setProgressData(progressService.getProgressData());
    });
    return unsub;
  }, []);

  const greeting = getGreetingAz(userProfile?.firstName);
  const todayFormatted = getFormattedTodayAz();
  const initials = userProfileService.getInitials(userProfile);

  // 1. Overdue reminders (past due & not completed)
  const overdueReminders = reminders.filter(
    (r) => !r.isCompleted && isReminderPast(r)
  );

  // 2. Smart "İndi" near-due reminders (strictly within next 2 hours)
  const nearDueReminders = reminders.filter(
    (r) => !r.isCompleted && isNearDue(r)
  );

  // 3. Other today reminders within 4 hours (excluding near-due which are placed in top "İndi")
  const otherTodayNowReminders = reminders.filter((r) => {
    if (r.isCompleted || isReminderPast(r) || isNearDue(r)) return false;
    const dueTime = new Date(r.dueDateTime).getTime();
    const diffHours = (dueTime - Date.now()) / (1000 * 60 * 60);
    return isReminderToday(r) && diffHours <= 4;
  });

  // 4. Later reminders (excluding anything displayed in near-due top section or overdue)
  const laterReminders = reminders.filter((r) => {
    if (r.isCompleted || isReminderPast(r) || isNearDue(r)) return false;
    return !otherTodayNowReminders.includes(r);
  });

  const completedReminders = reminders.filter((r) => r.isCompleted);
  const totalActiveCount = reminders.filter((r) => !r.isCompleted).length;

  const completedThisWeek = progressData.weeklyMetrics.completedTasks;
  const streakCount = routineService.getStreakData().currentStreak || progressData.streakSummary.currentStreak;

  return (
    <div className="w-full px-4 pt-2 pb-6 space-y-7">
      {/* 1. Header — Clean & Spacious, No Card Container */}
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-white truncate">
            {greeting}
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <span>{todayFormatted}</span>
            <span className="text-slate-600">•</span>
            <span className={totalActiveCount > 0 ? 'text-violet-300 font-medium' : 'text-emerald-400 font-medium'}>
              {totalActiveCount > 0
                ? `${totalActiveCount} aktiv tapşırıq`
                : 'Hamısı tamamlandı'}
            </span>
          </p>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          {notificationPermission !== 'granted' && (
            <button
              onClick={onRequestNotificationPermission}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 active:scale-95 transition-all"
              title="Bildirişləri aktivləşdir"
            >
              <Bell className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={onOpenManualAdd}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#131929] text-slate-300 border border-white/10 hover:text-white hover:border-white/20 active:scale-95 transition-all"
            title="Əlavə et"
          >
            <Plus className="h-4 w-4" />
          </button>

          {onNavigateToProfile && (
            <button
              onClick={onNavigateToProfile}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white font-bold text-xs border border-violet-400/30 active:scale-95 transition-all shadow-sm"
              title="Profil"
            >
              {initials}
            </button>
          )}
        </div>
      </div>

      {/* 2. Primary AI Action: "Günümü planla" */}
      <div
        onClick={() => onOpenPlanner?.()}
        className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-violet-950/40 via-[#131929] to-indigo-950/30 border border-violet-500/25 hover:border-violet-500/40 cursor-pointer active:scale-[0.99] transition-all group shadow-sm"
      >
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0 group-hover:scale-105 transition-transform">
            <Sparkles className="h-4 w-4 text-violet-100" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-white tracking-tight">Günümü planla</h3>
            <p className="text-xs text-slate-400 truncate mt-0.5">
              İşlərini de, optimal cədvəlini quraq.
            </p>
          </div>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-violet-600 group-hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1 transition-all shrink-0 shadow-sm">
          <span>Başla</span>
          <span className="text-xs">→</span>
        </div>
      </div>

      {/* 3. Focus Mode — Secondary Action */}
      {activeFocusSession ? (
        <div
          onClick={() => onOpenFocus?.()}
          className="flex items-center justify-between p-3.5 rounded-2xl bg-[#121828] border border-violet-500/30 cursor-pointer active:scale-[0.99] transition-all group"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 shrink-0">
              <Flame className="h-4 w-4 text-violet-300 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300">
                  Fokus Aktivdir
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </div>
              <p className="text-xs font-medium text-white truncate mt-0.5">
                {activeFocusSession.taskTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-violet-400 group-hover:text-violet-300 pl-2">
            <span>Davam et</span>
            <span>→</span>
          </div>
        </div>
      ) : (
        <div
          onClick={() => onOpenFocus?.()}
          className="flex items-center justify-between p-3.5 rounded-2xl bg-[#101625] border border-white/[0.06] hover:border-white/10 cursor-pointer active:scale-[0.99] transition-all group"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center shrink-0">
              <Flame className="h-4 w-4 text-violet-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-bold text-slate-200 tracking-tight">Fokuslan</h3>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                Bir iş seç və diqqətini yalnız ona ver.
              </p>
            </div>
          </div>
          <div className="text-xs font-semibold text-slate-400 group-hover:text-violet-300 flex items-center gap-1 transition-colors pl-2">
            <span>Başla</span>
            <span>→</span>
          </div>
        </div>
      )}

      {/* 4. Smart "İNDİ" Section — Visibly Smaller & Calmer (positioned after Fokuslan and before Rutinlərim) */}
      {nearDueReminders.length > 0 && (
        <section className="space-y-1.5">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-rose-300/90">
                İndi
              </h2>
            </div>
            <span className="text-[9px] font-medium text-rose-400/90 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-full">
              {nearDueReminders.length === 1 ? '1 yaxın vaxtda' : `${nearDueReminders.length} yaxın vaxtda`}
            </span>
          </div>

          <div className="space-y-1.5">
            {nearDueReminders.map((r) => (
              <MobileReminderCard
                key={r.id}
                reminder={r}
                variant="now"
                onToggleComplete={onToggleComplete}
                onDelete={onDelete}
                onEdit={onEdit}
                onSnooze={onSnooze}
                onFocus={onOpenFocus}
              />
            ))}
          </div>
        </section>
      )}

      {/* 5. Routines — Equal Height & Component Structure Cards */}
      <RoutineHomeSection
        onOpenRoutineSession={(routine) => onOpenRoutineSession?.(routine)}
        onOpenCreateRoutine={(initialType) => onOpenCreateRoutine?.(initialType)}
      />

      {/* 6. Weekly Progress — Compact Row */}
      <div
        onClick={() => onOpenProgress?.()}
        className="flex items-center justify-between py-2 px-1 text-xs cursor-pointer group hover:text-white transition-colors"
      >
        <div className="flex items-center gap-2 text-slate-300">
          <span className="font-semibold text-slate-400">Bu həftə</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-200">
            {completedThisWeek > 0
              ? `${completedThisWeek} tapşırıq tamamlandı`
              : 'Hələ tamamlanan tapşırıq yoxdur'}
          </span>
          {streakCount > 0 && (
            <>
              <span className="text-slate-600">•</span>
              <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                <Flame className="h-3 w-3 fill-amber-400/20 text-amber-400" />
                <span>{streakCount} gün ardıcıl</span>
              </span>
            </>
          )}
        </div>
        <div className="inline-flex items-center gap-1 text-violet-400 font-semibold text-[11px] group-hover:text-violet-300 transition-colors shrink-0">
          <span>Ətraflı bax</span>
          <span>→</span>
        </div>
      </div>

      {/* 7. Active / Completed Reminders */}
      <div className="space-y-4 pt-1">
        {/* Cleaner, thinner segmented control */}
        <div className="flex bg-[#0D121F] p-0.5 rounded-xl border border-white/[0.06]">
          <button
            onClick={() => setFilterMode('active')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              filterMode === 'active'
                ? 'bg-[#151C2C] text-white shadow-sm border border-white/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Aktiv ({totalActiveCount})
          </button>
          <button
            onClick={() => setFilterMode('completed')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              filterMode === 'completed'
                ? 'bg-[#151C2C] text-white shadow-sm border border-white/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Bitmiş ({completedReminders.length})
          </button>
        </div>

        {/* ACTIVE REMINDERS LIST */}
        {filterMode === 'active' && (
          <div className="space-y-5">
            {/* OVERDUE REMINDERS */}
            {overdueReminders.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 px-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                    Gecikmiş ({overdueReminders.length})
                  </h2>
                </div>

                <div className="space-y-2">
                  {overdueReminders.map((r) => (
                    <MobileReminderCard
                      key={r.id}
                      reminder={r}
                      variant="overdue"
                      onToggleComplete={onToggleComplete}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onSnooze={onSnooze}
                      onFocus={onOpenFocus}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* REMAINING "İNDİ" REMINDERS (Only if not already shown in top near-due section) */}
            {otherTodayNowReminders.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 px-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-violet-300">
                    İndi ({otherTodayNowReminders.length})
                  </h2>
                </div>

                <div className="space-y-2">
                  {otherTodayNowReminders.map((r) => (
                    <MobileReminderCard
                      key={r.id}
                      reminder={r}
                      variant="now"
                      onToggleComplete={onToggleComplete}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onSnooze={onSnooze}
                      onFocus={onOpenFocus}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* LATER REMINDERS */}
            {laterReminders.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 px-0.5">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Sonra ({laterReminders.length})
                  </h2>
                </div>

                <div className="space-y-2">
                  {laterReminders.map((r) => (
                    <MobileReminderCard
                      key={r.id}
                      reminder={r}
                      variant="later"
                      onToggleComplete={onToggleComplete}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onSnooze={onSnooze}
                      onFocus={onOpenFocus}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {totalActiveCount === 0 && (
              <div className="py-12 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 border border-violet-500/20 mx-auto mb-3">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-white">Xatırlatmanız yoxdur</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-[240px] mx-auto">
                  Aşağıdakı mikrofon düyməsinə toxunub yeni xatırlatma əlavə edə bilərsiniz.
                </p>
              </div>
            )}
          </div>
        )}

        {/* COMPLETED TAB */}
        {filterMode === 'completed' && (
          <div className="space-y-2">
            {completedReminders.length > 0 ? (
              completedReminders.map((r) => (
                <MobileReminderCard
                  key={r.id}
                  reminder={r}
                  onToggleComplete={onToggleComplete}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onSnooze={onSnooze}
                  onFocus={onOpenFocus}
                />
              ))
            ) : (
              <div className="py-12 text-center">
                <CheckCircle2 className="h-9 w-9 text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-400">
                  Hələ tamamlanmış xatırlatma yoxdur
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
