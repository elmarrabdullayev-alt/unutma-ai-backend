import React from 'react';
import { BellRing, Check, Clock3, X } from 'lucide-react';
import { Reminder } from '../types';
import { CATEGORIES } from '../utils/categoryMeta';

interface ActiveAlarmBannerProps {
  activeAlarmReminder: Reminder | null;
  onDismiss: () => void;
  onComplete: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
}

export const ActiveAlarmBanner: React.FC<ActiveAlarmBannerProps> = ({
  activeAlarmReminder,
  onDismiss,
  onComplete,
  onSnooze,
}) => {
  if (!activeAlarmReminder) return null;

  const cat = CATEGORIES[activeAlarmReminder.category] || CATEGORIES.other;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-md animate-bounce-short">
      <div className="rounded-3xl border border-violet-500/50 bg-[#0F172A]/95 p-4 shadow-2xl shadow-violet-500/30 backdrop-blur-xl text-slate-50">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white border border-white/10 shadow-lg shadow-violet-500/30">
            <BellRing className="h-6 w-6 animate-pulse text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-300 uppercase tracking-wider">
                Xatırlatma Vaxtı!
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {new Date(activeAlarmReminder.dueDateTime).toLocaleTimeString('az-AZ', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            <h4 className="mt-1 font-bold text-sm text-white line-clamp-1">
              {activeAlarmReminder.title}
            </h4>

            {activeAlarmReminder.description && (
              <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">
                {activeAlarmReminder.description}
              </p>
            )}

            <div className="mt-3 flex items-center gap-2">
              <button
                id="alarm-complete-btn"
                onClick={() => onComplete(activeAlarmReminder.id)}
                className="flex items-center gap-1 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:brightness-110 active:scale-95 transition-all shadow-md shadow-violet-500/25 border border-white/10"
              >
                <Check className="h-3.5 w-3.5" />
                Tamamlandı
              </button>

              <button
                id="alarm-snooze-btn"
                onClick={() => onSnooze(activeAlarmReminder.id, 5)}
                className="flex items-center gap-1 rounded-xl border border-white/5 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-slate-700 transition-all"
              >
                <Clock3 className="h-3.5 w-3.5 text-amber-400" />
                +5 dəqiqə
              </button>

              <button
                id="alarm-dismiss-btn"
                onClick={onDismiss}
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
