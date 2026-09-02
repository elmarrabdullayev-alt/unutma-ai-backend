import React, { useState, useEffect } from 'react';
import { Reminder, FocusSession, FocusHistoryItem, FocusTodayStats } from '../../types';
import { focusService } from '../../services/focusService';
import { focusAudioService } from '../../services/focusAudioService';
import { FocusSetupScreen } from './FocusSetupScreen';
import { FocusSessionScreen } from './FocusSessionScreen';
import { FocusCompletionScreen } from './FocusCompletionScreen';

interface FocusModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminders: Reminder[];
  initialReminder?: Reminder | null;
  onToggleCompleteReminder?: (id: string) => void;
}

export const FocusModal: React.FC<FocusModalProps> = ({
  isOpen,
  onClose,
  reminders,
  initialReminder,
  onToggleCompleteReminder,
}) => {
  const [activeSession, setActiveSession] = useState<FocusSession | null>(() =>
    focusService.getActiveSession()
  );
  const [completedResult, setCompletedResult] = useState<FocusHistoryItem | null>(null);
  const [todayStats, setTodayStats] = useState<FocusTodayStats>(() =>
    focusService.getTodayStats()
  );

  useEffect(() => {
    const unsub = focusService.subscribe((session) => {
      setActiveSession(session);
      setTodayStats(focusService.getTodayStats());
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  // Handler to start a new focus session
  const handleStartSession = async (params: {
    taskTitle: string;
    plannedMinutes: number;
    linkedReminderId?: string;
    audioPreset: string;
  }) => {
    setCompletedResult(null);
    await focusService.startSession(params);
  };

  // Handler when session timer finishes
  const handleSessionFinished = async () => {
    const res = await focusService.completeSession();
    if (res) {
      setCompletedResult(res);
    }
  };

  // Handler when user finishes early
  const handleStopEarly = async () => {
    const res = await focusService.stopSessionEarly();
    if (res) {
      setCompletedResult(res);
    }
  };

  // Handler to extend / restart session with +N mins
  const handleExtendSession = async (minutes: number) => {
    if (completedResult) {
      const title = completedResult.taskTitle;
      const linkedId = completedResult.linkedReminderId;
      const currentAudio = focusAudioService.getSettings().preset;
      setCompletedResult(null);
      await focusService.startSession({
        taskTitle: title,
        plannedMinutes: minutes,
        linkedReminderId: linkedId,
        audioPreset: currentAudio,
      });
    }
  };

  // Find linked reminder object if any
  const linkedReminder = completedResult?.linkedReminderId
    ? reminders.find((r) => r.id === completedResult.linkedReminderId) || null
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md h-[100dvh] sm:h-[680px] sm:max-h-[92vh] sm:rounded-3xl bg-[#090D16] border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        {/* Render View depending on state: Result -> Active Session -> Setup */}
        {completedResult ? (
          <FocusCompletionScreen
            result={completedResult}
            linkedReminder={linkedReminder}
            onCompleteReminder={(id) => {
              if (onToggleCompleteReminder) {
                onToggleCompleteReminder(id);
              }
            }}
            onExtendSession={handleExtendSession}
            onClose={() => {
              setCompletedResult(null);
              onClose();
            }}
          />
        ) : activeSession ? (
          <FocusSessionScreen
            session={activeSession}
            onSessionFinished={handleSessionFinished}
            onStopEarly={handleStopEarly}
          />
        ) : (
          <FocusSetupScreen
            reminders={reminders}
            initialReminder={initialReminder}
            todayStats={todayStats}
            onStartSession={handleStartSession}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
};
