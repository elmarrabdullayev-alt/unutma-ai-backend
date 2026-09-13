import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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

  const currentStepKey = completedResult ? 'completed' : activeSession ? 'active' : 'setup';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
        className="relative w-full max-w-md h-[100dvh] sm:h-[680px] sm:max-h-[92vh] sm:rounded-3xl bg-[#090D16] border border-white/10 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Render View depending on state: Result -> Active Session -> Setup */}
        <AnimatePresence mode="wait">
          {completedResult ? (
            <motion.div
              key="completion"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className="h-full flex flex-col"
            >
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
            </motion.div>
          ) : activeSession ? (
            <motion.div
              key="active-session"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className="h-full flex flex-col"
            >
              <FocusSessionScreen
                session={activeSession}
                onSessionFinished={handleSessionFinished}
                onStopEarly={handleStopEarly}
              />
            </motion.div>
          ) : (
            <motion.div
              key="setup"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className="h-full flex flex-col"
            >
              <FocusSetupScreen
                reminders={reminders}
                initialReminder={initialReminder}
                todayStats={todayStats}
                onStartSession={handleStartSession}
                onClose={onClose}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};
