/**
 * "Bu gün yorğunam" for today only. Stored per calendar day so that tomorrow
 * starts normal. Reads/writes are guarded: storage can be missing or blocked.
 */
const KEY = 'unutma_ai_energy_v1';

export function dayKey(d: Date = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function isTiredToday(now: Date = new Date()): boolean {
  try {
    return localStorage.getItem(KEY) === dayKey(now);
  } catch {
    return false;
  }
}

export function setTiredToday(tired: boolean, now: Date = new Date()): void {
  try {
    if (tired) localStorage.setItem(KEY, dayKey(now));
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable: the mode simply isn't remembered
  }
}

/** Phrases that mean "I am tired today". */
export const TIRED_PHRASE = /(bu gün yorğun|bu gün yorgun|yorğunam|yorgunam|halsızam|halsizam|enerjim yoxdur|çox yorulmuşam|cox yorulmusam|yorulmuşam|yorulmusam)/i;
