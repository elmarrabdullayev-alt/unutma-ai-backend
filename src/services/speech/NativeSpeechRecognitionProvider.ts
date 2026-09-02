import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { SpeechCallbacks, SpeechRecognitionProvider } from './SpeechRecognitionProvider';

export class NativeSpeechRecognitionProvider implements SpeechRecognitionProvider {
  public readonly name = 'NativeSpeechRecognitionProvider';
  private isListening = false;
  private callbacks: SpeechCallbacks | null = null;
  private lastTranscript = '';
  private partialListenerHandle: PluginListenerHandle | null = null;
  private listeningStateHandle: PluginListenerHandle | null = null;
  private audioLevelInterval: number | null = null;
  private currentAudioLevel = 0;

  public isAvailable(): boolean {
    return Capacitor.isNativePlatform() && typeof SpeechRecognition !== 'undefined';
  }

  public async start(callbacks: SpeechCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.lastTranscript = '';

    // 1. Availability check
    try {
      const avail = await SpeechRecognition.available();
      console.log('[NATIVE STT] available:', avail?.available);
      if (!avail?.available) {
        throw new Error('Native Speech Recognition is not available on this device');
      }
    } catch (availErr: any) {
      console.warn('[NATIVE STT] available check failed:', availErr);
      throw availErr;
    }

    // 2. Permission check & request
    try {
      const permStatus = await SpeechRecognition.checkPermissions();
      console.log('[NATIVE STT] permission:', permStatus?.speechRecognition);

      if (permStatus?.speechRecognition !== 'granted') {
        const reqStatus = await SpeechRecognition.requestPermissions();
        console.log('[NATIVE STT] permission requested:', reqStatus?.speechRecognition);
        if (reqStatus?.speechRecognition !== 'granted') {
          throw new Error('Mikrofon/Danışıq tanıma icazəsi verilməyib.');
        }
      }
    } catch (permErr: any) {
      console.warn('[NATIVE STT] permission error:', permErr);
      throw permErr;
    }

    // 3. Remove old listeners
    await this.cleanupListeners();

    // 4. Attach partial results listener
    try {
      this.partialListenerHandle = await SpeechRecognition.addListener('partialResults', (data) => {
        if (data && Array.isArray(data.matches) && data.matches.length > 0) {
          const partial = (data.matches[0] || '').trim();
          if (partial) {
            console.log('[NATIVE STT] partial transcript:', partial);
            this.lastTranscript = partial;
            if (this.callbacks?.onResult) {
              this.callbacks.onResult(partial, false);
            }
          }
        }
      });

      this.listeningStateHandle = await SpeechRecognition.addListener('listeningState', (data) => {
        console.log('[NATIVE STT] listeningState:', data.status);
      });
    } catch (listenerErr) {
      console.warn('[NATIVE STT] listener attach failed:', listenerErr);
    }

    // 5. Start native recognition in Azerbaijani ('az-AZ')
    try {
      this.isListening = true;
      console.log('[NATIVE STT] listening started');
      this.startAudioLevelSimulation();

      // Start recognition in background promise
      SpeechRecognition.start({
        language: 'az-AZ',
        maxResults: 5,
        prompt: 'Danışın...',
        popup: false,
        partialResults: true,
      })
        .then((result) => {
          if (result && Array.isArray(result.matches) && result.matches.length > 0) {
            const finalMatch = (result.matches[0] || '').trim();
            if (finalMatch) {
              console.log('[NATIVE STT] final transcript:', finalMatch);
              this.lastTranscript = finalMatch;
              if (this.callbacks?.onResult) {
                this.callbacks.onResult(finalMatch, true);
              }
            }
          }
        })
        .catch((startErr) => {
          console.warn('[NATIVE STT] start execution error:', startErr);
        });
    } catch (startErr: any) {
      this.isListening = false;
      this.stopAudioLevelSimulation();
      console.error('[NATIVE STT] failed:', startErr);
      throw startErr;
    }
  }

  public async stop(): Promise<string> {
    if (!this.isListening && !this.lastTranscript) {
      return '';
    }

    this.isListening = false;
    this.stopAudioLevelSimulation();

    try {
      console.log('[NATIVE STT] stopping native recognition...');
      await SpeechRecognition.stop();
    } catch (stopErr) {
      console.warn('[NATIVE STT] stop error:', stopErr);
    } finally {
      await this.cleanupListeners();
    }

    const finalTranscript = this.lastTranscript.trim();
    if (finalTranscript) {
      console.log('[NATIVE STT] final transcript:', finalTranscript);
      if (this.callbacks?.onResult) {
        this.callbacks.onResult(finalTranscript, true);
      }
      if (this.callbacks?.onEnd) {
        this.callbacks.onEnd();
      }
      return finalTranscript;
    } else {
      console.log('[NATIVE STT] failed');
      return '';
    }
  }

  public getAudioLevel(): number {
    return this.currentAudioLevel;
  }

  private async cleanupListeners(): Promise<void> {
    try {
      if (this.partialListenerHandle) {
        await this.partialListenerHandle.remove();
        this.partialListenerHandle = null;
      }
      if (this.listeningStateHandle) {
        await this.listeningStateHandle.remove();
        this.listeningStateHandle = null;
      }
    } catch (e) {
      // Ignore listener removal errors
    }
  }

  private startAudioLevelSimulation(): void {
    this.stopAudioLevelSimulation();
    this.audioLevelInterval = window.setInterval(() => {
      if (!this.isListening) return;
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
}
