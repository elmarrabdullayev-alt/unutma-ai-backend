import { Capacitor } from '@capacitor/core';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { SpeechCallbacks, SpeechRecognitionProvider } from './SpeechRecognitionProvider';
import { apiClient } from '../apiClient';

export class NativeVoiceRecorderProvider implements SpeechRecognitionProvider {
  public readonly name = 'NativeVoiceRecorderProvider';
  private isRecording = false;
  private isStopping = false;
  private activeStopPromise: Promise<string> | null = null;
  private callbacks: SpeechCallbacks | null = null;
  private audioLevelInterval: number | null = null;
  private currentAudioLevel = 0;

  public isAvailable(): boolean {
    return Capacitor.isNativePlatform() && typeof VoiceRecorder !== 'undefined';
  }

  public async start(callbacks: SpeechCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.activeStopPromise = null;

    if (this.isRecording) {
      console.warn('[NATIVE VOICE] Already recording, ignoring start request');
      return;
    }

    try {
      // 1. Permission check and request
      const hasPerm = await VoiceRecorder.hasAudioRecordingPermission();
      console.log('[NATIVE VOICE] permission status:', hasPerm.value);

      if (!hasPerm.value) {
        const reqPerm = await VoiceRecorder.requestAudioRecordingPermission();
        console.log('[NATIVE VOICE] permission requested result:', reqPerm.value);
        if (!reqPerm.value) {
          const err = new Error('Mikrofon icazəsi verilməyib. Zəhmət olmasa tənzimləmələrdən mikrofon icazəsi verin.');
          console.error('[NATIVE VOICE] error: Permission denied');
          if (callbacks.onError) callbacks.onError(err);
          throw err;
        }
      }

      // 2. Check current status in case previous recording was dangling
      try {
        const status = await VoiceRecorder.getCurrentStatus();
        if (status.status === 'RECORDING') {
          console.warn('[NATIVE VOICE] Previous recording was dangling, stopping it first');
          await VoiceRecorder.stopRecording();
        }
      } catch (statusErr) {
        console.warn('[NATIVE VOICE] Error checking recording status:', statusErr);
      }

      // 3. Start native recording
      const startResult = await VoiceRecorder.startRecording();
      if (!startResult.value) {
        throw new Error('Native səs yazma başladıla bilmədi.');
      }

      this.isRecording = true;
      console.log('[NATIVE VOICE] recording started');

      // 4. Simulate audio level pulsation for UI waveform
      this.startAudioLevelSimulation();
    } catch (err: any) {
      this.isRecording = false;
      this.stopAudioLevelSimulation();
      console.error('[NATIVE VOICE] error:', err?.message || err);
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

    if (!this.isRecording) {
      console.log('[NATIVE VOICE] Not recording, returning empty');
      return '';
    }

    this.stopAudioLevelSimulation();
    this.isStopping = true;

    this.activeStopPromise = (async () => {
      try {
        console.log('[NATIVE VOICE] recording stopped');
        const recordingData = await VoiceRecorder.stopRecording();
        this.isRecording = false;
        this.isStopping = false;

        const base64Audio = recordingData.value?.recordDataBase64 || '';
        const mimeType = recordingData.value?.mimeType || 'audio/aac';
        const duration = recordingData.value?.msDuration || 0;

        // 2. Normalize Base64 before sending (strip data URL prefix and whitespace)
        const normalizedBase64 = base64Audio
          .replace(/^data:.*?;base64,/, '')
          .replace(/\s/g, '')
          .trim();

        const prefixRemoved = base64Audio.length !== normalizedBase64.length;

        console.log('[NATIVE VOICE] mimeType:', mimeType);
        console.log('[NATIVE VOICE] raw base64 length:', base64Audio.length);
        console.log('[NATIVE VOICE] normalized base64 length:', normalizedBase64.length);
        console.log('[NATIVE VOICE] base64 prefix removed:', prefixRemoved);

        // 3. Validate Base64 client-side before request
        if (!normalizedBase64 || normalizedBase64.length < 100 || !/^[A-Za-z0-9+/=]+$/.test(normalizedBase64)) {
          console.warn('[NATIVE VOICE] Audio recording was empty, too short, or contained invalid characters');
          if (this.callbacks?.onEnd) this.callbacks.onEnd();
          return '';
        }

        // Send to Gemini transcription backend with normalized payload
        console.log('[NATIVE VOICE] transcription started');
        const transcriptionResponse = await apiClient.transcribeAudio(normalizedBase64, mimeType);
        const text = (transcriptionResponse.transcription || '').trim();

        console.log(`[NATIVE VOICE] transcription completed: "${text}"`);

        if (this.callbacks?.onResult) {
          this.callbacks.onResult(text, true);
        }
        if (this.callbacks?.onEnd) {
          this.callbacks.onEnd();
        }

        return text;
      } catch (err: any) {
        this.isRecording = false;
        this.isStopping = false;
        console.error('[NATIVE VOICE] error:', err?.message || err);
        const localizedError = this.localizeError(err);
        if (this.callbacks?.onError) {
          this.callbacks.onError(new Error(localizedError));
        }
        throw new Error(localizedError);
      } finally {
        this.activeStopPromise = null;
      }
    })();

    return this.activeStopPromise;
  }

  public getAudioLevel(): number {
    return this.currentAudioLevel;
  }

  private startAudioLevelSimulation(): void {
    this.stopAudioLevelSimulation();
    this.audioLevelInterval = window.setInterval(() => {
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
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }
    this.currentAudioLevel = 0;
  }

  private localizeError(err: any): string {
    const msg = String(err?.message || '');
    if (msg.includes('Permission') || msg.includes('icazə')) {
      return 'Mikrofon icazəsi verilməyib. Zəhmət olmasa tənzimləmələrdən mikrofon icazəsi verin.';
    }
    if (msg.includes('RECORDING_ALREADY') || msg.includes('already recording')) {
      return 'Səs qeydiyyatı artıq aktivdir.';
    }
    if (msg.includes('CANNOT_RECORD_ON_EMULATOR') || msg.includes('emulator')) {
      return 'Emulyatorda mikrofon dəstəklənmir. Zəhmət olmasa fiziki cihazda yoxlayın.';
    }
    if (msg.includes('AI server') || msg.includes('transkripsiya') || msg.includes('bağlantı')) {
      return msg;
    }
    return msg || 'Səs qeydiyyatı zamanı xəta baş verdi.';
  }
}
