import React, { useState } from 'react';
import {
  Check,
  Clock,
  Repeat,
  MoreVertical,
  Edit2,
  Trash2,
  Volume2,
  HeartPulse,
  Briefcase,
  CreditCard,
  User,
  ShoppingBag,
  GraduationCap,
  Home,
  Bell,
  Clock3,
} from 'lucide-react';
import { Reminder, ReminderCategory } from '../types';
import { CATEGORIES } from '../utils/categoryMeta';
import { getRelativeTimeAz, formatDateAz, getRecurrenceLabelAz } from '../utils/dateUtils';
import { speakText } from '../utils/soundUtils';

interface ReminderCardProps {
  reminder: Reminder;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  onSnooze: (id: string, minutes: number) => void;
}

const CATEGORY_ICON_MAP: Record<ReminderCategory, any> = {
  health: HeartPulse,
  work: Briefcase,
  finance: CreditCard,
  personal: User,
  shopping: ShoppingBag,
  education: GraduationCap,
  home: Home,
  other: Bell,
};

export const ReminderCard: React.FC<ReminderCardProps> = ({
  reminder,
  onToggleComplete,
  onDelete,
  onEdit,
  onSnooze,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);

  const categoryInfo = CATEGORIES[reminder.category] || CATEGORIES.other;
  const CategoryIcon = CATEGORY_ICON_MAP[reminder.category] || Bell;
  const { label: relativeTime, isPast, isUrgent } = getRelativeTimeAz(reminder.dueDateTime);
  const recurrenceLabel = getRecurrenceLabelAz(reminder.recurrence);

  const handleSpeak = () => {
    const speechText = `${reminder.title}. ${relativeTime}. ${reminder.description || ''}`;
    speakText(speechText);
  };

  // Determine vertical accent bar color based on status/priority/category
  const getAccentBarColor = () => {
    if (reminder.isCompleted) return 'bg-slate-600';
    if (reminder.priority === 'high' || isPast) return 'bg-rose-500 shadow-sm shadow-rose-500/50';
    if (isUrgent) return 'bg-amber-500 shadow-sm shadow-amber-500/50';
    if (reminder.category === 'personal') return 'bg-violet-500 shadow-sm shadow-violet-500/50';
    if (reminder.category === 'work') return 'bg-indigo-500 shadow-sm shadow-indigo-500/50';
    if (reminder.category === 'finance') return 'bg-emerald-500 shadow-sm shadow-emerald-500/50';
    if (reminder.category === 'health') return 'bg-rose-400 shadow-sm shadow-rose-400/50';
    if (reminder.category === 'shopping') return 'bg-amber-400 shadow-sm shadow-amber-400/50';
    return 'bg-violet-500';
  };

  return (
    <div
      id={`reminder-card-${reminder.id}`}
      className={`group relative rounded-2xl border transition-all duration-200 ${
        reminder.isCompleted
          ? 'border-white/5 bg-slate-900/40 opacity-60'
          : isUrgent
          ? 'border-amber-500/30 bg-slate-800/60 shadow-lg shadow-amber-500/5'
          : 'border-white/5 bg-slate-800/40 hover:border-white/15 hover:bg-slate-800/70 shadow-sm'
      } p-4 text-slate-50`}
    >
      <div className="flex items-center gap-3.5">
        {/* Sleek Vertical Left Accent Bar */}
        <div className={`w-1.5 self-stretch min-h-[44px] rounded-full transition-colors ${getAccentBarColor()}`} />

        {/* Reminder Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            {/* Category Tag */}
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${categoryInfo.bgColor}`}
            >
              <CategoryIcon className="h-3 w-3" />
              {categoryInfo.label}
            </span>

            {/* Recurrence badge */}
            {recurrenceLabel && (
              <span className="inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
                <Repeat className="h-2.5 w-2.5" />
                {recurrenceLabel}
              </span>
            )}

            {/* Priority tag */}
            {reminder.priority === 'high' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-400">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                Vacib
              </span>
            )}
          </div>

          {/* Title */}
          <h3
            className={`text-sm font-medium tracking-tight transition-all ${
              reminder.isCompleted ? 'text-slate-400 line-through' : 'text-slate-100'
            }`}
          >
            {reminder.title}
          </h3>

          {/* Description / Notes if any */}
          {reminder.description && (
            <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">{reminder.description}</p>
          )}

          {/* Time & Relative Timing */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1 font-medium ${
                isPast && !reminder.isCompleted
                  ? 'text-rose-400'
                  : isUrgent && !reminder.isCompleted
                  ? 'text-amber-400'
                  : 'text-slate-400'
              }`}
            >
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              {relativeTime}
            </span>

            <span className="text-[11px] text-slate-500">
              • {formatDateAz(reminder.dueDateTime)}
            </span>
          </div>
        </div>

        {/* Actions & Checkbox */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Audio TTS button */}
          <button
            id={`speak-reminder-${reminder.id}`}
            onClick={handleSpeak}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-700/50 hover:text-violet-400 transition-colors"
            title="Səsləndir"
          >
            <Volume2 className="h-4 w-4" />
          </button>

          {/* Options Dropdown */}
          <div className="relative">
            <button
              id={`options-btn-${reminder.id}`}
              onClick={() => {
                setShowMenu(!showMenu);
                setShowSnoozeMenu(false);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-700/50 hover:text-white transition-colors"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {showMenu && (
              <div
                className="absolute right-0 top-9 z-30 w-44 rounded-2xl border border-white/10 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-xl animate-fade-in"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  id={`edit-btn-${reminder.id}`}
                  onClick={() => {
                    setShowMenu(false);
                    onEdit(reminder);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5 text-indigo-400" />
                  Redaktə et
                </button>

                {/* Snooze Options */}
                <button
                  id={`snooze-toggle-${reminder.id}`}
                  onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                  className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Clock3 className="h-3.5 w-3.5 text-amber-400" />
                    Təxirə sal
                  </span>
                  <span className="text-[10px] text-slate-500">▶</span>
                </button>

                {showSnoozeMenu && (
                  <div className="my-1 rounded-xl border border-white/5 bg-slate-950/90 p-1">
                    <button
                      onClick={() => {
                        onSnooze(reminder.id, 15);
                        setShowMenu(false);
                      }}
                      className="w-full text-left rounded-lg px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 hover:text-amber-300"
                    >
                      +15 dəqiqə
                    </button>
                    <button
                      onClick={() => {
                        onSnooze(reminder.id, 60);
                        setShowMenu(false);
                      }}
                      className="w-full text-left rounded-lg px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 hover:text-amber-300"
                    >
                      +1 saat
                    </button>
                    <button
                      onClick={() => {
                        onSnooze(reminder.id, 24 * 60);
                        setShowMenu(false);
                      }}
                      className="w-full text-left rounded-lg px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 hover:text-amber-300"
                    >
                      Sabah bu vaxta
                    </button>
                  </div>
                )}

                <div className="my-1 border-t border-white/5" />

                <button
                  id={`delete-btn-${reminder.id}`}
                  onClick={() => {
                    setShowMenu(false);
                    onDelete(reminder.id);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                  Sil
                </button>
              </div>
            )}
          </div>

          {/* Sleek Rounded-MD Checkbox */}
          <button
            id={`toggle-complete-${reminder.id}`}
            onClick={() => onToggleComplete(reminder.id)}
            className={`flex h-6 w-6 items-center justify-center rounded-lg border transition-all active:scale-90 ${
              reminder.isCompleted
                ? 'border-violet-500 bg-violet-600 text-white shadow-md shadow-violet-500/30'
                : 'border-slate-600 bg-slate-800/50 hover:border-violet-400 text-transparent'
            }`}
            title={reminder.isCompleted ? 'Tamamlanmamış et' : 'Tamamla'}
          >
            <Check className={`h-3.5 w-3.5 ${reminder.isCompleted ? 'stroke-[3]' : 'opacity-0'}`} />
          </button>
        </div>
      </div>
    </div>
  );
};
