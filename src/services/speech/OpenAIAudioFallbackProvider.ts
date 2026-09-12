import { SpeechCallbacks, SpeechRecognitionProvider } from './SpeechRecognitionProvider';
import { apiClient } from '../apiClient';

export class OpenAIAudioFallbackProvider implements SpeechRecognitionProvider {
  public readonly name = 'OpenAIAudioFallbackProvider';
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private animFrame: number | null = null;
  private currentAudioLevel = 0;
  private callbacks: SpeechCallbacks | null = null;
  private activeStopPromise: Promise<string> | null = null;

  public isAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      !!navigator.mediaDevices.getUserMedia &&
      typeof MediaRecorder !== 'undefined'
    );
  }

  public async start(callbacks: SpeechCallbacks): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('MediaRecorder audio input is not supported in this environment.');
    }

    this.callbacks = callbacks;
    this.audioChunks = [];
    this.activeStopPromise = null;

    // 1. Acquire microphone media stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;
      console.log('[OpenAIAudioFallbackProvider] microphone stream acquired');
    } catch (err: any) {
      console.error('[OpenAIAudioFallbackProvider] getUserMedia error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Mikrofon icazəsi verilməyib. Zəhmət olmasa tətbiq tənzimləmələrindən mikrofon icazəsi verin.');
      }
      throw new Error(`Mikrofona qoşulmaq mümkün olmadı: ${err.message || 'Bilinməyən xəta'}`);
    }

    // 2. Setup Audio Visualizer
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        this.audioContext = ctx;
        const src = ctx.createMediaStreamSource(this.mediaStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        src.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          if (!this.mediaStream) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          this.currentAudioLevel = Math.min(1, sum / dataArray.length / 55);
          if (callbacks.onAudioLevel) callbacks.onAudioLevel(this.currentAudioLevel);
          this.animFrame = requestAnimationFrame(loop);
        };
        loop();
      }
    } catch (e) {
      console.warn('[OpenAIAudioFallbackProvider] Audio visualizer error (non-fatal):', e);
    }

    // 3. Setup MediaRecorder with best supported mimeType
    let mimeType = '';
    if (typeof MediaRecorder.isTypeSupported === 'function') {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/aac')) {
        mimeType = 'audio/aac';
      }
    }

    const recorder = mimeType ? new MediaRecorder(this.mediaStream, { mimeType }) : new MediaRecorder(this.mediaStream);
    this.audioChunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.audioChunks.push(e.data);
      }
    };

    recorder.onerror = (err) => {
      console.warn('[OpenAIAudioFallbackProvider] MediaRecorder error event:', err);
      if (callbacks.onError) callbacks.onError(err);
    };

    recorder.onstop = () => {
      if (callbacks.onEnd) callbacks.onEnd();
    };

    recorder.start(250);
    this.mediaRecorder = recorder;
    console.log('[OpenAIAudioFallbackProvider] recorder started');
  }

  public async stop(): Promise<string> {
    if (this.activeStopPromise) {
      return this.activeStopPromise;
    }

    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    const currentRecorder = this.mediaRecorder;
    this.mediaRecorder = null;

    if (!currentRecorder || currentRecorder.state === 'inactive') {
      this.cleanupStream();
      return '';
    }

    this.activeStopPromise = new Promise<string>((resolve, reject) => {
      currentRecorder.onstop = async () => {
        try {
          this.cleanupStream();
          console.log(`[OpenAIAudioFallbackProvider] audio chunks count=${this.audioChunks.length}`);

          if (this.audioChunks.length === 0) {
            resolve('');
            return;
          }

          const blob = new Blob(this.audioChunks, {
            type: currentRecorder.mimeType || 'audio/webm',
          });

          if (blob.size === 0) {
            resolve('');
            return;
          }

          const base64 = await this.blobToBase64(blob);
          const normalizedBase64 = base64
            .replace(/^data:.*?;base64,/, '')
            .replace(/\s/g, '')
            .trim();

          if (!normalizedBase64 || normalizedBase64.length < 100 || !/^[A-Za-z0-9+/=]+$/.test(normalizedBase64)) {
            console.log('[OpenAIAudioFallbackProvider] Audio recording was empty, too short, or invalid, skipping API call');
            if (this.callbacks?.onEnd) this.callbacks.onEnd();
            resolve('');
            return;
          }

          const transcriptionUrl = apiClient.buildUrl('/api/transcribe-audio');
          console.log(`[OpenAIAudioFallbackProvider] transcription URL=${transcriptionUrl}`);

          const data = await apiClient.transcribeAudio(normalizedBase64, blob.type || 'audio/webm');
          console.log('[OpenAIAudioFallbackProvider] response status=200');
          console.log('[OpenAIAudioFallbackProvider] transcription received');

          const resultText = (data.transcription || '').trim();
          if (this.callbacks?.onResult) {
            this.callbacks.onResult(resultText, true);
          }

          resolve(resultText);
        } catch (err: any) {
          console.error('[OpenAIAudioFallbackProvider] Transcribe error:', err);
          const errorMsg = err.message?.includes('AI server bağlantısı')
            ? err.message
            : (err.message || 'Səs qeydə alındı, lakin transkripsiya edilə bilmədi.');
          if (this.callbacks?.onError) {
            this.callbacks.onError(new Error(errorMsg));
          }
          reject(new Error(errorMsg));
        } finally {
          this.activeStopPromise = null;
        }
      };

      try {
        currentRecorder.stop();
      } catch (e) {
        this.cleanupStream();
        this.activeStopPromise = null;
        resolve('');
      }
    });

    return this.activeStopPromise;
  }

  private cleanupStream(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
  }

  public getAudioLevel(): number {
    return this.currentAudioLevel;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        const base64Data = res.split(',')[1] || '';
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
