import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MoreHorizontal, Pencil, Trash2, Volume2, Clock3, Flame, Repeat2 } from 'lucide-react';
import { Reminder } from '../types';
import { CATEGORIES } from '../utils/categoryMeta';
import { getRelativeTimeAz, formatTimeOnly, getReminderUrgencyStatus } from '../utils/dateUtils';
import { speakText, playSuccessSound } from '../utils/soundUtils';
import { CompletionCheck } from './ui/CompletionCheck';
import { springPress } from '../utils/motion';

interface MobileReminderCardProps {
  reminder: Reminder;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  onSnooze: (id: string, minutes: number) => void;
  onFocus?: (reminder: Reminder) => void;
  variant?: 'overdue' | 'now' | 'later' | 'default';
  /** Hide the time line when the parent already shows it (timeline layout) */
  hideTime?: boolean;
}

/** Long enough to see the tick draw and the seeds burst before the row leaves */
const COMPLETE_DELAY_MS = 520;

export const MobileReminderCard: React.FC<MobileReminderCardProps> = ({
  reminder,
  onToggleComplete,
  onDelete,
  onEdit,
  onSnooze,
  onFocus,
  variant = 'default',
  hideTime = false,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [optimisticDone, setOptimisticDone] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const completeTimer = useRef<number | null>(null);

  const categoryInfo = CATEGORIES[reminder.category] || CATEGORIES.other;
  const { label: relativeTime, isPast } = getRelativeTimeAz(reminder.dueDateTime);
  const timeOnly = formatTimeOnly(reminder.dueDateTime);

  useEffect(() => () => {
    if (completeTimer.current) window.clearTimeout(completeTimer.current);
  }, []);

  // Close menu on click outside or Escape
  useEffect(() => {
    if (!showMenu) return;
    const handleOutside = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowDeleteConfirm(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMenu(false);
        setShowDeleteConfirm(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showMenu]);

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    speakText(`${reminder.title}. ${relativeTime}. ${reminder.description || ''}`);
  };

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (reminder.isCompleted) {
      onToggleComplete(reminder.id);
      return;
    }
    if (optimisticDone) return;
    playSuccessSound();
    setOptimisticDone(true);
    completeTimer.current = window.setTimeout(() => onToggleComplete(reminder.id), COMPLETE_DELAY_MS);
  };

  const urgencyStatus = getReminderUrgencyStatus(reminder);
  const isCompleted = reminder.isCompleted || optimisticDone;
  const isOverdue = !isCompleted && (urgencyStatus === 'overdue' || isPast || variant === 'overdue');
  const isNow = !isCompleted && !isOverdue && variant === 'now';
  const isRecurring = reminder.recurrence && reminder.recurrence !== 'none';

  const menuItem =
    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-ink-50 hover:bg-white/[0.06] active:bg-white/[0.09] transition-colors';

  return (
    <div
      id={`mobile-reminder-card-${reminder.id}`}
      className={`group relative rounded-card transition-[background-color,border-color,opacity] duration-300 ${
        isCompleted
          ? 'surface-quiet opacity-70'
          : isOverdue
          ? 'surface border-nar-400/25'
          : isNow
          ? 'surface border-zer-400/30'
          : 'surface'
      } ${showMenu ? 'z-30' : ''}`}
    >
      <div className="flex items-center gap-2 py-3 pl-2 pr-1">
        <CompletionCheck
          checked={isCompleted}
          onToggle={handleComplete}
          tone={isOverdue ? 'overdue' : 'default'}
          label={isCompleted ? `"${reminder.title}" aktiv et` : `"${reminder.title}" tamamla`}
        />

        <button
          type="button"
          onClick={() => onEdit(reminder)}
          className="flex-1 min-w-0 text-left rounded-xl py-0.5 pr-1"
          aria-label={`${reminder.title}, ${timeOnly}. Redaktə et`}
        >
          {!hideTime && timeOnly && (
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className={`tabular text-[13px] font-semibold ${
                  isCompleted ? 'text-ink-400' : isOverdue ? 'text-nar-300' : 'text-zer-300'
                }`}
              >
                {timeOnly}
              </span>
              {isOverdue && <span className="text-[12px] font-medium text-nar-300">gecikir</span>}
            </div>
          )}

          <span className="relative inline-block max-w-full">
            <h3
              className={`text-[16px] font-semibold leading-snug tracking-[-0.01em] break-words line-clamp-2 transition-colors duration-300 ${
                isCompleted ? 'text-ink-400' : 'text-ink-50'
              }`}
            >
              {reminder.title}
            </h3>
            {/* Strike line draws across instead of snapping on */}
            <motion.span
              aria-hidden="true"
              className="absolute left-0 right-0 top-1/2 h-[1.5px] origin-left rounded-full bg-ink-400"
              initial={false}
              animate={{ scaleX: isCompleted ? 1 : 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: isCompleted ? 0.12 : 0 }}
            />
          </span>

          <div className="mt-1 flex items-center gap-2 text-[13px] text-ink-400 min-w-0">
            <span className={`inline-flex items-center gap-1.5 shrink-0 ${categoryInfo.color}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
              <span className="text-ink-300">{categoryInfo.label}</span>
            </span>
            {isRecurring && <Repeat2 className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-label="Təkrarlanır" />}
            {reminder.description && <span className="truncate text-ink-400">{reminder.description}</span>}
          </div>
        </button>

        <div className="relative shrink-0" ref={menuRef}>
          <motion.button
            type="button"
            whileTap={{ scale: 0.86 }}
            transition={springPress}
            id={`menu-mobile-${reminder.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((prev) => !prev);
              setShowDeleteConfirm(false);
            }}
            aria-label="Digər əməliyyatlar"
            aria-haspopup="menu"
            aria-expanded={showMenu}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
              showMenu ? 'bg-white/[0.08] text-ink-50' : 'text-ink-400 hover:text-ink-100'
            }`}
          >
            <MoreHorizontal className="h-5 w-5" />
          </motion.button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, scale: 0.9, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: -4, transition: { duration: 0.14 } }}
                transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                style={{ transformOrigin: 'top right' }}
                className="absolute right-1 top-12 z-40 w-56 rounded-2xl border border-white/[0.09] bg-ink-850/95 p-1.5 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.85)] backdrop-blur-xl"
              >
                <button role="menuitem" onClick={(e) => { handleSpeak(e); setShowMenu(false); }} className={menuItem}>
                  <Volume2 className="h-4 w-4 text-zer-300" />
                  <span>Səsləndir</span>
                </button>

                {onFocus && !isCompleted && (
                  <button
                    role="menuitem"
                    onClick={(e) => { e.stopPropagation(); setShowMenu(false); onFocus(reminder); }}
                    className={menuItem}
                  >
                    <Flame className="h-4 w-4 text-zer-300" />
                    <span>Fokuslan</span>
                  </button>
                )}

                <button
                  role="menuitem"
                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); onEdit(reminder); }}
                  className={menuItem}
                >
                  <Pencil className="h-4 w-4 text-ink-300" />
                  <span>Redaktə et</span>
                </button>

                {!isCompleted && (
                  <button
                    role="menuitem"
                    onClick={(e) => { e.stopPropagation(); setShowMenu(false); onSnooze(reminder.id, 15); }}
                    className={menuItem}
                  >
                    <Clock3 className="h-4 w-4 text-ink-300" />
                    <span>15 dəqiqə təxirə sal</span>
                  </button>
                )}

                <div className="my-1 h-px bg-white/[0.07]" />

                <AnimatePresence mode="wait" initial={false}>
                  {!showDeleteConfirm ? (
                    <motion.button
                      key="ask"
                      role="menuitem"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
                      className={`${menuItem} text-nar-300 hover:bg-nar-500/10`}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Sil</span>
                    </motion.button>
                  ) : (
                    <motion.button
                      key="confirm"
                      role="menuitem"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={springPress}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        setShowDeleteConfirm(false);
                        onDelete(reminder.id);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[14px] font-semibold bg-nar-500 text-white active:bg-nar-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Bəli, sil</span>
                    </motion.button>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
