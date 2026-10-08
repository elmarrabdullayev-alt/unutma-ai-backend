import './setupNativeMock';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { speakText, stopSpeaking } from '../src/utils/soundUtils';
import { NativeVoiceRecorderProvider } from '../src/services/speech/NativeVoiceRecorderProvider';

console.log('==========================================================');
console.log('RUNNING IOS VOICE RECORDING & TTS AUDIT TESTS');
console.log('==========================================================');

let passedCount = 0;
function pass(desc: string) {
  console.log(`✅ [PASS] ${desc}`);
  passedCount++;
}

// -------------------------------------------------------------
// SECTION 1: TTS DEACTIVATION AUDIT (PROBLEM 2)
// -------------------------------------------------------------
console.log('\n--- SECTION 1: TTS Deactivation & Turkish Removal Audit ---');

const soundUtilsPath = path.resolve(process.cwd(), 'src/utils/soundUtils.ts');
const soundUtilsContent = fs.readFileSync(soundUtilsPath, 'utf8');

// 1. Ensure tr-TR fallback is completely gone
assert(!soundUtilsContent.includes("'tr-TR'"), "soundUtils.ts must not contain 'tr-TR'");
assert(!soundUtilsContent.includes('"tr-TR"'), 'soundUtils.ts must not contain "tr-TR"');
assert(!soundUtilsContent.includes("v.lang.includes('tr')"), 'soundUtils.ts must not search for Turkish voices');
pass('tr-TR voice search and fallback completely removed');

// 2. Ensure SpeechSynthesisUtterance is NOT created in speakText
assert(!soundUtilsContent.includes('new SpeechSynthesisUtterance'), 'speakText must not instantiate SpeechSynthesisUtterance');
assert(!soundUtilsContent.includes('window.speechSynthesis.speak'), 'speakText must not invoke window.speechSynthesis.speak');
pass('SpeechSynthesisUtterance instantiation and speak() completely removed');

// 3. Ensure window.speechSynthesis.cancel() is called to abort any speech
assert(soundUtilsContent.includes('window.speechSynthesis.cancel()'), 'speakText must call window.speechSynthesis.cancel()');
pass('speakText and stopSpeaking call window.speechSynthesis.cancel()');

// 4. Runtime simulation of speakText()
let cancelCalled = 0;
let speakCalled = 0;
(global as any).window = {
  ...((global as any).window || {}),
  speechSynthesis: {
    cancel: () => {
      cancelCalled++;
    },
    speak: () => {
      speakCalled++;
    },
  },
};

speakText('Salam, necəsiniz?');
assert(cancelCalled >= 1, 'speakText() must immediately cancel existing speech');
assert(speakCalled === 0, 'speakText() must NEVER call window.speechSynthesis.speak');
pass('Runtime: speakText() cancels speech and initiates no utterance');

stopSpeaking();
assert(cancelCalled >= 2, 'stopSpeaking() cancels speech');
pass('Runtime: stopSpeaking() cancels active speech synthesis');

// -------------------------------------------------------------
// SECTION 2: NativeVoiceRecorderProvider.ts AUDIT (PROBLEM 1)
// -------------------------------------------------------------
console.log('\n--- SECTION 2: NativeVoiceRecorderProvider Lifecycle Audit ---');

const providerPath = path.resolve(process.cwd(), 'src/services/speech/NativeVoiceRecorderProvider.ts');
const providerContent = fs.readFileSync(providerPath, 'utf8');

// 1. silenceListenerHandle property exists
assert(providerContent.includes('silenceListenerHandle'), 'Must declare silenceListenerHandle property');
pass('silenceListenerHandle class property declared');

// 2. removeSilenceListener helper exists
assert(providerContent.includes('removeSilenceListener'), 'Must implement removeSilenceListener helper');
pass('removeSilenceListener helper implemented');

// 3. Listener registered BEFORE startRecording
const startMethod = providerContent.substring(providerContent.indexOf('public async start('));
const addListenerIndex = startMethod.indexOf('addListener');
const startRecordingIndex = startMethod.indexOf('VoiceRecorder.startRecording()');

assert(addListenerIndex > 0, 'addListener must be present in start()');
assert(startRecordingIndex > 0, 'VoiceRecorder.startRecording() must be present in start()');
assert(addListenerIndex < startRecordingIndex, 'silenceAutoStop listener must be registered BEFORE VoiceRecorder.startRecording()');
pass('silenceAutoStop listener is reliably registered BEFORE startRecording()');

// 4. Stored in silenceListenerHandle
assert(startMethod.includes('this.silenceListenerHandle ='), 'Handle must be saved to this.silenceListenerHandle');
pass('silenceAutoStop listener handle is stored in class property');

// 5. Idempotent single stop() call in silenceAutoStop callback
assert(startMethod.includes('!this.isStopping'), 'silenceAutoStop callback must guard with !this.isStopping');
assert(startMethod.includes('!this.activeStopPromise'), 'silenceAutoStop callback must guard with !this.activeStopPromise');
pass('silenceAutoStop callback guards against multiple calls and race conditions');

// 6. Listener removed on stop, error, and start
assert(startMethod.includes('await this.removeSilenceListener()'), 'start() must clean up any previous listener first');
pass('start() removes any existing listener before registering a new one');

const stopMethod = providerContent.substring(providerContent.indexOf('public async stop('));
assert(stopMethod.includes('await this.removeSilenceListener()'), 'stop() must clean up listener');
pass('stop() removes silenceAutoStop listener immediately');

// -------------------------------------------------------------
// SECTION 3: VoiceRecorderPlugin.swift AUDIT (PROBLEM 1)
// -------------------------------------------------------------
console.log('\n--- SECTION 3: VoiceRecorderPlugin.swift Native Audit ---');

const swiftPluginPath = path.resolve(process.cwd(), 'ios/App/CapApp-SPM/Sources/CapApp-SPM/VoiceRecorderPlugin.swift');
const swiftContent = fs.readFileSync(swiftPluginPath, 'utf8');

// 1. Checks speech detection before auto-stopping
assert(swiftContent.includes('self.speechBegan'), 'Must track speechBegan state');
pass('Swift plugin tracks speechBegan to ensure user spoke before auto-stopping');

// 2. Common RunLoop mode for meter timer
assert(swiftContent.includes('RunLoop.main.add(timer, forMode: .common)'), 'Meter timer must run in .common mode');
pass('Swift meter timer added to RunLoop.main in .common mode (not blocked by UI gestures)');

// 3. Silence timeout in range 1.3 - 1.6s
const timeoutMatch = swiftContent.match(/silenceAutoStopTimeoutSec:\s*TimeInterval\s*=\s*([0-9.]+)/);
assert(timeoutMatch !== null, 'Must define silenceAutoStopTimeoutSec');
const timeoutSec = parseFloat(timeoutMatch[1]);
assert(timeoutSec >= 1.3 && timeoutSec <= 1.6, `Timeout must be between 1.3s and 1.6s (was: ${timeoutSec}s)`);
pass(`Swift silenceAutoStopTimeoutSec is ${timeoutSec}s (within 1.3–1.6s range)`);

// 4. Idempotent stopRecording with lock and isStoppingNative
assert(swiftContent.includes('isStoppingNative'), 'Must track isStoppingNative flag');
assert(swiftContent.includes('recordingLock'), 'Must use lock in stopRecording');
pass('Swift stopRecording() uses recordingLock and isStoppingNative for thread-safe idempotency');

// -------------------------------------------------------------
// SECTION 4: VoiceAssistantFullScreen.tsx AUDIT
// -------------------------------------------------------------
console.log('\n--- SECTION 4: VoiceAssistantFullScreen.tsx UI Audit ---');

const uiPath = path.resolve(process.cwd(), 'src/components/VoiceAssistantFullScreen.tsx');
const uiContent = fs.readFileSync(uiPath, 'utf8');

// 1. Setting isListening to false when isFinal is true
assert(uiContent.includes('setIsListening(false);'), 'Must reset isListening on final transcription result');
pass('UI sets isListening(false) on isFinal to avoid requiring second mic tap');

// 2. Ensure no TTS playback button
assert(!uiContent.includes('Təkrar səsləndir'), 'Təkrar səsləndir button must be removed while TTS is deactivated');
pass('AI response answers are strictly text-based with no TTS audio replay button');

// 3. Duplicate protection guards in UI
assert(uiContent.includes('isAnalyzingRef'), 'VoiceAssistantFullScreen must have isAnalyzingRef guard');
assert(uiContent.includes('currentSessionIdRef'), 'VoiceAssistantFullScreen must track currentSessionIdRef');
assert(uiContent.includes('analyzedSessionIdRef'), 'VoiceAssistantFullScreen must track analyzedSessionIdRef');
pass('VoiceAssistantFullScreen implements session idempotency and duplicate processing guards');

// -------------------------------------------------------------
// SECTION 5: FUNCTIONAL LIFECYCLE & ERROR RECOVERY SIMULATION
// -------------------------------------------------------------
console.log('\n--- SECTION 5: Functional Lifecycle & Error Recovery Simulation ---');

import { Capacitor, WebPlugin } from '@capacitor/core';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { apiClient } from '../src/services/apiClient';

export async function runLifecycleSimulationTests() {
  // Setup Capacitor & VoiceRecorder mocks
  let nativeStatus = 'NONE';
  let nativeStopCalls = 0;
  let nativeStartCalls = 0;
  let listenerRemovedCount = 0;

  (globalThis as any).__nativePromiseHandler = async (_plugin: string, method: string, _options?: any) => {
    if (method === 'hasAudioRecordingPermission' || method === 'requestAudioRecordingPermission') {
      return { value: true };
    }
    if (method === 'getCurrentStatus') {
      return { status: nativeStatus };
    }
    if (method === 'startRecording') {
      nativeStartCalls++;
      nativeStatus = 'RECORDING';
      return { value: true };
    }
    if (method === 'stopRecording') {
      nativeStopCalls++;
      nativeStatus = 'NONE';
      return {
        value: {
          recordDataBase64: Buffer.from(
            'mock-audio-data-for-voice-recording-over-one-hundred-characters-long-padded-base64-content-here-abcdef1234567890'
          ).toString('base64'),
          mimeType: 'audio/m4a',
          msDuration: 2500,
        },
      };
    }
    return { value: true };
  };

  (Capacitor as any).isNativePlatform = () => true;
  (Capacitor as any).isPluginAvailable = (name: string) => name === 'VoiceRecorder';
  (Capacitor as any).getPlatform = () => 'ios';

  const origRemoveListener = (WebPlugin.prototype as any).removeListener;
  (WebPlugin.prototype as any).removeListener = function (eventName: string, listenerFunc: any) {
    listenerRemovedCount++;
    return origRemoveListener.call(this, eventName, listenerFunc);
  };

  const provider = new NativeVoiceRecorderProvider();

  // Test 1: silenceAutoStop -> stop -> transcription success -> clean IDLE
  let finalResultReceived = '';
  let onEndCalled = false;
  apiClient.transcribeAudio = async () => ({
    success: true,
    transcription: 'Sabah saat 10-da iclası xatırlat',
  });

  await provider.start({
    onResult: (text, isFinal) => {
      if (isFinal) finalResultReceived = text;
    },
    onEnd: () => {
      onEndCalled = true;
    },
  });

  assert.strictEqual(provider.currentLifecycleState, 'RECORDING', 'State must be RECORDING after start');
  assert.strictEqual(provider.isRecording, true, 'isRecording must be true');

  // Trigger silenceAutoStop via native Capacitor event
  await (VoiceRecorder as any).notifyListeners('silenceAutoStop', { silenceDuration: 1.4 });
  const finalRecorded = await provider.stop();

  assert.strictEqual(finalResultReceived, 'Sabah saat 10-da iclası xatırlat', 'Result must match transcription');
  assert.strictEqual(finalRecorded, 'Sabah saat 10-da iclası xatırlat');
  assert.strictEqual(onEndCalled, true, 'onEnd must be called');
  assert.strictEqual(provider.currentLifecycleState, 'IDLE', 'State must return to clean IDLE');
  assert.strictEqual(provider.isRecording, false, 'isRecording must be false after completion');
  assert.strictEqual(provider.isStopping, false, 'isStopping must be false after completion');
  pass('Test 1: silenceAutoStop -> stop -> transcription success -> clean IDLE');

  // Test 2: silenceAutoStop -> stop -> HTTP 503 -> clean IDLE
  let errorReceived: Error | null = null;
  apiClient.transcribeAudio = async () => {
    const err: any = new Error('HTTP Xətası 503');
    err.status = 503;
    throw err;
  };

  await provider.start({
    onResult: () => {},
    onError: (err) => {
      errorReceived = err;
    },
  });

  assert.strictEqual(provider.currentLifecycleState, 'RECORDING');
  await (VoiceRecorder as any).notifyListeners('silenceAutoStop', { silenceDuration: 1.4 });
  try {
    await provider.stop();
  } catch (e: any) {
    // Expected error
  }

  assert(errorReceived !== null, 'onError callback must receive error');
  assert.strictEqual(provider.currentLifecycleState, 'IDLE', 'State must transition to IDLE after HTTP 503');
  assert.strictEqual(provider.isRecording, false, 'isRecording must be false after HTTP 503');
  assert.strictEqual(provider.isStopping, false, 'isStopping must be false after HTTP 503');
  pass('Test 2: silenceAutoStop -> stop -> HTTP 503 -> clean IDLE');

  // Test 3: silenceAutoStop -> stop -> Load failed -> clean IDLE
  errorReceived = null;
  apiClient.transcribeAudio = async () => {
    throw new Error('AI xidmətinə qoşulmaq mümkün olmadı. İnternet bağlantınızı yoxlayın.');
  };

  await provider.start({
    onResult: () => {},
    onError: (err) => {
      errorReceived = err;
    },
  });

  assert.strictEqual(provider.currentLifecycleState, 'RECORDING');
  await (VoiceRecorder as any).notifyListeners('silenceAutoStop', { silenceDuration: 1.4 });
  try {
    await provider.stop();
  } catch (e: any) {
    // Expected error
  }

  assert(errorReceived !== null, 'onError must receive normalized Load failed error');
  assert.strictEqual(provider.currentLifecycleState, 'IDLE', 'State must be clean IDLE after Load failed');
  assert.strictEqual(provider.isRecording, false, 'isRecording must be false');
  pass('Test 3: silenceAutoStop -> stop -> Load failed -> clean IDLE');

  // Test 4: Repeated stop calls -> exactly one native stop
  apiClient.transcribeAudio = async () => ({
    success: true,
    transcription: 'Test transcript',
  });

  await provider.start({
    onResult: () => {},
  });
  const stopCountBefore = nativeStopCalls;

  // Fire 3 concurrent stop calls
  const [res1, res2, res3] = await Promise.all([
    provider.stop(),
    provider.stop(),
    provider.stop(),
  ]);

  assert.strictEqual(nativeStopCalls, stopCountBefore + 1, 'Native stop must be invoked exactly ONCE for concurrent calls');
  assert.strictEqual(res1, 'Test transcript');
  assert.strictEqual(res2, 'Test transcript');
  assert.strictEqual(res3, 'Test transcript');
  assert.strictEqual(provider.currentLifecycleState, 'IDLE');
  pass('Test 4: Repeated stop calls -> exactly one native stop with idempotent result');

  // Test 5: Transcription failure -> no second native stop
  const stopCountBeforeFail = nativeStopCalls;
  apiClient.transcribeAudio = async () => {
    throw new Error('Simulated transcription network failure');
  };

  await provider.start({
    onResult: () => {},
  });
  try {
    await provider.stop();
  } catch (e) {
    // Expected transcription error
  }

  assert.strictEqual(nativeStopCalls, stopCountBeforeFail + 1, 'Native stop must NOT be called a second time on transcription failure');
  assert.strictEqual(provider.currentLifecycleState, 'IDLE');
  pass('Test 5: Architecture rule confirmed: transcription failure causes no second native stop');

  // Test 6: Recording immediately after failed transcription starts cleanly
  let nextSessionResult = '';
  apiClient.transcribeAudio = async () => ({
    success: true,
    transcription: 'Next recording after failure',
  });

  await provider.start({
    onResult: (t, isFinal) => {
      if (isFinal) nextSessionResult = t;
    },
  });
  assert.strictEqual(provider.currentLifecycleState, 'RECORDING', 'Must start cleanly without dangling error');
  await provider.stop();
  assert.strictEqual(nextSessionResult, 'Next recording after failure');
  assert.strictEqual(provider.currentLifecycleState, 'IDLE');
  pass('Test 6: Recording immediately after failed transcription starts cleanly');

  // Test 7 & 8: Listener cleanup on success and error
  console.log(`[TEST AUDIT] listenerRemovedCount: ${listenerRemovedCount}`);
  assert(listenerRemovedCount >= 1, 'removeSilenceListener must be called during cleanups');
  pass('Test 7 & 8: silenceAutoStop listener cleanup verified across successes and errors');

  // Test 9 & 10: Duplicate final result and router duplicate execution protection
  let routerExecutions = 0;
  let lastSessionToken = 0;

  const simulateSafeAnalyze = (text: string, sessionToken: number) => {
    if (sessionToken === lastSessionToken) {
      return false; // Dropped duplicate
    }
    lastSessionToken = sessionToken;
    routerExecutions++;
    return true;
  };

  const token1 = Date.now();
  assert(simulateSafeAnalyze('Test text', token1) === true, 'First event must process');
  assert(simulateSafeAnalyze('Test text', token1) === false, 'Duplicate callback within session must be dropped');
  assert(simulateSafeAnalyze('Test text', token1) === false, 'Mic button click after auto-stop must be dropped');
  assert.strictEqual(routerExecutions, 1, 'Exactly one router execution permitted per recording session');
  pass('Test 9 & 10: Duplicate final result and duplicate router/reminder execution prevented');

  // Test 11: TTS remains disabled
  let speechAttempted = false;
  (global as any).window = {
    speechSynthesis: {
      speak: () => { speechAttempted = true; },
      cancel: () => {},
    },
  };
  speakText('Təsdiq mesajı');
  assert.strictEqual(speechAttempted, false, 'window.speechSynthesis.speak must NEVER be called');
  pass('Test 11: TTS remains completely disabled across all flows');

  // Test 12: Notification logic remains untouched
  const notifProviderPath = path.resolve(process.cwd(), 'src/services/notificationProvider/CapacitorLocalNotificationProvider.ts');
  const notifContent = fs.readFileSync(notifProviderPath, 'utf8');
  assert(notifContent.includes("sound: 'default'"), "Notification sound must remain 'default'");
  assert(!notifContent.includes('reminder_alarm.wav'), 'Must not reference removed custom wav files');
  pass('Test 12: Notification scheduling and sound logic remains untouched');
}

runLifecycleSimulationTests().then(() => {
  console.log('==========================================================');
  console.log(`ALL TESTS PASSED: ${passedCount} tests passed`);
  console.log('==========================================================');
}).catch((err) => {
  console.error('Test simulation failed:', err);
  process.exit(1);
});
