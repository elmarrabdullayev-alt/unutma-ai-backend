import { Reminder, ReminderConflict, ExtractedReminderDraft } from '../types';

/**
 * Checks if two dates fall on the exact same minute
 */
export function areExactSameDateTime(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate() &&
    d1.getHours() === d2.getHours() &&
    d1.getMinutes() === d2.getMinutes()
  );
}

/**
 * Determines whether a reminder occurs on a specific target Date,
 * taking recurring rules into account.
 */
export function doesReminderOccurOn(
  reminder: Reminder | ExtractedReminderDraft | { dueDateTime: string; recurrence?: string; recurrenceInterval?: number; recurrenceUnit?: string; recurrenceDayOfMonth?: number },
  targetDate: Date
): boolean {
  const remDate = new Date(reminder.dueDateTime);
  if (isNaN(remDate.getTime()) || isNaN(targetDate.getTime())) return false;

  // Exact same minute match
  if (
    targetDate.getHours() !== remDate.getHours() ||
    targetDate.getMinutes() !== remDate.getMinutes()
  ) {
    return false;
  }

  const tStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const rStart = new Date(remDate.getFullYear(), remDate.getMonth(), remDate.getDate());

  // Can't occur before start date
  if (tStart.getTime() < rStart.getTime()) {
    return false;
  }

  const diffDays = Math.round((tStart.getTime() - rStart.getTime()) / (1000 * 60 * 60 * 24));

  const rec = (reminder as any).recurrence;
  if (!rec || rec === 'none') {
    return diffDays === 0;
  }

  if (rec === 'daily') {
    return true;
  }

  if (rec === 'weekly') {
    return diffDays % 7 === 0;
  }

  if (rec === 'weekdays') {
    const day = targetDate.getDay();
    return day >= 1 && day <= 5;
  }

  if (rec === 'monthly') {
    const dayOfMonth = (reminder as any).recurrenceDayOfMonth || remDate.getDate();
    return targetDate.getDate() === dayOfMonth;
  }

  if (rec === 'yearly') {
    return targetDate.getMonth() === remDate.getMonth() && targetDate.getDate() === remDate.getDate();
  }

  if (rec === 'custom') {
    const unit = (reminder as any).recurrenceUnit || 'day';
    const interval = (reminder as any).recurrenceInterval || 1;
    if (unit === 'day') {
      return diffDays % interval === 0;
    }
    if (unit === 'week') {
      return diffDays % (interval * 7) === 0;
    }
    if (unit === 'month') {
      const monthDiff = (targetDate.getFullYear() - remDate.getFullYear()) * 12 + (targetDate.getMonth() - remDate.getMonth());
      return monthDiff >= 0 && monthDiff % interval === 0 && targetDate.getDate() === remDate.getDate();
    }
  }

  return diffDays === 0;
}

/**
 * Finds next free 30-min slot on the same day without any conflicts
 */
export function findAlternativeSlot(
  baseDueDateTimeStr: string,
  existingReminders: Reminder[],
  extraReservedSlots: Date[] = []
): { iso: string; time: string } {
  const base = new Date(baseDueDateTimeStr);

  for (let offsetMinutes = 30; offsetMinutes <= 360; offsetMinutes += 30) {
    const candidateSlot = new Date(base.getTime() + offsetMinutes * 60 * 1000);
    const hasConflictWithExisting = existingReminders.some(
      (r) => !r.isCompleted && doesReminderOccurOn(r, candidateSlot)
    );
    const hasConflictWithBatch = extraReservedSlots.some((d) => areExactSameDateTime(d, candidateSlot));

    if (!hasConflictWithExisting && !hasConflictWithBatch) {
      const h = candidateSlot.getHours().toString().padStart(2, '0');
      const m = candidateSlot.getMinutes().toString().padStart(2, '0');
      return { iso: candidateSlot.toISOString(), time: `${h}:${m}` };
    }
  }

  const fallback = new Date(base.getTime() + 30 * 60 * 1000);
  const h = fallback.getHours().toString().padStart(2, '0');
  const m = fallback.getMinutes().toString().padStart(2, '0');
  return { iso: fallback.toISOString(), time: `${h}:${m}` };
}

export class ConflictDetector {
  /**
   * Checks candidates against existing active reminders and against each other in the batch.
   * Returns list of conflicts with structured information and suggested alternative times.
   */
  public detectConflicts(
    candidates: Array<ExtractedReminderDraft | Reminder | any>,
    existingReminders: Reminder[]
  ): ReminderConflict[] {
    const conflicts: ReminderConflict[] = [];
    const activeExisting = existingReminders.filter((r) => !r.isCompleted);
    const evaluatedSlots: Array<{ id?: string; title: string; dueDateTime: string; date: Date }> = [];

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (!candidate.dueDateTime) continue;

      const candDate = new Date(candidate.dueDateTime);
      if (isNaN(candDate.getTime())) continue;

      const candHours = candDate.getHours().toString().padStart(2, '0');
      const candMins = candDate.getMinutes().toString().padStart(2, '0');
      const formattedTime = `${candHours}:${candMins}`;

      // 1. Check against active existing reminders
      let matchedExisting: Reminder | null = null;
      for (const existing of activeExisting) {
        // Skip if same reminder id (editing self)
        if (candidate.id && existing.id === candidate.id) continue;

        if (doesReminderOccurOn(existing, candDate) || doesReminderOccurOn(candidate, new Date(existing.dueDateTime))) {
          matchedExisting = existing;
          break;
        }
      }

      // 2. Check against previous candidates in this batch (internal conflict)
      let matchedBatchCandidate: { id?: string; title: string; dueDateTime: string } | null = null;
      if (!matchedExisting) {
        for (const prev of evaluatedSlots) {
          if (candidate.id && prev.id === candidate.id) continue;
          if (doesReminderOccurOn(prev, candDate) || doesReminderOccurOn(candidate, prev.date)) {
            matchedBatchCandidate = prev;
            break;
          }
        }
      }

      if (matchedExisting) {
        console.log(`[CONFLICT] candidate: ${candidate.title || 'Xatırlatma'} (${formattedTime})`);
        console.log(`[CONFLICT] existing: ${matchedExisting.title} (${formattedTime})`);
        console.log(`[CONFLICT] detected: true`);

        const alternative = findAlternativeSlot(
          candidate.dueDateTime,
          activeExisting,
          evaluatedSlots.map((s) => s.date)
        );

        conflicts.push({
          candidateId: candidate.id,
          candidateTitle: candidate.title || 'Xatırlatma',
          candidateDueDateTime: candidate.dueDateTime,
          conflictingReminderId: matchedExisting.id,
          conflictingReminderTitle: matchedExisting.title,
          conflictingDueDateTime: matchedExisting.dueDateTime,
          formattedTime,
          formattedDate: this.formatShortDateAz(candDate),
          message: `${formattedTime} üçün artıq '${matchedExisting.title}' xatırlatması var.`,
          suggestedAlternativeDueDateTime: alternative.iso,
          suggestedAlternativeTime: alternative.time,
        });
      } else if (matchedBatchCandidate) {
        console.log(`[CONFLICT] candidate: ${candidate.title || 'Xatırlatma'} (${formattedTime})`);
        console.log(`[CONFLICT] existing: ${matchedBatchCandidate.title} (${formattedTime})`);
        console.log(`[CONFLICT] detected: true`);

        const alternative = findAlternativeSlot(
          candidate.dueDateTime,
          activeExisting,
          evaluatedSlots.map((s) => s.date)
        );

        conflicts.push({
          candidateId: candidate.id,
          candidateTitle: candidate.title || 'Xatırlatma',
          candidateDueDateTime: candidate.dueDateTime,
          conflictingReminderId: matchedBatchCandidate.id,
          conflictingReminderTitle: matchedBatchCandidate.title,
          conflictingDueDateTime: matchedBatchCandidate.dueDateTime,
          formattedTime,
          formattedDate: this.formatShortDateAz(candDate),
          message: `${formattedTime} üçün artıq '${matchedBatchCandidate.title}' xatırlatması var.`,
          suggestedAlternativeDueDateTime: alternative.iso,
          suggestedAlternativeTime: alternative.time,
        });
      } else {
        console.log(`[CONFLICT] candidate: ${candidate.title || 'Xatırlatma'} (${formattedTime})`);
        console.log(`[CONFLICT] detected: false`);
      }

      evaluatedSlots.push({
        id: candidate.id,
        title: candidate.title || 'Xatırlatma',
        dueDateTime: candidate.dueDateTime,
        date: candDate,
      });
    }

    return conflicts;
  }

  public logUserDecision(decision: 'Yenə də əlavə et' | 'Vaxtı dəyiş' | 'Ləğv et') {
    console.log(`[CONFLICT] user decision: ${decision}`);
  }

  private formatShortDateAz(d: Date): string {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    ) {
      return 'Bugün';
    }
    if (
      d.getFullYear() === tomorrow.getFullYear() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getDate() === tomorrow.getDate()
    ) {
      return 'Sabah';
    }

    const monthsAz = [
      'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
      'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'
    ];
    return `${d.getDate()} ${monthsAz[d.getMonth()]}`;
  }
}

export const conflictDetector = new ConflictDetector();
