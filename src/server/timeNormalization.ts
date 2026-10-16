/**
 * Server-side helpers that make sure the reminder time the AI returns matches
 * the clock time the user actually said, in the user's own timezone.
 */

/**
 * Finds every explicit clock time in an Azerbaijani sentence, e.g.
 * "saat 10", "10:30", "10-da", "axşam 8", "günorta saat 2", "gecə 1".
 * Durations such as "2 saat sonra" or "30 dəqiqə" and intervals such as
 * "hər 3 gündən bir" are NOT clock times and are ignored.
 * Returns the time only when exactly one distinct clock time is present.
 */
export function extractSingleExplicitTime(text: string): { hour: number; minute: number } | null {
  const lower = (text || "").toLowerCase();
  const covered: Array<[number, number]> = [];
  const found: Array<{ hour: number; minute: number }> = [];

  const isCovered = (start: number) => covered.some(([s, e]) => start >= s && start < e);
  const push = (start: number, end: number, hour: number, minute: number) => {
    covered.push([start, end]);
    if (hour === 24) hour = 0;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return;
    found.push({ hour, minute });
  };

  // a) Daypart + hour: "axşam 8", "günorta saat 2:30", "gecə 1"
  const daypartRe =
    /(səhər|seher|günorta|gunorta|nahar|axşamüstü|axsamustu|axşam|axsam|gecə|gece)\s+(?:saat\s+)?(\d{1,2})(?::(\d{2}))?/g;
  for (const m of lower.matchAll(daypartRe)) {
    const part = m[1];
    let h = parseInt(m[2], 10);
    const min = m[3] ? parseInt(m[3], 10) : 0;
    if (/^(günorta|gunorta|nahar)$/.test(part)) {
      if (h >= 1 && h <= 5) h += 12;
    } else if (/^(axşam|axsam|axşamüstü|axsamustu)$/.test(part)) {
      if (h >= 1 && h <= 11) h += 12;
    } else if (/^(gecə|gece)$/.test(part)) {
      if (h === 12) h = 0;
      else if (h >= 9 && h <= 11) h += 12;
    }
    push(m.index!, m.index! + m[0].length, h, min);
  }

  // b) "saat 10", "saat 10:30" (number AFTER "saat"; "2 saat sonra" is a duration)
  for (const m of lower.matchAll(/saat\s+(\d{1,2})(?::(\d{2}))?/g)) {
    if (isCovered(m.index!)) continue;
    push(m.index!, m.index! + m[0].length, parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) : 0);
  }

  // c) "14:00"
  for (const m of lower.matchAll(/(\d{1,2}):(\d{2})/g)) {
    if (isCovered(m.index!)) continue;
    push(m.index!, m.index! + m[0].length, parseInt(m[1], 10), parseInt(m[2], 10));
  }

  // d) "10-da", "3-də" (but not dates like "ayın 15-də")
  for (const m of lower.matchAll(/(\d{1,2})-(?:da|də|de|ta|tə|te)(?=$|[\s,.!?])/g)) {
    if (isCovered(m.index!)) continue;
    if (/ayın\s*$|ayin\s*$/.test(lower.slice(0, m.index!))) continue;
    push(m.index!, m.index! + m[0].length, parseInt(m[1], 10), 0);
  }

  const unique = new Map(found.map((t) => [`${t.hour}:${t.minute}`, t]));
  return unique.size === 1 ? [...unique.values()][0] : null;
}

/**
 * Normalizes dueDateTime to ensure that the time in the user's timezone matches
 * the user's intended explicit hour and dayparts (e.g. 18:00, "səhər 10", "günorta 2", "axşam 10", "gecə 1").
 * Prevents the UTC offset mutation (e.g. 18:00 UTC becoming 22:00 in Asia/Baku).
 */
export function normalizeDueDateTimeForTimezone(
  dueDateTime: string,
  text: string,
  timezone: string
): string {
  if (!dueDateTime) return dueDateTime;

  // 1. Detect the explicit clock time the user said. If the text contains no
  //    clock time, or several different ones (multi-reminder sentences), we
  //    cannot know which one belongs to this reminder, so we trust the model.
  const explicit = extractSingleExplicitTime(text);
  if (!explicit) {
    return dueDateTime;
  }
  const targetHour = explicit.hour;
  const targetMinute = explicit.minute;

  // 2. Check what hour dueDateTime represents in the specified timezone
  const baseDate = new Date(dueDateTime);
  if (isNaN(baseDate.getTime())) return dueDateTime;

  try {
    const dtfTime = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const timeParts = dtfTime.formatToParts(baseDate);
    let hInTz = Number(timeParts.find((p) => p.type === 'hour')?.value || 0);
    if (hInTz === 24) hInTz = 0;
    const minInTz = Number(timeParts.find((p) => p.type === 'minute')?.value || 0);

    // If it already matches the target hour and minute in timezone, return as is
    if (hInTz === targetHour && minInTz === targetMinute) {
      return dueDateTime;
    }

    // Otherwise, calculate the exact UTC date that yields targetHour:targetMinute in timezone
    const dtfDate = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dateParts = dtfDate.formatToParts(baseDate);
    const y = dateParts.find((p) => p.type === 'year')?.value;
    const m = dateParts.find((p) => p.type === 'month')?.value;
    const d = dateParts.find((p) => p.type === 'day')?.value;

    if (!y || !m || !d) return dueDateTime;

    const guess = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), targetHour, targetMinute, 0));
    const guessParts = dtfTime.formatToParts(guess);
    let guessH = Number(guessParts.find((p) => p.type === 'hour')?.value || 0);
    if (guessH === 24) guessH = 0;
    const guessMin = Number(guessParts.find((p) => p.type === 'minute')?.value || 0);

    const diffMs = ((guessH * 60 + guessMin) - (targetHour * 60 + targetMinute)) * 60 * 1000;
    const corrected = new Date(guess.getTime() - diffMs);
    return corrected.toISOString();
  } catch (tzErr) {
    console.warn('[SERVER-TZ] Timezone adjustment warning:', tzErr);
    return dueDateTime;
  }
}
