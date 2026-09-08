import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Clock,
  Repeat,
  MoreHorizontal,
  Edit2,
  Trash2,
  Volume2,
  Clock3,
  Flame,
  CheckCircle2,
  RotateCcw,
  Calendar,
} from 'lucide-react';
import { Reminder } from '../types';
import { CATEGORIES } from '../utils/categoryMeta';
import {
  getRelativeTimeAz,
  formatTimeOnly,
  formatDateAz,
  getRecurrenceLabelAz,
  getReminderUrgencyStatus,
  isNearDue,
} from '../utils/dateUtils';
import { speakText, playSuccessSound } from '../utils/soundUtils';

interface MobileReminderCardProps {
  reminder: Reminder;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  onSnooze: (id: string, minutes: number) => void;
  onFocus?: (reminder: Reminder) => void;
  variant?: 'overdue' | 'now' | 'later' | 'default';
}

export const MobileReminderCard: React.FC<MobileReminderCardProps> = ({
  reminder,
  onToggleComplete,
  onDelete,
  onEdit,
  onSnooze,
  onFocus,
  variant = 'default',
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top?: number;
    bottom?: number;
    right: number;
    shouldOpenUpward: boolean;
  }>({ right: 16, shouldOpenUpward: false });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const categoryInfo = CATEGORIES[reminder.category] || CATEGORIES.other;
  const { label: relativeTime, isPast, isUrgent } = getRelativeTimeAz(reminder.dueDateTime);
  const timeOnly = formatTimeOnly(reminder.dueDateTime);
  const recurrenceLabel = getRecurrenceLabelAz(reminder);

  // Position calculation for Portal Menu
  const calculatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 210; // px
    const estimatedMenuHeight = 220; // px

    // Horizontal positioning: align right edge with button, keep at least 12px from viewport edges
    let right = window.innerWidth - rect.right;
    if (right < 12) right = 12;
    if (rect.right - menuWidth < 12) {
      right = Math.max(12, window.innerWidth - (rect.left + menuWidth));
    }

    // Vertical positioning: bottom nav + mic pill takes ~90px
    const bottomNavSafety = 96;
    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldOpenUpward = spaceBelow < estimatedMenuHeight + bottomNavSafety;

    if (shouldOpenUpward) {
      setMenuPosition({
        bottom: window.innerHeight - rect.top + 6,
        right,
        shouldOpenUpward: true,
      });
    } else {
      setMenuPosition({
        top: rect.bottom + 6,
        right,
        shouldOpenUpward: false,
      });
    }
  };

  const handleOpenMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showMenu) {
      calculatePosition();
      setShowMenu(true);
    } else {
      setShowMenu(false);
    }
  };

  // Close menu on outside click, window resize, scroll, or Escape key
  useEffect(() => {
    if (!showMenu) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMenu(false);
      }
    };

    const handleScrollOrResize = () => {
      setShowMenu(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [showMenu]);

  // Handle escape for delete confirmation
  useEffect(() => {
    if (!showDeleteConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDeleteConfirm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDeleteConfirm]);

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    const speechText = `${reminder.title}. ${relativeTime}. ${reminder.description || ''}`;
    speakText(speechText);
  };

  // Completion toggle: strictly toggles completion status, never deletes!
  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!reminder.isCompleted) {
      playSuccessSound();
    }
    onToggleComplete(reminder.id);
  };

  const urgencyStatus = getReminderUrgencyStatus(reminder);
  const isCompleted = reminder.isCompleted;

  const isOverdue = !isCompleted && (urgencyStatus === 'overdue' || isPast || variant === 'overdue');
  const isNear = !isCompleted && !isOverdue && urgencyStatus === 'nearDue';
  const isNow = !isCompleted && !isOverdue && !isNear && (isUrgent || variant === 'now');
  const isNowVariant = variant === 'now';

  return (
    <>
      <div
        id={`mobile-reminder-card-${reminder.id}`}
        className={`group relative overflow-hidden rounded-2xl transition-all duration-200 active:scale-[0.99] ${
          isCompleted
            ? 'bg-[#111625]/40 opacity-60 border border-white/5'
            : isOverdue
            ? 'bg-[#141A29] border border-rose-500/20'
            : isNowVariant || isNear
            ? 'bg-gradient-to-r from-[#171322] via-[#141829] to-[#141829] border border-rose-500/35 shadow-[0_2px_16px_-2px_rgba(244,63,94,0.20)] hover:border-rose-500/50'
            : isNow
            ? 'bg-[#141B2E] border border-violet-500/25 shadow-sm'
            : 'bg-[#121826] border border-white/5'
        }`}
      >
        {/* Subtle status left indicator bar */}
        {!isCompleted && (
          <div
            className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl transition-all ${
              isOverdue
                ? 'bg-rose-500'
                : isNowVariant || isNear
                ? 'bg-gradient-to-b from-rose-400 to-rose-600 shadow-[0_0_8px_rgba(244,63,94,0.45)]'
                : isNow
                ? 'bg-violet-500'
                : 'bg-slate-700/60'
            }`}
          />
        )}

        <div className={`flex items-center gap-2.5 ${isNowVariant ? 'py-2 px-3 pl-3.5' : 'p-3.5 pl-4'}`}>
          {/* Completion checkbox with 44px min touch area:
              - Inactive state: empty circle
              - Completed state: checkmark inside circle
              - Uses soft green / success accent
              - Never deletes! Calls onToggleComplete only.
          */}
          <button
            id={`toggle-complete-mobile-${reminder.id}`}
            onClick={handleComplete}
            className={`flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center ${
              isNowVariant ? '-ml-2' : '-ml-1.5'
            } rounded-full active:scale-90 transition-transform`}
            title={isCompleted ? 'Aktiv et' : 'Tamamla'}
            aria-label={isCompleted ? 'Aktiv et' : 'Tamamla'}
          >
            <div
              className={`flex ${isNowVariant ? 'h-5 w-5' : 'h-6 w-6'} items-center justify-center rounded-full border-[1.5px] transition-all duration-150 ${
                isCompleted
                  ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                  : isOverdue || isNowVariant || isNear
                  ? 'border-rose-400/80 bg-rose-950/20 hover:border-emerald-400'
                  : 'border-slate-500/70 bg-slate-900/40 hover:border-emerald-400'
              }`}
            >
              <Check
                className={`${isNowVariant ? 'h-3 w-3' : 'h-3.5 w-3.5'} transition-opacity ${
                  isCompleted ? 'stroke-[3] opacity-100' : 'opacity-0'
                }`}
              />
            </div>
          </button>

          {/* Reminder Information */}
          <div className="flex-1 min-w-0 pr-1">
            {/* Top Line: Time + Title */}
            <div className="flex items-baseline gap-2">
              {timeOnly && (
                <span
                  className={`inline-flex items-center gap-1 shrink-0 ${
                    isNowVariant ? 'text-[11px]' : 'text-xs'
                  } font-bold ${
                    isCompleted
                      ? 'text-slate-500'
                      : isOverdue || isNear || isNowVariant
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
                className={`tracking-tight truncate leading-snug ${
                  isNowVariant ? 'text-xs font-semibold' : 'text-sm font-semibold'
                } ${
                  isCompleted ? 'text-slate-500 line-through' : 'text-slate-100'
                }`}
              >
                {reminder.title}
              </h3>
            </div>

            {/* Description if present and not in compact now variant */}
            {!isNowVariant && reminder.description && (
              <p className="mt-0.5 text-xs text-slate-400 truncate">
                {reminder.description}
              </p>
            )}

            {/* Bottom metadata tags */}
            <div className={`${isNowVariant ? 'mt-0.5' : 'mt-1.5'} flex items-center gap-2 text-[10px]`}>
              {/* Category dot + label */}
              <span className="inline-flex items-center gap-1 font-medium text-slate-400 text-[10px]">
                <span className="h-1 w-1 rounded-full bg-violet-400" />
                {categoryInfo.label}
              </span>

              {/* Recurrence if any */}
              {recurrenceLabel && (
                <span className="inline-flex items-center gap-0.5 text-violet-300/90 font-medium text-[10px]">
                  <Repeat className="h-2.5 w-2.5" />
                  {recurrenceLabel}
                </span>
              )}

              {/* Near-Due Badge only in standard mode */}
              {!isNowVariant && isNear && (
                <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-rose-300">
                  <Clock3 className="h-2.5 w-2.5 text-rose-400" />
                  2 saat içində
                </span>
              )}

              {/* Relative timing badge */}
              <span
                className={`ml-auto text-[10px] font-medium ${
                  isOverdue || isNear || isNowVariant
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

          {/* Trailing actions: TTS voice button & 3-dot menu */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              id={`speak-btn-mobile-${reminder.id}`}
              onClick={handleSpeak}
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:text-violet-300 active:scale-95 transition-colors ${
                isNowVariant ? '-mr-1' : ''
              }`}
              title="Səsləndir"
              aria-label="Səsləndir"
            >
              <Volume2 className={`${isNowVariant ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
            </button>

            <button
              ref={buttonRef}
              id={`options-btn-mobile-${reminder.id}`}
              onClick={handleOpenMenu}
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl active:scale-95 transition-colors ${
                isNowVariant ? '-mr-1' : ''
              } ${showMenu ? 'text-white bg-white/10' : 'text-slate-400 hover:text-white'}`}
              title="Əməliyyatlar"
              aria-label="Əməliyyatlar"
            >
              <MoreHorizontal className={`${isNowVariant ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* PORTAL-BASED 3-DOT ACTION MENU:
          - Renders directly to document.body
          - Completely bypasses parent overflow-hidden
          - Always above cards and bottom navigation with high z-index
          - Opens upward if near screen bottom
      */}
      {showMenu &&
        createPortal(
          <>
            {/* Transparent backdrop for outside dismiss */}
            <div
              className="fixed inset-0 z-[9998] bg-black/20"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
              }}
            />

            <div
              ref={menuRef}
              style={{
                position: 'fixed',
                right: `${menuPosition.right}px`,
                ...(menuPosition.top !== undefined ? { top: `${menuPosition.top}px` } : {}),
                ...(menuPosition.bottom !== undefined ? { bottom: `${menuPosition.bottom}px` } : {}),
              }}
              className={`z-[9999] w-52 rounded-2xl border border-white/10 bg-[#0F1420]/98 p-1.5 shadow-2xl backdrop-blur-xl animate-scale-in text-slate-200 ${
                menuPosition.shouldOpenUpward ? 'origin-bottom-right' : 'origin-top-right'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Action 1: Redaktə et */}
              <button
                id={`edit-mobile-btn-${reminder.id}`}
                onClick={() => {
                  setShowMenu(false);
                  onEdit(reminder);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-slate-200 hover:bg-slate-800/80 hover:text-white transition-colors text-left"
              >
                <Edit2 className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                <span>Redaktə et</span>
              </button>

              {!reminder.isCompleted ? (
                <>
                  {/* Action 2: Vaxtı dəyiş */}
                  <button
                    id={`change-time-mobile-btn-${reminder.id}`}
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(reminder);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-slate-200 hover:bg-slate-800/80 hover:text-white transition-colors text-left"
                  >
                    <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span>Vaxtı dəyiş</span>
                  </button>

                  {/* Action 3: Təkrarlanmanı dəyiş */}
                  <button
                    id={`change-recurrence-mobile-btn-${reminder.id}`}
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(reminder);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-slate-200 hover:bg-slate-800/80 hover:text-white transition-colors text-left"
                  >
                    <Repeat className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    <span>Təkrarlanmanı dəyiş</span>
                  </button>

                  {/* Action 4: Tamamlandı kimi işarələ */}
                  <button
                    id={`mark-complete-mobile-btn-${reminder.id}`}
                    onClick={(e) => {
                      setShowMenu(false);
                      handleComplete(e);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors text-left"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>Tamamlandı kimi işarələ</span>
                  </button>

                  {/* Optional Focus mode if provided */}
                  {onFocus && (
                    <button
                      id={`focus-mobile-btn-${reminder.id}`}
                      onClick={() => {
                        setShowMenu(false);
                        onFocus(reminder);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-violet-300 hover:bg-violet-950/40 transition-colors text-left"
                    >
                      <Flame className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                      <span>Fokuslan</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  {/* Action for Completed: Aktiv et */}
                  <button
                    id={`reactivate-mobile-btn-${reminder.id}`}
                    onClick={(e) => {
                      setShowMenu(false);
                      handleComplete(e);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-violet-300 hover:bg-violet-950/40 transition-colors text-left"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                    <span>Aktiv et</span>
                  </button>
                </>
              )}

              <div className="my-1 border-t border-white/5" />

              {/* Action 5: Sil (Triggers explicit confirmation dialog) */}
              <button
                id={`delete-mobile-btn-${reminder.id}`}
                onClick={() => {
                  setShowMenu(false);
                  setShowDeleteConfirm(true);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                <span>Sil</span>
              </button>
            </div>
          </>,
          document.body
        )}

      {/* EXPLICIT DELETE CONFIRMATION MODAL:
          - Does not delete immediately
          - Shows prompt: "Bu xatırlatmanı silmək istəyirsiniz?"
          - Buttons: "Ləğv et" (Cancel) & "Sil" (Destructive Red)
      */}
      {showDeleteConfirm &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(false);
            }}
          >
            <div
              className="w-full max-w-xs rounded-2xl border border-white/10 bg-[#121828] p-5 shadow-2xl text-center animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/25 mx-auto mb-3">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">
                Bu xatırlatmanı silmək istəyirsiniz?
              </h3>
              <p className="text-xs text-slate-400 mb-5 truncate px-2">
                "{reminder.title}"
              </p>
              <div className="flex items-center gap-2.5">
                <button
                  id="cancel-delete-btn"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs transition-colors"
                >
                  Ləğv et
                </button>
                <button
                  id="confirm-delete-btn"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    onDelete(reminder.id);
                  }}
                  className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/30 transition-colors"
                >
                  Sil
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
