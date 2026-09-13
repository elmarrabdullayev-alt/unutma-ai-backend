import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { SpeechCallbacks, SpeechRecognitionProvider } from './SpeechRecognitionProvider';
import { NativeSpeechRecognitionProvider } from './NativeSpeechRecognitionProvider';
import { NativeVoiceRecorderProvider } from './NativeVoiceRecorderProvider';
import { WebSpeechRecognitionProvider } from './WebSpeechRecognitionProvider';
import { OpenAIAudioFallbackProvider } from './OpenAIAudioFallbackProvider';
import { OpenAIRealtimeSpeechProvider } from './OpenAIRealtimeSpeechProvider';

export class SpeechProviderManager {
  private activeProvider: SpeechRecognitionProvider | null = null;
  private nativeSTTProvider = new NativeSpeechRecognitionProvider();
  private nativeVoiceRecorderProvider = new NativeVoiceRecorderProvider();
  private webProvider = new WebSpeechRecognitionProvider();
  private openAIAudioProvider = new OpenAIAudioFallbackProvider();
  private openAIRealtimeProvider = new OpenAIRealtimeSpeechProvider();

  public getActiveProviderName(): string {
    return this.activeProvider ? this.activeProvider.name : 'None';
  }

  /**
   * Returns true whenever at least one speech provider is available.
   */
  public isSupported(): boolean {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios') {
      const hasRealtime = this.openAIRealtimeProvider.isAvailable();
      const hasSpeech = this.nativeSTTProvider.isAvailable();
      const hasRecorder = this.nativeVoiceRecorderProvider.isAvailable();
      return hasRealtime || hasSpeech || hasRecorder;
    }
    if (platform === 'android') {
      return (
        this.openAIRealtimeProvider.isAvailable() ||
        this.nativeSTTProvider.isAvailable() ||
        this.nativeVoiceRecorderProvider.isAvailable() ||
        this.openAIAudioProvider.isAvailable()
      );
    }
    return (
      this.openAIRealtimeProvider.isAvailable() ||
      this.webProvider.isAvailable() ||
      this.openAIAudioProvider.isAvailable()
    );
  }

  private async startListeningIOS(callbacks: SpeechCallbacks): Promise<void> {
    console.log('[VOICE][iOS] platform detected');

    // Diagnostic capability detection for iOS voice recorder
    const recorderAvailable = this.nativeVoiceRecorderProvider.isAvailable();
    console.log(`[VOICE][iOS] recorder plugin available: ${recorderAvailable}`);

    let micPermGranted = false;
    if (recorderAvailable) {
      try {
        const micStatus = await VoiceRecorder.hasAudioRecordingPermission();
        micPermGranted = !!micStatus?.value;
      } catch (e: any) {
        console.warn('[VOICE][iOS] mic permission probe warning:', e?.message || e);
        micPermGranted = false;
      }
    }

    if (!micPermGranted && recorderAvailable) {
      try {
        const reqMic = await VoiceRecorder.requestAudioRecordingPermission();
        micPermGranted = !!reqMic?.value;
      } catch (e) {
        micPermGranted = false;
      }
    }

    console.log(`[VOICE][iOS] microphone permission: ${micPermGranted ? 'granted' : 'denied'}`);

    // [REALTIME-STT] 1. Primary on iOS: OpenAI Realtime Streaming Transcription
    // Model: gpt-live-transcribe
    // Handles conversation.item.input_audio_transcription.delta live without waiting for stopRecording
    if (this.openAIRealtimeProvider.isAvailable()) {
      try {
        console.log(
          '[REALTIME-STT] [VOICE][iOS] Activating primary realtime transcription (gpt-live-transcribe)'
        );
        this.activeProvider = this.openAIRealtimeProvider;
        await this.openAIRealtimeProvider.start(callbacks);
        return;
      } catch (realtimeErr: any) {
        console.warn(
          '[REALTIME-STT] [VOICE][iOS] Realtime provider initialization failed, switching to M4A fallback:',
          realtimeErr?.message || realtimeErr
        );
        this.activeProvider = null;
      }
    }

    // 2. Fallback on iOS: Native Voice Recorder (VoiceRecorderPlugin -> AVAudioRecorder -> /api/transcribe-audio)
    console.log('[VOICE][iOS] [REALTIME-STT] Fallback activated: NativeVoiceRecorderProvider (M4A /api/transcribe-audio)');

    if (recorderAvailable) {
      if (!micPermGranted) {
        const permErr = new Error(
          'Mikrofon icazəsi verilməyib. Zəhmət olmasa tənzimləmələrdən mikrofon icazəsi verin.'
        );
        if (callbacks.onError) callbacks.onError(permErr);
        throw permErr;
      }

      this.activeProvider = this.nativeVoiceRecorderProvider;
      try {
        await this.nativeVoiceRecorderProvider.start(callbacks);
        return;
      } catch (recErr: any) {
        console.warn('[VOICE][iOS] NativeVoiceRecorderProvider start failed:', recErr?.message || recErr);
        this.activeProvider = null;
        throw recErr;
      }
    } else {
      console.error('[VOICE][iOS] recorder implementation is not available on this iOS device/build');
      const unavailableErr = new Error(
        'Səs qeydiyyatı funksiyası bu cihazda əlçatan deyil. Zəhmət olmasa tənzimləmələrdən mikrofon icazəsini yoxlayın və ya mətndən istifadə edin.'
      );
      if (callbacks.onError) callbacks.onError(unavailableErr);
      throw unavailableErr;
    }
  }

  public async startListening(callbacks: SpeechCallbacks): Promise<void> {
    const isNative = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform();
    console.log(`[SpeechProviderManager] runtime=${isNative ? 'native' : 'web'} platform=${platform}`);

    // iOS specific routing
    if (platform === 'ios') {
      await this.startListeningIOS(callbacks);
      return;
    }

    // Android native routing
    if (isNative) {
      // 1. Primary on Native: OpenAI Realtime transcription (gpt-live-transcribe)
      if (this.openAIRealtimeProvider.isAvailable()) {
        try {
          this.activeProvider = this.openAIRealtimeProvider;
          console.log('[REALTIME-STT] [SpeechProviderManager] primary provider=OpenAIRealtimeSpeechProvider (gpt-live-transcribe)');
          await this.openAIRealtimeProvider.start(callbacks);
          return;
        } catch (realtimeErr) {
          console.warn('[REALTIME-STT] Realtime provider failed on native, falling back:', realtimeErr);
        }
      }

      // 2. Native Speech Recognition (az-AZ locale)
      if (this.nativeSTTProvider.isAvailable()) {
        try {
          this.activeProvider = this.nativeSTTProvider;
          console.log('[SpeechProviderManager] fallback provider=NativeSpeechRecognitionProvider (az-AZ)');
          await this.nativeSTTProvider.start(callbacks);
          return;
        } catch (sttErr: any) {
          console.warn('[SpeechProviderManager] Native STT start failed:', sttErr);
        }
      }

      // 3. Fallback on Native: Native Audio Recorder (capacitor-voice-recorder + /api/transcribe-audio)
      if (this.nativeVoiceRecorderProvider.isAvailable()) {
        try {
          this.activeProvider = this.nativeVoiceRecorderProvider;
          console.log('[SpeechProviderManager] fallback provider=NativeVoiceRecorderProvider (M4A /api/transcribe-audio)');
          await this.nativeVoiceRecorderProvider.start(callbacks);
          return;
        } catch (recErr: any) {
          console.warn('[SpeechProviderManager] Native voice recorder start failed:', recErr);
        }
      }

      // 4. Last-resort fallback: MediaRecorder fallback
      if (this.openAIAudioProvider.isAvailable()) {
        this.activeProvider = this.openAIAudioProvider;
        console.log('[SpeechProviderManager] last resort provider=OpenAIAudioFallbackProvider');
        await this.openAIAudioProvider.start(callbacks);
        return;
      }

      throw new Error('Mikrofon/səs qəbulu vasitəsi bu cihazda dəstəklənmir.');
    }

    // Web browser environment:
    // 1. Primary on Web: OpenAI Realtime Streaming Transcription (gpt-live-transcribe)
    if (this.openAIRealtimeProvider.isAvailable()) {
      try {
        this.activeProvider = this.openAIRealtimeProvider;
        console.log('[REALTIME-STT] [SpeechProviderManager] primary web provider=OpenAIRealtimeSpeechProvider (gpt-live-transcribe)');
        await this.openAIRealtimeProvider.start(callbacks);
        return;
      } catch (realtimeErr) {
        console.warn('[REALTIME-STT] Web Realtime provider failed, switching to web speech fallback:', realtimeErr);
      }
    }

    // 2. WebSpeechRecognitionProvider
    if (this.webProvider.isAvailable()) {
      try {
        this.activeProvider = this.webProvider;
        console.log('[SpeechProviderManager] provider=WebSpeechRecognitionProvider');
        await this.webProvider.start(callbacks);
        return;
      } catch (err) {
        console.warn('[SpeechProviderManager] WebSpeech start failed, switching to OpenAI audio fallback:', err);
      }
    }

    // 3. Fallback to OpenAI MediaRecorder capture on web (/api/transcribe-audio)
    if (this.openAIAudioProvider.isAvailable()) {
      this.activeProvider = this.openAIAudioProvider;
      console.log('[SpeechProviderManager] provider=OpenAIAudioFallbackProvider');
      await this.openAIAudioProvider.start(callbacks);
    } else {
      throw new Error('Heç bir mikrofon/səs qəbulu vasitəsi bu mühitdə dəstəklənmir.');
    }
  }

  public async stopListening(): Promise<string> {
    if (this.activeProvider) {
      const provider = this.activeProvider;
      this.activeProvider = null;
      const result = await provider.stop();
      return result || '';
    }
    return '';
  }

  public getAudioLevel(): number {
    return this.activeProvider ? this.activeProvider.getAudioLevel() : 0;
  }
}

export const speechManager = new SpeechProviderManager();
