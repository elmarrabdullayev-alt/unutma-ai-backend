import {
  Reminder,
  ExtractedReminderDraft,
  AIActionPayload,
  ReminderCategory,
  ReminderRecurrence,
} from '../types';
import { getReminderStorageProvider, ReminderStorageProvider } from '../storage/ReminderStorageProvider';
import { notificationService } from './notificationService';

type ReminderListener = (reminders: Reminder[]) => void;

class ReminderService {
  private storage: ReminderStorageProvider;
  private reminders: Reminder[] = [];
  private listeners: ReminderListener[] = [];
  private isLoaded = false;

  constructor() {
    this.storage = getReminderStorageProvider();
    this.init();
  }

  private async init() {
    try {
      const stored = await this.storage.getAll();
      if (stored && stored.length > 0) {
        this.reminders = stored;
      } else {
        this.reminders = this.generateStarterReminders();
        await this.storage.saveAll(this.reminders);
      }
    } catch (e) {
      console.warn('[ReminderService] Init storage error:', e);
      if (this.reminders.length === 0) {
        this.reminders = this.generateStarterReminders();
      }
    } finally {
      this.isLoaded = true;
      notificationService.rescheduleAll(this.reminders);
      this.notifySubscribers();
    }
  }

  public getStorageProviderName(): string {
    return this.storage.name;
  }

  private async persist() {
    try {
      await this.storage.saveAll(this.reminders);
    } catch (e) {
      console.error('[ReminderService] Persist error:', e);
    }
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

  public snooze(id: string, minutes: number): Reminder | null {
    const target = this.reminders.find((r) => r.id === id);
    if (!target) return null;

    const currentDue = new Date(target.dueDateTime);
    const newDue = new Date(currentDue.getTime() + minutes * 60 * 1000);

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
        date: d.toISOString().slice(0, 10),
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
    this.reminders = newReminders;
    await this.persist();
    notificationService.rescheduleAll(this.reminders);
    this.notifySubscribers();
  }

  private scheduleNextRecurringInstance(r: Reminder) {
    const current = new Date(r.dueDateTime);
    const next = new Date(current);

    if (r.recurrence === 'daily') {
      next.setDate(next.getDate() + 1);
    } else if (r.recurrence === 'weekly') {
      next.setDate(next.getDate() + 7);
    } else if (r.recurrence === 'monthly') {
      next.setMonth(next.getMonth() + 1);
    } else if (r.recurrence === 'yearly') {
      next.setFullYear(next.getFullYear() + 1);
    } else {
      return;
    }

    this.createReminder({
      title: r.title,
      description: r.description,
      dueDateTime: next.toISOString(),
      category: r.category,
      recurrence: r.recurrence,
      priority: r.priority,
      notificationEnabled: true,
    });
  }

  private generateStarterReminders(): Reminder[] {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return [
      {
        id: 'starter-1',
        title: 'Həkimə zəng et və analiz nəticələrini soruş',
        description: 'Qan analizi və ultrasəs cavabları',
        dueDateTime: new Date(new Date().setHours(new Date().getHours() + 2, 0, 0, 0)).toISOString(),
        category: 'health',
        recurrence: 'none',
        priority: 'high',
        isCompleted: false,
        createdAt: now.toISOString(),
        notificationEnabled: true,
        notified: false,
        sourceVoiceText: 'Sabah saat 10-da həkimə zəng et',
      },
      {
        id: 'starter-2',
        title: 'Maşını ustaya apar',
        description: 'Yağ və əyləc mayesini yoxlatmaq',
        dueDateTime: new Date(tomorrow.setHours(14, 0, 0, 0)).toISOString(),
        category: 'personal',
        recurrence: 'none',
        priority: 'medium',
        isCompleted: false,
        createdAt: now.toISOString(),
        notificationEnabled: true,
        notified: false,
      },
      {
        id: 'starter-3',
        title: 'Mənzil kirayə haqqını ödə',
        description: 'Ev sahibinin bank kartına köçürmə',
        dueDateTime: (() => {
          const d = new Date();
          d.setDate(5);
          if (d.getTime() < Date.now()) {
            d.setMonth(d.getMonth() + 1);
          }
          d.setHours(10, 0, 0, 0);
          return d.toISOString();
        })(),
        category: 'finance',
        recurrence: 'monthly',
        priority: 'high',
        isCompleted: false,
        createdAt: now.toISOString(),
        notificationEnabled: true,
        notified: false,
      },
    ];
  }
}

export const reminderService = new ReminderService();
