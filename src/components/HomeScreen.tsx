import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  Sparkles,
  ArrowRight,
  Flame,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { Reminder, UserProfile, FocusSession, Routine, RoutineType } from '../types';
import { MobileReminderCard } from './MobileReminderCard';
import { RoutineHomeSection } from './routine/RoutineHomeSection';
import {
  staggerContainerVariants,
  staggerCardVariants,
  reminderCardItemVariants,
} from '../utils/motion';
import {
  getGreetingAz,
  getFormattedTodayAz,
  isReminderToday,
  isReminderPast,
} from '../utils/dateUtils';
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
  onOpenCalendar?: () => void;
  onOpenAssistant?: () => void;
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
  onOpenCalendar,
  onOpenAssistant,
  activeFocusSession,
  notificationPermission,
  onRequestNotificationPermission,
}) => {
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [progressData, setProgressData] = useState(() => progressService.getProgressData());

  useEffect(() => {
    const unsub = progressService.subscribe(() => {
      setProgressData(progressService.getProgressData());
    });
    return unsub;
  }, []);

  const greeting = getGreetingAz(userProfile?.firstName);
  const todayFormatted = getFormattedTodayAz();

  // Active reminders
  const activeReminders = reminders.filter((r) => !r.isCompleted);
  // Today's active reminders
  const todayActiveReminders = activeReminders.filter((r) => isReminderToday(r) || isReminderPast(r));
  // Reminders to show in "Bugünkü tapşırıqlar": max 4 unless showAllTasks
  const displayReminders = showAllTasks
    ? todayActiveReminders
    : todayActiveReminders.slice(0, 4);

  const streakCount =
    routineService.getStreakData().currentStreak || progressData.streakSummary.currentStreak;

  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
      className="w-full px-4 pt-2 pb-32 space-y-4 sm:space-y-5"
    >
      {/* 1. HEADER: Zərif salamlama, ad əsas vurğu, yuxarı sağda yalnız bildiriş ikonu */}
      <motion.div
        variants={staggerCardVariants}
        className="flex items-center justify-between gap-3 pt-1"
      >
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F5F6FA] truncate">
            {greeting} 👋
          </h1>
          <p className="text-xs text-[#94A3B8] mt-0.5 font-normal capitalize">
            {todayFormatted}
          </p>
        </div>

        {/* Yuxarı sağda yalnız bildiriş ikonu */}
        <div className="flex items-center shrink-0">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (onRequestNotificationPermission && notificationPermission !== 'granted') {
                onRequestNotificationPermission();
              } else if (onNavigateToProfile) {
                onNavigateToProfile();
              }
            }}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#121827] text-[#94A3B8] hover:text-[#F5F6FA] border border-white/[0.06] hover:border-white/[0.12] transition-colors relative"
            title="Bildirişlər"
            aria-label="Bildirişlər"
          >
            <Bell className="h-4 w-4" />
            {notificationPermission !== 'granted' && (
              <span className="absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full bg-[#A78BFA]" />
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* 2. ƏSAS AI KARTI: Bütün kart kliklənəndir, hündürlüyü azaldılmış, minimalist, sağda ox düyməsi */}
      <motion.div
        variants={staggerCardVariants}
        whileTap={{ scale: 0.99 }}
        onClick={() => {
          if (onOpenAssistant) {
            onOpenAssistant();
          } else {
            onOpenVoice();
          }
        }}
        className="group relative overflow-hidden rounded-[20px] p-4 sm:p-4.5 bg-[#121827] border border-white/[0.06] hover:border-[#7C3AED]/30 transition-all cursor-pointer shadow-sm"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <h2 className="text-sm sm:text-base font-semibold text-[#F5F6FA] tracking-tight">
              Bu gün nə planlaşdırırsan?
            </h2>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Bir cümlə söylə, qalanını mən həll edim.
            </p>
          </div>

          {/* Sağda kiçik, minimalist ox düyməsi */}
          <div className="h-8 w-8 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#94A3B8] group-hover:text-[#F5F6FA] group-hover:bg-[#7C3AED]/20 group-hover:border-[#7C3AED]/30 transition-all shrink-0">
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>
      </motion.div>

      {/* 3. AKTİV FOKUS SESİYASI (varsa zərif göstərilir) */}
      {activeFocusSession && (
        <motion.div
          variants={staggerCardVariants}
          whileTap={{ scale: 0.98 }}
          onClick={() => onOpenFocus?.()}
          className="flex items-center justify-between p-3.5 rounded-[18px] bg-[#121827] border border-[#7C3AED]/25 cursor-pointer shadow-sm"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-xl bg-[#7C3AED]/15 flex items-center justify-center text-[#A78BFA] shrink-0">
              <Flame className="h-4 w-4 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#A78BFA]">
                Fokus Aktivdir
              </span>
              <p className="text-xs font-medium text-[#F5F6FA] truncate mt-0.5">
                {activeFocusSession.taskTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-medium text-[#A78BFA] pl-2">
            <span>Davam et</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </motion.div>
      )}

      {/* 4. BUGÜNKÜ TAPŞIRIQLAR: Başlıq, sayğac və tapşırıq kartları */}
      <motion.section variants={staggerCardVariants} className="space-y-2.5">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
              Bugünkü tapşırıqlar
            </h2>
            <span className="text-[11px] text-[#94A3B8]/70">
              ({todayActiveReminders.length})
            </span>
          </div>

          {todayActiveReminders.length > 4 && (
            <button
              onClick={() => setShowAllTasks((prev) => !prev)}
              className="text-xs font-medium text-[#A78BFA] hover:text-[#C4B5FD] flex items-center gap-0.5 transition-colors"
            >
              <span>{showAllTasks ? 'Qısalt' : 'Hamısına bax'}</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Tapşırıqlar Siyahısı */}
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {displayReminders.map((reminder) => (
              <motion.div
                key={reminder.id}
                variants={reminderCardItemVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                layout
              >
                <MobileReminderCard
                  reminder={reminder}
                  onToggleComplete={onToggleComplete}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onSnooze={onSnooze}
                  onFocus={onOpenFocus}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Boş vəziyyət */}
          {todayActiveReminders.length === 0 && (
            <div className="py-7 px-4 text-center rounded-[18px] bg-[#121827] border border-white/[0.04]">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#7C3AED]/10 text-[#A78BFA] mx-auto mb-2">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-semibold text-[#F5F6FA]">
                Bugünkü bütün işlər tamamlandı
              </h3>
              <p className="text-[11px] text-[#94A3B8] mt-0.5 max-w-[240px] mx-auto">
                Yeni bir iş əlavə etmək üçün mərkəzdəki mikrofona toxunun.
              </p>
            </div>
          )}
        </div>
      </motion.section>

      {/* 5. GÜNLÜK RUTİNLƏR (Yan-yana 2 kompakt kart) */}
      <motion.div variants={staggerCardVariants}>
        <RoutineHomeSection
          onOpenRoutineSession={(routine) => onOpenRoutineSession?.(routine)}
          onOpenCreateRoutine={(initialType) => onOpenCreateRoutine?.(initialType)}
        />
      </motion.div>

      {/* 6. HƏFTƏLİK NƏTİCƏ / STREAK (Sadə, minimalist sətir) */}
      {streakCount > 0 && (
        <motion.div
          variants={staggerCardVariants}
          whileTap={{ scale: 0.99 }}
          onClick={() => onOpenProgress?.()}
          className="flex items-center justify-between p-3 rounded-[16px] bg-[#121827] border border-white/[0.04] text-xs cursor-pointer hover:border-white/[0.08] transition-colors"
        >
          <div className="flex items-center gap-2 text-[#94A3B8]">
            <Flame className="h-4 w-4 text-amber-400 fill-amber-400/20" />
            <span className="text-[#F5F6FA] font-medium">{streakCount} gün ardıcıl</span>
            <span className="text-white/20">·</span>
            <span>Məhsuldarlığını qoru</span>
          </div>
          <span className="text-[11px] font-medium text-[#A78BFA] flex items-center gap-0.5">
            Statistika <ChevronRight className="h-3 w-3" />
          </span>
        </motion.div>
      )}
    </motion.div>
  );
};
