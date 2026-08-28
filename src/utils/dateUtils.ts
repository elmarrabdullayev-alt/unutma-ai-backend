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

export function getGreetingAz(): string {
  const hour = new Date().getHours();
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

export function getRecurrenceLabelAz(recurrence: string): string {
  switch (recurrence) {
    case 'daily':
      return 'Hər gün';
    case 'weekly':
      return 'Hər həftə';
    case 'monthly':
      return 'Hər ay';
    case 'yearly':
      return 'Hər il';
    default:
      return '';
  }
}

export function isReminderPast(r: Reminder): boolean {
  const target = new Date(r.dueDateTime);
  return target.getTime() < Date.now();
}
