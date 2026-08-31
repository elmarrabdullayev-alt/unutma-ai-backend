import { SpeechCallbacks, SpeechRecognitionProvider } from './SpeechRecognitionProvider';

export class WebSpeechRecognitionProvider implements SpeechRecognitionProvider {
  public readonly name = 'WebSpeechRecognitionProvider';
  private recognition: any = null;
  private isListeningState = false;
  private currentTranscript = '';
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private animFrame: number | null = null;
  private currentAudioLevel = 0;

  public isAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public async start(callbacks: SpeechCallbacks): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Web Speech API is not available on this platform.');
    }

    this.currentTranscript = '';
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'az-AZ';

    recognition.onresult = (event: any) => {
      let interim = '';
      let finalChunk = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalChunk += item + ' ';
        } else {
          interim += item;
        }
      }

      if (finalChunk) {
        this.currentTranscript = (this.currentTranscript ? this.currentTranscript + ' ' : '') + finalChunk.trim();
        callbacks.onResult(this.currentTranscript, true);
      } else if (interim) {
        callbacks.onResult(this.currentTranscript ? `${this.currentTranscript} ${interim}` : interim, false);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('[WebSpeechProvider] Recognition error:', event.error);
      if (callbacks.onError) callbacks.onError(event);
    };

    recognition.onend = () => {
      this.isListeningState = false;
      if (callbacks.onEnd) callbacks.onEnd();
    };

    // Start audio visualizer
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      this.audioContext = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      this.analyser = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        this.currentAudioLevel = Math.min(1, sum / dataArray.length / 55);
        if (callbacks.onAudioLevel) callbacks.onAudioLevel(this.currentAudioLevel);
        this.animFrame = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      console.warn('[WebSpeechProvider] Mic stream error for visualizer:', e);
    }

    try {
      recognition.start();
      this.recognition = recognition;
      this.isListeningState = true;
    } catch (e) {
      console.warn('[WebSpeechProvider] Recognition start error:', e);
    }
  }

  public async stop(): Promise<string> {
    this.isListeningState = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.recognition = null;
    }

    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    return this.currentTranscript;
  }

  public getAudioLevel(): number {
    return this.currentAudioLevel;
  }
}
