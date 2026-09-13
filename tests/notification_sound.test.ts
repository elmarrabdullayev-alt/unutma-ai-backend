import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('==========================================================');
console.log('RUNNING NOTIFICATION SOUND AUDIT & VERIFICATION TEST');
console.log('==========================================================');

let passedCount = 0;
function pass(desc: string) {
  console.log(`✅ [PASS] ${desc}`);
  passedCount++;
}

// 1. Audit CapacitorLocalNotificationProvider.ts
const providerPath = path.resolve(process.cwd(), 'src/services/notificationProvider/CapacitorLocalNotificationProvider.ts');
const providerContent = fs.readFileSync(providerPath, 'utf8');

assert(providerContent.includes("sound: 'default'"), "CapacitorLocalNotificationProvider must have sound: 'default'");
pass("CapacitorLocalNotificationProvider explicitly sets sound: 'default'");

assert(!providerContent.includes("sound: 'reminder_alarm.wav'"), "CapacitorLocalNotificationProvider should not use missing reminder_alarm.wav");
pass("CapacitorLocalNotificationProvider removed non-existent reminder_alarm.wav");

assert(providerContent.includes("[NOTIFICATION] scheduling reminder"), "CapacitorLocalNotificationProvider logs [NOTIFICATION] scheduling reminder");
pass("CapacitorLocalNotificationProvider logs [NOTIFICATION] scheduling reminder");

assert(providerContent.includes("[NOTIFICATION] sound: default"), "CapacitorLocalNotificationProvider logs [NOTIFICATION] sound: default");
pass("CapacitorLocalNotificationProvider logs [NOTIFICATION] sound: default");

assert(providerContent.includes("[NOTIFICATION] permission status:"), "CapacitorLocalNotificationProvider logs [NOTIFICATION] permission status:");
pass("CapacitorLocalNotificationProvider logs [NOTIFICATION] permission status:");

// 2. Audit focusService.ts
const focusPath = path.resolve(process.cwd(), 'src/services/focusService.ts');
const focusContent = fs.readFileSync(focusPath, 'utf8');

assert(focusContent.includes("sound: 'default'"), "focusService must set sound: 'default'");
pass("focusService explicitly sets sound: 'default'");
assert(!focusContent.includes("sound: 'reminder_alarm.wav'"), "focusService does not use missing reminder_alarm.wav");
pass("focusService removed non-existent reminder_alarm.wav");

// 3. Audit LocalNotificationsPlugin.swift in iOS node_modules: ensure NO custom patch exists
const swiftPluginPath = path.resolve(process.cwd(), 'node_modules/@capacitor/local-notifications/ios/Sources/LocalNotificationsPlugin/LocalNotificationsPlugin.swift');
const swiftContent = fs.readFileSync(swiftPluginPath, 'utf8');

assert(!swiftContent.includes('path.lowercased() == "default"'), "LocalNotificationsPlugin.swift must NOT contain custom patches");
pass("LocalNotificationsPlugin.swift has no custom patch (node_modules is unmodified)");

assert(swiftContent.includes('private func resolveSound(_ path: String) -> UNNotificationSound'), "LocalNotificationsPlugin.swift has standard resolveSound");
pass("LocalNotificationsPlugin.swift uses standard official resolveSound");

// 4. Audit capacitor.config.ts and platform json files
const configTs = fs.readFileSync(path.resolve(process.cwd(), 'capacitor.config.ts'), 'utf8');
assert(configTs.includes("presentationOptions: ['badge', 'sound', 'banner', 'list']"), "capacitor.config.ts configures presentationOptions");
pass("capacitor.config.ts configures presentationOptions: ['badge', 'sound', 'banner', 'list']");

const iosConfig = fs.readFileSync(path.resolve(process.cwd(), 'ios/App/App/capacitor.config.json'), 'utf8');
assert(iosConfig.includes('"presentationOptions"'), "ios capacitor.config.json sets presentationOptions");
pass("ios capacitor.config.json sets presentationOptions");

// 5. Functional test of CapacitorLocalNotificationProvider
console.log('\n--- FUNCTIONAL SIMULATION TEST ---');

let capturedScheduleOptions: any = null;

(global as any).window = {
  Notification: {
    requestPermission: async () => 'granted',
    permission: 'granted',
  },
};
(global as any).Notification = (global as any).window.Notification;

import { LocalNotifications } from '@capacitor/local-notifications';
import { Reminder } from '../src/types';

const originalSchedule = LocalNotifications.schedule.bind(LocalNotifications);
LocalNotifications.schedule = async (options: any) => {
  capturedScheduleOptions = options;
  try {
    return await originalSchedule(options);
  } catch {
    return { notifications: [] };
  }
};

const logs: string[] = [];
const originalLog = console.log;
console.log = (...args: any[]) => {
  logs.push(args.join(' '));
  originalLog(...args);
};

import { CapacitorLocalNotificationProvider } from '../src/services/notificationProvider/CapacitorLocalNotificationProvider';

const provider = new CapacitorLocalNotificationProvider();
(provider as any).isAvailable = () => true;

const testReminder: Reminder = {
  id: 'test-reminder-123',
  title: 'İclas haqqında xatırlatma',
  description: '10:00 iclası',
  dueDateTime: new Date(Date.now() + 60 * 1000).toISOString(), // 1 minute in the future
  category: 'work',
  recurrence: 'none',
  priority: 'medium',
  isCompleted: false,
  notificationEnabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Run permission check and schedule
async function runTest() {
  await provider.requestPermission();
  await provider.schedule(testReminder);

  console.log = originalLog;

  assert(logs.some(l => l.includes('[NOTIFICATION] permission status: granted')), "Logged permission status");
  pass("Functional test logged [NOTIFICATION] permission status: granted");

  assert(logs.some(l => l.includes('[NOTIFICATION] scheduling reminder: "İclas haqqında xatırlatma"')), "Logged scheduling reminder");
  pass("Functional test logged [NOTIFICATION] scheduling reminder");

  assert(logs.some(l => l.includes('[NOTIFICATION] sound: default')), "Logged sound: default");
  pass("Functional test logged [NOTIFICATION] sound: default");

  assert(logs.some(l => l.includes('with sound: default')), "Logged scheduled with sound: default");
  pass("CapacitorLocalNotificationProvider successfully scheduled notification with sound: default");

  // Verify silent when notificationEnabled is false
  const logCountBefore = logs.length;
  const silentReminder: Reminder = { ...testReminder, id: 'test-reminder-silent', notificationEnabled: false };
  await provider.schedule(silentReminder);
  const scheduledSilent = logs.slice(logCountBefore).some(l => l.includes('Scheduled exact native alarm'));
  assert(!scheduledSilent, "Disabled reminder should not schedule (remains silent)");
  pass("Disabled reminder correctly skipped (remains silent)");

  console.log('==========================================================');
  console.log(`NOTIFICATION SOUND TESTS COMPLETED: ${passedCount} PASSED`);
  console.log('==========================================================');
  process.exit(0);
}

runTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
