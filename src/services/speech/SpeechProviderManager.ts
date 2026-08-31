import { Capacitor } from '@capacitor/core';
import { SpeechCallbacks, SpeechRecognitionProvider } from './SpeechRecognitionProvider';
import { WebSpeechRecognitionProvider } from './WebSpeechRecognitionProvider';
import { GeminiAudioFallbackProvider } from './GeminiAudioFallbackProvider';

export class SpeechProviderManager {
  private activeProvider: SpeechRecognitionProvider | null = null;
  private webProvider = new WebSpeechRecognitionProvider();
  private geminiProvider = new GeminiAudioFallbackProvider();

  public getActiveProviderName(): string {
    return this.activeProvider ? this.activeProvider.name : 'None';
  }

  public async startListening(callbacks: SpeechCallbacks): Promise<void> {
    const isNative = Capacitor.isNativePlatform();
    console.log(`[SpeechProviderManager] runtime=${isNative ? 'native' : 'web'}`);

    if (isNative) {
      // Inside Capacitor native runtime (Android/iOS), do NOT use WebSpeechRecognitionProvider as primary.
      // WebSpeech in WebView often hangs without returning speech events.
      // Use GeminiAudioFallbackProvider directly for guaranteed audio capture & server-side AI transcription.
      if (this.geminiProvider.isAvailable()) {
        this.activeProvider = this.geminiProvider;
        console.log('[SpeechProviderManager] provider=GeminiAudioFallbackProvider');
        await this.geminiProvider.start(callbacks);
        return;
      } else {
        throw new Error('Mikrofon/səs qəbulu vasitəsi bu cihazda dəstəklənmir.');
      }
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

    // Fallback to Gemini MediaRecorder capture
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
      const result = await this.activeProvider.stop();
      this.activeProvider = null;
      return result;
    }
    return '';
  }

  public getAudioLevel(): number {
    return this.activeProvider ? this.activeProvider.getAudioLevel() : 0;
  }
}

export const speechManager = new SpeechProviderManager();
