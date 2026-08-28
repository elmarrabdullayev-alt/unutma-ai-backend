import { Reminder } from '../types';
import { getNotificationProvider, NotificationProvider, NotificationActionCallback } from './notificationProvider';

class NotificationService {
  private provider: NotificationProvider;

  constructor() {
    this.provider = getNotificationProvider();
  }

  public getProviderName(): string {
    return this.provider.name;
  }

  public onAlarmTrigger(callback: (reminder: Reminder) => void): () => void {
    return this.provider.onAlarmTrigger(callback);
  }

  public onNotificationAction(callback: NotificationActionCallback): () => void {
    return this.provider.onNotificationAction(callback);
  }

  public async requestPermission(): Promise<NotificationPermission> {
    return await this.provider.requestPermission();
  }

  public async getPermission(): Promise<NotificationPermission> {
    return await this.provider.getPermission();
  }

  public scheduleNotification(reminder: Reminder, onTrigger?: () => void) {
    this.provider.schedule(reminder, onTrigger).catch((err) => {
      console.warn('[NotificationService] Schedule error:', err);
    });
  }

  public cancelNotification(reminderId: string) {
    this.provider.cancel(reminderId).catch((err) => {
      console.warn('[NotificationService] Cancel error:', err);
    });
  }

  public rescheduleAll(reminders: Reminder[]) {
    this.provider.rescheduleAll(reminders).catch((err) => {
      console.warn('[NotificationService] Reschedule error:', err);
    });
  }

  public cancelAll() {
    this.provider.cancelAll().catch((err) => {
      console.warn('[NotificationService] Cancel all error:', err);
    });
  }
}

export const notificationService = new NotificationService();
