import { Capacitor } from '@capacitor/core';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { SpeechCallbacks, SpeechRecognitionProvider } from './SpeechRecognitionProvider';
import { apiClient } from '../apiClient';

export type VoiceSessionLifecycleState = 'IDLE' | 'RECORDING' | 'STOPPING' | 'TRANSCRIBING';

/**
 * NativeVoiceRecorderProvider bridges to the native VoiceRecorder plugin.
 * On iOS, this connects to VoiceRecorderPlugin (AVAudioRecorder via CapApp-SPM).
 */
export class NativeVoiceRecorderProvider implements SpeechRecognitionProvider {
  public readonly name = 'NativeVoiceRecorderProvider';
  private lifecycleState: VoiceSessionLifecycleState = 'IDLE';
  private sessionId = 0;
  private activeStopPromise: Promise<string> | null = null;
  private callbacks: SpeechCallbacks | null = null;
  private audioLevelInterval: number | null = null;
  private currentAudioLevel = 0;
  private silenceListenerHandle: { remove: () => Promise<void> | void } | null = null;

  public get isRecording(): boolean {
    return this.lifecycleState === 'RECORDING';
  }

  public get isStopping(): boolean {
    return this.lifecycleState === 'STOPPING' || this.lifecycleState === 'TRANSCRIBING';
  }

  public get currentLifecycleState(): VoiceSessionLifecycleState {
    return this.lifecycleState;
  }

  public isAvailable(): boolean {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }
    return Capacitor.isPluginAvailable('VoiceRecorder');
  }

  /**
   * Diagnostic capability check for native recorder support.
   */
  public async checkCapability(): Promise<{ available: boolean; hasPermission: boolean; reason?: string }> {
    const available = this.isAvailable();
    const platform = Capacitor.getPlatform();
    const platformLabel = platform === 'ios' ? 'iOS' : 'Android';

    console.log(`[VOICE][${platformLabel}] recorder plugin available: ${available}`);
    console.log(
      `[VOICE][${platformLabel}] recorder implementation: ${
        available ? (platform === 'ios' ? 'Native AVAudioRecorder (VoiceRecorder)' : 'Native MediaRecorder') : 'Unavailable'
      }`
    );

    if (!available) {
      return {
        available: false,
        hasPermission: false,
        reason: 'VoiceRecorder plugin is not implemented/registered on native bridge',
      };
    }

    try {
      const hasPerm = await VoiceRecorder.hasAudioRecordingPermission();
      return { available: true, hasPermission: !!hasPerm?.value };
    } catch (err: any) {
      console.warn(`[VOICE][${platformLabel}] permission check warning:`, err?.message || err);
      return { available: false, hasPermission: false, reason: err?.message || String(err) };
    }
  }

  private async removeSilenceListener(): Promise<void> {
    if (this.silenceListenerHandle) {
      try {
        if (typeof this.silenceListenerHandle.remove === 'function') {
          await this.silenceListenerHandle.remove();
        }
      } catch (e: any) {
        console.warn('[NATIVE VOICE] Error removing silenceAutoStop listener:', e?.message || e);
      }
      this.silenceListenerHandle = null;
    }
  }

  public async start(callbacks: SpeechCallbacks): Promise<void> {
    this.callbacks = callbacks;
    const platform = Capacitor.getPlatform();

    if (this.lifecycleState === 'RECORDING') {
      console.warn('[NATIVE VOICE] Already recording, ignoring start request');
      return;
    }

    // If previous session is still stopping/transcribing, wait for it to settle cleanly
    if (this.activeStopPromise) {
      try {
        await this.activeStopPromise;
      } catch (e) {
        // Previous error already handled
      }
    }

    const currentSession = ++this.sessionId;

    // 1. Remove any previous silenceAutoStop listener before starting to prevent duplicates
    await this.removeSilenceListener();

    if (!this.isAvailable()) {
      if (platform === 'ios') {
        console.log('[VOICE][iOS] recorder start success/failure: failure');
      }
      const err = new Error('RECORDER_NOT_AVAILABLE');
      const localized = this.localizeError(err);
      if (callbacks.onError) callbacks.onError(new Error(localized));
      throw new Error(localized);
    }

    try {
      // 2. Permission check and request
      const hasPerm = await VoiceRecorder.hasAudioRecordingPermission();
      console.log('[NATIVE VOICE] permission status:', hasPerm?.value);

      if (!hasPerm?.value) {
        const reqPerm = await VoiceRecorder.requestAudioRecordingPermission();
        console.log('[NATIVE VOICE] permission requested result:', reqPerm?.value);
        if (!reqPerm?.value) {
          const err = new Error('Mikrofon icazəsi verilməyib. Zəhmət olmasa tənzimləmələrdən mikrofon icazəsi verin.');
          console.error('[NATIVE VOICE] error: Permission denied');
          if (callbacks.onError) callbacks.onError(err);
          throw err;
        }
      }

      // 3. Check current status in case previous recording was dangling on native
      try {
        const status = await VoiceRecorder.getCurrentStatus();
        if (status?.status === 'RECORDING') {
          console.warn('[NATIVE VOICE] Previous recording was dangling, stopping it first');
          await VoiceRecorder.stopRecording();
        }
      } catch (statusErr: any) {
        console.warn('[NATIVE VOICE] Error checking recording status:', statusErr?.name || 'Error', statusErr?.message || statusErr);
      }

      // 4. Register silenceAutoStop listener BEFORE starting recording so early events are never lost
      try {
        if (typeof (VoiceRecorder as any).addListener === 'function') {
          this.silenceListenerHandle = await (VoiceRecorder as any).addListener(
            'silenceAutoStop',
            async (eventData?: any) => {
              console.log('[NATIVE VOICE] silenceAutoStop event received from native iOS VoiceRecorder', eventData);
              // Ensure stop() is called strictly ONCE, preserving lifecycle idempotency
              if (this.sessionId === currentSession && this.lifecycleState === 'RECORDING' && !this.isStopping && !this.activeStopPromise) {
                try {
                  await this.stop();
                } catch (stopErr: any) {
                  console.warn('[NATIVE VOICE] Error executing stop after silenceAutoStop:', stopErr?.name || 'Error', stopErr?.message || stopErr);
                }
              }
            }
          );
          console.log('[NATIVE VOICE] silenceAutoStop listener successfully registered before recording');
        }
      } catch (listenerErr: any) {
        console.warn('[NATIVE VOICE] Could not attach silenceAutoStop listener before recording:', listenerErr?.name || 'Error', listenerErr?.message || listenerErr);
      }

      // 5. Start native recording
      const startResult = await VoiceRecorder.startRecording();
      if (!startResult?.value) {
        throw new Error('Native səs yazma başladıla bilmədi.');
      }

      this.lifecycleState = 'RECORDING';
      if (platform === 'ios') {
        console.log('[VOICE][iOS] recorder start success/failure: success');
      }
      console.log('[NATIVE VOICE] recording started');

      // 6. Simulate audio level pulsation for UI waveform
      this.startAudioLevelSimulation();
    } catch (err: any) {
      await this.removeSilenceListener();
      this.lifecycleState = 'IDLE';
      this.stopAudioLevelSimulation();
      if (platform === 'ios') {
        console.log('[VOICE][iOS] recorder start success/failure: failure');
      }
      console.error('[NATIVE VOICE] error:', err?.name || 'Error', err?.message || err);
      const localizedError = this.localizeError(err);
      if (callbacks.onError) callbacks.onError(new Error(localizedError));
      throw new Error(localizedError);
    }
  }

  public async stop(): Promise<string> {
    if (this.activeStopPromise) {
      console.log('[NATIVE VOICE] stop already in progress, returning active promise');
      return this.activeStopPromise;
    }

    if (this.lifecycleState !== 'RECORDING') {
      console.log('[NATIVE VOICE] Not recording, returning empty');
      await this.removeSilenceListener();
      this.lifecycleState = 'IDLE';
      return '';
    }

    this.stopAudioLevelSimulation();
    this.lifecycleState = 'STOPPING';

    const currentSession = this.sessionId;
    const sessionCallbacks = this.callbacks;

    this.activeStopPromise = (async () => {
      // Immediately remove silence listener to avoid trailing duplicate triggers
      await this.removeSilenceListener();

      let recordingData: any = null;
      let nativeStopSucceeded = false;

      try {
        console.log('[NATIVE VOICE] recording stopped');
        recordingData = await VoiceRecorder.stopRecording();
        nativeStopSucceeded = true;
      } catch (nativeErr: any) {
        console.error('[NATIVE VOICE] native stopRecording error:', nativeErr?.name || 'Error', nativeErr?.message || nativeErr);
      }

      // If native recording stopped without valid data, return cleanly to IDLE
      if (!nativeStopSucceeded || !recordingData?.value?.recordDataBase64) {
        console.warn('[NATIVE VOICE] Recording stopped without valid audio data');
        this.lifecycleState = 'IDLE';
        if (this.sessionId === currentSession && sessionCallbacks?.onEnd) {
          sessionCallbacks.onEnd();
        }
        return '';
      }

      // Native recording is stopped; now in TRANSCRIBING phase
      this.lifecycleState = 'TRANSCRIBING';

      try {
        const base64Audio = recordingData.value?.recordDataBase64 || '';
        const mimeType = recordingData.value?.mimeType || (Capacitor.getPlatform() === 'ios' ? 'audio/m4a' : 'audio/aac');
        const duration = recordingData.value?.msDuration || 0;

        // 2. Normalize Base64 before sending (strip data URL prefix and whitespace)
        const normalizedBase64 = base64Audio
          .replace(/^data:.*?;base64,/, '')
          .replace(/\s/g, '')
          .trim();

        const prefixRemoved = base64Audio.length !== normalizedBase64.length;

        if (Capacitor.getPlatform() === 'ios') {
          const extension = mimeType.includes('m4a') ? 'm4a' : (mimeType.includes('mp4') ? 'mp4' : 'm4a');
          const byteSize = Math.round((normalizedBase64.length * 3) / 4);
          console.log(`[VOICE][iOS] recording extension: ${extension}`);
          console.log(`[VOICE][iOS] recording byte size: ${byteSize}`);
          console.log(`[VOICE][iOS] mimeType: ${mimeType}`);
        }

        console.log('[NATIVE VOICE] mimeType:', mimeType);
        console.log('[NATIVE VOICE] raw base64 length:', base64Audio.length);
        console.log('[NATIVE VOICE] normalized base64 length:', normalizedBase64.length);
        console.log('[NATIVE VOICE] base64 prefix removed:', prefixRemoved);

        // 3. Validate Base64 client-side before request
        if (!normalizedBase64 || normalizedBase64.length < 100 || !/^[A-Za-z0-9+/=]+$/.test(normalizedBase64)) {
          console.warn('[NATIVE VOICE] Audio recording was empty, too short, or contained invalid characters');
          if (this.sessionId === currentSession && sessionCallbacks?.onEnd) {
            sessionCallbacks.onEnd();
          }
          return '';
        }

        // Send to OpenAI transcription backend with normalized payload
        console.log('[NATIVE VOICE] transcription started');
        const transcriptionResponse = await apiClient.transcribeAudio(normalizedBase64, mimeType);
        const text = (transcriptionResponse.transcription || '').trim();

        console.log(`[NATIVE VOICE] transcription completed: "${text}"`);

        // Strictly ONE final result and end callback per session
        if (this.sessionId === currentSession) {
          if (sessionCallbacks?.onResult) {
            sessionCallbacks.onResult(text, true);
          }
          if (sessionCallbacks?.onEnd) {
            sessionCallbacks.onEnd();
          }
        }

        return text;
      } catch (err: any) {
        // Architecture Rule: This is a TRANSCRIPTION failure, NOT a recording-stop failure.
        // The native recorder has ALREADY stopped. Do not call native stopRecording() again!
        console.error('[NATIVE VOICE] transcription error:', err?.name || 'Error', err?.message || err);
        const localizedError = this.localizeError(err);
        if (this.sessionId === currentSession && sessionCallbacks?.onError) {
          sessionCallbacks.onError(new Error(localizedError));
        }
        throw new Error(localizedError);
      } finally {
        // Always reset lifecycle state to IDLE and clear activeStopPromise
        this.lifecycleState = 'IDLE';
        this.activeStopPromise = null;
        await this.removeSilenceListener();
      }
    })();

    return this.activeStopPromise;
  }

  public getAudioLevel(): number {
    return this.currentAudioLevel;
  }

  private startAudioLevelSimulation(): void {
    this.stopAudioLevelSimulation();
    const setIntervalFn = typeof window !== 'undefined' && typeof window.setInterval === 'function' ? window.setInterval : setInterval;
    this.audioLevelInterval = (setIntervalFn as any)(() => {
      if (!this.isRecording) return;
      // Generate natural acoustic pulse pattern between 0.35 and 0.85
      const base = 0.4 + Math.random() * 0.45;
      this.currentAudioLevel = Math.min(1, Math.max(0.1, base));
      if (this.callbacks?.onAudioLevel) {
        this.callbacks.onAudioLevel(this.currentAudioLevel);
      }
    }, 100);
  }

  private stopAudioLevelSimulation(): void {
    if (this.audioLevelInterval !== null) {
      const clearIntervalFn = typeof window !== 'undefined' && typeof window.clearInterval === 'function' ? window.clearInterval : clearInterval;
      (clearIntervalFn as any)(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }
    this.currentAudioLevel = 0;
  }

  private localizeError(err: any): string {
    const rawMsg = String(err?.message || err || '');
    console.warn('[NATIVE VOICE] technical error:', rawMsg);

    if (
      rawMsg.includes('not implemented') ||
      rawMsg.includes('RECORDER_NOT_AVAILABLE') ||
      rawMsg.includes('not registered') ||
      rawMsg.includes('CANNOT_RECORD_ON_THIS_PHONE')
    ) {
      return 'Səs qeydiyyatı funksiyası bu cihazda əlçatan deyil. Zəhmət olmasa tənzimləmələrdən mikrofon icazəsini yoxlayın və ya mətndən istifadə edin.';
    }
    if (
      rawMsg.includes('Permission') ||
      rawMsg.includes('icazə') ||
      rawMsg.includes('MISSING_PERMISSION') ||
      rawMsg.includes('denied')
    ) {
      return 'Mikrofon icazəsi verilməyib. Zəhmət olmasa tənzimləmələrdən mikrofon icazəsi verin.';
    }
    if (rawMsg.includes('RECORDING_ALREADY') || rawMsg.includes('already recording')) {
      return 'Səs qeydiyyatı artıq aktivdir.';
    }
    if (rawMsg.includes('CANNOT_RECORD_ON_EMULATOR') || rawMsg.includes('emulator')) {
      return 'Emulyatorda mikrofon dəstəklənmir. Zəhmət olmasa fiziki cihazda yoxlayın.';
    }
    if (rawMsg.includes('EMPTY_RECORDING')) {
      return 'Səs yazısı boşdur. Zəhmət olmasa daha aydın danışın.';
    }
    if (rawMsg.includes('AI server') || rawMsg.includes('transkripsiya') || rawMsg.includes('bağlantı')) {
      return rawMsg;
    }
    return 'Səs qeydiyyatı zamanı xəta baş verdi. Zəhmət olmasa yenidən cəhd edin və ya mətndən istifadə edin.';
  }
}
