import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Reminder } from '../types';
import { MobileReminderCard } from './MobileReminderCard';
import { isSameDay } from '../utils/dateUtils';

interface CalendarScreenProps {
  reminders: Reminder[];
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  onSnooze: (id: string, minutes: number) => void;
  onFocus?: (reminder: Reminder) => void;
  onOpenVoice: () => void;
  onOpenManualAdd: () => void;
}

const AZ_MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun',
  'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'
];

const AZ_DAYS_SHORT = ['B', 'BE', 'ÇA', 'Ç', 'CA', 'C', 'Ş'];

export const CalendarScreen: React.FC<CalendarScreenProps> = ({
  reminders,
  onToggleComplete,
  onDelete,
  onEdit,
  onSnooze,
  onFocus,
  onOpenVoice,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Generate 7-day strip centered around selected week
  const getWeekDates = () => {
    const dates: Date[] = [];
    const base = new Date(selectedDate);
    const dayOfWeek = base.getDay(); // 0 is Sunday
    const startOfWeek = new Date(base);
    startOfWeek.setDate(base.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); // Start on Monday

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  const selectedDayReminders = reminders.filter((r) => {
    const rDate = new Date(r.dueDateTime);
    return isSameDay(rDate, selectedDate);
  });

  const changeDayBy = (offset: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + offset);
    setSelectedDate(next);
  };

  return (
    <div className="w-full px-4 pt-2 pb-6 space-y-4">
      {/* Top Native Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F5F6FA]">
            Təqvim
          </h1>
          <p className="text-xs font-normal text-[#94A3B8] mt-0.5">
            {AZ_MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </p>
        </div>

        <button
          onClick={() => setSelectedDate(new Date())}
          className="rounded-[12px] border border-[#7C3AED]/30 bg-[#7C3AED]/15 px-3 py-1.5 text-xs font-medium text-[#A78BFA] active:scale-95 transition-all"
        >
          Bu gün
        </button>
      </div>

      {/* Horizontal Mobile 7-Day Date Selector */}
      <div className="rounded-[18px] border border-white/[0.06] bg-[#121827] p-2 shadow-sm">
        <div className="flex items-center justify-between gap-1">
          {weekDates.map((date, idx) => {
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, new Date());
            const hasReminders = reminders.some(
              (r) => !r.isCompleted && isSameDay(new Date(r.dueDateTime), date)
            );

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(date)}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-[14px] transition-all duration-150 relative ${
                  isSelected
                    ? 'bg-[#7C3AED] text-white shadow-sm'
                    : isToday
                    ? 'bg-[#0D1220] text-[#A78BFA] border border-[#7C3AED]/30'
                    : 'text-[#94A3B8] hover:text-[#F5F6FA]'
                }`}
              >
                <span className="text-[10px] font-medium uppercase opacity-80">
                  {AZ_DAYS_SHORT[date.getDay()]}
                </span>
                <span className="text-sm font-semibold mt-0.5">{date.getDate()}</span>

                {/* Event Dot */}
                {hasReminders && (
                  <span
                    className={`h-1 w-1 rounded-full mt-1 ${
                      isSelected ? 'bg-white' : 'bg-[#A78BFA]'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Agenda Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-[#A78BFA]" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#F5F6FA]">
            {selectedDate.getDate()} {AZ_MONTHS[selectedDate.getMonth()]} qrafiki
          </h2>
          <span className="text-[10px] font-normal text-[#94A3B8]">
            ({selectedDayReminders.length})
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => changeDayBy(-1)}
            aria-label="Əvvəlki gün"
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => changeDayBy(1)}
            aria-label="Növbəti gün"
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Daily Timeline Reminders */}
      <div className="space-y-2">
        {selectedDayReminders.length > 0 ? (
          selectedDayReminders.map((r) => (
            <MobileReminderCard
              key={r.id}
              reminder={r}
              onToggleComplete={onToggleComplete}
              onDelete={onDelete}
              onEdit={onEdit}
              onSnooze={onSnooze}
              onFocus={onFocus}
            />
          ))
        ) : (
          <div className="rounded-[18px] border border-white/[0.04] bg-[#121827] p-8 text-center">
            <Clock className="h-7 w-7 text-[#94A3B8] mx-auto mb-2 opacity-60" />
            <p className="text-xs font-medium text-[#F5F6FA]">
              Bu tarixdə xatırlatma yoxdur
            </p>
            <button
              onClick={onOpenVoice}
              className="mt-3 inline-flex items-center gap-1.5 rounded-[14px] bg-[#7C3AED]/20 border border-[#7C3AED]/30 px-3.5 py-1.5 text-xs font-medium text-[#A78BFA] hover:bg-[#7C3AED]/30 active:scale-95 transition-all"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Xatırlatma əlavə et</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
