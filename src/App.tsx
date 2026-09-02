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
import { reminderService } from './services/reminderService';
import { notificationService } from './services/notificationService';
import { userProfileService } from './services/userProfileService';

export default function App() {
  const [reminders, setReminders] = useState<Reminder[]>(() => reminderService.getAll());
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => userProfileService.getProfile());
  const [currentTab, setCurrentTab] = useState<MobileTab>('home');
  const [isVoiceFullScreenOpen, setIsVoiceFullScreenOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [activeAlarmReminder, setActiveAlarmReminder] = useState<Reminder | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // App startup & onboarding state
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() =>
    notificationService.getPermission()
  );

  // Initialize services and subscriptions
  useEffect(() => {
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

    // Listen for notification tap / action deep links
    const unsubAction = notificationService.onNotificationAction((reminderId, actionId) => {
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
      unsubAction();
    };
  }, []);

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
    <div className="min-h-screen bg-[#060911] text-slate-50 font-sans selection:bg-violet-500/30 selection:text-violet-200 flex justify-center">
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
        <div className="w-full max-w-md min-h-screen bg-[#090D16] flex flex-col relative shadow-2xl safe-top">
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
                onOpenVoice={() => setIsVoiceFullScreenOpen(true)}
                onOpenManualAdd={() => setIsManualModalOpen(true)}
              />
            )}

            {currentTab === 'ai' && (
              <AiAssistantScreen
                reminders={reminders}
                onOpenVoice={() => setIsVoiceFullScreenOpen(true)}
              />
            )}

            {currentTab === 'profile' && (
              <ProfileScreen
                reminders={reminders}
                notificationPermission={notificationPermission}
                onRequestNotificationPermission={handleRequestNotification}
                onImportReminders={handleImportReminders}
                onReplayOnboarding={handleReplayOnboarding}
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
        </div>
      )}
    </div>
  );
}
