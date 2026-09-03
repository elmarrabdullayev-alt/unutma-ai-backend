import { Routine, RoutineProposal, RoutineStep, RoutineStreakData, RoutineHistoryEntry, RoutineType, Reminder } from '../types';
import { notificationService } from './notificationService';

const STORAGE_KEY_ROUTINES = 'unutma_ai_routines_v1';
const STORAGE_KEY_HISTORY = 'unutma_ai_routine_history_v1';

interface StoredHistoryData {
  streak: RoutineStreakData;
  history: RoutineHistoryEntry[];
  dailyCompletions: Record<string, string[]>; // key: `${routineId}_${YYYY-MM-DD}` -> step IDs completed
}

const DEFAULT_ROUTINES: Routine[] = [
  {
    id: 'routine-morning-default',
    type: 'morning',
    title: 'Səhər rutini',
    icon: 'Sunrise',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0], // Every day
    startTime: '07:00',
    steps: [
      { id: 'step-m1', title: 'Oyan', time: '07:00', duration: 5, notificationEnabled: true },
      { id: 'step-m2', title: 'Su iç', time: '07:10', duration: 5, notificationEnabled: true },
      { id: 'step-m3', title: '10 dəqiqə idman', time: '07:15', duration: 10, notificationEnabled: true },
      { id: 'step-m4', title: 'Duş', time: '07:40', duration: 15, notificationEnabled: false },
      { id: 'step-m5', title: 'Evdən çıx', time: '08:00', duration: 10, notificationEnabled: true },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true,
  },
  {
    id: 'routine-evening-default',
    type: 'evening',
    title: 'Axşam rutini',
    icon: 'Moon',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
    startTime: '22:00',
    steps: [
      { id: 'step-e1', title: 'Sabahı planla', time: '22:00', duration: 15, notificationEnabled: true },
      { id: 'step-e2', title: 'Kitab oxu', time: '22:20', duration: 25, notificationEnabled: false },
      { id: 'step-e3', title: 'Yuxu rejimi', time: '23:00', duration: 10, notificationEnabled: true },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true,
  },
];

class RoutineService {
  private routines: Routine[] = [];
  private historyData: StoredHistoryData = {
    streak: {
      currentStreak: 0,
      bestStreak: 0,
      totalCompletions: 0,
    },
    history: [],
    dailyCompletions: {},
  };
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadFromStorage();
  }

  public init(): void {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;

    try {
      const rawRoutines = localStorage.getItem(STORAGE_KEY_ROUTINES);
      if (rawRoutines) {
        this.routines = JSON.parse(rawRoutines);
      } else {
        // Seed initial default routines on first launch
        this.routines = DEFAULT_ROUTINES;
        this.saveRoutinesToStorage();
      }
    } catch (e) {
      console.warn('[RoutineService] Failed to load routines from storage:', e);
      this.routines = DEFAULT_ROUTINES;
    }

    try {
      const rawHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (rawHistory) {
        const parsed = JSON.parse(rawHistory);
        this.historyData = {
          streak: parsed.streak || { currentStreak: 0, bestStreak: 0, totalCompletions: 0 },
          history: parsed.history || [],
          dailyCompletions: parsed.dailyCompletions || {},
        };
      }
    } catch (e) {
      console.warn('[RoutineService] Failed to load history from storage:', e);
    }

    this.checkStreakHealth();
  }

  private saveRoutinesToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_ROUTINES, JSON.stringify(this.routines));
    } catch (e) {
      console.warn('[RoutineService] Failed to save routines:', e);
    }
  }

  private saveHistoryToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(this.historyData));
    } catch (e) {
      console.warn('[RoutineService] Failed to save history:', e);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  // --- Date helpers ---
  public getTodayKey(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getYesterdayKey(todayKey: string): string {
    const d = new Date(todayKey + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return this.getTodayKey(d);
  }

  // Check if streak was broken (missed yesterday without completion)
  private checkStreakHealth() {
    const today = this.getTodayKey();
    const yesterday = this.getYesterdayKey(today);
    const lastDate = this.historyData.streak.lastCompletedDate;

    if (lastDate && lastDate !== today && lastDate !== yesterday) {
      // More than 1 day skipped: reset current streak
      this.historyData.streak.currentStreak = 0;
      this.saveHistoryToStorage();
    }
  }

  // --- CRUD Operations ---
  public getAll(): Routine[] {
    return this.routines;
  }

  public getById(id: string): Routine | undefined {
    return this.routines.find((r) => r.id === id);
  }

  public getTodayRoutines(date: Date = new Date()): Routine[] {
    const dayOfWeek = date.getDay(); // 0 = Sun, 1 = Mon ...
    return this.routines.filter(
      (r) => r.isActive && r.daysOfWeek.includes(dayOfWeek)
    );
  }

  public createRoutine(data: {
    type: RoutineType;
    title: string;
    icon?: string;
    daysOfWeek: number[];
    startTime: string;
    steps: Array<{
      title: string;
      time?: string;
      duration?: number;
      notificationEnabled: boolean;
    }>;
  }): Routine {
    const newRoutine: Routine = {
      id: `routine-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: data.type,
      title: data.title.trim(),
      icon: data.icon || (data.type === 'morning' ? 'Sunrise' : data.type === 'evening' ? 'Moon' : 'Sun'),
      daysOfWeek: data.daysOfWeek.length > 0 ? data.daysOfWeek : [1, 2, 3, 4, 5, 6, 0],
      startTime: data.startTime || '08:00',
      steps: data.steps.map((s, idx) => ({
        id: `step-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        title: s.title.trim(),
        time: s.time || data.startTime,
        duration: s.duration,
        notificationEnabled: s.notificationEnabled ?? true,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    };

    this.routines.push(newRoutine);
    this.saveRoutinesToStorage();
    this.scheduleRoutineNotifications(newRoutine);
    this.notify();
    return newRoutine;
  }

  public updateRoutine(id: string, updates: Partial<Routine>): Routine | undefined {
    const idx = this.routines.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;

    const existing = this.routines[idx];
    const updated: Routine = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.routines[idx] = updated;
    this.saveRoutinesToStorage();

    // Reschedule notifications for updated routine
    this.cancelRoutineNotifications(existing);
    if (updated.isActive) {
      this.scheduleRoutineNotifications(updated);
    }

    this.notify();
    return updated;
  }

  public deleteRoutine(id: string): boolean {
    const target = this.routines.find((r) => r.id === id);
    if (!target) return false;

    this.cancelRoutineNotifications(target);
    this.routines = this.routines.filter((r) => r.id !== id);
    this.saveRoutinesToStorage();
    this.notify();
    return true;
  }

  // --- Step completion & Streak tracking ---
  public getCompletedStepIdsForToday(routineId: string, dateStr: string = this.getTodayKey()): string[] {
    const key = `${routineId}_${dateStr}`;
    return this.historyData.dailyCompletions[key] || [];
  }

  public toggleStep(
    routineId: string,
    stepId: string,
    dateStr: string = this.getTodayKey()
  ): {
    routine: Routine;
    isCompleted100: boolean;
    progress: { completed: number; total: number; percent: number };
  } {
    const routine = this.getById(routineId);
    if (!routine) throw new Error('Routine not found');

    const key = `${routineId}_${dateStr}`;
    const currentCompleted = new Set(this.historyData.dailyCompletions[key] || []);

    const isCurrentlyChecked = currentCompleted.has(stepId);
    if (isCurrentlyChecked) {
      currentCompleted.delete(stepId);
    } else {
      currentCompleted.add(stepId);
    }

    this.historyData.dailyCompletions[key] = Array.from(currentCompleted);

    const total = routine.steps.length;
    const completed = currentCompleted.size;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const isCompleted100 = completed >= total && total > 0;

    // If just reached 100%, record completion and calculate streak
    if (isCompleted100 && !isCurrentlyChecked) {
      this.handleRoutine100PercentCompleted(routine, dateStr);
    }

    this.saveHistoryToStorage();
    this.notify();

    return {
      routine,
      isCompleted100,
      progress: { completed, total, percent },
    };
  }

  private handleRoutine100PercentCompleted(routine: Routine, dateStr: string) {
    const today = dateStr;
    const yesterday = this.getYesterdayKey(today);
    const lastDate = this.historyData.streak.lastCompletedDate;

    // Check if already completed today
    if (lastDate === today) {
      // Already incremented streak today, just count completion
      this.historyData.streak.totalCompletions += 1;
    } else if (lastDate === yesterday) {
      // Consecutive day!
      this.historyData.streak.currentStreak += 1;
      this.historyData.streak.bestStreak = Math.max(
        this.historyData.streak.bestStreak,
        this.historyData.streak.currentStreak
      );
      this.historyData.streak.totalCompletions += 1;
      this.historyData.streak.lastCompletedDate = today;
    } else {
      // First completion or broken streak
      this.historyData.streak.currentStreak = 1;
      this.historyData.streak.bestStreak = Math.max(
        this.historyData.streak.bestStreak,
        this.historyData.streak.currentStreak
      );
      this.historyData.streak.totalCompletions += 1;
      this.historyData.streak.lastCompletedDate = today;
    }

    // Add entry to history log
    this.historyData.history.unshift({
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      routineId: routine.id,
      routineTitle: routine.title,
      completedAt: new Date().toISOString(),
      date: today,
      stepsCompleted: routine.steps.length,
      totalSteps: routine.steps.length,
    });

    if (this.historyData.history.length > 50) {
      this.historyData.history = this.historyData.history.slice(0, 50);
    }
  }

  public resetTodayRoutine(routineId: string, dateStr: string = this.getTodayKey()) {
    const key = `${routineId}_${dateStr}`;
    delete this.historyData.dailyCompletions[key];
    this.saveHistoryToStorage();
    this.notify();
  }

  public getRoutineProgress(
    routine: Routine,
    dateStr: string = this.getTodayKey()
  ): {
    completed: number;
    total: number;
    percent: number;
    isCompleted: boolean;
    nextStep?: RoutineStep;
  } {
    const completedIds = new Set(this.getCompletedStepIdsForToday(routine.id, dateStr));
    const total = routine.steps.length;
    let completed = 0;
    let nextStep: RoutineStep | undefined = undefined;

    for (const step of routine.steps) {
      if (completedIds.has(step.id)) {
        completed++;
      } else if (!nextStep) {
        nextStep = step;
      }
    }

    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      completed,
      total,
      percent,
      isCompleted: total > 0 && completed >= total,
      nextStep,
    };
  }

  public getStreakData(): RoutineStreakData {
    this.checkStreakHealth();
    return this.historyData.streak;
  }

  public getHistory(): RoutineHistoryEntry[] {
    return this.historyData.history;
  }

  // --- Notification Engine Integration (Reusing notificationService) ---
  public scheduleRoutineNotifications(routine: Routine) {
    if (!routine.isActive) return;

    routine.steps.forEach((step) => {
      if (step.notificationEnabled) {
        const virtualReminder = this.createVirtualReminderForStep(routine, step);
        if (virtualReminder) {
          notificationService.scheduleNotification(virtualReminder);
        }
      }
    });
  }

  public cancelRoutineNotifications(routine: Routine) {
    routine.steps.forEach((step) => {
      const virtualId = `routine-${routine.id}-${step.id}`;
      notificationService.cancelNotification(virtualId);
    });
  }

  public rescheduleAllRoutineNotifications() {
    this.routines.forEach((routine) => {
      if (routine.isActive) {
        this.scheduleRoutineNotifications(routine);
      }
    });
  }

  private createVirtualReminderForStep(routine: Routine, step: RoutineStep): Reminder | null {
    const timeStr = step.time || routine.startTime || '08:00';
    const [hourStr, minStr] = timeStr.split(':');
    const hour = parseInt(hourStr || '8', 10);
    const minute = parseInt(minStr || '0', 10);

    // Calculate next occurrence matching routine daysOfWeek
    const nextDate = this.getNextOccurrenceDate(routine.daysOfWeek, hour, minute);
    if (!nextDate) return null;

    const isDaily = routine.daysOfWeek.length === 7;

    return {
      id: `routine-${routine.id}-${step.id}`,
      title: `${routine.title}: ${step.title}`,
      description: `${routine.title} addımı (${timeStr})`,
      dueDateTime: nextDate.toISOString(),
      category: routine.type === 'morning' ? 'personal' : routine.type === 'evening' ? 'personal' : 'other',
      priority: 'medium',
      recurrence: isDaily ? 'daily' : 'weekly',
      notificationEnabled: true,
      isCompleted: false,
      createdAt: routine.createdAt,
      updatedAt: routine.updatedAt,
    };
  }

  private getNextOccurrenceDate(daysOfWeek: number[], hour: number, minute: number): Date {
    const now = new Date();
    // Try from today up to 7 days ahead
    for (let offset = 0; offset < 8; offset++) {
      const target = new Date();
      target.setDate(now.getDate() + offset);
      target.setHours(hour, minute, 0, 0);

      const targetDay = target.getDay();
      if (daysOfWeek.includes(targetDay)) {
        if (target.getTime() > now.getTime() + 60 * 1000) {
          return target;
        }
      }
    }
    // Fallback: tomorrow at that time
    const fallback = new Date();
    fallback.setDate(now.getDate() + 1);
    fallback.setHours(hour, minute, 0, 0);
    return fallback;
  }

  // --- Natural Language & Deterministic Routine Parser ---
  public isRoutineIntent(prompt: string): boolean {
    const lower = prompt.toLowerCase();
    const hasRoutineWord = /rutin|cədvəl|rejim/i.test(lower);
    const hasRecurringTime = /(hər\s*(səhər|gün|axşam|gecə|həftə)|hər\s*gün\s*saat)/i.test(lower);
    const hasStepActions = /(oyan|idman|duş|su\s*iç|evdən\s*çıx|yuxu|kitab\s*oxu|hazırlaş)/i.test(lower);

    return (hasRoutineWord || (hasRecurringTime && hasStepActions));
  }

  public parseRoutinePrompt(prompt: string): RoutineProposal | null {
    const clean = prompt.trim();
    const lower = clean.toLowerCase();

    // 1. Detect Routine Type
    let type: RoutineType = 'custom';
    let title = 'Xüsusi rutin';
    let icon = 'Sun';

    if (lower.includes('səhər') || lower.includes('morning') || lower.includes('oyan')) {
      type = 'morning';
      title = 'Səhər rutini';
      icon = 'Sunrise';
    } else if (lower.includes('axşam') || lower.includes('gecə') || lower.includes('yuxu') || lower.includes('yat')) {
      type = 'evening';
      title = 'Axşam rutini';
      icon = 'Moon';
    } else if (lower.includes('gündüz') || lower.includes('nahar') || lower.includes('günorta')) {
      type = 'afternoon';
      title = 'Gündüz rutini';
      icon = 'Sun';
    }

    // 2. Detect Start Time (e.g. "saat 7-də", "7-də", "07:00", "saat 08:30")
    let startTime = type === 'morning' ? '07:00' : type === 'evening' ? '22:00' : '14:00';
    const timeMatch = lower.match(/(?:saat\s*)?(\d{1,2})(?::(\d{2}))?\s*[-–](?:də|da|ya|yə|yuxu)?/i) ||
                      lower.match(/(\d{1,2}):(\d{2})/);

    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      let m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      if (h < 6 && type === 'afternoon') h += 12; // e.g. "saat 2-də" -> 14:00
      if (h < 12 && type === 'evening' && h > 0) h += 12; // e.g. "saat 10-da" -> 22:00
      startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    // 3. Extract Steps
    // Common step phrases in Azerbaijani:
    // e.g. "Hər səhər 7-də oyanım, 10 dəqiqə idman edim və 8-də evdən çıxım."
    // Split on commas, "və", "sonra", "ardınca", newlines
    const rawSegments = clean
      .replace(/^.*?(?:rutini|hər səhər|hər axşam|hər gün)[:,\s]*/i, '')
      .split(/[,;\n]|\bvə\b|\bsonra\b|\bardınca\b/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);

    const steps: Array<{
      title: string;
      time?: string;
      duration?: number;
      notificationEnabled: boolean;
    }> = [];

    let [curH, curM] = startTime.split(':').map((v) => parseInt(v, 10));

    if (rawSegments.length > 0) {
      for (const seg of rawSegments) {
        // Check if segment has explicit time e.g. "8-də evdən çıxım"
        let stepTime: string | undefined = undefined;
        let stepDuration: number | undefined = undefined;

        const segTimeMatch = seg.match(/(?:saat\s*)?(\d{1,2})(?::(\d{2}))?\s*[-–](?:də|da|yə|ya)/i) ||
                            seg.match(/(\d{1,2}):(\d{2})/);
        if (segTimeMatch) {
          let sh = parseInt(segTimeMatch[1], 10);
          let sm = segTimeMatch[2] ? parseInt(segTimeMatch[2], 10) : 0;
          if (sh < 6 && type === 'afternoon') sh += 12;
          if (sh < 12 && type === 'evening' && sh > 0) sh += 12;
          curH = sh;
          curM = sm;
          stepTime = `${String(curH).padStart(2, '0')}:${String(curM).padStart(2, '0')}`;
        }

        // Check if segment has duration e.g. "10 dəqiqə idman"
        const durMatch = seg.match(/(\d+)\s*(?:dəqiqə|dəq|min)/i);
        if (durMatch) {
          stepDuration = parseInt(durMatch[1], 10);
        }

        // Clean up step title
        let cleanTitle = seg
          .replace(/(?:saat\s*)?\d{1,2}(?::\d{2})?\s*[-–](?:də|da|yə|ya)\s*/gi, '')
          .replace(/\b\d{1,2}:\d{2}\b/g, '')
          .replace(/\b(hər\s*səhər|hər\s*axşam|hər\s*gün)\b/gi, '')
          .replace(/\b(edim|edək|etmək|olum|olsun|içim|çıxım|qəbul\s*edim|oxuyum|yatım)\b/gi, (match) => {
            // Normalize verb to polite imperative or infinitive
            const m = match.toLowerCase();
            if (m === 'oyanım' || m === 'oyan') return 'Oyan';
            if (m === 'içim' || m === 'iç') return 'iç';
            if (m === 'çıxım' || m === 'çıx') return 'çıx';
            if (m === 'edim' || m === 'etmək') return 'et';
            if (m === 'oxuyum') return 'oxu';
            if (m === 'yatım') return 'yat';
            return match;
          })
          .trim();

        // Capitalize first letter
        if (cleanTitle) {
          cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
        }

        if (cleanTitle.length > 1) {
          if (!stepTime) {
            stepTime = `${String(curH).padStart(2, '0')}:${String(curM).padStart(2, '0')}`;
          }

          steps.push({
            title: cleanTitle,
            time: stepTime,
            duration: stepDuration || 10,
            notificationEnabled: true,
          });

          // Advance current time by duration for next step
          const addMin = stepDuration || 15;
          curM += addMin;
          curH += Math.floor(curM / 60);
          curM = curM % 60;
          if (curH >= 24) curH = curH % 24;
        }
      }
    }

    // Fallback default steps if nothing was extracted from sentence
    if (steps.length < 2) {
      if (type === 'morning') {
        steps.push(
          { title: 'Oyan', time: startTime, duration: 5, notificationEnabled: true },
          { title: 'Su iç', time: this.addMinutes(startTime, 10), duration: 5, notificationEnabled: true },
          { title: '10 dəqiqə idman', time: this.addMinutes(startTime, 15), duration: 10, notificationEnabled: true },
          { title: 'Evdən çıx', time: this.addMinutes(startTime, 60), duration: 10, notificationEnabled: true }
        );
      } else if (type === 'evening') {
        steps.push(
          { title: 'Sabahı planla', time: startTime, duration: 15, notificationEnabled: true },
          { title: 'Kitab oxu', time: this.addMinutes(startTime, 20), duration: 25, notificationEnabled: false },
          { title: 'Yuxu rejimi', time: this.addMinutes(startTime, 60), duration: 10, notificationEnabled: true }
        );
      } else {
        steps.push(
          { title: 'Başlanğıc', time: startTime, duration: 15, notificationEnabled: true },
          { title: 'İcraat', time: this.addMinutes(startTime, 20), duration: 30, notificationEnabled: true }
        );
      }
    }

    return {
      id: `prop-${Date.now()}`,
      type,
      title,
      icon,
      daysOfWeek: [1, 2, 3, 4, 5, 6, 0], // Default every day
      startTime,
      steps,
      rawPrompt: prompt,
    };
  }

  private addMinutes(timeStr: string, minutes: number): string {
    const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10));
    let total = h * 60 + m + minutes;
    let newH = Math.floor(total / 60) % 24;
    let newM = total % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  }
}

export const routineService = new RoutineService();
