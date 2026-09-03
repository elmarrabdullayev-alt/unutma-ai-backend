import React, { useState } from 'react';
import {
  Bell,
  Plus,
  CheckCircle2,
  CalendarDays,
  Sparkles,
  Flame,
  TrendingUp,
} from 'lucide-react';
import { Reminder, UserProfile, FocusSession, Routine, RoutineType } from '../types';
import { MobileReminderCard } from './MobileReminderCard';
import { RoutineHomeSection } from './routine/RoutineHomeSection';
import { routineService } from '../services/routineService';
import {
  getGreetingAz,
  getFormattedTodayAz,
  isReminderToday,
  isReminderPast,
} from '../utils/dateUtils';
import { userProfileService } from '../services/userProfileService';

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
  notificationPermission: NotificationPermission;
  onRequestNotificationPermission: () => void;
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

  const greeting = getGreetingAz(userProfile?.firstName);
  const todayFormatted = getFormattedTodayAz();
  const initials = userProfileService.getInitials(userProfile);

  // Categorize into native agenda sections
  const overdueReminders = reminders.filter(
    (r) => !r.isCompleted && isReminderPast(r)
  );

  const nowReminders = reminders.filter((r) => {
    if (r.isCompleted) return false;
    if (isReminderPast(r)) return false;
    const dueTime = new Date(r.dueDateTime).getTime();
    const diffHours = (dueTime - Date.now()) / (1000 * 60 * 60);
    return isReminderToday(r) && diffHours <= 4;
  });

  const laterReminders = reminders.filter((r) => {
    if (r.isCompleted) return false;
    if (isReminderPast(r)) return false;
    return !nowReminders.includes(r);
  });

  const completedReminders = reminders.filter((r) => r.isCompleted);
  const activeTodayCount = reminders.filter(
    (r) => !r.isCompleted && isReminderToday(r)
  ).length;

  const totalActiveCount = reminders.filter((r) => !r.isCompleted).length;

  return (
    <div className="w-full px-4 pt-2 pb-6 space-y-4">
      {/* Native App Top Header (Lightweight, No web hero cards) */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black tracking-tight text-white truncate">
            {greeting}
          </h1>
          <p className="text-xs font-semibold text-violet-300/80 mt-0.5">
            Bu gün nəyi yadda saxlayaq?
          </p>
          <p className="text-[11px] font-medium text-slate-400 mt-1 flex items-center gap-1.5">
            <span>{todayFormatted}</span>
            <span>•</span>
            <span className="text-violet-400 font-semibold">
              {activeTodayCount > 0
                ? `${activeTodayCount} aktiv tapşırıq`
                : 'Hamısı tamamlandı 🎉'}
            </span>
          </p>
        </div>

        {/* Quick action buttons (Avatar + Notification + Manual Add) */}
        <div className="flex items-center gap-2 shrink-0">
          {notificationPermission !== 'granted' && (
            <button
              onClick={onRequestNotificationPermission}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 active:scale-90 transition-transform"
              title="Bildirişləri aktivləşdir"
            >
              <Bell className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={onOpenManualAdd}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#141B2E] text-slate-200 border border-white/10 hover:text-white active:scale-90 transition-transform shadow-sm"
            title="Yazılı əlavə et"
          >
            <Plus className="h-5 w-5" />
          </button>

          {onNavigateToProfile && (
            <button
              onClick={onNavigateToProfile}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white font-black text-xs border border-violet-400/30 active:scale-90 transition-transform shadow-md"
              title="Profilə keç"
            >
              {initials}
            </button>
          )}
        </div>
      </div>

      {/* Home Card: "Günümü planla" */}
      <div
        onClick={() => onOpenPlanner?.()}
        className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-violet-950/40 via-[#131A2D] to-indigo-950/40 border border-violet-500/25 hover:border-violet-500/40 shadow-md cursor-pointer active:scale-[0.99] transition-all group"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-md shrink-0 group-hover:scale-105 transition-transform">
            <Sparkles className="h-4 w-4 text-violet-100" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-black text-white tracking-tight">Günümü planla</h3>
            </div>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              İşlərini de, optimal cədvəlini quraq.
            </p>
          </div>
        </div>
        <div className="h-7 px-2.5 rounded-lg bg-violet-500/15 group-hover:bg-violet-600 text-violet-300 group-hover:text-white text-[11px] font-bold flex items-center gap-1 transition-all shrink-0">
          <span>Başla</span>
          <span className="text-sm">›</span>
        </div>
      </div>

      {/* Focus Mode Entry / Active Session Banner */}
      {activeFocusSession ? (
        <div
          onClick={() => onOpenFocus?.()}
          className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-violet-950/60 via-indigo-950/50 to-violet-950/60 border border-violet-500/30 shadow-lg cursor-pointer active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-9 w-9 rounded-xl bg-violet-600 flex items-center justify-center text-white shadow-md shrink-0">
              <Flame className="h-4 w-4 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-violet-300">
                  Fokus Aktivdir
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <p className="text-xs font-bold text-white truncate">
                {activeFocusSession.taskTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-violet-300 pl-2">
            <span>Aç</span>
            <span className="text-sm">›</span>
          </div>
        </div>
      ) : (
        <div
          onClick={() => onOpenFocus?.()}
          className="flex items-center justify-between p-3.5 rounded-2xl bg-[#111726] border border-white/5 hover:border-violet-500/20 shadow-sm cursor-pointer active:scale-[0.99] transition-all group"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-9 w-9 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-violet-400 shrink-0 group-hover:scale-105 transition-transform">
              <Flame className="h-4 w-4 text-violet-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-black text-white tracking-tight">Fokuslan</h3>
              <p className="text-[11px] text-slate-400 truncate">
                Bir iş seç və diqqətini yalnız ona ver.
              </p>
            </div>
          </div>
          <div className="h-7 px-2.5 rounded-lg bg-white/5 group-hover:bg-violet-600/20 text-slate-300 group-hover:text-violet-300 text-[11px] font-bold flex items-center gap-1 transition-colors">
            <span>Başla</span>
            <span>›</span>
          </div>
        </div>
      )}

      {/* Routine Section: Rutinlərim */}
      <RoutineHomeSection
        onOpenRoutineSession={(routine) => onOpenRoutineSession?.(routine)}
        onOpenCreateRoutine={(initialType) => onOpenCreateRoutine?.(initialType)}
      />

      {/* Progress Dashboard Entry Card: İrəliləyişin */}
      <div
        onClick={() => onOpenProgress?.()}
        className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-[#121829] via-[#0F1424] to-[#121626] border border-violet-500/20 hover:border-violet-500/35 shadow-md cursor-pointer active:scale-[0.99] transition-all group"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600/30 to-indigo-600/30 border border-violet-500/30 flex items-center justify-center text-violet-300 shadow-sm shrink-0 group-hover:scale-105 transition-transform">
            <TrendingUp className="h-4 w-4 text-violet-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-black text-white tracking-tight">İrəliləyişin</h3>
              {routineService.getStreakData().currentStreak > 0 && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-500/15 border border-amber-500/25 text-[9px] font-black text-amber-300">
                  <Flame className="h-2.5 w-2.5" />
                  <span>{routineService.getStreakData().currentStreak} gün</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              Bu həftə necə irəlilədiyinə bax.
            </p>
          </div>
        </div>
        <div className="h-7 px-2.5 rounded-lg bg-violet-500/15 group-hover:bg-violet-600 text-violet-300 group-hover:text-white text-[11px] font-bold flex items-center gap-1 transition-all shrink-0">
          <span>Bax</span>
          <span className="text-sm">›</span>
        </div>
      </div>

      {/* iOS-Style Segmented Tab (Aktiv / Bitmiş) */}
      <div className="flex bg-[#101522] p-1 rounded-2xl border border-white/5 shadow-inner">
        <button
          onClick={() => setFilterMode('active')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${
            filterMode === 'active'
              ? 'bg-[#182032] text-white shadow-sm border border-white/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Aktiv ({totalActiveCount})
        </button>
        <button
          onClick={() => setFilterMode('completed')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${
            filterMode === 'completed'
              ? 'bg-[#182032] text-white shadow-sm border border-white/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Bitmiş ({completedReminders.length})
        </button>
      </div>

      {/* ACTIVE AGENDA SECTIONS */}
      {filterMode === 'active' && (
        <div className="space-y-5">
          {/* SECTION 1: GECİKMİŞ */}
          {overdueReminders.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-1">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-rose-400">
                  Gecikmiş
                </h2>
                <span className="text-[10px] font-bold text-rose-400/80">
                  ({overdueReminders.length})
                </span>
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

          {/* SECTION 2: İNDİ (Due now or upcoming in next 4 hours today) */}
          {nowReminders.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-1">
                <span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
                <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-violet-300">
                  İndi
                </h2>
                <span className="text-[10px] font-bold text-violet-400/80">
                  ({nowReminders.length})
                </span>
              </div>

              <div className="space-y-2">
                {nowReminders.map((r) => (
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

          {/* SECTION 3: SONRA */}
          {laterReminders.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-1">
                <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  Sonra
                </h2>
                <span className="text-[10px] font-bold text-slate-500">
                  ({laterReminders.length})
                </span>
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
          {overdueReminders.length === 0 &&
            nowReminders.length === 0 &&
            laterReminders.length === 0 && (
              <div className="py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 border border-violet-500/20 mx-auto mb-3">
                  <Sparkles className="h-6 w-6" />
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
            <div className="py-14 text-center">
              <CheckCircle2 className="h-10 w-10 text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-400">
                Hələ tamamlanmış xatırlatma yoxdur
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
