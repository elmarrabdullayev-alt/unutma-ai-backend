/**
 * Plain, deterministic day helpers (no AI call, works offline):
 * - urgency labels: "Təcili" / "Vacib" / "Gözləyə bilər"
 * - end-of-day summary: "Bu gün 7 işdən 5-i tamamlandı, 2-si sabaha qaldı."
 * - morning briefing: "Bu gün 2 görüşün, 4 tapşırığın və 1 rutin var."
 * - energy mode: when the user says they are tired, light tasks come first
 *   and heavy ones are offered for another day.
 */
import type { Reminder } from '../types';

export type Urgency = 'urgent' | 'important' | 'later';

export const URGENCY_LABEL: Record<Urgency, string> = {
  urgent: 'Təcili',
  important: 'Vacib',
  later: 'Gözləyə bilər',
};

/** Due within this window (or already overdue) and high priority → "Təcili". */
const URGENT_WINDOW_MS = 2 * 60 * 60 * 1000;

const MEETING_TITLE = /(görüş|gorus|iclas|meeting)/i;

function sameDay(iso: string, day: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
}

export function getUrgency(r: Reminder, now: Date): Urgency {
  const due = new Date(r.dueDateTime).getTime();
  if (r.priority === 'high' && due - now.getTime() <= URGENT_WINDOW_MS) return 'urgent';
  if (r.priority === 'high') return 'important';
  return 'later';
}

/** Sorts active items: urgent first, then by due time. Completed items go last. */
export function sortByUrgency(items: Reminder[], now: Date): Reminder[] {
  const rank: Record<Urgency, number> = { urgent: 0, important: 1, later: 2 };
  return [...items].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return Number(a.isCompleted) - Number(b.isCompleted);
    const byUrgency = rank[getUrgency(a, now)] - rank[getUrgency(b, now)];
    if (byUrgency !== 0) return byUrgency;
    return new Date(a.dueDateTime).getTime() - new Date(b.dueDateTime).getTime();
  });
}

export interface DaySummary {
  total: number;
  done: number;
  leftover: number;
  message: string;
}

/** End-of-day summary for `day` (defaults to today). Leftovers are the unfinished items of that day. */
export function buildDaySummary(reminders: Reminder[], day: Date): DaySummary {
  const items = reminders.filter((r) => sameDay(r.dueDateTime, day));
  const done = items.filter((r) => r.isCompleted).length;
  const leftover = items.length - done;

  let message: string;
  if (items.length === 0) {
    message = 'Bu gün üçün plan yox idi.';
  } else if (leftover === 0) {
    message = `Bu gün ${items.length} işin hamısını tamamladın. Əla!`;
  } else {
    message = `Bu gün ${items.length} işdən ${done} tamamladın, ${leftover} iş sabaha qaldı.`;
  }
  return { total: items.length, done, leftover, message };
}

export interface MorningBriefing {
  meetings: number;
  tasks: number;
  routines: number;
  message: string;
}

/** Morning overview of unfinished items due today. `routineCount` is supplied by the caller. */
export function buildMorningBriefing(reminders: Reminder[], now: Date, routineCount: number): MorningBriefing {
  const pending = reminders.filter((r) => !r.isCompleted && sameDay(r.dueDateTime, now));
  const meetings = pending.filter((r) => r.category === 'work' || MEETING_TITLE.test(r.title)).length;
  const tasks = pending.length - meetings;

  const parts: string[] = [];
  if (meetings) parts.push(`${meetings} görüşün`);
  if (tasks) parts.push(`${tasks} tapşırığın`);
  if (routineCount) parts.push(`${routineCount} rutin`);

  const message = parts.length === 0
    ? 'Bu gün üçün planın boşdur. Rahat bir gün keçir.'
    : `Bu gün ${parts.join(', ')} var.`;
  return { meetings, tasks, routines: routineCount, message };
}

export interface EnergyPlan {
  ordered: Reminder[];
  /** Heavy items (high priority, work) suggested for another day. */
  moveLater: Reminder[];
  message: string;
}

/**
 * Tired mode: light items first, heavy ones offered for another day.
 * Nothing is moved automatically; the user decides.
 */
export function planForEnergy(items: Reminder[], now: Date, tired: boolean): EnergyPlan {
  const active = items.filter((r) => !r.isCompleted);
  if (!tired) {
    return { ordered: sortByUrgency(active, now), moveLater: [], message: '' };
  }
  const isHeavy = (r: Reminder) => r.priority === 'high' || (r.category === 'work' && r.priority !== 'low');
  const light = sortByUrgency(active.filter((r) => !isHeavy(r)), now);
  const heavy = sortByUrgency(active.filter(isHeavy), now);
  const message = heavy.length
    ? `Yorğun olduğun üçün yüngül işlər önə keçirildi. ${heavy.length} ağır işi başqa vaxta keçirmək olar. Keçirim?`
    : 'Yorğun olduğun üçün yüngül işlər önə keçirildi.';
  return { ordered: [...light, ...heavy], moveLater: heavy, message };
}
