import React, { useState, useEffect } from 'react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        id="edit-reminder-modal"
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-gradient-to-b from-[#111827] to-[#0F172A] p-6 shadow-2xl text-slate-50"
      >
        <button
          id="close-edit-modal-btn"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="font-bold text-lg text-white mb-4">Xatırlatmanı Redaktə Et</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Başlıq</label>
            <input
              id="edit-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Xatırlatmanın adı"
              className="w-full rounded-xl border border-white/5 bg-slate-800/40 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-violet-500/60 focus:outline-none transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Əlavə Qeyd (İxtiyari)</label>
            <textarea
              id="edit-desc-input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Məsələn: sənədləri götürməyi unutma"
              className="w-full resize-none rounded-xl border border-white/5 bg-slate-800/40 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-violet-500/60 focus:outline-none transition-colors"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Tarix</label>
              <input
                id="edit-date-input"
                type="date"
                required
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full rounded-xl border border-white/5 bg-slate-800/40 px-3 py-2 text-xs text-slate-100 focus:border-violet-500/60 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Saat</label>
              <input
                id="edit-time-input"
                type="time"
                required
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="w-full rounded-xl border border-white/5 bg-slate-800/40 px-3 py-2 text-xs text-slate-100 focus:border-violet-500/60 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Kateqoriya</label>
            <select
              id="edit-category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as ReminderCategory)}
              className="w-full rounded-xl border border-white/5 bg-slate-800/40 px-3 py-2 text-xs text-slate-100 focus:border-violet-500/60 focus:outline-none transition-colors"
            >
              {Object.values(CATEGORIES).map((cat) => (
                <option key={cat.id} value={cat.id} className="bg-slate-900 text-slate-100">
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Recurrence & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Təkrarlanma</label>
              <select
                id="edit-recurrence-select"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as ReminderRecurrence)}
                className="w-full rounded-xl border border-white/5 bg-slate-800/40 px-3 py-2 text-xs text-slate-100 focus:border-violet-500/60 focus:outline-none transition-colors"
              >
                <option value="none" className="bg-slate-900 text-slate-100">Təkrarlanmır</option>
                <option value="daily" className="bg-slate-900 text-slate-100">Hər gün</option>
                <option value="weekly" className="bg-slate-900 text-slate-100">Hər həftə</option>
                <option value="monthly" className="bg-slate-900 text-slate-100">Hər ay</option>
                <option value="yearly" className="bg-slate-900 text-slate-100">Hər il</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Prioritet</label>
              <select
                id="edit-priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as ReminderPriority)}
                className="w-full rounded-xl border border-white/5 bg-slate-800/40 px-3 py-2 text-xs text-slate-100 focus:border-violet-500/60 focus:outline-none transition-colors"
              >
                <option value="low" className="bg-slate-900 text-slate-100">Aşağı</option>
                <option value="medium" className="bg-slate-900 text-slate-100">Orta (Adi)</option>
                <option value="high" className="bg-slate-900 text-slate-100">Yüksək (Təcili)</option>
              </select>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              id="save-edit-reminder-btn"
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 py-2.5 text-xs font-bold text-white hover:brightness-110 active:scale-98 transition-all shadow-lg shadow-violet-500/25 border border-white/10"
            >
              <Save className="h-4 w-4" />
              Yadda Saxla
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
