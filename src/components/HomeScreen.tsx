import React, { useState } from 'react';
import {
  Bell,
  Plus,
  CheckCircle2,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import { Reminder } from '../types';
import { MobileReminderCard } from './MobileReminderCard';
import {
  getGreetingAz,
  getFormattedTodayAz,
  isReminderToday,
  isReminderPast,
} from '../utils/dateUtils';

interface HomeScreenProps {
  reminders: Reminder[];
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  onSnooze: (id: string, minutes: number) => void;
  onOpenVoice: () => void;
  onOpenManualAdd: () => void;
  notificationPermission: NotificationPermission;
  onRequestNotificationPermission: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  reminders,
  onToggleComplete,
  onDelete,
  onEdit,
  onSnooze,
  onOpenVoice,
  onOpenManualAdd,
  notificationPermission,
  onRequestNotificationPermission,
}) => {
  const [filterMode, setFilterMode] = useState<'active' | 'completed'>('active');

  const greeting = getGreetingAz();
  const todayFormatted = getFormattedTodayAz();

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
    <div className="w-full px-4 pt-2 pb-6 space-y-5">
      {/* Native App Top Header (Lightweight, No web hero cards) */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            {greeting}
          </h1>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">
            {todayFormatted}
          </p>

          {/* Subtle status text */}
          <p className="text-xs font-medium text-violet-300/90 mt-1.5 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            {activeTodayCount > 0
              ? `Bu gün ${activeTodayCount} xatırlatman var`
              : 'Bu gün bütün xatırlatmalar tamamlanıb 🎉'}
          </p>
        </div>

        {/* Quick action buttons (Notification & Manual Add) */}
        <div className="flex items-center gap-2">
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
