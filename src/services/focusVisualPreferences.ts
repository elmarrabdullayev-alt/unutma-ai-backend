import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export type FocusVisualTheme = 'memory-ring' | 'energy-core' | 'sound-wave';

export const FOCUS_VISUAL_THEME_STORAGE_KEY = 'unutma_ai_focus_visual_theme_v1';
export const DEFAULT_FOCUS_VISUAL_THEME: FocusVisualTheme = 'memory-ring';

export type FocusVisualProps = {
  progress: number;
  isPaused: boolean;
};

export interface FocusVisualOption {
  id: FocusVisualTheme;
  title: string;
  subtitle: string;
  description: string;
}

export const FOCUS_VISUAL_OPTIONS: FocusVisualOption[] = [
  {
    id: 'memory-ring',
    title: 'Yaddaş halqası',
    subtitle: 'Orbital bənövşəyi halqalar',
    description: 'Tədricən mərkəzə sıxılan və fırlanan bənövşəyi orbital halqalar və parıldayan yaddaş nüvəsi.',
  },
  {
    id: 'energy-core',
    title: 'Enerji nüvəsi',
    subtitle: 'Pulsasiya edən şüalar',
    description: 'Fokus dərinləşdikcə güclənən konsentrik enerji qabıqları və zərif elektrik filamentləri.',
  },
  {
    id: 'sound-wave',
    title: 'Səs dalğası',
    subtitle: 'Sakitləşdirici tezlik spektri',
    description: 'Axıcı səs dalğaları və tamamlandıqda sakit mərkəzi xəttə çevrilən tezlik zolaqları.',
  },
];

class FocusVisualPreferencesService {
  private currentTheme: FocusVisualTheme = DEFAULT_FOCUS_VISUAL_THEME;
  private isInitialized = false;
  private listeners: Set<(theme: FocusVisualTheme) => void> = new Set();

  constructor() {
    // Synchronous initial read from localStorage for instant zero-flicker render
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      try {
        const stored = localStorage.getItem(FOCUS_VISUAL_THEME_STORAGE_KEY);
        if (stored && this.isValidTheme(stored)) {
          this.currentTheme = stored as FocusVisualTheme;
        }
      } catch {
        // ignore fallback errors
      }
    }
  }

  private isValidTheme(val: unknown): val is FocusVisualTheme {
    return val === 'memory-ring' || val === 'energy-core' || val === 'sound-wave';
  }

  /**
   * Initializes theme preference asynchronously from Capacitor Preferences.
   */
  public async init(): Promise<FocusVisualTheme> {
    if (this.isInitialized) return this.currentTheme;

    try {
      let raw: string | null = null;
      if (Capacitor.isNativePlatform()) {
        try {
          const { value } = await Preferences.get({ key: FOCUS_VISUAL_THEME_STORAGE_KEY });
          raw = value;
        } catch (err) {
          console.warn('[FocusVisualPreferences] Preferences.get error:', err);
        }
      }

      if (!raw && typeof window !== 'undefined' && 'localStorage' in window) {
        raw = localStorage.getItem(FOCUS_VISUAL_THEME_STORAGE_KEY);
      }

      if (raw && this.isValidTheme(raw)) {
        this.currentTheme = raw as FocusVisualTheme;
      }
    } catch (err) {
      console.warn('[FocusVisualPreferences] init error:', err);
    } finally {
      this.isInitialized = true;
      this.notify();
    }

    return this.currentTheme;
  }

  public getTheme(): FocusVisualTheme {
    return this.currentTheme;
  }

  public async setTheme(theme: FocusVisualTheme): Promise<void> {
    if (!this.isValidTheme(theme)) return;
    this.currentTheme = theme;
    this.notify();

    // Persist to Capacitor Preferences and localStorage
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        localStorage.setItem(FOCUS_VISUAL_THEME_STORAGE_KEY, theme);
      }
      if (Capacitor.isNativePlatform()) {
        await Preferences.set({
          key: FOCUS_VISUAL_THEME_STORAGE_KEY,
          value: theme,
        });
      }
    } catch (err) {
      console.warn('[FocusVisualPreferences] setTheme save error:', err);
    }
  }

  public subscribe(listener: (theme: FocusVisualTheme) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.currentTheme);
      } catch (err) {
        console.error('[FocusVisualPreferences] notify error:', err);
      }
    }
  }
}

export const focusVisualPreferences = new FocusVisualPreferencesService();
