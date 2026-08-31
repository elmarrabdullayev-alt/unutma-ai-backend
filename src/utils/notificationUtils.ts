import { Reminder } from '../types';
import { playReminderAlarmSound } from './soundUtils';

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Bu brauzer bildirişləri dəstəkləmir.');
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Bildiriş icazəsi alınarkən xəta:', err);
    return 'denied';
  }
}

export function sendPushNotification(reminder: Reminder) {
  playReminderAlarmSound();

  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    try {
      const title = `🔔 Unutma AI: ${reminder.title}`;
      const body = reminder.description
        ? `${reminder.description}\nVaxt: ${new Date(reminder.dueDateTime).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}`
        : `Xatırlatma vaxtı çatdı! (${new Date(reminder.dueDateTime).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })})`;

      const notif = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: reminder.id,
        requireInteraction: true,
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch (e) {
      console.warn('Bildiriş göndərilmədi:', e);
    }
  }
}
