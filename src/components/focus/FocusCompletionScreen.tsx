import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  RotateCcw,
  ArrowRight,
  Flame,
  Check,
} from 'lucide-react';
import { FocusHistoryItem, Reminder } from '../../types';

interface FocusCompletionScreenProps {
  result: FocusHistoryItem;
  linkedReminder?: Reminder | null;
  onCompleteReminder: (reminderId: string) => void;
  onExtendSession: (minutes: number) => void;
  onClose: () => void;
}

export const FocusCompletionScreen: React.FC<FocusCompletionScreenProps> = ({
  result,
  linkedReminder,
  onCompleteReminder,
  onExtendSession,
  onClose,
}) => {
  const [isReminderMarkedDone, setIsReminderMarkedDone] = useState(
    Boolean(linkedReminder?.isCompleted)
  );

  const handleToggleReminder = () => {
    if (result.linkedReminderId) {
      onCompleteReminder(result.linkedReminderId);
      setIsReminderMarkedDone(!isReminderMarkedDone);
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-[#130e13] text-white p-6 justify-between select-none animate-fade-in"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 24px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)',
      }}
    >
      {/* Top Graphic & Title */}
      <div className="flex flex-col items-center text-center mt-6">
        <div className="relative flex items-center justify-center mb-4">
          <div className="h-20 w-20 rounded-3xl bg-gradient-to-tr from-zer-600 to-zer-500 flex items-center justify-center shadow-2xl shadow-zer-600/40 animate-bounce-subtle">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zer-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-zer-500" />
          </span>
        </div>

        <h2 className="font-display text-[26px] leading-[1.15] font-normal text-ink-50">
          {result.interrupted
            ? 'Fokus sessiyası dayandırıldı'
            : 'Fokus sessiyası tamamlandı ✨'}
        </h2>
        <p className="text-xs text-ink-400 mt-1 max-w-[260px]">
          {result.interrupted
            ? 'İşin bir hissəsini tamamladınız. Zəhmətiniz hədər getmədi!'
            : 'Əla nəticə! Diqqətinizi tapşırığa yönəltdiniz və uğurla bitirdiniz.'}
        </p>
      </div>

      {/* Middle: Session Details Card */}
      <div className="space-y-3 my-auto">
        <div className="rounded-2xl bg-[#1d161c] border border-white/10 p-4 space-y-3 shadow-lg">
          {/* Task Title */}
          <div>
            <span className="text-[12px] font-extrabold text-ink-400">
              Tapşırıq
            </span>
            <p className="text-sm font-bold text-white mt-0.5">{result.taskTitle}</p>
          </div>

          <div className="h-px bg-white/5" />

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-2.5 rounded-xl bg-[#251c24] border border-white/5">
              <span className="text-[12px] text-ink-400 block font-semibold">
                Planlaşdırılan
              </span>
              <span className="text-sm font-black text-ink-200">
                {result.plannedMinutes} dəqiqə
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-zer-950/30 border border-zer-500/20">
              <span className="text-[12px] text-zer-300 block font-semibold">
                Faktiki Fokus
              </span>
              <span className="text-sm font-black text-zer-400">
                {result.actualMinutes} dəqiqə
              </span>
            </div>
          </div>
        </div>

        {/* Linked Reminder Complete Action */}
        {result.linkedReminderId && linkedReminder && (
          <div className="p-3.5 rounded-2xl bg-[#1d161c] border border-zer-500/20 flex items-center justify-between shadow-sm">
            <div className="min-w-0 flex-1 pr-2">
              <p className="text-[13px] font-bold text-ink-300 truncate">
                Xatırlatmanı tamamlandı kimi qeyd et
              </p>
              <p className="text-[12px] text-ink-500">
                "{linkedReminder.title}" siyahıda yenilənəcək
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleReminder}
              className={`h-9 px-3 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                isReminderMarkedDone
                  ? 'bg-pista-600 btn-gold text-ink-950 shadow-sm'
                  : ' text-ink-950 hover:brightness-110'
              }`}
            >
              {isReminderMarkedDone ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Tamamlandı
                </>
              ) : (
                'Tamamla'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="space-y-2.5 pt-2">
        <button
          type="button"
          onClick={() => onExtendSession(15)}
          className="w-full h-11 rounded-xl bg-[#251c24] border border-white/10 hover:bg-[#2e242d] text-ink-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
        >
          <RotateCcw className="h-3.5 w-3.5 text-zer-400" />
          Bir az da davam et (+15 dəq)
        </button>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-12 rounded-2xl btn-gold text-ink-950 text-xs font-extrabold shadow-lg shadow-zer-600/30 active:scale-[0.98] hover:brightness-110 transition-all flex items-center justify-center gap-1.5"
        >
          Bağla
        </button>
      </div>
    </div>
  );
};
