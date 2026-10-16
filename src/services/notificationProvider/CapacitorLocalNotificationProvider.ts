import { Capacitor } from '@capacitor/core';
import {
  LocalNotifications,
  ScheduleOptions,
  LocalNotificationSchema,
} from '@capacitor/local-notifications';
import { Reminder } from '../../types';
import { playReminderAlarmSound } from '../../utils/soundUtils';
import { getNativeRepeatKind, getNextOccurrence, isRecurring } from '../../utils/recurrence';
import { NotificationProvider, NotificationActionCallback } from './NotificationProvider';

export class CapacitorLocalNotificationProvider implements NotificationProvider {
  public readonly name = 'CapacitorLocalNotificationProvider';
  private alarmTriggerListeners: Array<(reminder: Reminder) => void> = [];
  private actionListeners: Array<NotificationActionCallback> = [];
  private pendingActions: Array<{ reminderId: string; actionId: string }> = [];
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private async init() {
    if (!this.isAvailable()) return;

    try {
      // 1. Setup Android Notification Channel with high priority and default sound
      if (Capacitor.getPlatform() === 'android') {
        await LocalNotifications.createChannel({
          id: 'unutma_reminders_channel',
          name: 'Unutma AI Xatırlatmaları',
          description: 'Dəqiq vaxtlı səsli və vizual xatırlatma siqnalları',
          importance: 5, // High / Max
          visibility: 1, // Public on lock screen
          vibration: true,
          lights: true,
          lightColor: '#7C3AED',
        });
      }

      // 2. Register Action Types (Complete / Snooze)
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: 'REMINDER_ACTIONS',
            actions: [
              {
                id: 'complete',
                title: '✓ Tamamla',
              },
              {
                id: 'snooze_15',
                title: '⏱ 15 dəq gecikdir',
              },
            ],
          },
        ],
      });

      // 3. Setup tap & action listener
      LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
        const reminderId = String(notificationAction.notification.extra?.reminderId || '');
        const actionId = notificationAction.actionId;
        console.log('[CapacitorNotifications] Action performed:', actionId, 'for reminder:', reminderId);

        if (reminderId) {
          if (this.actionListeners.length > 0) {
            this.actionListeners.forEach((cb) => cb(reminderId, actionId));
          } else {
            this.pendingActions.push({ reminderId, actionId });
          }
        }
      });

      // 4. Setup foreground trigger listener
      LocalNotifications.addListener('localNotificationReceived', (notification) => {
        const extra = notification.extra;
        if (extra && extra.reminderData) {
          playReminderAlarmSound();
          this.alarmTriggerListeners.forEach((cb) => cb(extra.reminderData));
        }
      });

      this.isInitialized = true;
    } catch (e) {
      console.warn('[CapacitorNotifications] Init warning:', e);
    }
  }

  public isAvailable(): boolean {
    return typeof window !== 'undefined' && Capacitor.isPluginAvailable('LocalNotifications');
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isAvailable()) return 'denied';
    try {
      const status = await LocalNotifications.requestPermissions();
      console.log(`[NOTIFICATION] permission status: ${status.display}`);
      if (status.display === 'granted') {
        return 'granted';
      }
      return status.display === 'denied' ? 'denied' : 'default';
    } catch (e) {
      console.warn('[CapacitorNotifications] requestPermission error:', e);
      return 'denied';
    }
  }

  public async getPermission(): Promise<NotificationPermission> {
    if (!this.isAvailable()) return 'denied';
    try {
      const status = await LocalNotifications.checkPermissions();
      console.log(`[NOTIFICATION] permission status: ${status.display}`);
      if (status.display === 'granted') {
        return 'granted';
      }
      return status.display === 'denied' ? 'denied' : 'default';
    } catch (e) {
      return 'denied';
    }
  }

  /**
   * Generates a stable 32-bit integer ID from a reminder string ID
   */
  private stringToNotificationId(idStr: string): number {
    let hash = 0;
    for (let i = 0; i < idStr.length; i++) {
      hash = (hash << 5) - hash + idStr.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash % 1000000000);
  }

  /** Extra notification slots per reminder (weekdays need 5, upcoming one-shots up to 3). */
  private static readonly SLOTS_PER_REMINDER = 6;
  /** iOS keeps at most 64 pending notifications; leave a little headroom. */
  private static readonly MAX_PENDING = 60;

  private slotIds(reminderId: string): number[] {
    const ids = [this.stringToNotificationId(reminderId)];
    for (let k = 1; k <= CapacitorLocalNotificationProvider.SLOTS_PER_REMINDER; k++) {
      ids.push(this.stringToNotificationId(`${reminderId}#${k}`));
    }
    return ids;
  }

  /**
   * Turns a reminder into the native notifications that represent it.
   *
   * IMPORTANT: the plugin's `at` + `repeats` does NOT repeat daily/weekly on
   * either platform — it repeats every (at - now) milliseconds, and `every` is
   * ignored when `at` is set (see LocalNotificationsPlugin.swift and
   * LocalNotificationManager.kt). Real calendar repeats need `on`.
   */
  private buildNotifications(reminder: Reminder): Array<{ schema: LocalNotificationSchema; fireAt: number; repeating: boolean }> {
    if (reminder.isCompleted || reminder.notificationEnabled === false) return [];

    const due = new Date(reminder.dueDateTime);
    if (isNaN(due.getTime())) return [];
    const now = Date.now();
    const ids = this.slotIds(reminder.id);
    const hour = due.getHours();
    const minute = due.getMinutes();

    const make = (slot: number, schedule: LocalNotificationSchema['schedule'], fireAt: Date): LocalNotificationSchema => {
      const timeStr = fireAt.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' });
      return {
        id: ids[slot],
        title: `🔔 Unutma AI: ${reminder.title}`,
        body: reminder.description ? `${reminder.description}\nVaxt: ${timeStr}` : `Xatırlatma vaxtı çatdı! (${timeStr})`,
        schedule,
        channelId: 'unutma_reminders_channel',
        actionTypeId: 'REMINDER_ACTIONS',
        sound: 'default',
        extra: { reminderId: reminder.id, reminderData: reminder },
      };
    };

    const result: Array<{ schema: LocalNotificationSchema; fireAt: number; repeating: boolean }> = [];

    if (isRecurring(reminder)) {
      const kind = getNativeRepeatKind(reminder);
      // A calendar repeat fires at its next calendar match. If the reminder's
      // first occurrence is later than that (start date in the future), using it
      // now would fire too early, so fall back to one-shots until then.
      const startReached = kind ? due.getTime() <= this.nextCalendarMatch(kind, due, now) + 60 * 1000 : false;

      if (kind && startReached) {
        if (kind === 'daily') {
          result.push({ schema: make(0, { on: { hour, minute, second: 0 }, allowWhileIdle: true }, due), fireAt: due.getTime(), repeating: true });
        } else if (kind === 'weekly') {
          // Capacitor weekday: 1 = Sunday ... 7 = Saturday
          result.push({ schema: make(0, { on: { weekday: due.getDay() + 1, hour, minute, second: 0 }, allowWhileIdle: true }, due), fireAt: due.getTime(), repeating: true });
        } else if (kind === 'monthly') {
          const day = reminder.recurrenceDayOfMonth || due.getDate();
          result.push({ schema: make(0, { on: { day, hour, minute, second: 0 }, allowWhileIdle: true }, due), fireAt: due.getTime(), repeating: true });
        } else if (kind === 'weekdays') {
          [2, 3, 4, 5, 6].forEach((weekday, i) => {
            result.push({ schema: make(i, { on: { weekday, hour, minute, second: 0 }, allowWhileIdle: true }, due), fireAt: due.getTime(), repeating: true });
          });
        }
        return result;
      }

      // Every N days/weeks, yearly, or a future start: schedule the next few
      // occurrences one by one; they are topped up whenever the app opens.
      let occ: Date | null = due;
      let guard = 0;
      while (occ && occ.getTime() < now - 2 * 60 * 1000 && guard++ < 1000) {
        occ = getNextOccurrence(reminder, occ);
      }
      for (let slot = 0; occ && slot < 3; slot++) {
        result.push({ schema: make(slot, { at: occ, allowWhileIdle: true }, occ), fireAt: occ.getTime(), repeating: false });
        occ = getNextOccurrence(reminder, occ);
      }
      return result;
    }

    // One-time reminder. Already past by more than 2 minutes -> nothing to do.
    if (due.getTime() < now - 2 * 60 * 1000) return [];
    const fireAt = due.getTime() > now ? due : new Date(now + 1000);
    result.push({ schema: make(0, { at: fireAt, allowWhileIdle: true }, fireAt), fireAt: fireAt.getTime(), repeating: false });
    return result;
  }

  /** Next time (ms) a native calendar repeat of this shape would fire after `now`. */
  private nextCalendarMatch(kind: 'daily' | 'weekly' | 'monthly' | 'weekdays', due: Date, now: number): number {
    const c = new Date(now);
    c.setHours(due.getHours(), due.getMinutes(), 0, 0);
    for (let i = 0; i < 400; i++) {
      const ok =
        kind === 'daily' ||
        (kind === 'weekly' && c.getDay() === due.getDay()) ||
        (kind === 'weekdays' && c.getDay() >= 1 && c.getDay() <= 5) ||
        (kind === 'monthly' && c.getDate() === due.getDate());
      if (ok && c.getTime() > now) return c.getTime();
      c.setDate(c.getDate() + 1);
    }
    return Number.MAX_SAFE_INTEGER;
  }

  public async schedule(reminder: Reminder, onTrigger?: () => void): Promise<void> {
    if (!this.isAvailable()) return;

    // First cancel existing to prevent duplicates (all slots)
    await this.cancel(reminder.id);

    const notifications = this.buildNotifications(reminder).map((n) => n.schema);
    if (notifications.length === 0) return;

    try {
      await LocalNotifications.schedule({ notifications });
      console.log(`[CapacitorNotifications] Scheduled ${notifications.length} notification(s) for "${reminder.title}"`);
    } catch (e) {
      console.error('[CapacitorNotifications] Schedule error:', e);
    }
  }

  public async cancel(reminderId: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await LocalNotifications.cancel({
        notifications: this.slotIds(reminderId).map((id) => ({ id })),
      });
    } catch (e) {
      console.warn('[CapacitorNotifications] Cancel warning:', e);
    }
  }

  public async cancelAll(): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map((n) => ({ id: n.id })),
        });
      }
    } catch (e) {
      console.warn('[CapacitorNotifications] cancelAll error:', e);
    }
  }

  public async rescheduleAll(reminders: Reminder[]): Promise<void> {
    if (!this.isAvailable()) return;
    await this.cancelAll();

    // Repeating notifications first (they occupy one slot forever), then the
    // soonest one-shots, capped below the iOS limit of 64 pending notifications.
    const all = reminders.flatMap((r) => this.buildNotifications(r));
    all.sort((a, b) => (a.repeating === b.repeating ? a.fireAt - b.fireAt : a.repeating ? -1 : 1));
    const selected = all.slice(0, CapacitorLocalNotificationProvider.MAX_PENDING).map((n) => n.schema);
    if (all.length > selected.length) {
      console.warn(`[CapacitorNotifications] ${all.length - selected.length} notification(s) deferred (OS limit); they are scheduled on a later app launch.`);
    }
    if (selected.length === 0) return;

    try {
      await LocalNotifications.schedule({ notifications: selected });
    } catch (e) {
      console.error('[CapacitorNotifications] rescheduleAll error:', e);
    }
  }

  public onNotificationAction(callback: NotificationActionCallback): () => void {
    this.actionListeners.push(callback);
    // Flush any pending actions received before listener was registered
    if (this.pendingActions.length > 0) {
      const actionsToFlush = [...this.pendingActions];
      this.pendingActions = [];
      actionsToFlush.forEach(({ reminderId, actionId }) => {
        try {
          callback(reminderId, actionId);
        } catch (e) {
          console.warn('[CapacitorNotifications] Error flushing pending action:', e);
        }
      });
    }
    return () => {
      this.actionListeners = this.actionListeners.filter((cb) => cb !== callback);
    };
  }

  public onAlarmTrigger(callback: (reminder: Reminder) => void): () => void {
    this.alarmTriggerListeners.push(callback);
    return () => {
      this.alarmTriggerListeners = this.alarmTriggerListeners.filter((cb) => cb !== callback);
    };
  }
}
