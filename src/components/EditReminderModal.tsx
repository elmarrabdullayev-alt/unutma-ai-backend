import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Save,
  Clock,
  Calendar,
  AlertTriangle,
  Repeat,
  Tag,
  Check,
} from 'lucide-react';
import { Reminder, ReminderCategory, ReminderRecurrence, ReminderPriority } from '../types';
import { CATEGORIES } from '../utils/categoryMeta';
import { sheetVariants } from '../utils/motion';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface EditReminderModalProps {
  reminder: Reminder | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedReminder: Reminder) => void;
}

export const EditReminderModal: React.FC<EditReminderModalProps> = ({
  reminder,
  isOpen,
  onClose,
  onSave,
}) => {
  useEscapeKey(onClose);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('10:00');
  const [category, setCategory] = useState<ReminderCategory>('other');
  const [recurrence, setRecurrence] = useState<ReminderRecurrence>('none');
  const [priority, setPriority] = useState<ReminderPriority>('medium');

  useEffect(() => {
    if (reminder) {
      setTitle(reminder.title);
      setDescription(reminder.description || '');
      const d = new Date(reminder.dueDateTime);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        setDateStr(`${year}-${month}-${day}`);
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        setTimeStr(`${hours}:${minutes}`);
      }
      setCategory(reminder.category);
      setRecurrence(reminder.recurrence);
      setPriority(reminder.priority);
    }
  }, [reminder, isOpen]);

  if (!isOpen || !reminder) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Construct ISO string
    let newDueDateTime = reminder.dueDateTime;
    if (dateStr && timeStr) {
      const [y, m, d] = dateStr.split('-').map(Number);
      const [h, min] = timeStr.split(':').map(Number);
      const newDate = new Date(y, m - 1, d, h, min, 0);
      newDueDateTime = newDate.toISOString();
    }

    const updated: Reminder = {
      ...reminder,
      title: title.trim(),
      description: description.trim(),
      dueDateTime: newDueDateTime,
      category,
      recurrence,
      priority,
    };

    onSave(updated);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/70 backdrop-blur-sm"
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 24px)' }}
      onClick={onClose}
    >
      {/* Bottom sheet: rises with a spring, can be dragged down to dismiss */}
      <motion.div
        variants={sheetVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120 || info.velocity.y > 600) onClose();
        }}
        onClick={(e) => e.stopPropagation()}
        id="edit-reminder-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-reminder-title"
        className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-t-[32px] border border-b-0 border-white/10 bg-ink-900 px-6 pt-3 text-ink-50 shadow-[0_-24px_60px_-20px_rgba(0,0,0,0.9)]"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
      >
        <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/15" />
        <motion.button
          whileTap={{ scale: 0.98 }}
          whileHover={{ scale: 1.02 }}
          id="close-edit-modal-btn"
          onClick={onClose}
          aria-label="Bağla"
          className="absolute right-3.5 top-3.5 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-ink-800/80 text-ink-400 hover:bg-ink-700 hover:text-white transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </motion.button>

        <h3 id="edit-reminder-title" className="font-display text-[26px] leading-tight text-ink-50 mb-5 pr-12">Xatırlatmanı redaktə et</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-ink-400 mb-1">Başlıq</label>
            <input
              id="edit-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Xatırlatmanın adı"
              className="w-full rounded-xl border border-white/5 bg-ink-800/40 px-3 py-2 text-xs text-ink-100 placeholder-ink-500 focus:border-zer-500/60 focus:outline-none transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-ink-400 mb-1">Əlavə Qeyd (İxtiyari)</label>
            <textarea
              id="edit-desc-input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Məsələn: sənədləri götürməyi unutma"
              className="w-full resize-none rounded-xl border border-white/5 bg-ink-800/40 px-3 py-2 text-xs text-ink-100 placeholder-ink-500 focus:border-zer-500/60 focus:outline-none transition-colors"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-400 mb-1">Tarix</label>
              <input
                id="edit-date-input"
                type="date"
                required
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full rounded-xl border border-white/5 bg-ink-800/40 px-3 py-2 text-xs text-ink-100 focus:border-zer-500/60 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-400 mb-1">Saat</label>
              <input
                id="edit-time-input"
                type="time"
                required
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="w-full rounded-xl border border-white/5 bg-ink-800/40 px-3 py-2 text-xs text-ink-100 focus:border-zer-500/60 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-ink-400 mb-1">Kateqoriya</label>
            <select
              id="edit-category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as ReminderCategory)}
              className="w-full rounded-xl border border-white/5 bg-ink-800/40 px-3 py-2 text-xs text-ink-100 focus:border-zer-500/60 focus:outline-none transition-colors"
            >
              {Object.values(CATEGORIES).map((cat) => (
                <option key={cat.id} value={cat.id} className="bg-ink-900 text-ink-100">
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Recurrence & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-400 mb-1">Təkrarlanma</label>
              <select
                id="edit-recurrence-select"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as ReminderRecurrence)}
                className="w-full rounded-xl border border-white/5 bg-ink-800/40 px-3 py-2 text-xs text-ink-100 focus:border-zer-500/60 focus:outline-none transition-colors"
              >
                <option value="none" className="bg-ink-900 text-ink-100">Təkrarlanmır</option>
                <option value="daily" className="bg-ink-900 text-ink-100">Hər gün</option>
                <option value="weekly" className="bg-ink-900 text-ink-100">Hər həftə</option>
                <option value="monthly" className="bg-ink-900 text-ink-100">Hər ay</option>
                <option value="yearly" className="bg-ink-900 text-ink-100">Hər il</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-400 mb-1">Prioritet</label>
              <select
                id="edit-priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as ReminderPriority)}
                className="w-full rounded-xl border border-white/5 bg-ink-800/40 px-3 py-2 text-xs text-ink-100 focus:border-zer-500/60 focus:outline-none transition-colors"
              >
                <option value="low" className="bg-ink-900 text-ink-100">Aşağı</option>
                <option value="medium" className="bg-ink-900 text-ink-100">Orta (Adi)</option>
                <option value="high" className="bg-ink-900 text-ink-100">Yüksək (Təcili)</option>
              </select>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <motion.button
              whileTap={{ scale: 0.98 }}
              whileHover={{ scale: 1.01 }}
              id="save-edit-reminder-btn"
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold btn-gold text-ink-950 hover:brightness-110 transition-all shadow-lg shadow-zer-500/25 border border-white/10"
            >
              <Save className="h-4 w-4" />
              Yadda Saxla
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
