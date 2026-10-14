import {
  Reminder,
  ExtractedReminderDraft,
  AIActionPayload,
  ReminderCategory,
  ReminderRecurrence,
} from '../types';
import { getReminderStorageProvider, ReminderStorageProvider } from '../storage/ReminderStorageProvider';
import { notificationService } from './notificationService';
import { getLocalYMD } from '../utils/dateUtils';

type ReminderListener = (reminders: Reminder[]) => void;

class ReminderService {
  private storage: ReminderStorageProvider;
  private reminders: Reminder[] = [];
  private listeners: ReminderListener[] = [];
  private isLoaded = false;

  private initPromise: Promise<void>;

  constructor() {
    this.storage = getReminderStorageProvider();
    this.initPromise = this.init();
  }

  public async waitUntilLoaded(): Promise<void> {
    await this.initPromise;
  }

  private async init() {
    try {
      const stored = await this.storage.getAll();
      if (stored && stored.length > 0) {
        const existingIds = new Set(stored.map((r) => r.id));
        const newlyAdded = this.reminders.filter((r) => !existingIds.has(r.id));
        this.reminders = [...stored, ...newlyAdded];
        if (newlyAdded.length > 0) {
          await this.storage.saveAll(this.reminders);
        }
      } else if (this.reminders.length > 0) {
        // Reminders created before storage finished loading
        await this.storage.saveAll(this.reminders);
      }
      // NOTE: demo/starter reminders used to be inserted here. They fired real
      // notifications ("call the doctor") for new users and came back every time
      // a user deleted all their reminders, so they are no longer created.
    } catch (e) {
      console.warn('[ReminderService] Init storage error:', e);
    } finally {
      this.isLoaded = true;
      notificationService.rescheduleAll(this.reminders);
      this.notifySubscribers();
    }
  }

  public getStorageProviderName(): string {
    return this.storage.name;
  }

  private persistChain: Promise<void> = Promise.resolve();

  /**
   * Saves are chained so an older snapshot can never finish after (and
   * overwrite) a newer one when several changes happen quickly.
   */
  private persist(): Promise<void> {
    const snapshot = [...this.reminders];
    this.persistChain = this.persistChain.then(async () => {
      try {
        await this.storage.saveAll(snapshot);
        console.log(`[VOICE-FLOW] persistence success: count=${snapshot.length}, storage=${this.storage.name}`);
      } catch (e) {
        console.error('[VOICE-FLOW] persistence error:', e);
      }
    });
    return this.persistChain;
  }

  private notifySubscribers() {
    this.listeners.forEach((listener) => listener([...this.reminders]));
  }

  public subscribe(listener: ReminderListener): () => void {
    this.listeners.push(listener);
    // Send immediate current state
    listener([...this.reminders]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getAll(): Reminder[] {
    return [...this.reminders];
  }

  public getById(id: string): Reminder | undefined {
    return this.reminders.find((r) => r.id === id);
  }

  public createReminder(draft: Partial<Reminder> | ExtractedReminderDraft): Reminder {
    const nowISO = new Date().toISOString();
    const newReminder: Reminder = {
      id: draft.id || `rem-${Date.now()}-${Math.random().toString(36).substr(2, 7)}`,
      title: draft.title?.trim() || 'Xatırlatma',
      description: draft.description?.trim() || '',
      dueDateTime: draft.dueDateTime || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      category: (draft.category as ReminderCategory) || 'other',
      recurrence: (draft.recurrence as ReminderRecurrence) || 'none',
      recurrenceDays: (draft as any).recurrenceDays,
      recurrenceInterval: (draft as any).recurrenceInterval,
      recurrenceUnit: (draft as any).recurrenceUnit,
      recurrenceRule: (draft as any).recurrenceRule,
      recurrenceDayOfMonth: (draft as any).recurrenceDayOfMonth,
      priority: draft.priority || 'medium',
      isCompleted: false,
      createdAt: nowISO,
      updatedAt: nowISO,
      notificationEnabled: draft.notificationEnabled !== false,
      sourceVoiceText: (draft as any).sourceVoiceText || '',
      inferredTime: (draft as any).inferredTime || false,
      notified: false,
    };

    this.reminders = [newReminder, ...this.reminders];
    notificationService.scheduleNotification(newReminder);
    this.persist();
    this.notifySubscribers();
    return newReminder;
  }

  public createMultipleReminders(drafts: ExtractedReminderDraft[]): Reminder[] {
    const createdList: Reminder[] = [];
    const nowISO = new Date().toISOString();

    for (const draft of drafts) {
      const newReminder: Reminder = {
        id: `rem-${Date.now()}-${Math.random().toString(36).substr(2, 7)}`,
        title: draft.title?.trim() || 'Xatırlatma',
        description: draft.description?.trim() || '',
        dueDateTime: draft.dueDateTime,
        category: draft.category || 'other',
        recurrence: draft.recurrence || 'none',
        recurrenceDays: draft.recurrenceDays,
        recurrenceInterval: draft.recurrenceInterval,
        recurrenceUnit: draft.recurrenceUnit,
        recurrenceRule: draft.recurrenceRule,
        recurrenceDayOfMonth: draft.recurrenceDayOfMonth,
        priority: draft.priority || 'medium',
        isCompleted: false,
        createdAt: nowISO,
        updatedAt: nowISO,
        notificationEnabled: true,
        inferredTime: draft.inferredTime || false,
        notified: false,
      };

      createdList.push(newReminder);
      notificationService.scheduleNotification(newReminder);
    }

    this.reminders = [...createdList, ...this.reminders];
    this.persist();
    this.notifySubscribers();
    return createdList;
  }

  public updateReminder(id: string, updates: Partial<Reminder>): Reminder | null {
    let updatedReminder: Reminder | null = null;

    this.reminders = this.reminders.map((r) => {
      if (r.id === id) {
        updatedReminder = {
          ...r,
          ...updates,
          updatedAt: new Date().toISOString(),
          // Reset notified if due date changed
          notified: updates.dueDateTime && updates.dueDateTime !== r.dueDateTime ? false : r.notified,
        };
        return updatedReminder;
      }
      return r;
    });

    if (updatedReminder) {
      notificationService.scheduleNotification(updatedReminder);
      this.persist();
      this.notifySubscribers();
    }

    return updatedReminder;
  }

  public deleteReminder(id: string): boolean {
    const exists = this.reminders.some((r) => r.id === id);
    if (!exists) return false;

    notificationService.cancelNotification(id);
    this.reminders = this.reminders.filter((r) => r.id !== id);
    this.persist();
    this.notifySubscribers();
    return true;
  }

  public toggleComplete(id: string): Reminder | null {
    const target = this.reminders.find((r) => r.id === id);
    if (!target) return null;

    const nextCompleted = !target.isCompleted;
    const nowISO = new Date().toISOString();

    // If completed and has recurrence, generate next recurring event
    if (nextCompleted && target.recurrence && target.recurrence !== 'none') {
      this.scheduleNextRecurringInstance(target);
    }

    return this.updateReminder(id, {
      isCompleted: nextCompleted,
      completedAt: nextCompleted ? nowISO : undefined,
    });
  }

  /** Marks a reminder as done (never un-completes it, unlike toggleComplete). */
  public completeReminder(id: string): Reminder | null {
    const target = this.reminders.find((r) => r.id === id);
    if (!target) return null;
    if (target.isCompleted) return target;
    return this.toggleComplete(id);
  }

  public snooze(id: string, minutes: number): Reminder | null {
    const target = this.reminders.find((r) => r.id === id);
    if (!target) return null;

    // Snooze from "now" when the reminder is already overdue; otherwise the
    // new time could still be in the past and the alarm would fire again at once.
    const currentDueMs = new Date(target.dueDateTime).getTime();
    const baseMs = isNaN(currentDueMs) ? Date.now() : Math.max(Date.now(), currentDueMs);
    const newDue = new Date(baseMs + minutes * 60 * 1000);

    return this.updateReminder(id, {
      dueDateTime: newDue.toISOString(),
      notified: false,
      isCompleted: false,
    });
  }

  public search(query: string): Reminder[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.reminders;

    return this.reminders.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        r.category.toLowerCase().includes(q)
    );
  }

  public getDailySchedule(date: Date): Reminder[] {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    return this.reminders.filter((r) => {
      const rDate = new Date(r.dueDateTime);
      return (
        rDate.getFullYear() === year &&
        rDate.getMonth() === month &&
        rDate.getDate() === day
      );
    }).sort((a, b) => new Date(a.dueDateTime).getTime() - new Date(b.dueDateTime).getTime());
  }

  public getWeeklyAnalysis(startDate: Date = new Date()): {
    dayStats: Array<{ dayName: string; date: string; count: number; hoursBusy: number }>;
    leastBusyDay: string;
  } {
    const daysNameAz = ['Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə'];
    const result: Array<{ dayName: string; date: string; count: number; hoursBusy: number }> = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const items = this.getDailySchedule(d);

      result.push({
        dayName: daysNameAz[d.getDay()],
        date: getLocalYMD(d),
        count: items.length,
        hoursBusy: items.length * 1.5, // estimate
      });
    }

    const leastBusy = [...result].sort((a, b) => a.count - b.count)[0];

    return {
      dayStats: result,
      leastBusyDay: leastBusy ? leastBusy.dayName : 'Bazar ertəsi',
    };
  }

  // Structured Action Executor for AI Assistant
  public executeAIAction(payload: AIActionPayload): {
    success: boolean;
    message: string;
    affectedReminders?: Reminder[];
  } {
    switch (payload.action) {
      case 'create_reminder':
      case 'create_multiple_reminders': {
        if (payload.remindersToCreate && payload.remindersToCreate.length > 0) {
          const created = this.createMultipleReminders(payload.remindersToCreate);
          return {
            success: true,
            message: payload.responseMessage || `${created.length} xatırlatma uğurla əlavə edildi.`,
            affectedReminders: created,
          };
        }
        return { success: false, message: 'Yaradılacaq xatırlatma tapılmadı.' };
      }

      case 'update_reminder': {
        if (payload.targetReminderId && payload.updateFields) {
          const updated = this.updateReminder(payload.targetReminderId, payload.updateFields);
          if (updated) {
            return {
              success: true,
              message: payload.responseMessage || 'Xatırlatma yeniləndi.',
              affectedReminders: [updated],
            };
          }
        }
        if (payload.targetReminderId && payload.delayMinutes) {
          const snoozed = this.snooze(payload.targetReminderId, payload.delayMinutes);
          if (snoozed) {
            return {
              success: true,
              message: payload.responseMessage || `Xatırlatma ${payload.delayMinutes} dəqiqə təxirə salındı.`,
              affectedReminders: [snoozed],
            };
          }
        }
        return { success: false, message: 'Yenilənəcək xatırlatma tapılmadı.' };
      }

      case 'delete_reminder': {
        if (payload.targetReminderId) {
          const deleted = this.deleteReminder(payload.targetReminderId);
          return {
            success: deleted,
            message: deleted ? payload.responseMessage || 'Xatırlatma silindi.' : 'Xatırlatma tapılmadı.',
          };
        }
        return { success: false, message: 'Silinəcək xatırlatma müəyyən edilmədi.' };
      }

      case 'complete_reminder': {
        if (payload.targetReminderId) {
          const target = this.getById(payload.targetReminderId);
          if (target && !target.isCompleted) {
            const completed = this.toggleComplete(payload.targetReminderId);
            return {
              success: true,
              message: payload.responseMessage || 'Xatırlatma tamamlandı!',
              affectedReminders: completed ? [completed] : [],
            };
          }
        }
        return { success: false, message: 'Tamamlanacaq xatırlatma tapılmadı.' };
      }

      default:
        return { success: true, message: payload.responseMessage || 'Sorğunuz icra edildi.' };
    }
  }

  public async importReminders(newReminders: Reminder[]) {
    // Drop malformed entries from a backup file so they can't crash the UI.
    const valid = (Array.isArray(newReminders) ? newReminders : []).filter(
      (r: any) =>
        r &&
        typeof r === 'object' &&
        typeof r.id === 'string' &&
        typeof r.title === 'string' &&
        typeof r.dueDateTime === 'string' &&
        !isNaN(new Date(r.dueDateTime).getTime())
    );
    this.reminders = valid.map((r) => ({
      ...r,
      category: r.category || 'other',
      recurrence: r.recurrence || 'none',
      priority: r.priority || 'medium',
      isCompleted: Boolean(r.isCompleted),
      notificationEnabled: r.notificationEnabled !== false,
      createdAt: r.createdAt || new Date().toISOString(),
    }));
    await this.persist();
    notificationService.rescheduleAll(this.reminders);
    this.notifySubscribers();
  }

  /** Adds months without overflowing (Jan 31 + 1 month = Feb 28/29, not Mar 3). */
  private addMonths(date: Date, months: number, dayOfMonth?: number): Date {
    const result = new Date(date);
    const wantedDay = dayOfMonth || date.getDate();
    result.setDate(1);
    result.setMonth(result.getMonth() + months);
    const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(wantedDay, lastDay));
    return result;
  }

  private nextOccurrence(r: Reminder, from: Date): Date | null {
    const next = new Date(from);
    if (r.recurrenceInterval && r.recurrenceUnit) {
      const n = Math.max(1, r.recurrenceInterval);
      if (r.recurrenceUnit === 'day') next.setDate(next.getDate() + n);
      else if (r.recurrenceUnit === 'week') next.setDate(next.getDate() + n * 7);
      else if (r.recurrenceUnit === 'month') return this.addMonths(next, n, r.recurrenceDayOfMonth);
      else if (r.recurrenceUnit === 'year') next.setFullYear(next.getFullYear() + n);
      else return null;
      return next;
    }
    switch (r.recurrence) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        return next;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        return next;
      case 'monthly':
        return this.addMonths(next, 1, r.recurrenceDayOfMonth);
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

  private scheduleNextRecurringInstance(r: Reminder) {
    let next = this.nextOccurrence(r, new Date(r.dueDateTime));
    if (!next) return;

    // If the reminder was completed late, skip occurrences that are already in
    // the past so the new instance doesn't fire immediately.
    let guard = 0;
    while (next && next.getTime() <= Date.now() && guard++ < 1000) {
      next = this.nextOccurrence(r, next);
    }
    if (!next) return;

    // Completing, un-completing and completing again must not create duplicates.
    const nextISO = next.toISOString();
    const alreadyExists = this.reminders.some(
      (x) => x.id !== r.id && x.title === r.title && x.dueDateTime === nextISO
    );
    if (alreadyExists) return;

    this.createReminder({
      title: r.title,
      description: r.description,
      dueDateTime: nextISO,
      category: r.category,
      recurrence: r.recurrence,
      recurrenceDays: r.recurrenceDays,
      recurrenceInterval: r.recurrenceInterval,
      recurrenceUnit: r.recurrenceUnit,
      recurrenceRule: r.recurrenceRule,
      recurrenceDayOfMonth: r.recurrenceDayOfMonth,
      priority: r.priority,
      notificationEnabled: r.notificationEnabled !== false,
    });
  }
}

export const reminderService = new ReminderService();
