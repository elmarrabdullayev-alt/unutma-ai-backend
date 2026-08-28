import { Capacitor } from '@capacitor/core';
import { NotificationProvider } from './NotificationProvider';
import { WebNotificationProvider } from './WebNotificationProvider';
import { CapacitorLocalNotificationProvider } from './CapacitorLocalNotificationProvider';

export * from './NotificationProvider';
export * from './WebNotificationProvider';
export * from './CapacitorLocalNotificationProvider';

let instance: NotificationProvider | null = null;

export function getNotificationProvider(): NotificationProvider {
  if (!instance) {
    if (Capacitor.isNativePlatform()) {
      const capProvider = new CapacitorLocalNotificationProvider();
      if (capProvider.isAvailable()) {
        instance = capProvider;
        return instance;
      }
    }
    instance = new WebNotificationProvider();
  }
  return instance;
}
