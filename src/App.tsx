import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { screenVariants } from './utils/motion';
import { Reminder, UserProfile } from './types';
import { HomeScreen } from './components/HomeScreen';
import { CalendarScreen } from './components/CalendarScreen';
import { AiAssistantScreen } from './components/AiAssistantScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { MobileBottomNav, MobileTab } from './components/MobileBottomNav';
import { VoiceAssistantFullScreen } from './components/VoiceAssistantFullScreen';
import { EditReminderModal } from './components/EditReminderModal';
import { ManualAddModal } from './components/ManualAddModal';
import { ActiveAlarmBanner } from './components/ActiveAlarmBanner';
import { AnimatedSplash } from './components/AnimatedSplash';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { FocusModal } from './components/focus/FocusModal';
import { DailyPlanModal } from './components/planner/DailyPlanModal';
import { RoutineSessionModal } from './components/routine/RoutineSessionModal';
import { RoutineReviewModal } from './components/routine/RoutineReviewModal';
import { RoutineEditorModal } from './components/routine/RoutineEditorModal';
import { ProgressDashboard } from './components/progress/ProgressDashboard';
import { reminderService } from './services/reminderService';
import { notificationService } from './services/notificationService';
import { userProfileService } from './services/userProfileService';
import { focusService } from './services/focusService';
import { routineService } from './services/routineService';
import { progressService } from './services/progressService';
import { FocusSession, DailyPlanProposal, Routine, RoutineProposal, RoutineType } from './types';

export default function App() {
  const [reminders, setReminders] = useState<Reminder[]>(() => reminderService.getAll());
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => userProfileService.getProfile());
  const [currentTab, setCurrentTab] = useState<MobileTab>('home');
  const [isVoiceFullScreenOpen, setIsVoiceFullScreenOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);
  const [isDailyPlanModalOpen, setIsDailyPlanModalOpen] = useState(false);
  const [dailyPlanInitialProposal, setDailyPlanInitialProposal] = useState<DailyPlanProposal | null>(null);

  // Routine Builder states
  const [activeRoutineSession, setActiveRoutineSession] = useState<Routine | null>(null);
  const [routineProposalForReview, setRoutineProposalForReview] = useState<RoutineProposal | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [editorInitialProposal, setEditorInitialProposal] = useState<RoutineProposal | null>(null);
  const [editorInitialType, setEditorInitialType] = useState<RoutineType | undefined>(undefined);
  const [isRoutineEditorOpen, setIsRoutineEditorOpen] = useState(false);
  const [isProgressDashboardOpen, setIsProgressDashboardOpen] = useState(false);

  const [focusInitialReminder, setFocusInitialReminder] = useState<Reminder | null>(null);
  const [activeFocusSession, setActiveFocusSession] = useState<FocusSession | null>(() =>
    focusService.getActiveSession()
  );
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [activeAlarmReminder, setActiveAlarmReminder] = useState<Reminder | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // App startup & onboarding state
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Initialize services and subscriptions
  useEffect(() => {
    notificationService.getPermission().then((perm) => {
      setNotificationPermission(perm);
    });

    // Initialize profile service (loads from Capacitor Preferences / localStorage)
    userProfileService.init().then((profile) => {
      setUserProfile(profile);
    });

    const unsubProfile = userProfileService.subscribe((updated) => {
      setUserProfile(updated);
    });

    const unsubscribe = reminderService.subscribe((updatedReminders) => {
      setReminders(updatedReminders);
    });

    // Listen for live alarm triggers
    const unsubAlarm = notificationService.onAlarmTrigger((alarmReminder) => {
      setActiveAlarmReminder(alarmReminder);
    });

    // Initialize focusService
    focusService.init().then(() => {
      setActiveFocusSession(focusService.getActiveSession());
    });

    const unsubFocus = focusService.subscribe((session) => {
      setActiveFocusSession(session);
    });

    // Initialize routineService and progressService
    routineService.init();
    progressService.init();

    // Listen for notification tap / action deep links
    const unsubAction = notificationService.onNotificationAction(async (reminderId, actionId) => {
      // Check if notification belongs to a routine step.
      // Format is routine-{routineId}-{stepId}, and routine IDs themselves contain
      // hyphens (e.g. "routine-1712-abc"), so match by prefix instead of split('-').
      if (reminderId.startsWith('routine-')) {
        const all = routineService.getAll();
        const matched =
          all.find((r) => reminderId.startsWith(`routine-${r.id}-`)) || all[0];
        if (matched) {
          setCurrentTab('home');
          setActiveRoutineSession(matched);
          setActiveAlarmReminder(null);
        }
        return;
      }

      // When the app is opened by tapping a notification button, reminders may
      // still be loading from storage; wait so the action isn't silently lost.
      await reminderService.waitUntilLoaded();

      if (actionId === 'complete') {
        // Explicit complete: a toggle would UN-complete an already completed reminder.
        reminderService.completeReminder(reminderId);
        setActiveAlarmReminder(null);
        setToastMessage('Xatırlatma tamamlandı!');
        setTimeout(() => setToastMessage(null), 2500);
      } else if (actionId === 'snooze_15') {
        reminderService.snooze(reminderId, 15);
        setActiveAlarmReminder(null);
        setToastMessage('Xatırlatma 15 dəqiqə təxirə salındı.');
        setTimeout(() => setToastMessage(null), 2500);
      } else {
        // Default tap deep link: focus/open reminder
        const targetReminder = reminderService.getById(reminderId);
        if (targetReminder) {
          setCurrentTab('home');
          setEditingReminder(targetReminder);
          setActiveAlarmReminder(null);
        }
      }
    });

    return () => {
      unsubProfile();
      unsubscribe();
      unsubAlarm();
      unsubFocus();
      unsubAction();
    };
  }, []);

  const handleOpenFocus = (reminder?: Reminder) => {
    setFocusInitialReminder(reminder || null);
    setIsFocusModalOpen(true);
  };

  const handleSplashComplete = () => {
    setShowSplash(false);
    const hasCompleted = userProfileService.hasCompletedOnboarding();
    if (!hasCompleted) {
      setShowOnboarding(true);
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setUserProfile(userProfileService.getProfile());
    setToastMessage('Xoş gəldin! Unutma AI istifadəyə hazırdır.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleReplayOnboarding = () => {
    setShowOnboarding(true);
  };

  const handleRequestNotification = async () => {
    const granted = await notificationService.requestPermission();
    setNotificationPermission(granted);
    if (granted === 'granted') {
      setToastMessage('Bildirişlər uğurla aktivləşdirildi!');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleRemindersCreated = (newReminders: Reminder[], summary: string) => {
    const currentAll = reminderService.getAll();
    const currentIds = new Set(currentAll.map((r) => r.id));
    const missing = newReminders.filter((r) => !currentIds.has(r.id));
    if (missing.length > 0) {
      reminderService.createMultipleReminders(
        missing.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description || '',
          dueDateTime: r.dueDateTime,
          category: r.category,
          priority: r.priority,
          recurrence: r.recurrence,
          sourceVoiceText: r.sourceVoiceText,
        }))
      );
    }
    const all = reminderService.getAll();
    setReminders(all);
    console.log(`[VOICE-FLOW] UI refresh: ${newReminders.length} new reminders created, total=${all.length}`);
    setToastMessage(summary || `${newReminders.length} yeni xatırlatma yaradıldı!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleToggleComplete = (id: string) => {
    const updated = reminderService.toggleComplete(id);
    if (updated) {
      setToastMessage(
        updated.isCompleted
          ? 'Xatırlatma tamamlandı və "Bitmiş" bölməsinə keçirildi.'
          : 'Xatırlatma yenidən aktiv edildi.'
      );
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  const handleDeleteReminder = (id: string) => {
    reminderService.deleteReminder(id);
    if (activeAlarmReminder?.id === id) {
      setActiveAlarmReminder(null);
    }
  };

  const handleEditSave = (updated: Reminder) => {
    reminderService.updateReminder(updated.id, updated);
    setEditingReminder(null);
    setToastMessage('Xatırlatma yeniləndi.');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSnooze = (id: string, minutes: number) => {
    reminderService.snooze(id, minutes);
    if (activeAlarmReminder?.id === id) {
      setActiveAlarmReminder(null);
    }
    setToastMessage(
      `Xatırlatma ${minutes >= 60 ? `${minutes / 60} saat` : `${minutes} dəqiqə`} təxirə salındı.`
    );
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleImportReminders = (importedList: Reminder[]) => {
    reminderService.importReminders(importedList);
    setToastMessage('Məlumatlar uğurla idxal edildi!');
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <MotionConfig reducedMotion="user">
    <div className="app-backdrop min-h-[100dvh] w-full text-ink-50 font-sans selection:bg-zer-500/30 selection:text-zer-100 flex justify-center overflow-x-hidden">
      {/* 1. Animated Startup Splash */}
      {showSplash && <AnimatedSplash onComplete={handleSplashComplete} />}

      {/* 2. Onboarding Experience (for first-launch or replay) */}
      {!showSplash && showOnboarding && (
        <OnboardingFlow
          initialProfile={userProfile}
          onComplete={handleOnboardingComplete}
        />
      )}

      {/* 3. Main Application Canvas */}
      {!showSplash && !showOnboarding && (
        <div className="w-full max-w-md min-h-[100dvh] flex flex-col relative safe-top">
          {/* Active Alarm Banner */}
          <ActiveAlarmBanner
            activeAlarmReminder={activeAlarmReminder}
            onDismiss={() => setActiveAlarmReminder(null)}
            onComplete={(id) => {
              handleToggleComplete(id);
              setActiveAlarmReminder(null);
            }}
            onSnooze={(id, min) => handleSnooze(id, min)}
          />

          {/* Floating Toast Notification */}
          {toastMessage && (
            <div
              className="fixed left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm animate-fade-in pointer-events-none"
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
            >
              <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-full border border-white/10 bg-ink-850/95 pl-4 pr-1.5 py-1 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl text-[14px] pointer-events-auto">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pista-400/20 text-pista-300"><Sparkles className="h-3.5 w-3.5" /></span>
                <span className="flex-1 font-medium text-ink-50 py-1">{toastMessage}</span>
                <button
                  id="toast-dismiss-btn"
                  onClick={() => setToastMessage(null)}
                  aria-label="Bağla"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-ink-400 hover:text-white active:scale-95 transition-all"
                >
                  <span className="text-sm font-bold leading-none">✕</span>
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Native Mobile Screens with Fluid Transitions */}
          <main className="flex-1 pb-36 pt-2 overflow-y-auto">
            <AnimatePresence mode="wait" initial={false}>
              {currentTab === 'home' && (
                <motion.div
                  key="tab-home"
                  variants={screenVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full"
                >
                  <HomeScreen
                    reminders={reminders}
                    userProfile={userProfile}
                    onNavigateToProfile={() => setCurrentTab('profile')}
                    onToggleComplete={handleToggleComplete}
                    onDelete={handleDeleteReminder}
                    onEdit={(r) => setEditingReminder(r)}
                    onSnooze={handleSnooze}
                    onOpenVoice={() => setIsVoiceFullScreenOpen(true)}
                    onOpenManualAdd={() => setIsManualModalOpen(true)}
                    onOpenFocus={handleOpenFocus}
                    onOpenPlanner={() => {
                      setDailyPlanInitialProposal(null);
                      setIsDailyPlanModalOpen(true);
                    }}
                    onOpenProgress={() => setIsProgressDashboardOpen(true)}
                    onOpenRoutineSession={(routine) => setActiveRoutineSession(routine)}
                    onOpenCreateRoutine={(initialType) => {
                      setEditingRoutine(null);
                      setEditorInitialProposal(null);
                      setEditorInitialType(initialType);
                      setIsRoutineEditorOpen(true);
                    }}
                    onOpenCalendar={() => setCurrentTab('calendar')}
                    onOpenAssistant={() => setCurrentTab('ai')}
                    activeFocusSession={activeFocusSession}
                    notificationPermission={notificationPermission}
                    onRequestNotificationPermission={handleRequestNotification}
                  />
                </motion.div>
              )}

              {currentTab === 'calendar' && (
                <motion.div
                  key="tab-calendar"
                  variants={screenVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full"
                >
                  <CalendarScreen
                    reminders={reminders}
                    onToggleComplete={handleToggleComplete}
                    onDelete={handleDeleteReminder}
                    onEdit={(r) => setEditingReminder(r)}
                    onSnooze={handleSnooze}
                    onFocus={handleOpenFocus}
                    onOpenVoice={() => setIsVoiceFullScreenOpen(true)}
                    onOpenManualAdd={() => setIsManualModalOpen(true)}
                  />
                </motion.div>
              )}

              {currentTab === 'ai' && (
                <motion.div
                  key="tab-ai"
                  variants={screenVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full"
                >
                  <AiAssistantScreen
                    reminders={reminders}
                    onOpenVoice={() => setIsVoiceFullScreenOpen(true)}
                    onOpenDailyPlanner={(proposal) => {
                      setDailyPlanInitialProposal(proposal || null);
                      setIsDailyPlanModalOpen(true);
                    }}
                    onOpenRoutineReview={(proposal) => {
                      setRoutineProposalForReview(proposal);
                    }}
                    onRemindersCreated={(newReminders) => {
                      setToastMessage(`${newReminders.length} xatırlatma əlavə edildi.`);
                    }}
                  />
                </motion.div>
              )}

              {currentTab === 'profile' && (
                <motion.div
                  key="tab-profile"
                  variants={screenVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full"
                >
                  <ProfileScreen
                    reminders={reminders}
                    notificationPermission={notificationPermission}
                    onRequestNotificationPermission={handleRequestNotification}
                    onImportReminders={handleImportReminders}
                    onReplayOnboarding={handleReplayOnboarding}
                    onOpenProgress={() => setIsProgressDashboardOpen(true)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* 4-Destination Native Fixed Bottom Nav with Glowing AI Mic */}
          <MobileBottomNav
            currentTab={currentTab}
            onTabChange={(tab) => setCurrentTab(tab)}
            onMicClick={() => setIsVoiceFullScreenOpen(true)}
          />

          {/* Full-Screen Immersive Voice Assistant */}
          <VoiceAssistantFullScreen
            isOpen={isVoiceFullScreenOpen}
            onClose={() => setIsVoiceFullScreenOpen(false)}
            onRemindersCreated={handleRemindersCreated}
            onOpenDailyPlanner={(proposal) => {
              setIsVoiceFullScreenOpen(false);
              setDailyPlanInitialProposal(proposal);
              setIsDailyPlanModalOpen(true);
            }}
            onOpenRoutineReview={(proposal) => {
              setIsVoiceFullScreenOpen(false);
              setRoutineProposalForReview(proposal);
            }}
          />

          {/* Edit Reminder Modal */}
          <EditReminderModal
            isOpen={!!editingReminder}
            reminder={editingReminder}
            onClose={() => setEditingReminder(null)}
            onSave={handleEditSave}
          />

          {/* Manual Add Modal */}
          <ManualAddModal
            isOpen={isManualModalOpen}
            onClose={() => setIsManualModalOpen(false)}
            onRemindersCreated={handleRemindersCreated}
          />

          {/* Daily Planner Modal */}
          <DailyPlanModal
            isOpen={isDailyPlanModalOpen}
            onClose={() => {
              setIsDailyPlanModalOpen(false);
              setDailyPlanInitialProposal(null);
            }}
            initialProposal={dailyPlanInitialProposal}
            existingReminders={reminders}
            onPlanConfirmed={(created) => {
              setToastMessage(`Plan təsdiqləndi! ${created.length} xatırlatma əlavə edildi.`);
            }}
            onOpenFocus={(taskTitle) => {
              const matched = reminderService.getAll().find((r) => r.title === taskTitle);
              handleOpenFocus(matched || undefined);
            }}
          />

          {/* Focus Mode Modal */}
          <FocusModal
            isOpen={isFocusModalOpen}
            onClose={() => {
              setIsFocusModalOpen(false);
              setFocusInitialReminder(null);
            }}
            reminders={reminders}
            initialReminder={focusInitialReminder}
            onToggleCompleteReminder={handleToggleComplete}
          />

          {/* Routine Session Checklist Modal */}
          <RoutineSessionModal
            isOpen={!!activeRoutineSession}
            routine={activeRoutineSession}
            onClose={() => setActiveRoutineSession(null)}
            onEditRoutine={(r) => {
              setActiveRoutineSession(null);
              setEditingRoutine(r);
              setEditorInitialProposal(null);
              setIsRoutineEditorOpen(true);
            }}
          />

          {/* Routine Review Proposal Modal */}
          <RoutineReviewModal
            isOpen={!!routineProposalForReview}
            proposal={routineProposalForReview}
            onClose={() => setRoutineProposalForReview(null)}
            onConfirm={(savedRoutine) => {
              setRoutineProposalForReview(null);
              setToastMessage(`"${savedRoutine.title}" rutini yaradıldı!`);
              setTimeout(() => setToastMessage(null), 3000);
            }}
            onEdit={(prop) => {
              setRoutineProposalForReview(null);
              setEditingRoutine(null);
              setEditorInitialProposal(prop);
              setIsRoutineEditorOpen(true);
            }}
          />

          {/* Routine Editor Modal (Manual / Edit) */}
          <RoutineEditorModal
            isOpen={isRoutineEditorOpen}
            editingRoutine={editingRoutine}
            initialProposal={editorInitialProposal}
            initialType={editorInitialType}
            onClose={() => {
              setIsRoutineEditorOpen(false);
              setEditingRoutine(null);
              setEditorInitialProposal(null);
            }}
            onSave={(saved) => {
              setIsRoutineEditorOpen(false);
              setEditingRoutine(null);
              setEditorInitialProposal(null);
              setToastMessage(`"${saved.title}" rutini yadda saxlanıldı!`);
              setTimeout(() => setToastMessage(null), 3000);
            }}
            onDelete={(id) => {
              routineService.deleteRoutine(id);
              setIsRoutineEditorOpen(false);
              setEditingRoutine(null);
              setEditorInitialProposal(null);
              setToastMessage('Rutin silindi.');
              setTimeout(() => setToastMessage(null), 3000);
            }}
          />

          {/* Premium Streak + Progress Dashboard */}
          <ProgressDashboard
            isOpen={isProgressDashboardOpen}
            onClose={() => setIsProgressDashboardOpen(false)}
            onOpenFocus={() => {
              setIsProgressDashboardOpen(false);
              handleOpenFocus();
            }}
            onOpenRoutines={() => {
              setIsProgressDashboardOpen(false);
              setCurrentTab('home');
            }}
            onOpenManualAdd={() => {
              setIsProgressDashboardOpen(false);
              setIsManualModalOpen(true);
            }}
          />
        </div>
      )}
    </div>
    </MotionConfig>
  );
}
