/**
 * Notification sound checks.
 *
 * Background: @capacitor/local-notifications on iOS treats `sound` as a FILE
 * NAME — UNNotificationSound(named: <value>). The app used to send
 * sound: 'default', iOS looked for a file named "default", found none and
 * delivered every reminder SILENTLY. The fix ships a real sound file in
 * /public (copied into the iOS bundle's public/ folder, where the plugin
 * searches) and references it by name on iOS.
 */
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;
function check(ok: boolean, msg: string) {
  if (ok) {
    passed++;
    process.stdout.write(`✅ [PASS] ${msg}\n`);
  } else {
    failed++;
    process.stdout.write(`❌ [FAIL] ${msg}\n`);
  }
}

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

async function main() {
  // 1. The sound file exists where the iOS plugin looks (top level of public/)
  const soundPath = path.join(root, 'public', 'unutma-chime.wav');
  check(fs.existsSync(soundPath), 'public/unutma-chime.wav exists at the top level of public/');

  if (fs.existsSync(soundPath)) {
    const buf = fs.readFileSync(soundPath);
    const isWav = buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE';
    const audioFormat = buf.readUInt16LE(20); // 1 = linear PCM (supported by iOS notifications)
    const sampleRate = buf.readUInt32LE(24);
    const byteRate = buf.readUInt32LE(28);
    const seconds = (buf.length - 44) / byteRate;
    check(isWav && audioFormat === 1, 'sound is linear-PCM WAV (an iOS notification format)');
    check(seconds > 0.3 && seconds < 30, `sound is ${seconds.toFixed(1)}s (iOS plays notification sounds up to 30s)`);
    check(sampleRate >= 22050, `sample rate ${sampleRate} Hz`);
  }

  // 2. No code path sends the broken 'default' value any more
  for (const f of [
    'src/services/notificationProvider/CapacitorLocalNotificationProvider.ts',
    'src/services/focusService.ts',
  ]) {
    const src = read(f);
    check(!/sound:\s*'default'/.test(src), `${f} no longer sends sound: 'default'`);
    check(src.includes('getNotificationSound()'), `${f} uses getNotificationSound()`);
  }

  // 3. Foreground notifications are allowed to play sound
  check(
    read('capacitor.config.ts').includes("presentationOptions: ['badge', 'sound', 'banner', 'list']"),
    "capacitor.config.ts presentationOptions include 'sound'"
  );

  // 4. Platform behaviour of the helper
  const core: any = await import('@capacitor/core');
  const { getNotificationSound, NOTIFICATION_SOUND_FILE } = await import(
    '../src/services/notificationProvider/notificationSound'
  );
  const original = core.Capacitor.getPlatform;
  try {
    core.Capacitor.getPlatform = () => 'ios';
    check(getNotificationSound() === NOTIFICATION_SOUND_FILE, 'iOS gets the bundled sound file name');
    core.Capacitor.getPlatform = () => 'android';
    check(getNotificationSound() === undefined, 'Android leaves sound to the notification channel');
  } catch (e: any) {
    check(false, `platform check could not run: ${e?.message || e}`);
  } finally {
    core.Capacitor.getPlatform = original;
  }

  process.stdout.write(`\nTEST SUMMARY: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  process.stdout.write(`Test crashed: ${e?.stack || e}\n`);
  process.exit(1);
});
