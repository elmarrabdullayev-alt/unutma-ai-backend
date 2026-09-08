import { Reminder } from '../types';

const AZ_MONTHS_SHORT = [
  'Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn',
  'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'
];

const AZ_MONTHS_FULL = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun',
  'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'
];

const AZ_DAYS_SHORT = ['Baz', 'B.e', 'Ç.a', 'Çər', 'C.a', 'Cüm', 'Şən'];
const AZ_DAYS_FULL = [
  'Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə',
  'Cümə axşamı', 'Cümə', 'Şənbə'
];

export function formatDateAz(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const day = date.getDate();
  const month = AZ_MONTHS_FULL[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

export function formatTimeOnly(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function getRelativeTimeAz(dateStr: string): { label: string; isPast: boolean; isUrgent: boolean } {
  if (!dateStr) return { label: '', isPast: false, isUrgent: false };
  const target = new Date(dateStr);
  const now = new Date();
  if (isNaN(target.getTime())) return { label: '', isPast: false, isUrgent: false };

  const diffMs = target.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Check if same calendar day
  const isToday = isSameDay(target, now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = isSameDay(target, tomorrow);

  if (diffMs < 0) {
    const absMinutes = Math.abs(diffMinutes);
    if (absMinutes < 1) return { label: 'İndicə vaxtı keçdi', isPast: true, isUrgent: true };
    if (absMinutes < 60) return { label: `${absMinutes} dəqiqə əvvəl`, isPast: true, isUrgent: true };
    const absHours = Math.abs(diffHours);
    if (absHours < 24 && isToday) return { label: `Bugün, ${formatTimeOnly(dateStr)} (vaxtı keçib)`, isPast: true, isUrgent: true };
    return { label: `${Math.abs(diffDays)} gün əvvəl (${formatTimeOnly(dateStr)})`, isPast: true, isUrgent: true };
  }

  // Future
  if (diffMinutes <= 15) {
    return { label: `${diffMinutes} dəqiqə qaldı`, isPast: false, isUrgent: true };
  }
  if (diffMinutes < 60) {
    return { label: `${diffMinutes} dəqiqə sonra`, isPast: false, isUrgent: diffMinutes <= 30 };
  }
  if (isToday) {
    return { label: `Bugün, saat ${formatTimeOnly(dateStr)}`, isPast: false, isUrgent: diffHours <= 2 };
  }
  if (isTomorrow) {
    return { label: `Sabah, saat ${formatTimeOnly(dateStr)}`, isPast: false, isUrgent: false };
  }
  if (diffDays <= 7) {
    const dayName = AZ_DAYS_FULL[target.getDay()];
    return { label: `${dayName}, ${formatTimeOnly(dateStr)}`, isPast: false, isUrgent: false };
  }

  const day = target.getDate();
  const month = AZ_MONTHS_SHORT[target.getMonth()];
  return { label: `${day} ${month}, ${formatTimeOnly(dateStr)}`, isPast: false, isUrgent: false };
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function isReminderToday(r: Reminder): boolean {
  const target = new Date(r.dueDateTime);
  const now = new Date();
  return isSameDay(target, now);
}

export function isReminderTomorrow(r: Reminder): boolean {
  const target = new Date(r.dueDateTime);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameDay(target, tomorrow);
}

export function isReminderUpcoming(r: Reminder): boolean {
  const target = new Date(r.dueDateTime);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);
  return target.getTime() > tomorrow.getTime();
}

export function getGreetingAz(firstName?: string): string {
  const hour = new Date().getHours();
  const trimmed = firstName ? firstName.trim() : '';

  if (trimmed) {
    if (hour >= 5 && hour < 12) {
      return `Sabahın xeyir, ${trimmed}`;
    } else if (hour >= 12 && hour < 18) {
      return `Günortan xeyir, ${trimmed}`;
    } else {
      return `Axşamın xeyir, ${trimmed}`;
    }
  }

  if (hour >= 5 && hour < 12) {
    return 'Sabahın xeyir 👋';
  } else if (hour >= 12 && hour < 18) {
    return 'Hər vaxtın xeyir 👋';
  } else {
    return 'Axşamın xeyir 👋';
  }
}

export function getFormattedTodayAz(): string {
  const now = new Date();
  const day = now.getDate();
  const month = AZ_MONTHS_FULL[now.getMonth()];
  const dayName = AZ_DAYS_FULL[now.getDay()];
  return `${day} ${month}, ${dayName}`;
}

export function getShortWeekdayAz(date: Date): string {
  return AZ_DAYS_SHORT[date.getDay()];
}

export function getRecurrenceLabelAz(reminderOrRecurrence: Reminder | string): string {
  if (typeof reminderOrRecurrence === 'object' && reminderOrRecurrence !== null) {
    const r = reminderOrRecurrence;
    if (r.recurrenceInterval && r.recurrenceInterval > 1) {
      if (r.recurrenceUnit === 'day') return `Hər ${r.recurrenceInterval} gündən bir`;
      if (r.recurrenceUnit === 'week') return `Hər ${r.recurrenceInterval} həftədən bir`;
      if (r.recurrenceUnit === 'month') return `Hər ${r.recurrenceInterval} aydan bir`;
      if (r.recurrenceUnit === 'year') return `Hər ${r.recurrenceInterval} ildən bir`;
    }
    if (r.recurrenceDayOfMonth) {
      return `Hər ayın ${r.recurrenceDayOfMonth}-i`;
    }
    if (r.recurrenceDays && r.recurrenceDays.length === 1) {
      const dayNames = ['bazar', 'bazar ertəsi', 'çərşənbə axşamı', 'çərşənbə', 'cümə axşamı', 'cümə', 'şənbə'];
      return `Hər ${dayNames[r.recurrenceDays[0]]}`;
    }
    return getRecurrenceLabelAz(r.recurrence);
  }

  switch (reminderOrRecurrence) {
    case 'daily':
      return 'Hər gün';
    case 'weekly':
      return 'Hər həftə';
    case 'monthly':
      return 'Hər ay';
    case 'yearly':
      return 'Hər il';
    case 'weekdays':
      return 'Həftəiçi';
    default:
      return '';
  }
}

export function isReminderPast(r: Reminder): boolean {
  const target = new Date(r.dueDateTime);
  return target.getTime() < Date.now();
}

export type ReminderUrgencyStatus = 'completed' | 'overdue' | 'nearDue' | 'normal';

/**
 * Calculates the next visible occurrence Date for a reminder,
 * properly projecting recurring patterns (daily, weekly, weekdays, monthly, yearly, custom interval).
 */
export function getNextOccurrenceDate(reminder: Reminder, now: Date = new Date()): Date {
  const base = new Date(reminder.dueDateTime);
  if (isNaN(base.getTime())) return base;

  if (!reminder.recurrence || reminder.recurrence === 'none') {
    return base;
  }

  // If the stored dueDateTime is still in the future or equal to now, that is the current visible occurrence
  if (base.getTime() >= now.getTime()) {
    return base;
  }

  // If past and recurring, project forward to find the next occurrence strictly >= now
  const next = new Date(base);
  const nowMs = now.getTime();
  const maxIterations = 500;
  let iterations = 0;

  const rec = reminder.recurrence;
  const interval = reminder.recurrenceInterval && reminder.recurrenceInterval > 0 ? reminder.recurrenceInterval : 1;
  const unit = reminder.recurrenceUnit || (rec === 'weekly' ? 'week' : rec === 'monthly' ? 'month' : rec === 'yearly' ? 'year' : 'day');

  while (next.getTime() < nowMs && iterations < maxIterations) {
    iterations++;
    if (rec === 'custom') {
      if (unit === 'day') next.setDate(next.getDate() + interval);
      else if (unit === 'week') next.setDate(next.getDate() + interval * 7);
      else if (unit === 'month') {
        next.setMonth(next.getMonth() + interval);
        if (reminder.recurrenceDayOfMonth) next.setDate(reminder.recurrenceDayOfMonth);
      } else if (unit === 'year') {
        next.setFullYear(next.getFullYear() + interval);
      } else {
        next.setDate(next.getDate() + interval);
      }
    } else if (rec === 'daily') {
      next.setDate(next.getDate() + 1);
    } else if (rec === 'weekly') {
      next.setDate(next.getDate() + 7);
    } else if (rec === 'weekdays') {
      next.setDate(next.getDate() + 1);
      const d = next.getDay();
      if (d === 0) next.setDate(next.getDate() + 1); // Sunday -> Monday
      else if (d === 6) next.setDate(next.getDate() + 2); // Saturday -> Monday
    } else if (rec === 'monthly') {
      next.setMonth(next.getMonth() + 1);
      if (reminder.recurrenceDayOfMonth) next.setDate(reminder.recurrenceDayOfMonth);
    } else if (rec === 'yearly') {
      next.setFullYear(next.getFullYear() + 1);
    } else {
      break;
    }
  }

  return next;
}

/**
 * Returns whether a reminder is due within the next 2 hours:
 * - reminder.isCompleted === false
 * - dueDateTime >= now
 * - dueDateTime <= now + 2 hours
 * For recurring reminders, calculates based on visible next occurrence.
 */
export function isNearDue(reminder: Reminder, now: Date = new Date()): boolean {
  return getReminderUrgencyStatus(reminder, now) === 'nearDue';
}

/**
 * Evaluates urgency status with strict priority:
 * 1. completed
 * 2. overdue
 * 3. nearDue (within next 2 hours)
 * 4. normal
 */
export function getReminderUrgencyStatus(reminder: Reminder, now: Date = new Date()): ReminderUrgencyStatus {
  // 1. completed: highest priority
  if (reminder.isCompleted) {
    return 'completed';
  }

  // Check if past for non-recurring or active instance
  const originalDue = new Date(reminder.dueDateTime);
  const isOriginalPast = !isNaN(originalDue.getTime()) && originalDue.getTime() < now.getTime();

  // If non-recurring and past, it is overdue
  if ((!reminder.recurrence || reminder.recurrence === 'none') && isOriginalPast) {
    return 'overdue';
  }

  // Calculate visible occurrence (handles recurring projection)
  const occurrence = getNextOccurrenceDate(reminder, now);
  const diffMs = occurrence.getTime() - now.getTime();
  const twoHoursMs = 2 * 60 * 60 * 1000;

  // 2. overdue: if occurrence is in the past
  if (diffMs < 0) {
    return 'overdue';
  }

  // 3. nearDue: if occurrence is within next 2 hours (0 <= diffMs <= 2 hours)
  if (diffMs <= twoHoursMs) {
    return 'nearDue';
  }

  // 4. normal
  return 'normal';
}
