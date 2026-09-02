import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { FocusAudioPreset, FocusAudioOption, FocusAudioSettings } from '../types';

export const FOCUS_AUDIO_PRESET_KEY = 'unutma_ai_focus_audio_preset_v1';
export const FOCUS_AUDIO_VOLUME_KEY = 'unutma_ai_focus_audio_volume_v1';
export const FOCUS_AUDIO_AUTOPLAY_KEY = 'unutma_ai_focus_audio_autoplay_v1';

export const FOCUS_AUDIO_OPTIONS: FocusAudioOption[] = [
  {
    id: 'silent',
    name: 'Səssiz',
    subtitle: 'Səssiz və tam sakit mühit',
    iconName: 'VolumeX',
  },
  {
    id: 'lofi',
    name: 'Lo-Fi',
    subtitle: 'Sakit və ritmik melodiyalar',
    iconName: 'Music',
    fileName: 'lofi.mp3',
  },
  {
    id: 'rain',
    name: 'Yağış',
    subtitle: 'Sakitləşdirici yağış damlaları',
    iconName: 'CloudRain',
    fileName: 'rain.mp3',
  },
  {
    id: 'cafe',
    name: 'Kafe',
    subtitle: 'Mülayim kafe abu-havası',
    iconName: 'Coffee',
    fileName: 'cafe.mp3',
  },
  {
    id: 'white-noise',
    name: 'White Noise',
    subtitle: 'Kənar səsləri boğan bərabər səs',
    iconName: 'Waves',
    fileName: 'white-noise.mp3',
  },
  {
    id: 'deep-focus',
    name: 'Deep Focus',
    subtitle: 'Dərin konsentrasiya tonları',
    iconName: 'Zap',
    fileName: 'deep-focus.mp3',
  },
  {
    id: 'nature',
    name: 'Təbiət',
    subtitle: 'Meşə və quş səsləri',
    iconName: 'Trees',
    fileName: 'nature.mp3',
  },
];

type AudioChangeListener = (settings: FocusAudioSettings, isPlaying: boolean) => void;

class FocusAudioService {
  private currentPreset: FocusAudioPreset = 'silent';
  private volume = 0.6; // 0 to 1 (default 60%)
  private autoPlay = false; // default OFF as requested
  private isPlaying = false;
  private audioElement: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private synthGainNode: GainNode | null = null;
  private synthSources: AudioNode[] = [];
  private listeners: Set<AudioChangeListener> = new Set();
  private isInitialized = false;

  constructor() {
    this.init();
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      let presetRaw: string | null = null;
      let volumeRaw: string | null = null;
      let autoPlayRaw: string | null = null;

      if (Capacitor.isNativePlatform()) {
        try {
          const p = await Preferences.get({ key: FOCUS_AUDIO_PRESET_KEY });
          presetRaw = p.value;
          const v = await Preferences.get({ key: FOCUS_AUDIO_VOLUME_KEY });
          volumeRaw = v.value;
          const a = await Preferences.get({ key: FOCUS_AUDIO_AUTOPLAY_KEY });
          autoPlayRaw = a.value;
        } catch (e) {
          console.warn('[FocusAudioService] Native preferences read error:', e);
        }
      }

      if (!presetRaw && typeof window !== 'undefined' && 'localStorage' in window) {
        presetRaw = localStorage.getItem(FOCUS_AUDIO_PRESET_KEY);
      }
      if (!volumeRaw && typeof window !== 'undefined' && 'localStorage' in window) {
        volumeRaw = localStorage.getItem(FOCUS_AUDIO_VOLUME_KEY);
      }
      if (!autoPlayRaw && typeof window !== 'undefined' && 'localStorage' in window) {
        autoPlayRaw = localStorage.getItem(FOCUS_AUDIO_AUTOPLAY_KEY);
      }

      if (presetRaw) {
        const validPreset = FOCUS_AUDIO_OPTIONS.some((opt) => opt.id === presetRaw);
        if (validPreset) {
          this.currentPreset = presetRaw as FocusAudioPreset;
        }
      }

      if (volumeRaw !== null) {
        const parsedVol = parseFloat(volumeRaw);
        if (!isNaN(parsedVol) && parsedVol >= 0 && parsedVol <= 1) {
          this.volume = parsedVol;
        }
      }

      if (autoPlayRaw !== null) {
        this.autoPlay = autoPlayRaw === 'true';
      }
    } catch (err) {
      console.warn('[FocusAudioService] Init error:', err);
    } finally {
      this.isInitialized = true;
      this.notify();
    }
  }

  public getSettings(): FocusAudioSettings {
    return {
      preset: this.currentPreset,
      volume: this.volume,
      autoPlay: this.autoPlay,
    };
  }

  public isAudioPlaying(): boolean {
    return this.isPlaying;
  }

  public subscribe(listener: AudioChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.getSettings(), this.isPlaying);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const settings = this.getSettings();
    this.listeners.forEach((fn) => fn(settings, this.isPlaying));
  }

  public async setPreset(preset: FocusAudioPreset, restartIfPlaying = true): Promise<void> {
    if (this.currentPreset === preset) return;
    this.currentPreset = preset;
    await this.persist();

    if (this.isPlaying) {
      if (preset === 'silent') {
        this.stopAudioResources();
        this.isPlaying = false;
        this.notify();
      } else if (restartIfPlaying) {
        this.stopAudioResources();
        await this.startAudioResource();
      }
    } else {
      this.notify();
    }
  }

  public async setVolume(volume: number): Promise<void> {
    const clamped = Math.max(0, Math.min(1, volume));
    this.volume = clamped;

    if (this.audioElement) {
      this.audioElement.volume = clamped;
    }
    if (this.synthGainNode && this.audioContext) {
      try {
        this.synthGainNode.gain.setValueAtTime(clamped * 0.15, this.audioContext.currentTime);
      } catch {
        // ignore
      }
    }

    await this.persist();
    this.notify();
  }

  public async setAutoPlay(autoPlay: boolean): Promise<void> {
    this.autoPlay = autoPlay;
    await this.persist();
    this.notify();
  }

  private async persist(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        localStorage.setItem(FOCUS_AUDIO_PRESET_KEY, this.currentPreset);
        localStorage.setItem(FOCUS_AUDIO_VOLUME_KEY, String(this.volume));
        localStorage.setItem(FOCUS_AUDIO_AUTOPLAY_KEY, String(this.autoPlay));
      }
      if (Capacitor.isNativePlatform()) {
        await Preferences.set({ key: FOCUS_AUDIO_PRESET_KEY, value: this.currentPreset });
        await Preferences.set({ key: FOCUS_AUDIO_VOLUME_KEY, value: String(this.volume) });
        await Preferences.set({ key: FOCUS_AUDIO_AUTOPLAY_KEY, value: String(this.autoPlay) });
      }
    } catch (e) {
      console.warn('[FocusAudioService] persist error:', e);
    }
  }

  /**
   * Start or resume playing focus audio
   */
  public async play(): Promise<void> {
    if (this.currentPreset === 'silent') {
      this.isPlaying = false;
      this.notify();
      return;
    }

    if (this.isPlaying) return;

    await this.startAudioResource();
  }

  /**
   * Pause current focus audio
   */
  public pause(): void {
    if (!this.isPlaying) return;

    if (this.audioElement) {
      try {
        this.audioElement.pause();
      } catch {
        // ignore
      }
    }

    if (this.audioContext && this.audioContext.state === 'running') {
      try {
        this.audioContext.suspend();
      } catch {
        // ignore
      }
    }

    this.isPlaying = false;
    this.notify();
  }

  /**
   * Resume audio if paused
   */
  public async resume(): Promise<void> {
    if (this.currentPreset === 'silent') return;

    if (this.audioElement) {
      try {
        await this.audioElement.play();
        this.isPlaying = true;
        this.notify();
        return;
      } catch {
        // fallback to restarting
      }
    }

    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        this.isPlaying = true;
        this.notify();
        return;
      } catch {
        // fallback
      }
    }

    await this.startAudioResource();
  }

  /**
   * Stop and cleanup audio
   */
  public stop(): void {
    this.stopAudioResources();
    this.isPlaying = false;
    this.notify();
  }

  /**
   * Release all audio elements and context
   */
  public release(): void {
    this.stop();
  }

  private stopAudioResources(): void {
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        this.audioElement.src = '';
        this.audioElement.load();
      } catch {
        // ignore
      }
      this.audioElement = null;
    }

    if (this.synthSources.length > 0) {
      this.synthSources.forEach((src) => {
        try {
          if ('stop' in src && typeof (src as AudioScheduledSourceNode).stop === 'function') {
            (src as AudioScheduledSourceNode).stop();
          }
          src.disconnect();
        } catch {
          // ignore
        }
      });
      this.synthSources = [];
    }

    if (this.synthGainNode) {
      try {
        this.synthGainNode.disconnect();
      } catch {
        // ignore
      }
      this.synthGainNode = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {
        // ignore
      }
      this.audioContext = null;
    }
  }

  private async startAudioResource(): Promise<void> {
    this.stopAudioResources();

    if (this.currentPreset === 'silent') {
      this.isPlaying = false;
      this.notify();
      return;
    }

    const option = FOCUS_AUDIO_OPTIONS.find((o) => o.id === this.currentPreset);
    if (!option || !option.fileName) {
      this.isPlaying = false;
      this.notify();
      return;
    }

    const audioUrl = `/audio/focus/${option.fileName}`;

    try {
      const audio = new Audio();
      audio.loop = true;
      audio.volume = this.volume;
      audio.preload = 'auto';

      let hasHandledError = false;

      audio.onerror = () => {
        if (!hasHandledError) {
          hasHandledError = true;
          console.info(`[FocusAudio] Local asset ${audioUrl} not found, using procedural ambient fallback for ${this.currentPreset}`);
          this.audioElement = null;
          this.startProceduralFallback(this.currentPreset);
        }
      };

      audio.src = audioUrl;
      this.audioElement = audio;

      await audio.play();
      this.isPlaying = true;
      this.notify();
    } catch {
      // Audio play failed or file missing -> fallback gracefully to procedural ambient synth
      console.info(`[FocusAudio] Play failed for ${audioUrl}, using procedural ambient synth`);
      this.startProceduralFallback(this.currentPreset);
    }
  }

  /**
   * High-quality procedural ambient generator fallback
   * Ensures users still get calming rain/white-noise/drone even if physical mp3s are absent
   */
  private startProceduralFallback(preset: FocusAudioPreset): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        this.isPlaying = false;
        this.notify();
        return;
      }

      this.audioContext = new AudioCtx();
      const ctx = this.audioContext;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(this.volume * 0.12, ctx.currentTime);
      masterGain.connect(ctx.destination);
      this.synthGainNode = masterGain;

      // 1. Generate gentle noise buffer (Pink / Brownish noise for rain, white noise, cafe)
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Pink noise filter algorithm
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Filter based on preset
      const filter = ctx.createBiquadFilter();

      if (preset === 'rain') {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(700, ctx.currentTime);
      } else if (preset === 'white-noise') {
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, ctx.currentTime);
        filter.Q.setValueAtTime(0.5, ctx.currentTime);
      } else if (preset === 'cafe') {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, ctx.currentTime);
      } else if (preset === 'deep-focus' || preset === 'lofi') {
        // Meditative drone chord
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, ctx.currentTime);

        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(110, ctx.currentTime); // A2

        const osc2 = ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(164.81, ctx.currentTime); // E3

        const droneGain = ctx.createGain();
        droneGain.gain.setValueAtTime(0.04, ctx.currentTime);

        osc1.connect(droneGain);
        osc2.connect(droneGain);
        droneGain.connect(masterGain);

        osc1.start();
        osc2.start();
        this.synthSources.push(osc1, osc2, droneGain);
      } else if (preset === 'nature') {
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(850, ctx.currentTime);
      }

      whiteNoise.connect(filter);
      filter.connect(masterGain);
      whiteNoise.start();

      this.synthSources.push(whiteNoise, filter);
      this.isPlaying = true;
      this.notify();
    } catch (e) {
      console.warn('[FocusAudio] Procedural fallback error:', e);
      this.isPlaying = false;
      this.notify();
    }
  }
}

export const focusAudioService = new FocusAudioService();
