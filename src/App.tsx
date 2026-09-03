import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
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
    const unsubAction = notificationService.onNotificationAction((reminderId, actionId) => {
      // Check if notification belongs to a routine step (e.g. routine-rt-123-step-1)
      if (reminderId.startsWith('routine-')) {
        const parts = reminderId.split('-');
        // Format is routine-{routineId}-{stepId}
        const routineId = parts.length >= 2 ? parts[1] : '';
        const matched = routineService.getById(routineId) || routineService.getAll()[0];
        if (matched) {
          setCurrentTab('home');
          setActiveRoutineSession(matched);
          setActiveAlarmReminder(null);
        }
        return;
      }

      if (actionId === 'complete') {
        reminderService.toggleComplete(reminderId);
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
    setToastMessage(summary || `${newReminders.length} yeni xatırlatma yaradıldı!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleToggleComplete = (id: string) => {
    reminderService.toggleComplete(id);
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
    <div className="min-h-[100dvh] w-full bg-[#090D16] text-slate-50 font-sans selection:bg-violet-500/30 selection:text-violet-200 flex justify-center overflow-x-hidden">
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
        <div className="w-full max-w-md min-h-[100dvh] bg-[#090D16] flex flex-col relative shadow-2xl safe-top">
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
            <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm animate-fade-in pointer-events-none">
              <div className="flex items-center gap-2.5 rounded-2xl border border-violet-500/40 bg-[#101524]/98 px-4 py-3 shadow-2xl backdrop-blur-xl text-white text-xs pointer-events-auto">
                <Sparkles className="h-4 w-4 shrink-0 text-violet-400" />
                <span className="flex-1 font-semibold text-slate-100">{toastMessage}</span>
                <button
                  onClick={() => setToastMessage(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Native Mobile Screens */}
          <main className="flex-1 pb-28 pt-2 overflow-y-auto">
            {currentTab === 'home' && (
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
                activeFocusSession={activeFocusSession}
                notificationPermission={notificationPermission}
                onRequestNotificationPermission={handleRequestNotification}
              />
            )}

            {currentTab === 'calendar' && (
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
            )}

            {currentTab === 'ai' && (
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
            )}

            {currentTab === 'profile' && (
              <ProfileScreen
                reminders={reminders}
                notificationPermission={notificationPermission}
                onRequestNotificationPermission={handleRequestNotification}
                onImportReminders={handleImportReminders}
                onReplayOnboarding={handleReplayOnboarding}
                onOpenProgress={() => setIsProgressDashboardOpen(true)}
              />
            )}
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
  );
}
