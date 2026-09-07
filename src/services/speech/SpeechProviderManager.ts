import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { SpeechCallbacks, SpeechRecognitionProvider } from './SpeechRecognitionProvider';
import { NativeSpeechRecognitionProvider } from './NativeSpeechRecognitionProvider';
import { NativeVoiceRecorderProvider } from './NativeVoiceRecorderProvider';
import { WebSpeechRecognitionProvider } from './WebSpeechRecognitionProvider';
import { GeminiAudioFallbackProvider } from './GeminiAudioFallbackProvider';

export class SpeechProviderManager {
  private activeProvider: SpeechRecognitionProvider | null = null;
  private nativeSTTProvider = new NativeSpeechRecognitionProvider();
  private nativeVoiceRecorderProvider = new NativeVoiceRecorderProvider();
  private webProvider = new WebSpeechRecognitionProvider();
  private geminiProvider = new GeminiAudioFallbackProvider();

  public getActiveProviderName(): string {
    return this.activeProvider ? this.activeProvider.name : 'None';
  }

  /**
   * Returns true on iOS whenever at least one of these is available:
   * - native speech recognition
   * - native voice recorder fallback
   */
  public isSupported(): boolean {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios') {
      const hasSpeech = this.nativeSTTProvider.isAvailable();
      const hasRecorder = this.nativeVoiceRecorderProvider.isAvailable();
      return hasSpeech || hasRecorder;
    }
    if (platform === 'android') {
      return (
        this.nativeSTTProvider.isAvailable() ||
        this.nativeVoiceRecorderProvider.isAvailable() ||
        this.geminiProvider.isAvailable()
      );
    }
    return this.webProvider.isAvailable() || this.geminiProvider.isAvailable();
  }

  private async startListeningIOS(callbacks: SpeechCallbacks): Promise<void> {
    console.log('[VOICE][iOS] platform detected');

    // 1. Initial microphone permission check via VoiceRecorder
    let micPermGranted = false;
    try {
      const micStatus = await VoiceRecorder.hasAudioRecordingPermission();
      micPermGranted = !!micStatus?.value;
    } catch (e) {
      micPermGranted = false;
    }

    // 2. Check native speech recognition availability
    let nativeSTTAvailable = false;
    if (this.nativeSTTProvider.isAvailable()) {
      try {
        const avail = await SpeechRecognition.available();
        nativeSTTAvailable = !!avail?.available;
      } catch (e) {
        nativeSTTAvailable = false;
      }
    }
    console.log(`[VOICE][iOS] native speech available: ${nativeSTTAvailable}`);

    // 3. Primary on iOS: NativeSpeechRecognitionProvider (az-AZ)
    if (nativeSTTAvailable) {
      try {
        let speechPerm = 'prompt';
        try {
          const permStatus = await SpeechRecognition.checkPermissions();
          speechPerm = permStatus?.speechRecognition || 'prompt';
        } catch (e) {
          speechPerm = 'prompt';
        }

        // Request speech recognition permission if not granted
        if (speechPerm !== 'granted') {
          try {
            const reqStatus = await SpeechRecognition.requestPermissions();
            speechPerm = reqStatus?.speechRecognition || 'denied';
          } catch (e) {
            speechPerm = 'denied';
          }
        }

        // Request microphone permission if not granted
        if (!micPermGranted) {
          try {
            const reqMic = await VoiceRecorder.requestAudioRecordingPermission();
            micPermGranted = !!reqMic?.value;
          } catch (e) {
            micPermGranted = false;
          }
        }

        console.log(`[VOICE][iOS] microphone permission: ${micPermGranted ? 'granted' : 'denied'}`);
        console.log(`[VOICE][iOS] speech permission: ${speechPerm}`);

        if (speechPerm === 'granted' && micPermGranted) {
          this.activeProvider = this.nativeSTTProvider;
          await this.nativeSTTProvider.start(callbacks);
          console.log('[VOICE][iOS] provider selected: NativeSpeechRecognitionProvider');
          return;
        } else {
          console.warn('[VOICE][iOS] Permissions not fully granted for native speech, activating fallback');
        }
      } catch (sttErr: any) {
        console.warn('[VOICE][iOS] NativeSpeechRecognitionProvider attempt failed:', sttErr?.message || sttErr);
        this.activeProvider = null;
      }
    } else {
      if (!micPermGranted) {
        try {
          const reqMic = await VoiceRecorder.requestAudioRecordingPermission();
          micPermGranted = !!reqMic?.value;
        } catch (e) {
          micPermGranted = false;
        }
      }
      console.log(`[VOICE][iOS] microphone permission: ${micPermGranted ? 'granted' : 'denied'}`);
      console.log('[VOICE][iOS] speech permission: not_available');
    }

    // 4. Fallback on iOS: Native Voice Recorder (capacitor-voice-recorder + /api/transcribe-audio)
    console.log('[VOICE][iOS] fallback activated: NativeVoiceRecorderProvider');
    if (this.nativeVoiceRecorderProvider.isAvailable()) {
      try {
        this.activeProvider = this.nativeVoiceRecorderProvider;
        console.log('[VOICE][iOS] provider selected: NativeVoiceRecorderProvider');
        await this.nativeVoiceRecorderProvider.start(callbacks);
        return;
      } catch (recErr: any) {
        console.warn('[VOICE][iOS] NativeVoiceRecorderProvider failed:', recErr?.message || recErr);
        this.activeProvider = null;
        throw recErr;
      }
    }

    // 5. Last resort fallback: GeminiAudioFallbackProvider
    if (this.geminiProvider.isAvailable()) {
      try {
        this.activeProvider = this.geminiProvider;
        console.log('[VOICE][iOS] provider selected: GeminiAudioFallbackProvider');
        await this.geminiProvider.start(callbacks);
        return;
      } catch (gemErr: any) {
        console.warn('[VOICE][iOS] GeminiAudioFallbackProvider failed:', gemErr?.message || gemErr);
        this.activeProvider = null;
        throw gemErr;
      }
    }

    throw new Error('Mikrofon/səs qəbulu vasitəsi bu cihazda dəstəklənmir.');
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

    // Android native routing (KEEP EXISTING CURRENT FLOW UNCHANGED)
    if (isNative) {
      // 1. Primary on Native Android: Native Speech Recognition (az-AZ locale)
      if (this.nativeSTTProvider.isAvailable()) {
        try {
          this.activeProvider = this.nativeSTTProvider;
          console.log('[SpeechProviderManager] primary provider=NativeSpeechRecognitionProvider (az-AZ)');
          await this.nativeSTTProvider.start(callbacks);
          return;
        } catch (sttErr: any) {
          console.warn('[SpeechProviderManager] Native STT start failed:', sttErr);
          console.log('[NATIVE STT] failed');
          console.log('[NATIVE STT] Gemini fallback activated');
        }
      }

      // 2. Fallback on Native: Native Audio Recorder (capacitor-voice-recorder + /api/transcribe-audio)
      if (this.nativeVoiceRecorderProvider.isAvailable()) {
        try {
          this.activeProvider = this.nativeVoiceRecorderProvider;
          console.log('[SpeechProviderManager] fallback provider=NativeVoiceRecorderProvider');
          await this.nativeVoiceRecorderProvider.start(callbacks);
          return;
        } catch (recErr: any) {
          console.warn('[SpeechProviderManager] Native voice recorder start failed:', recErr);
        }
      }

      // 3. Last-resort fallback: MediaRecorder fallback
      if (this.geminiProvider.isAvailable()) {
        this.activeProvider = this.geminiProvider;
        console.log('[SpeechProviderManager] last resort provider=GeminiAudioFallbackProvider');
        await this.geminiProvider.start(callbacks);
        return;
      }

      throw new Error('Mikrofon/səs qəbulu vasitəsi bu cihazda dəstəklənmir.');
    }

    // Web browser environment: prefer WebSpeechRecognitionProvider for real-time streaming, fallback to GeminiAudioFallbackProvider
    if (this.webProvider.isAvailable()) {
      try {
        this.activeProvider = this.webProvider;
        console.log('[SpeechProviderManager] provider=WebSpeechRecognitionProvider');
        await this.webProvider.start(callbacks);
        return;
      } catch (err) {
        console.warn('[SpeechProviderManager] WebSpeech start failed, switching to Gemini fallback:', err);
      }
    }

    // Fallback to Gemini MediaRecorder capture on web
    if (this.geminiProvider.isAvailable()) {
      this.activeProvider = this.geminiProvider;
      console.log('[SpeechProviderManager] provider=GeminiAudioFallbackProvider');
      await this.geminiProvider.start(callbacks);
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
