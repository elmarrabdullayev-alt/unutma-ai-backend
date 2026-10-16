import { Reminder } from '../types';

type RecurringFields = Pick<
  Reminder,
  'dueDateTime' | 'recurrence' | 'recurrenceInterval' | 'recurrenceUnit' | 'recurrenceDayOfMonth'
>;

/** Adds months without overflowing (Jan 31 + 1 month = Feb 28/29, not Mar 3). */
export function addMonthsClamped(date: Date, months: number, dayOfMonth?: number): Date {
  const result = new Date(date);
  const wantedDay = dayOfMonth || date.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(wantedDay, lastDay));
  return result;
}

/**
 * Returns the occurrence that follows `from` for a recurring reminder,
 * or null when the reminder does not repeat.
 */
export function getNextOccurrence(r: RecurringFields, from: Date): Date | null {
  const next = new Date(from);

  // Only "custom" uses interval/unit. (The local parser also fills interval=1 /
  // unit='day' on daily, weekly and *weekdays* reminders, so trusting those
  // fields for other types would turn "weekdays" into "every day".)
  if (r.recurrence === 'custom') {
    const n = Math.max(1, r.recurrenceInterval || 1);
    switch (r.recurrenceUnit || 'day') {
      case 'day':
        next.setDate(next.getDate() + n);
        return next;
      case 'week':
        next.setDate(next.getDate() + n * 7);
        return next;
      case 'month':
        return addMonthsClamped(next, n, r.recurrenceDayOfMonth);
      case 'year':
        next.setFullYear(next.getFullYear() + n);
        return next;
      default:
        return null;
    }
  }

  switch (r.recurrence) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      return next;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      return next;
    case 'monthly':
      return addMonthsClamped(next, 1, r.recurrenceDayOfMonth);
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      return next;
    case 'weekdays': {
      const day = next.getDay();
      next.setDate(next.getDate() + (day === 5 ? 3 : day === 6 ? 2 : 1));
      return next;
    }
    default:
      return null;
  }
}

/** True when the reminder repeats in any way. */
export function isRecurring(r: Pick<Reminder, 'recurrence'>): boolean {
  return !!r.recurrence && r.recurrence !== 'none';
}

/**
 * Simplifies a recurrence to one of the shapes the OS can repeat natively
 * ("every day at 10:00", "every Monday at 10:00", "every 15th at 10:00", ...).
 * Returns null for shapes that need app-side scheduling (every 3 days, yearly, ...).
 */
export function getNativeRepeatKind(
  r: RecurringFields
): 'daily' | 'weekly' | 'monthly' | 'weekdays' | null {
  const interval = r.recurrenceInterval || 1;
  if (r.recurrence === 'daily') return 'daily';
  if (r.recurrence === 'weekly') return 'weekly';
  if (r.recurrence === 'monthly') return 'monthly';
  if (r.recurrence === 'weekdays') return 'weekdays';
  if (r.recurrence === 'custom' && interval === 1) {
    if (r.recurrenceUnit === 'day') return 'daily';
    if (r.recurrenceUnit === 'week') return 'weekly';
    if (r.recurrenceUnit === 'month') return 'monthly';
  }
  return null;
}
