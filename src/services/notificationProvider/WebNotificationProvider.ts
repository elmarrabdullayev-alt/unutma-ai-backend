import { Reminder } from '../../types';
import { playReminderAlarmSound } from '../../utils/soundUtils';
import { NotificationProvider, NotificationActionCallback } from './NotificationProvider';

interface ScheduledWebTimer {
  reminderId: string;
  timeoutId: number;
  scheduledTime: number;
  reminder: Reminder;
}

export class WebNotificationProvider implements NotificationProvider {
  public readonly name = 'WebNotificationProvider';
  private scheduledMap: Map<string, ScheduledWebTimer> = new Map();
  private alarmTriggerListeners: Array<(reminder: Reminder) => void> = [];
  private actionListeners: Array<NotificationActionCallback> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.checkPendingAlarms();
        }
      });
    }
  }

  public isAvailable(): boolean {
    return typeof window !== 'undefined';
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    try {
      return await Notification.requestPermission();
    } catch (err) {
      console.warn('[WebNotificationProvider] Permission request failed:', err);
      return 'denied';
    }
  }

  public async getPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  public async schedule(reminder: Reminder, onTrigger?: () => void): Promise<void> {
    if (reminder.isCompleted || reminder.notificationEnabled === false) {
      await this.cancel(reminder.id);
      return;
    }

    const dueTime = new Date(reminder.dueDateTime).getTime();
    const now = Date.now();
    const delay = dueTime - now;

    await this.cancel(reminder.id);

    if (delay <= 0) {
      if (Math.abs(delay) < 2 * 60 * 1000 && !reminder.notified) {
        this.triggerAlarm(reminder);
        if (onTrigger) onTrigger();
      }
      return;
    }

    if (delay <= 2147483647) {
      const timeoutId = window.setTimeout(() => {
        this.triggerAlarm(reminder);
        this.scheduledMap.delete(reminder.id);
        if (onTrigger) onTrigger();
      }, delay);

      this.scheduledMap.set(reminder.id, {
        reminderId: reminder.id,
        timeoutId,
        scheduledTime: dueTime,
        reminder,
      });

      console.log(`[WebNotificationProvider] Scheduled "${reminder.title}" in ${Math.round(delay / 1000)}s`);
    }
  }

  public async cancel(reminderId: string): Promise<void> {
    const scheduled = this.scheduledMap.get(reminderId);
    if (scheduled) {
      window.clearTimeout(scheduled.timeoutId);
      this.scheduledMap.delete(reminderId);
      console.log(`[WebNotificationProvider] Cancelled notification for ${reminderId}`);
    }
  }

  public async cancelAll(): Promise<void> {
    this.scheduledMap.forEach((item) => window.clearTimeout(item.timeoutId));
    this.scheduledMap.clear();
  }

  public async rescheduleAll(reminders: Reminder[]): Promise<void> {
    await this.cancelAll();
    for (const r of reminders) {
      if (!r.isCompleted && r.notificationEnabled !== false) {
        await this.schedule(r);
      }
    }
  }

  public onNotificationAction(callback: NotificationActionCallback): () => void {
    this.actionListeners.push(callback);
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

  private triggerAlarm(reminder: Reminder) {
    // 1. Play alert sound
    playReminderAlarmSound();

    // 2. In-app listeners (active alarm banner, modals)
    this.alarmTriggerListeners.forEach((cb) => cb(reminder));

    // 3. Web Notification API if granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const timeStr = new Date(reminder.dueDateTime).toLocaleTimeString('az-AZ', {
          hour: '2-digit',
          minute: '2-digit',
        });

        const notif = new Notification(`🔔 Unutma AI: ${reminder.title}`, {
          body: reminder.description
            ? `${reminder.description}\nVaxt: ${timeStr}`
            : `Xatırlatma vaxtı çatdı! (${timeStr})`,
          icon: '/favicon.ico',
          tag: reminder.id,
          requireInteraction: true,
        });

        notif.onclick = () => {
          window.focus();
          notif.close();
          this.actionListeners.forEach((cb) => cb(reminder.id, 'tap'));
        };
      } catch (err) {
        console.warn('[WebNotificationProvider] System notification error:', err);
      }
    }
  }

  private checkPendingAlarms() {
    const now = Date.now();
    this.scheduledMap.forEach((val, id) => {
      if (val.scheduledTime <= now) {
        window.clearTimeout(val.timeoutId);
        this.scheduledMap.delete(id);
      }
    });
  }
}
