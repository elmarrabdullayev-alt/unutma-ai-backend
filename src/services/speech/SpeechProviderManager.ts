import { Capacitor } from '@capacitor/core';
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

  public async startListening(callbacks: SpeechCallbacks): Promise<void> {
    const isNative = Capacitor.isNativePlatform();
    console.log(`[SpeechProviderManager] runtime=${isNative ? 'native' : 'web'}`);

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
