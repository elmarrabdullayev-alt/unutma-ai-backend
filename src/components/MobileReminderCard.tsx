import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  MoreHorizontal,
  Edit2,
  Trash2,
  Volume2,
  Clock3,
  Flame,
} from 'lucide-react';
import { Reminder } from '../types';
import { CATEGORIES } from '../utils/categoryMeta';
import {
  getRelativeTimeAz,
  formatTimeOnly,
  getReminderUrgencyStatus,
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
  const menuRef = useRef<HTMLDivElement>(null);

  const categoryInfo = CATEGORIES[reminder.category] || CATEGORIES.other;
  const { label: relativeTime, isPast } = getRelativeTimeAz(reminder.dueDateTime);
  const timeOnly = formatTimeOnly(reminder.dueDateTime);

  // Close menu on click outside or Escape
  useEffect(() => {
    if (!showMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMenu(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showMenu]);

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

  const urgencyStatus = getReminderUrgencyStatus(reminder);
  const isCompleted = reminder.isCompleted;
  const isOverdue = !isCompleted && (urgencyStatus === 'overdue' || isPast || variant === 'overdue');

  return (
    <div
      id={`mobile-reminder-card-${reminder.id}`}
      className={`group relative rounded-[18px] border transition-all duration-200 ${
        isCompleted
          ? 'bg-[#121827]/60 border-white/[0.04] opacity-60'
          : 'bg-[#121827] border-white/[0.06] hover:border-white/[0.12]'
      }`}
    >
      <div className="flex items-center gap-3 p-3.5">
        {/* 1. Solda tamamlanma dairəsi (min touch area 44px) */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          id={`toggle-complete-mobile-${reminder.id}`}
          onClick={handleComplete}
          aria-label={isCompleted ? 'Aktiv et' : 'Tamamla'}
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center -ml-1 rounded-full text-slate-300"
        >
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full border transition-all duration-150 ${
              isCompleted
                ? 'border-[#10B981] bg-[#10B981] text-white shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                : 'border-white/20 bg-[#0D1220]/70 hover:border-[#A78BFA]'
            }`}
          >
            {isCompleted && <Check className="h-3.5 w-3.5 stroke-[3]" />}
          </div>
        </motion.button>

        {/* 2. Saat, Tapşırıq adı və Kateqoriya */}
        <div className="flex-1 min-w-0 pr-1">
          {/* Saat və yalnız gecikəndə 'Gecikir' statusu */}
          <div className="flex items-center gap-1.5">
            {timeOnly && (
              <span
                className={`text-[11px] font-semibold tracking-tight ${
                  isCompleted
                    ? 'text-[#94A3B8]'
                    : isOverdue
                    ? 'text-[#FF4D73]'
                    : 'text-[#A78BFA]'
                }`}
              >
                {timeOnly}
              </span>
            )}
            {isOverdue && (
              <span className="text-[10px] font-semibold text-[#FF4D73] bg-[#FF4D73]/10 px-1.5 py-0.2 rounded-md">
                Gecikir
              </span>
            )}
          </div>

          {/* Tapşırıq adı əsas vurğudur, uzun adlar düzgün sətirə keçir */}
          <h3
            className={`text-sm font-semibold tracking-tight leading-snug mt-0.5 break-words line-clamp-2 ${
              isCompleted ? 'text-[#94A3B8] line-through font-normal' : 'text-[#F5F6FA]'
            }`}
          >
            {reminder.title}
          </h3>

          {/* Kateqoriya və əlavə məlumat daha kiçik, sakit rəngdə */}
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[11px] text-[#94A3B8]">
            <span className="inline-flex items-center gap-1 font-normal text-[#94A3B8]">
              <span className="h-1 w-1 rounded-full bg-[#94A3B8]/60" />
              {categoryInfo.label}
            </span>

            {reminder.description && (
              <>
                <span className="text-white/20">·</span>
                <span className="truncate max-w-[160px] text-[#94A3B8]/75">
                  {reminder.description}
                </span>
              </>
            )}
          </div>
        </div>

        {/* 3. Sağda üç nöqtə əməliyyat menyusu */}
        <div className="relative shrink-0" ref={menuRef}>
          <motion.button
            whileTap={{ scale: 0.92 }}
            id={`menu-mobile-${reminder.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((prev) => !prev);
            }}
            aria-label="Digər əməliyyatlar"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[#94A3B8] hover:text-[#F5F6FA] active:bg-white/5 transition-colors"
          >
            <MoreHorizontal className="h-4 w-4" />
          </motion.button>

          {/* Menyu Popup */}
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-10 z-30 w-44 rounded-2xl border border-white/[0.08] bg-[#0D1220] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl"
              >
                {/* Oxu */}
                <button
                  onClick={(e) => {
                    handleSpeak(e);
                    setShowMenu(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs text-[#F5F6FA] hover:bg-white/[0.06] transition-colors"
                >
                  <Volume2 className="h-3.5 w-3.5 text-[#A78BFA]" />
                  <span>Səsləndir</span>
                </button>

                {/* Fokus */}
                {onFocus && !isCompleted && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onFocus(reminder);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs text-[#F5F6FA] hover:bg-white/[0.06] transition-colors"
                  >
                    <Flame className="h-3.5 w-3.5 text-amber-400" />
                    <span>Fokuslan</span>
                  </button>
                )}

                {/* Düzəliş et */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onEdit(reminder);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs text-[#F5F6FA] hover:bg-white/[0.06] transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5 text-[#94A3B8]" />
                  <span>Redaktə et</span>
                </button>

                {/* Təxirə sal */}
                {!isCompleted && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onSnooze(reminder.id, 15);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs text-[#F5F6FA] hover:bg-white/[0.06] transition-colors"
                  >
                    <Clock3 className="h-3.5 w-3.5 text-[#94A3B8]" />
                    <span>15 dəq təxirə sal</span>
                  </button>
                )}

                <div className="my-1 border-t border-white/[0.06]" />

                {/* Sil */}
                {!showDeleteConfirm ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs text-[#FF4D73] hover:bg-[#FF4D73]/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Sil</span>
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      setShowDeleteConfirm(false);
                      onDelete(reminder.id);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold bg-[#FF4D73] text-white hover:bg-[#FF4D73]/90 transition-colors"
                  >
                    <span>Təsdiq et (Sil)</span>
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
