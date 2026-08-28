import { Reminder } from '../../types';

export type NotificationActionCallback = (reminderId: string, actionId?: string) => void;

export interface NotificationProvider {
  readonly name: string;
  isAvailable(): boolean;
  requestPermission(): Promise<NotificationPermission>;
  getPermission(): Promise<NotificationPermission>;
  schedule(reminder: Reminder, onTrigger?: () => void): Promise<void>;
  cancel(reminderId: string): Promise<void>;
  cancelAll(): Promise<void>;
  rescheduleAll(reminders: Reminder[]): Promise<void>;
  onNotificationAction(callback: NotificationActionCallback): () => void;
  onAlarmTrigger(callback: (reminder: Reminder) => void): () => void;
}
