export interface SpeechCallbacks {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (error: any) => void;
  onEnd?: () => void;
  onAudioLevel?: (level: number) => void;
}

export interface SpeechRecognitionProvider {
  readonly name: string;
  isAvailable(): boolean;
  start(callbacks: SpeechCallbacks): Promise<void>;
  stop(): Promise<string>;
  getAudioLevel(): number;
}
