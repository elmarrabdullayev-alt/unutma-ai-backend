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
import {
  getRelativeTimeAz,
  formatDateAz,
  getRecurrenceLabelAz,
  getReminderUrgencyStatus,
  formatTimeOnly,
} from '../utils/dateUtils';
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
  const recurrenceLabel = getRecurrenceLabelAz(reminder);

  const handleSpeak = () => {
    const speechText = `${reminder.title}. ${relativeTime}. ${reminder.description || ''}`;
    speakText(speechText);
  };

  const urgencyStatus = getReminderUrgencyStatus(reminder);
  const isCompleted = reminder.isCompleted;
  const isOverdue = !isCompleted && (urgencyStatus === 'overdue' || isPast);
  const isNear = !isCompleted && !isOverdue && urgencyStatus === 'nearDue';
  const timeOnly = formatTimeOnly(reminder.dueDateTime);

  // Determine vertical accent bar color based on status/priority/category
  const getAccentBarColor = () => {
    if (isCompleted) return 'bg-ink-600';
    if (isOverdue) return 'bg-nar-500 shadow-sm shadow-nar-500/50';
    if (isNear) return 'bg-gradient-to-b from-nar-400 to-nar-600 shadow-[0_0_10px_rgba(244,63,94,0.7)]';
    if (reminder.priority === 'high') return 'bg-nar-500 shadow-sm shadow-nar-500/50';
    if (isUrgent) return 'bg-amber-500 shadow-sm shadow-amber-500/50';
    if (reminder.category === 'personal') return 'bg-zer-500 shadow-sm shadow-zer-500/50';
    if (reminder.category === 'work') return 'bg-zer-500 shadow-sm shadow-zer-500/50';
    if (reminder.category === 'finance') return 'bg-pista-500 shadow-sm shadow-pista-500/50';
    if (reminder.category === 'health') return 'bg-nar-400 shadow-sm shadow-nar-400/50';
    if (reminder.category === 'shopping') return 'bg-amber-400 shadow-sm shadow-amber-400/50';
    return 'bg-zer-500';
  };

  return (
    <div
      id={`reminder-card-${reminder.id}`}
      className={`group relative rounded-2xl border transition-all duration-200 ${
        isCompleted
          ? 'border-white/5 bg-ink-900/40 opacity-60'
          : isOverdue
          ? 'border-nar-500/30 bg-[#1d161c] shadow-md shadow-nar-500/5'
          : isNear
          ? 'border-nar-500/35 bg-gradient-to-r from-[#1d161c] via-[#1d161c] to-[#1d161c] shadow-[0_4px_24px_-4px_rgba(244,63,94,0.22)] hover:border-nar-500/50'
          : isUrgent
          ? 'border-amber-500/30 bg-ink-800/60 shadow-lg shadow-amber-500/5'
          : 'border-white/5 bg-ink-800/40 hover:border-white/15 hover:bg-ink-800/70 shadow-sm'
      } p-4 text-ink-50`}
    >
      <div className="flex items-center gap-3.5">
        {/* Sleek Vertical Left Accent Bar */}
        <div className={`w-1.5 self-stretch min-h-[44px] rounded-full transition-colors ${getAccentBarColor()}`} />

        {/* Reminder Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            {/* Category Tag */}
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[12px] font-semibold ${categoryInfo.bgColor}`}
            >
              <CategoryIcon className="h-3 w-3" />
              {categoryInfo.label}
            </span>

            {/* Recurrence badge */}
            {recurrenceLabel && (
              <span className="inline-flex items-center gap-1 rounded-md border border-zer-500/30 bg-zer-500/10 px-1.5 py-0.5 text-[12px] font-medium text-zer-300">
                <Repeat className="h-2.5 w-2.5" />
                {recurrenceLabel}
              </span>
            )}

            {/* Priority tag */}
            {reminder.priority === 'high' && (
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-nar-400">
                <span className="h-1.5 w-1.5 rounded-full bg-nar-500 animate-pulse" />
                Vacib
              </span>
            )}
          </div>

          {/* Title */}
          <h3
            className={`text-sm font-medium tracking-tight transition-all ${
              reminder.isCompleted ? 'text-ink-400 line-through' : 'text-ink-100'
            }`}
          >
            {reminder.title}
          </h3>

          {/* Description / Notes if any */}
          {reminder.description && (
            <p className="mt-0.5 text-xs text-ink-400 line-clamp-1">{reminder.description}</p>
          )}

          {/* Time & Relative Timing */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {timeOnly && (
              <span
                className={`inline-flex items-center gap-1 font-bold ${
                  isCompleted
                    ? 'text-ink-500'
                    : isOverdue
                    ? 'text-nar-400'
                    : isNear
                    ? 'text-nar-400'
                    : 'text-ink-200'
                }`}
              >
                {isNear && (
                  <span className="h-1.5 w-1.5 rounded-full bg-nar-500 animate-pulse shrink-0" />
                )}
                {timeOnly}
              </span>
            )}

            {isNear && (
              <span className="inline-flex items-center gap-1 rounded-md border border-nar-500/30 bg-nar-500/10 px-1.5 py-0.5 text-[12px] font-extrabold text-nar-300">
                <Clock3 className="h-2.5 w-2.5 text-nar-400" />
                2 saat içində
              </span>
            )}

            <span
              className={`inline-flex items-center gap-1 font-medium ${
                isCompleted
                  ? 'text-ink-500'
                  : isOverdue
                  ? 'text-nar-400 font-semibold'
                  : isNear
                  ? 'text-nar-400 font-semibold'
                  : isUrgent
                  ? 'text-amber-400'
                  : 'text-ink-400'
              }`}
            >
              <Clock className="h-3.5 w-3.5 text-ink-400" />
              {relativeTime}
            </span>

            <span className="text-[13px] text-ink-500">
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
            className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-400 hover:bg-ink-700/50 hover:text-zer-400 transition-colors"
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
              className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-400 hover:bg-ink-700/50 hover:text-white transition-colors"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {showMenu && (
              <div
                className="absolute right-0 top-9 z-30 w-44 rounded-2xl border border-white/10 bg-ink-900/95 p-1.5 shadow-2xl backdrop-blur-xl animate-fade-in"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  id={`edit-btn-${reminder.id}`}
                  onClick={() => {
                    setShowMenu(false);
                    onEdit(reminder);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-ink-300 hover:bg-ink-800 hover:text-white transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5 text-zer-400" />
                  Redaktə et
                </button>

                {/* Snooze Options */}
                <button
                  id={`snooze-toggle-${reminder.id}`}
                  onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                  className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs text-ink-300 hover:bg-ink-800 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Clock3 className="h-3.5 w-3.5 text-amber-400" />
                    Təxirə sal
                  </span>
                  <span className="text-[12px] text-ink-500">▶</span>
                </button>

                {showSnoozeMenu && (
                  <div className="my-1 rounded-xl border border-white/5 bg-ink-950/90 p-1">
                    <button
                      onClick={() => {
                        onSnooze(reminder.id, 15);
                        setShowMenu(false);
                      }}
                      className="w-full text-left rounded-lg px-2 py-1 text-[13px] text-ink-300 hover:bg-ink-800 hover:text-amber-300"
                    >
                      +15 dəqiqə
                    </button>
                    <button
                      onClick={() => {
                        onSnooze(reminder.id, 60);
                        setShowMenu(false);
                      }}
                      className="w-full text-left rounded-lg px-2 py-1 text-[13px] text-ink-300 hover:bg-ink-800 hover:text-amber-300"
                    >
                      +1 saat
                    </button>
                    <button
                      onClick={() => {
                        onSnooze(reminder.id, 24 * 60);
                        setShowMenu(false);
                      }}
                      className="w-full text-left rounded-lg px-2 py-1 text-[13px] text-ink-300 hover:bg-ink-800 hover:text-amber-300"
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
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-nar-400 hover:bg-nar-500/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5 text-nar-400" />
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
                ? 'border-zer-500 btn-gold text-ink-950 shadow-md shadow-zer-500/30'
                : 'border-ink-600 bg-ink-800/50 hover:border-zer-400 text-transparent'
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
