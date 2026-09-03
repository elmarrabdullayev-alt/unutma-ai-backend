import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { reminderService } from './reminderService';
import { routineService } from './routineService';
import { focusService } from './focusService';
import {
  ProgressDashboardData,
  DayProgressItem,
  RoutineStreakItem,
  WeekDayShortAz,
  Reminder,
} from '../types';

export const MILESTONES_STORAGE_KEY = 'unutma_ai_progress_milestones_v1';
export const MEANINGFUL_MILESTONES = [3, 7, 14, 30];

const AZ_WEEK_LABELS: WeekDayShortAz[] = ['B.e', 'Ç.a', 'Ç.', 'C.a', 'C.', 'Ş.', 'B.'];
const AZ_WEEK_NAMES = [
  'Bazar ertəsi',
  'Çərşənbə axşamı',
  'Çərşənbə',
  'Cümə axşamı',
  'Cümə',
  'Şənbə',
  'Bazar',
];

type ProgressListener = () => void;

class ProgressService {
  private shownMilestones: Set<number> = new Set();
  private listeners: ProgressListener[] = [];
  private isInitialized = false;

  constructor() {
    this.init();
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      let raw: string | null = null;
      if (Capacitor.isNativePlatform()) {
        try {
          const res = await Preferences.get({ key: MILESTONES_STORAGE_KEY });
          raw = res.value;
        } catch (e) {
          console.warn('[ProgressService] Native read error:', e);
        }
      }
      if (!raw && typeof window !== 'undefined' && 'localStorage' in window) {
        raw = localStorage.getItem(MILESTONES_STORAGE_KEY);
      }

      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.shownMilestones = new Set(parsed);
        }
      }
    } catch (err) {
      console.warn('[ProgressService] Failed to load milestones:', err);
    } finally {
      this.isInitialized = true;
    }

    // Subscribe to existing services (read-only) to notify UI when data changes
    reminderService.subscribe(() => this.notify());
    routineService.subscribe(() => this.notify());
    focusService.subscribe(() => this.notify());
  }

  public subscribe(listener: ProgressListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public async markMilestoneShown(milestone: number): Promise<void> {
    this.shownMilestones.add(milestone);
    const arr = Array.from(this.shownMilestones);
    const raw = JSON.stringify(arr);

    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        localStorage.setItem(MILESTONES_STORAGE_KEY, raw);
      }
      if (Capacitor.isNativePlatform()) {
        await Preferences.set({ key: MILESTONES_STORAGE_KEY, value: raw });
      }
    } catch (e) {
      console.warn('[ProgressService] Error saving milestone:', e);
    }

    this.notify();
  }

  public getShownMilestones(): number[] {
    return Array.from(this.shownMilestones);
  }

  // --- Date helpers in device-local timezone ---
  public toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseDate(isoOrKey: string): Date | null {
    if (!isoOrKey) return null;
    const d = new Date(isoOrKey);
    return isNaN(d.getTime()) ? null : d;
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

  private getStartOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  }

  private getEndOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  }

  /**
   * Calculates all metrics on-demand without mutating any underlying service data.
   */
  public getProgressData(): ProgressDashboardData {
    const now = new Date();
    const todayKey = this.toDateKey(now);
    const startOfToday = this.getStartOfDay(now);
    const endOfToday = this.getEndOfDay(now);

    // Read from services
    const reminders = reminderService.getAll();
    const routines = routineService.getAll();
    const routineHistory = routineService.getHistory();
    const routineStreak = routineService.getStreakData();
    const focusHistory = focusService.getHistory();

    // 1. Calculate Monday of current week in local timezone
    const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    const offsetToMon = (dayOfWeek + 6) % 7; // Mon->0, Tue->1 ... Sun->6
    const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offsetToMon, 0, 0, 0, 0);
    const thisSunday = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + 6, 23, 59, 59, 999);

    // Previous week bounds
    const prevMonday = new Date(thisMonday);
    prevMonday.setDate(prevMonday.getDate() - 7);
    const prevSunday = new Date(thisMonday);
    prevSunday.setMilliseconds(-1);

    // Helper: is date within range
    const inRange = (d: Date, start: Date, end: Date) => d >= start && d <= end;

    // Helper: get reminder completion date
    const getReminderCompletionDate = (r: Reminder): Date | null => {
      if (!r.isCompleted) return null;
      if (r.completedAt) return this.parseDate(r.completedAt);
      if (r.updatedAt) return this.parseDate(r.updatedAt);
      return this.parseDate(r.dueDateTime);
    };

    // --- TODAY SUMMARY METRICS ---
    const todayCompletedTasks = reminders.filter((r) => {
      if (!r.isCompleted) return false;
      const cDate = getReminderCompletionDate(r);
      return cDate ? this.isSameDay(cDate, now) : false;
    }).length;

    let todayFocusMinutes = 0;
    focusHistory.forEach((f) => {
      const sDate = this.parseDate(f.startedAt);
      if (sDate && this.isSameDay(sDate, now)) {
        todayFocusMinutes += f.actualMinutes || 0;
      }
    });

    const todayCompletedRoutines = routineHistory.filter(
      (h) => h.date === todayKey
    ).length;

    // --- 7-DAY WEEKLY CALCULATION (B.e to B.) ---
    const weekDays: DayProgressItem[] = [];
    let weekTasksCompleted = 0;
    let weekFocusMinutes = 0;
    let weekRoutinesCompleted = 0;

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + i);
      const dayKey = this.toDateKey(dayDate);
      const isToday = this.isSameDay(dayDate, now);
      const isFuture = dayDate.getTime() > endOfToday.getTime();

      let tasksOnDay = 0;
      let focusOnDay = 0;
      let routinesOnDay = 0;

      if (!isFuture) {
        tasksOnDay = reminders.filter((r) => {
          if (!r.isCompleted) return false;
          const cDate = getReminderCompletionDate(r);
          return cDate ? this.isSameDay(cDate, dayDate) : false;
        }).length;

        focusHistory.forEach((f) => {
          const sDate = this.parseDate(f.startedAt);
          if (sDate && this.isSameDay(sDate, dayDate)) {
            focusOnDay += f.actualMinutes || 0;
          }
        });

        routinesOnDay = routineHistory.filter((h) => h.date === dayKey).length;
      }

      weekTasksCompleted += tasksOnDay;
      weekFocusMinutes += focusOnDay;
      weekRoutinesCompleted += routinesOnDay;

      // Calculate single day completion percentage
      let dayPercent = 0;
      if (!isFuture) {
        // Scheduled routines for this day of week
        const dWeekDay = dayDate.getDay();
        const activeRoutinesForDay = routines.filter(
          (r) => r.isActive && r.daysOfWeek.includes(dWeekDay)
        ).length;

        // Tasks due on this day
        const tasksDueOnDay = reminders.filter((r) => {
          const dDate = this.parseDate(r.dueDateTime);
          return dDate ? this.isSameDay(dDate, dayDate) : false;
        }).length;

        const totalExpected = activeRoutinesForDay + tasksDueOnDay;

        if (totalExpected > 0) {
          const totalDone = Math.min(totalExpected, routinesOnDay + tasksOnDay);
          dayPercent = Math.round((totalDone / totalExpected) * 100);
          // Bonus if focus was performed
          if (focusOnDay >= 20 && dayPercent < 100) {
            dayPercent = Math.min(100, dayPercent + 15);
          }
        } else if (routinesOnDay > 0 || tasksOnDay > 0 || focusOnDay > 0) {
          // Unscheduled activity done
          dayPercent = 100;
        } else {
          dayPercent = 0;
        }
      }

      weekDays.push({
        dayName: AZ_WEEK_LABELS[i],
        dayFull: AZ_WEEK_NAMES[i],
        dateStr: dayKey,
        isToday,
        isFuture,
        percent: dayPercent,
        tasksCompleted: tasksOnDay,
        focusMinutes: focusOnDay,
        routinesCompleted: routinesOnDay,
      });
    }

    // --- PREVIOUS WEEK COMPARISON (Reliable data only, do not fabricate) ---
    let prevWeekTasks = 0;
    let prevWeekFocus = 0;
    let prevWeekRoutines = 0;
    let hasPrevWeekHistory = false;

    reminders.forEach((r) => {
      const cDate = getReminderCompletionDate(r);
      if (cDate && inRange(cDate, prevMonday, prevSunday)) {
        prevWeekTasks++;
        hasPrevWeekHistory = true;
      }
    });

    focusHistory.forEach((f) => {
      const sDate = this.parseDate(f.startedAt);
      if (sDate && inRange(sDate, prevMonday, prevSunday)) {
        prevWeekFocus += f.actualMinutes || 0;
        hasPrevWeekHistory = true;
      }
    });

    routineHistory.forEach((h) => {
      const hDate = this.parseDate(h.date);
      if (hDate && inRange(hDate, prevMonday, prevSunday)) {
        prevWeekRoutines++;
        hasPrevWeekHistory = true;
      }
    });

    let tasksDiffPercent: number | null = null;
    let focusDiffPercent: number | null = null;
    let routinesDiffPercent: number | null = null;

    if (hasPrevWeekHistory) {
      if (prevWeekTasks > 0) {
        tasksDiffPercent = Math.round(((weekTasksCompleted - prevWeekTasks) / prevWeekTasks) * 100);
      }
      if (prevWeekFocus > 0) {
        focusDiffPercent = Math.round(((weekFocusMinutes - prevWeekFocus) / prevWeekFocus) * 100);
      }
      if (prevWeekRoutines > 0) {
        routinesDiffPercent = Math.round(((weekRoutinesCompleted - prevWeekRoutines) / prevWeekRoutines) * 100);
      }
    }

    // --- ROUTINE STREAKS ---
    const activeRoutines = routines.filter((r) => r.isActive);
    const routineStreaks: RoutineStreakItem[] = activeRoutines.map((routine) => {
      // Days in this week up to today that are scheduled for this routine
      let scheduledDaysThisWeek = 0;
      let completedDaysThisWeek = 0;

      for (let i = 0; i <= offsetToMon; i++) {
        const d = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + i);
        const dayIdx = d.getDay();
        const dKey = this.toDateKey(d);

        if (routine.daysOfWeek.includes(dayIdx)) {
          scheduledDaysThisWeek++;
          // Check if completed on that day
          const completedInHistory = routineHistory.some(
            (h) => h.routineId === routine.id && h.date === dKey
          );
          const stepsCompletedToday = routineService.getCompletedStepIdsForToday(routine.id, dKey);
          const isDoneToday = routine.steps.length > 0 && stepsCompletedToday.length >= routine.steps.length;

          if (completedInHistory || isDoneToday) {
            completedDaysThisWeek++;
          }
        }
      }

      const thisWeekRate =
        scheduledDaysThisWeek > 0
          ? Math.round((completedDaysThisWeek / scheduledDaysThisWeek) * 100)
          : 0;

      // Routine consecutive streak backwards from today
      let currentRStreak = 0;
      let checkDate = new Date(now);

      // If routine not yet completed today, allow check starting from yesterday
      const doneToday = routineHistory.some(
        (h) => h.routineId === routine.id && h.date === this.toDateKey(now)
      );
      if (!doneToday) {
        checkDate.setDate(checkDate.getDate() - 1);
      }

      for (let dayBack = 0; dayBack < 60; dayBack++) {
        const dateKey = this.toDateKey(checkDate);
        const dayIdx = checkDate.getDay();

        // Only count days the routine was scheduled
        if (routine.daysOfWeek.includes(dayIdx)) {
          const isDone = routineHistory.some(
            (h) => h.routineId === routine.id && h.date === dateKey
          );
          if (isDone) {
            currentRStreak++;
          } else {
            break;
          }
        }
        checkDate.setDate(checkDate.getDate() - 1);
      }

      // Best streak
      const bestRStreak = Math.max(currentRStreak, routineStreak.bestStreak);

      return {
        routineId: routine.id,
        title: routine.title,
        type: routine.type,
        icon: routine.icon,
        currentStreak: currentRStreak,
        bestStreak: bestRStreak,
        thisWeekRate,
        completedDaysThisWeek,
        scheduledDaysThisWeek,
      };
    });

    // --- OVERALL STREAK SUMMARY ---
    // The streak is determined by routine consistency and daily completions
    const currentStreak = routineStreak.currentStreak || 0;
    const bestStreak = Math.max(routineStreak.bestStreak || 0, currentStreak);

    // --- FOCUS STATISTICS ---
    const thisWeekFocusSessions = focusHistory.filter((f) => {
      const sDate = this.parseDate(f.startedAt);
      return sDate ? inRange(sDate, thisMonday, thisSunday) : false;
    });

    const focusSessionCount = thisWeekFocusSessions.length;
    const avgDurationMinutes =
      focusSessionCount > 0 ? Math.round(weekFocusMinutes / focusSessionCount) : 0;

    // --- TASK COMPLETION STATS ---
    const overdueTasks = reminders.filter(
      (r) => !r.isCompleted && new Date(r.dueDateTime).getTime() < Date.now()
    ).length;

    // --- OVERALL WEEK PROGRESS (Weighted calculation per requirement 9) ---
    /**
     * FORMULA:
     * - Reminders/Tasks completion rate: 40%
     * - Routine completion rate: 35%
     * - Focus activity target (120 mins/week): 25%
     * 
     * Weight Normalization:
     * If any category has no available activity or data, weights are normalized
     * across the available categories only.
     * Documented as a practical productivity reflection, not a medical/clinical metric.
     */
    let weightedSum = 0;
    let totalWeight = 0;

    // Task rate
    const tasksDueThisWeek = reminders.filter((r) => {
      const dDate = this.parseDate(r.dueDateTime);
      return dDate ? inRange(dDate, thisMonday, thisSunday) : false;
    }).length;
    const totalTasksThisWeek = weekTasksCompleted + tasksDueThisWeek;

    if (totalTasksThisWeek > 0) {
      const taskRate = Math.min(1, weekTasksCompleted / totalTasksThisWeek);
      weightedSum += taskRate * 0.4;
      totalWeight += 0.4;
    }

    // Routine rate
    let totalScheduledRoutineRuns = 0;
    let totalCompletedRoutineRuns = 0;
    routineStreaks.forEach((rs) => {
      totalScheduledRoutineRuns += rs.scheduledDaysThisWeek;
      totalCompletedRoutineRuns += rs.completedDaysThisWeek;
    });

    if (totalScheduledRoutineRuns > 0) {
      const routineRate = Math.min(1, totalCompletedRoutineRuns / totalScheduledRoutineRuns);
      weightedSum += routineRate * 0.35;
      totalWeight += 0.35;
    }

    // Focus rate (Target: 120 minutes weekly)
    const weeklyFocusTarget = 120;
    const hasFocusData = focusHistory.length > 0 || weekFocusMinutes > 0;
    if (hasFocusData) {
      const focusRate = Math.min(1, weekFocusMinutes / weeklyFocusTarget);
      weightedSum += focusRate * 0.25;
      totalWeight += 0.25;
    }

    const overallPercent =
      totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : null;

    // --- PERSONAL BESTS (Backed by actual stored history only) ---
    let longestFocusMinutes: number | null = null;
    focusHistory.forEach((f) => {
      if (f.actualMinutes && (longestFocusMinutes === null || f.actualMinutes > longestFocusMinutes)) {
        longestFocusMinutes = f.actualMinutes;
      }
    });

    const bestRoutineStreak = bestStreak > 0 ? bestStreak : null;

    // Max tasks completed in a single calendar day
    const tasksByDayMap: Record<string, number> = {};
    reminders.forEach((r) => {
      if (r.isCompleted) {
        const cDate = getReminderCompletionDate(r);
        if (cDate) {
          const k = this.toDateKey(cDate);
          tasksByDayMap[k] = (tasksByDayMap[k] || 0) + 1;
        }
      }
    });

    let maxTasksInOneDay: number | null = null;
    Object.values(tasksByDayMap).forEach((cnt) => {
      if (maxTasksInOneDay === null || cnt > maxTasksInOneDay) {
        maxTasksInOneDay = cnt;
      }
    });

    // Has any history
    const hasAnyHistory =
      reminders.some((r) => r.isCompleted) ||
      routineHistory.length > 0 ||
      focusHistory.length > 0 ||
      currentStreak > 0;

    // Milestone celebration check
    let milestoneToCelebrate: number | null = null;
    if (currentStreak >= 3) {
      // Find highest reached milestone not yet shown
      for (const m of MEANINGFUL_MILESTONES) {
        if (currentStreak >= m && !this.shownMilestones.has(m)) {
          milestoneToCelebrate = m;
        }
      }
    }

    return {
      streakSummary: {
        currentStreak,
        bestStreak,
      },
      todaySummary: {
        completedTasks: todayCompletedTasks,
        focusMinutes: todayFocusMinutes,
        completedRoutines: todayCompletedRoutines,
      },
      weeklyProgress: {
        overallPercent,
        days: weekDays,
      },
      weeklyMetrics: {
        completedTasks: weekTasksCompleted,
        tasksDiffPercent,
        focusMinutes: weekFocusMinutes,
        focusDiffPercent,
        completedRoutines: weekRoutinesCompleted,
        routinesDiffPercent,
      },
      routineStreaks,
      focusStats: {
        todayMinutes: todayFocusMinutes,
        thisWeekMinutes: weekFocusMinutes,
        sessionCount: focusSessionCount,
        avgDurationMinutes,
      },
      taskStats: {
        todayCompleted: todayCompletedTasks,
        thisWeekCompleted: weekTasksCompleted,
        overdueCount: overdueTasks,
      },
      personalBests: {
        longestFocusMinutes,
        bestRoutineStreak,
        maxTasksInOneDay,
      },
      hasAnyHistory,
      milestoneToCelebrate,
    };
  }
}

export const progressService = new ProgressService();
