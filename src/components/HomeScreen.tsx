import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { Bell, Flame, ChevronRight, Mic, Sparkles, Check, Clock3 } from 'lucide-react';
import { Reminder, UserProfile, FocusSession, Routine, RoutineType } from '../types';
import { MobileReminderCard } from './MobileReminderCard';
import { RoutineHomeSection } from './routine/RoutineHomeSection';
import {
  staggerContainerVariants,
  staggerCardVariants,
  reminderCardItemVariants,
  springPress,
  springLayout,
} from '../utils/motion';
import { getFormattedTodayAz, isReminderToday, isReminderPast, isReminderTomorrow, formatTimeOnly } from '../utils/dateUtils';
import { progressService } from '../services/progressService';
import { routineService } from '../services/routineService';
import { CATEGORIES } from '../utils/categoryMeta';
import { playSuccessSound } from '../utils/soundUtils';
import { DayBriefingCard } from './home/DayBriefingCard';
import { planForEnergy } from '../services/daySummary';
import { isTiredToday } from '../services/energyMode';
import { notesService } from '../services/notesService';

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
  onOpenCalendar?: () => void;
  onOpenAssistant?: () => void;
  activeFocusSession?: FocusSession | null;
  notificationPermission?: NotificationPermission;
  onRequestNotificationPermission?: () => void;
  onMoveHeavyToTomorrow?: (ids: string[]) => void;
}

function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Sabahın xeyir';
  if (hour >= 12 && hour < 18) return 'Günortan xeyir';
  return 'Axşamın xeyir';
}

/** "1 saat 20 dəqiqə sonra", "12 dəqiqə sonra", "indi" */
function countdownAz(dueMs: number, nowMs: number): string {
  const mins = Math.round((dueMs - nowMs) / 60000);
  if (mins <= 0) return 'indi';
  if (mins < 60) return `${mins} dəqiqə sonra`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) return 'sabah';
  return m === 0 ? `${h} saat sonra` : `${h} saat ${m} dəqiqə sonra`;
}

const byDue = (a: Reminder, b: Reminder) =>
  new Date(a.dueDateTime).getTime() - new Date(b.dueDateTime).getTime();

export const HomeScreen: React.FC<HomeScreenProps> = ({
  reminders,
  userProfile,
  onNavigateToProfile,
  onToggleComplete,
  onDelete,
  onEdit,
  onSnooze,
  onOpenVoice,
  onOpenFocus,
  onOpenProgress,
  onOpenRoutineSession,
  onOpenCreateRoutine,
  onOpenAssistant,
  activeFocusSession,
  notificationPermission,
  onRequestNotificationPermission,
}) => {
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [progressData, setProgressData] = useState(() => progressService.getProgressData());
  const [now, setNow] = useState(() => Date.now());
  const [, setTiredTick] = useState(0);

  useEffect(() => progressService.subscribe(() => setProgressData(progressService.getProgressData())), []);

  // Keep "in 12 minutes" honest without re-rendering every second
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const firstName = userProfile?.firstName?.trim();
  const greeting = greetingFor(new Date(now).getHours());
  const todayFormatted = getFormattedTodayAz();

  const { overdue, upcomingToday, doneToday, next } = useMemo(() => {
    const active = reminders.filter((r) => !r.isCompleted);
    const overdueList = active.filter((r) => isReminderPast(r)).sort(byDue);
    const upcoming = active.filter((r) => isReminderToday(r) && !isReminderPast(r)).sort(byDue);
    const done = reminders.filter((r) => r.isCompleted && r.completedAt && isReminderToday({ ...r, dueDateTime: r.completedAt }));
    // "Next" is the soonest future reminder, even if it's tomorrow
    const future = active.filter((r) => !isReminderPast(r)).sort(byDue);
    return { overdue: overdueList, upcomingToday: upcoming, doneToday: done, next: future[0] };
  }, [reminders, now]);

  // Overdue first, then the rest of today in time order (the hero item is not repeated)
  const timeline = [...overdue, ...upcomingToday].filter((r) => !next || r.id !== next.id);
  // Tired today: light tasks first, heavy ones offered for tomorrow
  const nowDate = new Date(now);
  const tired = isTiredToday(nowDate);
  const energyPlan = tired ? planForEnergy(timeline, nowDate, true) : null;
  const orderedTimeline = energyPlan ? energyPlan.ordered : timeline;
  const visible = showAllTasks ? orderedTimeline : orderedTimeline.slice(0, 5);
  const routineCount = (() => {
    try {
      return routineService.getTodayRoutines(nowDate).length;
    } catch {
      return 0;
    }
  })();
  const streakCount = routineService.getStreakData().currentStreak || progressData.streakSummary.currentStreak;

  const nextCategory = next ? CATEGORIES[next.category as keyof typeof CATEGORIES] || CATEGORIES.other : null;
  const nextDue = next ? new Date(next.dueDateTime).getTime() : 0;
  const nextIsToday = next ? isReminderToday(next) : false;
  const nextSoon = next ? nextDue - now < 30 * 60000 : false;

  const tomorrowReminders = useMemo(
    () =>
      reminders
        .filter((r) => isReminderTomorrow(r) && !r.isCompleted)
        .sort((a, b) => new Date(a.dueDateTime).getTime() - new Date(b.dueDateTime).getTime())
        .slice(0, 3),
    [reminders]
  );
  const recentNotes = notesService.list().slice(0, 3);

  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
      className="w-full px-5 pt-3 pb-36 space-y-7"
    >
      {/* Greeting */}
      <motion.header variants={staggerCardVariants} className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-ink-400 capitalize">{todayFormatted}</p>
          <h1 className="font-display mt-1 text-[34px] leading-[1.05] font-normal text-ink-50">
            {greeting}
            {firstName && (
              <>
                ,<br />
                <span className="text-zer-200">{firstName}</span>
              </>
            )}
          </h1>
        </div>

        <motion.button
          whileTap={{ scale: 0.88 }}
          transition={springPress}
          onClick={() => {
            if (onRequestNotificationPermission && notificationPermission !== 'granted') {
              onRequestNotificationPermission();
            } else {
              onNavigateToProfile?.();
            }
          }}
          className="surface relative mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-200"
          aria-label={notificationPermission !== 'granted' ? 'Bildirişləri aç' : 'Bildiriş ayarları'}
        >
          <Bell className="h-[18px] w-[18px]" />
          {notificationPermission !== 'granted' && (
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-nar-400 ring-2 ring-ink-900" />
          )}
        </motion.button>
      </motion.header>

      <DayBriefingCard
        reminders={reminders}
        now={nowDate}
        routineCount={routineCount}
        tired={tired}
        heavyIds={energyPlan ? energyPlan.moveLater.map((r) => r.id) : []}
        energyMessage={energyPlan ? energyPlan.message : ''}
        onMoveHeavyToTomorrow={(ids) => onMoveHeavyToTomorrow?.(ids)}
        onTiredChange={() => setTiredTick((t) => t + 1)}
      />

      {/* Next up — the one big moment on the screen */}
      <motion.section variants={staggerCardVariants} aria-label="Növbəti xatırlatma">
        {next ? (
          <motion.div
            layout
            transition={springLayout}
            className="relative overflow-hidden rounded-sheet p-5 pb-4"
            style={{
              background:
                'radial-gradient(140% 120% at 100% 0%, rgb(226 163 50 / 0.22), transparent 55%), linear-gradient(180deg, var(--color-ink-850), var(--color-ink-900))',
              border: '1px solid rgb(241 200 104 / 0.18)',
              boxShadow: '0 1px 0 0 rgb(255 240 210 / 0.08) inset, 0 24px 48px -24px rgb(0 0 0 / 0.9)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-[13px] font-medium text-zer-200">
                <span className="relative flex h-2 w-2">
                  {nextSoon && <span className="absolute inset-0 rounded-full bg-zer-300 animate-ripple" />}
                  <span className="relative h-2 w-2 rounded-full bg-zer-300" />
                </span>
                <span className="sr-only">Növbəti: </span>
                {countdownAz(nextDue, now)}
              </span>
              {nextCategory && <span className={`text-[13px] ${nextCategory.color}`}>{nextCategory.label}</span>}
            </div>

            <button type="button" onClick={() => onEdit(next)} className="mt-3 block w-full text-left">
              <div className="flex items-baseline gap-3">
                <span className="font-display tabular text-[56px] leading-none font-light text-ink-50">
                  {formatTimeOnly(next.dueDateTime)}
                </span>
                {!nextIsToday && <span className="text-[15px] text-ink-300">sabah</span>}
              </div>
              <h2 className="mt-2 text-[19px] font-semibold leading-snug text-ink-50 line-clamp-2">{next.title}</h2>
              {next.description && <p className="mt-1 text-[14px] text-ink-300 line-clamp-1">{next.description}</p>}
            </button>

            <div className="mt-4 flex gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                transition={springPress}
                onClick={() => {
                  playSuccessSound();
                  onToggleComplete(next.id);
                }}
                className="btn-gold flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-semibold"
              >
                <Check className="h-[18px] w-[18px]" strokeWidth={2.6} />
                Tamamla
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                transition={springPress}
                onClick={() => onSnooze(next.id, 15)}
                className="flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-[15px] font-medium text-ink-100 active:bg-white/[0.08] transition-colors"
              >
                <Clock3 className="h-[18px] w-[18px] text-ink-300" />
                15 dəq
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.98 }}
            transition={springPress}
            onClick={onOpenVoice}
            className="surface flex w-full items-center gap-4 rounded-sheet p-5 text-left"
          >
            <span className="btn-gold flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
              <Mic className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <span className="min-w-0">
              <span className="font-display block text-[22px] leading-tight text-ink-50">Nəyi yadında saxlayım?</span>
              <span className="mt-1 block text-[14px] text-ink-300">Məsələn: "sabah saat 10-da Anara zəng et"</span>
            </span>
          </motion.button>
        )}
      </motion.section>

      {/* Active focus session */}
      {activeFocusSession && (
        <motion.button
          variants={staggerCardVariants}
          whileTap={{ scale: 0.98 }}
          onClick={() => onOpenFocus?.()}
          className="surface flex w-full items-center gap-3 rounded-card p-4 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zer-400/15 text-zer-300">
            <Flame className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium text-zer-300">Fokus davam edir</span>
            <span className="block truncate text-[15px] font-semibold text-ink-50">{activeFocusSession.taskTitle}</span>
          </span>
          <ChevronRight className="h-5 w-5 text-ink-400" />
        </motion.button>
      )}

      {/* Today, as a timeline */}
      <motion.section variants={staggerCardVariants} aria-labelledby="today-heading">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="today-heading" className="text-[17px] font-semibold text-ink-50">
            {next && nextIsToday ? 'Daha sonra' : 'Bu gün'}
            <span className="ml-2 text-[15px] font-normal text-ink-400 tabular">{timeline.length}</span>
          </h2>
          {doneToday.length > 0 && (
            <span className="text-[13px] text-pista-300 tabular">{doneToday.length} tamamlandı</span>
          )}
        </div>

        {timeline.length > 0 ? (
          <LayoutGroup>
            <ol className="relative space-y-2">
              <AnimatePresence initial={false}>
                {visible.map((reminder) => (
                  <motion.li
                    key={reminder.id}
                    variants={reminderCardItemVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    layout
                    transition={springLayout}
                    className="relative"
                  >
                    <MobileReminderCard
                      reminder={reminder}
                      variant="default"
                      onToggleComplete={onToggleComplete}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onSnooze={onSnooze}
                      onFocus={onOpenFocus}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          </LayoutGroup>
        ) : next ? (
          <p className="text-[14px] text-ink-400">Bu gün üçün başqa xatırlatma yoxdur.</p>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={springLayout}
            className="surface-quiet flex flex-col items-center rounded-card px-6 py-8 text-center"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pista-400/15 text-pista-300">
              <Sparkles className="h-5 w-5" />
            </span>
            <h3 className="font-display mt-3 text-[20px] text-ink-50">Bu gün üçün hər şey hazırdır</h3>
            <p className="mt-1 max-w-[260px] text-[14px] leading-relaxed text-ink-300">
              Yeni xatırlatma üçün aşağıdakı mikrofona toxunun və danışın.
            </p>
          </motion.div>
        )}

        {timeline.length > 5 && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            transition={springPress}
            onClick={() => setShowAllTasks((p) => !p)}
            className="mt-3 flex h-11 w-full items-center justify-center rounded-full border border-white/[0.08] text-[14px] font-medium text-ink-200 active:bg-white/[0.05] transition-colors"
          >
            {showAllTasks ? 'Daha az göstər' : `Daha ${timeline.length - 5} xatırlatma`}
          </motion.button>
        )}
      </motion.section>

      {/* Ask the assistant */}
      <motion.button
        variants={staggerCardVariants}
        whileTap={{ scale: 0.98 }}
        transition={springPress}
        onClick={() => (onOpenAssistant ? onOpenAssistant() : onOpenVoice())}
        className="surface-quiet group flex w-full items-center gap-4 rounded-card p-4 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lilac-400/15 text-lilac-300">
          <Sparkles className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink-50">Günümü planla</span>
          <span className="block text-[13px] text-ink-300">Bir cümlə de, saatları mən yerləşdirim</span>
        </span>
        <ChevronRight className="h-5 w-5 text-ink-400 transition-transform group-active:translate-x-0.5" />
      </motion.button>

      {/* Routines */}
      <motion.div variants={staggerCardVariants}>
        <RoutineHomeSection
          onOpenRoutineSession={(routine) => onOpenRoutineSession?.(routine)}
          onOpenCreateRoutine={(initialType) => onOpenCreateRoutine?.(initialType)}
        />
      </motion.div>

      {/* Tomorrow + notes: always visible, so the lower part of the screen is never empty */}
      <motion.section variants={staggerCardVariants} aria-labelledby="tomorrow-heading" className="space-y-3">
        <h2 id="tomorrow-heading" className="text-[13px] font-medium uppercase tracking-wide text-ink-400">Sabah</h2>
        <div className="surface-quiet rounded-card p-4">
          {tomorrowReminders.length === 0 ? (
            <p className="text-[14px] text-ink-300">Sabah üçün xatırlatma yoxdur.</p>
          ) : (
            <ul className="space-y-3">
              {tomorrowReminders.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[15px] text-ink-50">{r.title}</span>
                  <span className="shrink-0 text-[13px] text-ink-300">{formatTimeOnly(r.dueDateTime)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <h2 className="pt-2 text-[13px] font-medium uppercase tracking-wide text-ink-400">Qeydlər</h2>
        <div className="surface-quiet rounded-card p-4">
          {recentNotes.length === 0 ? (
            <p className="text-[14px] text-ink-300">
              Xatırlatma olmayan qeydlər üçün səsli köməkçidə "qeyd et: …" deyin.
            </p>
          ) : (
            <ul className="space-y-3">
              {recentNotes.map((n) => (
                <li key={n.id} className="text-[15px] leading-snug text-ink-50">{n.text}</li>
              ))}
            </ul>
          )}
        </div>
      </motion.section>

      {/* Streak */}
      {streakCount > 0 && (
        <motion.button
          variants={staggerCardVariants}
          whileTap={{ scale: 0.98 }}
          onClick={() => onOpenProgress?.()}
          className="surface-quiet flex w-full items-center justify-between rounded-card p-4 text-left"
        >
          <span className="flex items-center gap-3">
            <Flame className="h-5 w-5 text-zer-300" />
            <span className="text-[15px] font-medium text-ink-50">{streakCount} gün ardıcıl</span>
          </span>
          <span className="flex items-center gap-1 text-[13px] text-ink-300">
            İrəliləyiş <ChevronRight className="h-4 w-4" />
          </span>
        </motion.button>
      )}
    </motion.div>
  );
};
