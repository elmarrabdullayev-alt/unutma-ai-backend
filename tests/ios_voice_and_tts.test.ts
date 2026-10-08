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

console.log('==========================================================');
console.log(`ALL TESTS PASSED: ${passedCount} tests passed`);
console.log('==========================================================');
