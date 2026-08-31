import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Repeat,
  CheckCircle,
  Search,
  Plus,
  Mic,
  Flame,
} from 'lucide-react';
import { Reminder, TabFilter, ReminderCategory } from '../types';
import { ReminderCard } from './ReminderCard';
import { CATEGORIES } from '../utils/categoryMeta';
import { isReminderToday, isReminderTomorrow, isReminderUpcoming } from '../utils/dateUtils';

interface ReminderListProps {
  reminders: Reminder[];
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  onSnooze: (id: string, minutes: number) => void;
  onOpenVoice: () => void;
  onOpenManualAdd: () => void;
  onClearCompleted: () => void;
}

export const ReminderList: React.FC<ReminderListProps> = ({
  reminders,
  onToggleComplete,
  onDelete,
  onEdit,
  onSnooze,
  onOpenVoice,
  onOpenManualAdd,
  onClearCompleted,
}) => {
  const [activeTab, setActiveTab] = useState<TabFilter>('today');
  const [selectedCategory, setSelectedCategory] = useState<ReminderCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Counts
  const todayReminders = reminders.filter((r) => !r.isCompleted && isReminderToday(r));
  const tomorrowReminders = reminders.filter((r) => !r.isCompleted && isReminderTomorrow(r));
  const upcomingReminders = reminders.filter((r) => !r.isCompleted && isReminderUpcoming(r));
  const recurringReminders = reminders.filter((r) => !r.isCompleted && r.recurrence !== 'none');
  const completedReminders = reminders.filter((r) => r.isCompleted);

  // Filter based on tab, category, and search
  const filteredReminders = reminders.filter((r) => {
    // Search match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = r.title.toLowerCase().includes(q);
      const matchDesc = (r.description || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }

    // Category match
    if (selectedCategory !== 'all' && r.category !== selectedCategory) {
      return false;
    }

    // Tab match
    switch (activeTab) {
      case 'today':
        return !r.isCompleted && isReminderToday(r);
      case 'tomorrow':
        return !r.isCompleted && isReminderTomorrow(r);
      case 'upcoming':
        return !r.isCompleted && isReminderUpcoming(r);
      case 'recurring':
        return !r.isCompleted && r.recurrence !== 'none';
      case 'completed':
        return r.isCompleted;
      default:
        return true;
    }
  });

  // Sort by due date ascending
  const sortedReminders = [...filteredReminders].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    return new Date(a.dueDateTime).getTime() - new Date(b.dueDateTime).getTime();
  });

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4 sm:px-6">
      {/* Top Main Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-white/5 mb-4">
        <button
          id="tab-today-btn"
          onClick={() => setActiveTab('today')}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'today'
              ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 border border-white/10'
              : 'bg-slate-800/40 text-slate-400 border border-white/5 hover:bg-slate-800/70 hover:text-slate-200'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          Bugün
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
              activeTab === 'today' ? 'bg-white/20 text-white' : 'bg-slate-700/60 text-slate-300'
            }`}
          >
            {todayReminders.length}
          </span>
        </button>

        <button
          id="tab-tomorrow-btn"
          onClick={() => setActiveTab('tomorrow')}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'tomorrow'
              ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 border border-white/10'
              : 'bg-slate-800/40 text-slate-400 border border-white/5 hover:bg-slate-800/70 hover:text-slate-200'
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          Sabah
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
              activeTab === 'tomorrow' ? 'bg-white/20 text-white' : 'bg-slate-700/60 text-slate-300'
            }`}
          >
            {tomorrowReminders.length}
          </span>
        </button>

        <button
          id="tab-upcoming-btn"
          onClick={() => setActiveTab('upcoming')}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'upcoming'
              ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 border border-white/10'
              : 'bg-slate-800/40 text-slate-400 border border-white/5 hover:bg-slate-800/70 hover:text-slate-200'
          }`}
        >
          <Flame className="h-3.5 w-3.5" />
          Yaxınlaşan
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
              activeTab === 'upcoming' ? 'bg-white/20 text-white' : 'bg-slate-700/60 text-slate-300'
            }`}
          >
            {upcomingReminders.length}
          </span>
        </button>

        <button
          id="tab-recurring-btn"
          onClick={() => setActiveTab('recurring')}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'recurring'
              ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 border border-white/10'
              : 'bg-slate-800/40 text-slate-400 border border-white/5 hover:bg-slate-800/70 hover:text-slate-200'
          }`}
        >
          <Repeat className="h-3.5 w-3.5" />
          Təkrarlanan
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
              activeTab === 'recurring' ? 'bg-white/20 text-white' : 'bg-slate-700/60 text-slate-300'
            }`}
          >
            {recurringReminders.length}
          </span>
        </button>

        <button
          id="tab-completed-btn"
          onClick={() => setActiveTab('completed')}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'completed'
              ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 border border-white/10'
              : 'bg-slate-800/40 text-slate-400 border border-white/5 hover:bg-slate-800/70 hover:text-slate-200'
          }`}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Bitmiş
          {completedReminders.length > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeTab === 'completed' ? 'bg-white/20 text-white' : 'bg-slate-700/60 text-slate-300'
              }`}
            >
              {completedReminders.length}
            </span>
          )}
        </button>
      </div>

      {/* Search & Category Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            id="search-reminders-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Xatırlatmalarda axtarış..."
            className="w-full rounded-2xl border border-white/5 bg-slate-800/40 pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-violet-500/50 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`rounded-xl px-3 py-1.5 text-[11px] font-medium transition-all ${
              selectedCategory === 'all'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                : 'bg-slate-800/40 text-slate-400 border border-white/5 hover:text-slate-200'
            }`}
          >
            Bütün kateqoriyalar
          </button>
          {Object.values(CATEGORIES).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-xl px-3 py-1.5 text-[11px] font-medium transition-all ${
                selectedCategory === cat.id
                  ? `${cat.bgColor} border font-semibold`
                  : 'bg-slate-800/40 text-slate-400 border border-white/5 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section Header */}
      <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-300">
            {activeTab === 'today'
              ? 'Bugün'
              : activeTab === 'tomorrow'
              ? 'Sabah'
              : activeTab === 'upcoming'
              ? 'Yaxınlaşan'
              : activeTab === 'recurring'
              ? 'Təkrarlanan'
              : 'Bitmiş'}
          </span>
          <span className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider">
            {sortedReminders.length} {sortedReminders.length === 1 ? 'TAPŞIRIQ' : 'TAPŞIRIQ'}
          </span>
        </div>

        {activeTab === 'completed' && completedReminders.length > 0 && (
          <button
            id="clear-completed-btn"
            onClick={onClearCompleted}
            className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
          >
            Bitmişləri təmizlə
          </button>
        )}
      </div>

      {/* Reminder Cards List */}
      {sortedReminders.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {sortedReminders.map((reminder) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              onToggleComplete={onToggleComplete}
              onDelete={onDelete}
              onEdit={onEdit}
              onSnooze={onSnooze}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-slate-800/20 p-8 text-center my-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 border border-violet-500/20 mb-3 shadow-lg shadow-violet-500/10">
            <Mic className="h-7 w-7 animate-pulse" />
          </div>

          <h4 className="text-base font-semibold text-white">
            {searchQuery
              ? 'Axtarışa uyğun xatırlatma tapılmadı'
              : activeTab === 'today'
              ? 'Bugün üçün heç bir xatırlatma yoxdur'
              : activeTab === 'tomorrow'
              ? 'Sabah üçün xatırlatma yoxdur'
              : activeTab === 'completed'
              ? 'Hələ bitmiş xatırlatma yoxdur'
              : 'Xatırlatma siyahısı boşdur'}
          </h4>

          <p className="mt-1 text-xs text-slate-400 max-w-sm">
            “De, Unutma AI xatırlasın.” Səsli düyməyə toxunaraq xatırlatmalı olduğunuz hər şeyi bir cümlədə söyləyin.
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <button
              id="empty-state-voice-btn"
              onClick={onOpenVoice}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-500/25 border border-white/10 hover:brightness-110 active:scale-95 transition-all"
            >
              <Mic className="h-4 w-4" />
              Səslə Xatırlatma Yarat
            </button>

            <button
              id="empty-state-manual-btn"
              onClick={onOpenManualAdd}
              className="flex items-center gap-1.5 rounded-2xl border border-white/5 bg-slate-800/60 px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Yazılı əlavə et
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
