import React, { useState } from 'react';
import {
  Check,
  Clock,
  Repeat,
  MoreHorizontal,
  Edit2,
  Trash2,
  Volume2,
  Clock3,
} from 'lucide-react';
import { Reminder } from '../types';
import { CATEGORIES } from '../utils/categoryMeta';
import { getRelativeTimeAz, formatTimeOnly, formatDateAz, getRecurrenceLabelAz } from '../utils/dateUtils';
import { speakText, playSuccessSound } from '../utils/soundUtils';

interface MobileReminderCardProps {
  reminder: Reminder;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  onSnooze: (id: string, minutes: number) => void;
  variant?: 'overdue' | 'now' | 'later' | 'default';
}

export const MobileReminderCard: React.FC<MobileReminderCardProps> = ({
  reminder,
  onToggleComplete,
  onDelete,
  onEdit,
  onSnooze,
  variant = 'default',
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);

  const categoryInfo = CATEGORIES[reminder.category] || CATEGORIES.other;
  const { label: relativeTime, isPast, isUrgent } = getRelativeTimeAz(reminder.dueDateTime);
  const timeOnly = formatTimeOnly(reminder.dueDateTime);
  const recurrenceLabel = getRecurrenceLabelAz(reminder.recurrence);

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    const speechText = `${reminder.title}. ${relativeTime}. ${reminder.description || ''}`;
    speakText(speechText);
  };

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!reminder.isCompleted) {
      playSuccessSound();
    }
    onToggleComplete(reminder.id);
  };

  const isOverdue = !reminder.isCompleted && (isPast || variant === 'overdue');
  const isNow = !reminder.isCompleted && (isUrgent || variant === 'now');

  // Native row styling: minimal glass slate with left accent stripe
  return (
    <div
      id={`mobile-reminder-card-${reminder.id}`}
      className={`group relative overflow-hidden rounded-2xl transition-all duration-200 active:scale-[0.99] ${
        reminder.isCompleted
          ? 'bg-[#111625]/40 opacity-50 border border-white/5'
          : isOverdue
          ? 'bg-[#141A29] border border-rose-500/20'
          : isNow
          ? 'bg-[#141B2E] border border-violet-500/25 shadow-sm'
          : 'bg-[#121826] border border-white/5'
      }`}
    >
      {/* Subtle status left indicator bar */}
      {!reminder.isCompleted && (
        <div
          className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${
            isOverdue
              ? 'bg-rose-500'
              : isNow
              ? 'bg-violet-500'
              : 'bg-slate-700/60'
          }`}
        />
      )}

      <div className="flex items-center gap-3 p-3.5 pl-4">
        {/* Large native iOS circular completion checkbox with 44px min touch area */}
        <button
          id={`toggle-complete-mobile-${reminder.id}`}
          onClick={handleComplete}
          className="flex h-11 w-11 shrink-0 items-center justify-center -ml-1 rounded-full active:scale-90 transition-transform"
          title={reminder.isCompleted ? 'Tamamlanmamış et' : 'Tamamla'}
        >
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] transition-all duration-150 ${
              reminder.isCompleted
                ? 'border-violet-500 bg-violet-600 text-white shadow-sm'
                : isOverdue
                ? 'border-rose-400/80 bg-rose-950/30'
                : 'border-slate-500/80 bg-slate-800/40 hover:border-violet-400'
            }`}
          >
            <Check className={`h-3.5 w-3.5 ${reminder.isCompleted ? 'stroke-[3]' : 'opacity-0'}`} />
          </div>
        </button>

        {/* Reminder Information */}
        <div className="flex-1 min-w-0 pr-1">
          {/* Top Line: Time + Title */}
          <div className="flex items-baseline gap-2">
            {timeOnly && (
              <span
                className={`text-xs font-bold tracking-tight shrink-0 ${
                  reminder.isCompleted
                    ? 'text-slate-500'
                    : isOverdue
                    ? 'text-rose-400'
                    : isNow
                    ? 'text-violet-300'
                    : 'text-slate-200'
                }`}
              >
                {timeOnly}
              </span>
            )}
            <h3
              className={`text-sm font-semibold tracking-tight truncate leading-snug ${
                reminder.isCompleted ? 'text-slate-500 line-through' : 'text-slate-100'
              }`}
            >
              {reminder.title}
            </h3>
          </div>

          {/* Description if present */}
          {reminder.description && (
            <p className="mt-0.5 text-xs text-slate-400 truncate">
              {reminder.description}
            </p>
          )}

          {/* Bottom metadata tags */}
          <div className="mt-1.5 flex items-center gap-2 text-[11px]">
            {/* Category dot + label */}
            <span className="inline-flex items-center gap-1 font-medium text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              {categoryInfo.label}
            </span>

            {/* Recurrence if any */}
            {recurrenceLabel && (
              <span className="inline-flex items-center gap-0.5 text-violet-300/90 font-medium">
                <Repeat className="h-2.5 w-2.5" />
                {recurrenceLabel}
              </span>
            )}

            {/* Relative timing badge */}
            <span
              className={`ml-auto text-[10px] font-medium ${
                isOverdue
                  ? 'text-rose-400 font-semibold'
                  : isNow
                  ? 'text-violet-300 font-semibold'
                  : 'text-slate-500'
              }`}
            >
              {relativeTime}
            </span>
          </div>
        </div>

        {/* Trailing actions: TTS voice button & menu */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            id={`speak-btn-mobile-${reminder.id}`}
            onClick={handleSpeak}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:text-violet-300 active:scale-95 transition-colors"
            title="Səsləndir"
          >
            <Volume2 className="h-4 w-4" />
          </button>

          <div className="relative">
            <button
              id={`options-btn-mobile-${reminder.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
                setShowSnoozeMenu(false);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:text-white active:scale-95 transition-colors"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {/* Native Popover Menu */}
            {showMenu && (
              <div
                className="absolute right-0 top-9 z-30 w-44 rounded-2xl border border-white/10 bg-[#0F1420]/98 p-1.5 shadow-2xl backdrop-blur-xl animate-fade-in"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  id={`edit-mobile-btn-${reminder.id}`}
                  onClick={() => {
                    setShowMenu(false);
                    onEdit(reminder);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5 text-indigo-400" />
                  Düzəliş et
                </button>

                <button
                  id={`snooze-toggle-mobile-${reminder.id}`}
                  onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Clock3 className="h-3.5 w-3.5 text-amber-400" />
                    Təxirə sal
                  </span>
                  <span className="text-[10px] text-slate-500">›</span>
                </button>

                {showSnoozeMenu && (
                  <div className="my-1 rounded-xl border border-white/5 bg-slate-900/90 p-1">
                    <button
                      onClick={() => {
                        onSnooze(reminder.id, 15);
                        setShowMenu(false);
                      }}
                      className="w-full text-left rounded-lg px-2 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800 hover:text-amber-300"
                    >
                      +15 dəqiqə
                    </button>
                    <button
                      onClick={() => {
                        onSnooze(reminder.id, 60);
                        setShowMenu(false);
                      }}
                      className="w-full text-left rounded-lg px-2 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800 hover:text-amber-300"
                    >
                      +1 saat
                    </button>
                    <button
                      onClick={() => {
                        onSnooze(reminder.id, 24 * 60);
                        setShowMenu(false);
                      }}
                      className="w-full text-left rounded-lg px-2 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800 hover:text-amber-300"
                    >
                      Sabah bu vaxta
                    </button>
                  </div>
                )}

                <div className="my-1 border-t border-white/5" />

                <button
                  id={`delete-mobile-btn-${reminder.id}`}
                  onClick={() => {
                    setShowMenu(false);
                    onDelete(reminder.id);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                  Sil
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
