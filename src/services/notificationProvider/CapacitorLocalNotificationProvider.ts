import { Capacitor } from '@capacitor/core';
import {
  LocalNotifications,
  ScheduleOptions,
  LocalNotificationSchema,
  ScheduleEvery,
} from '@capacitor/local-notifications';
import { Reminder } from '../../types';
import { playReminderAlarmSound } from '../../utils/soundUtils';
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
      // 1. Setup Android Notification Channel with high priority and alarm sound
      if (Capacitor.getPlatform() === 'android') {
        await LocalNotifications.createChannel({
          id: 'unutma_reminders_channel',
          name: 'Unutma AI Xatırlatmaları',
          description: 'Dəqiq vaxtlı səsli və vizual xatırlatma siqnalları',
          importance: 5, // High / Max
          visibility: 1, // Public on lock screen
          sound: 'reminder_alarm.wav',
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

  public async schedule(reminder: Reminder, onTrigger?: () => void): Promise<void> {
    if (!this.isAvailable()) return;
    if (reminder.isCompleted || reminder.notificationEnabled === false) {
      await this.cancel(reminder.id);
      return;
    }

    const dueTime = new Date(reminder.dueDateTime);
    const now = Date.now();

    // First cancel existing to prevent duplicates
    await this.cancel(reminder.id);

    // If already past by more than 2 minutes, ignore
    if (dueTime.getTime() < now - 2 * 60 * 1000) {
      return;
    }

    const intId = this.stringToNotificationId(reminder.id);
    const timeStr = dueTime.toLocaleTimeString('az-AZ', {
      hour: '2-digit',
      minute: '2-digit',
    });

    let repeats: boolean | undefined = undefined;
    let every: ScheduleEvery | undefined = undefined;

    if (reminder.recurrence === 'daily') {
      repeats = true;
      every = 'day';
    } else if (reminder.recurrence === 'weekly') {
      repeats = true;
      every = 'week';
    } else if (reminder.recurrence === 'monthly') {
      repeats = true;
      every = 'month';
    } else if (reminder.recurrence === 'yearly') {
      repeats = true;
      every = 'year';
    }

    const notifSchema: LocalNotificationSchema = {
      id: intId,
      title: `🔔 Unutma AI: ${reminder.title}`,
      body: reminder.description
        ? `${reminder.description}\nVaxt: ${timeStr}`
        : `Xatırlatma vaxtı çatdı! (${timeStr})`,
      schedule: {
        at: dueTime.getTime() > now ? dueTime : new Date(now + 1000),
        allowWhileIdle: true,
        repeats,
        every,
      },
      channelId: 'unutma_reminders_channel',
      actionTypeId: 'REMINDER_ACTIONS',
      sound: 'reminder_alarm.wav',
      extra: {
        reminderId: reminder.id,
        reminderData: reminder,
      },
    };

    try {
      await LocalNotifications.schedule({
        notifications: [notifSchema],
      });
      console.log(`[CapacitorNotifications] Scheduled exact native alarm for "${reminder.title}" at ${dueTime.toISOString()}`);
    } catch (e) {
      console.error('[CapacitorNotifications] Schedule error:', e);
    }
  }

  public async cancel(reminderId: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      const intId = this.stringToNotificationId(reminderId);
      await LocalNotifications.cancel({
        notifications: [{ id: intId }],
      });
      console.log(`[CapacitorNotifications] Cancelled notification for ${reminderId}`);
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
    for (const r of reminders) {
      if (!r.isCompleted && r.notificationEnabled !== false) {
        await this.schedule(r);
      }
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
