import { Capacitor } from '@capacitor/core';

/**
 * Sound file for local notifications.
 *
 * iOS: the plugin treats `sound` as a FILE NAME (UNNotificationSound(named:)).
 * The old value 'default' looked for a file called "default", found nothing,
 * and iOS delivered every reminder silently. The file lives in /public, which
 * Capacitor copies into the app bundle's public/ folder, where the plugin looks.
 *
 * Android 8+: sound comes from the notification channel (system default), so
 * we leave it unset there.
 */
export const NOTIFICATION_SOUND_FILE = 'unutma-chime.wav';

export function getNotificationSound(): string | undefined {
  return Capacitor.getPlatform() === 'ios' ? NOTIFICATION_SOUND_FILE : undefined;
}
