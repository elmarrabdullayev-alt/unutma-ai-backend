import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Reminder } from '../types';

export const STORAGE_KEY = 'unutma_ai_reminders_v3';
export const LEGACY_STORAGE_KEY = 'unutma_ai_reminders_v2';

export interface ReminderStorageProvider {
  name: string;
  isAvailable(): boolean;
  getAll(): Promise<Reminder[]>;
  saveAll(reminders: Reminder[]): Promise<void>;
  getById(id: string): Promise<Reminder | null>;
  saveReminder(reminder: Reminder): Promise<void>;
  removeReminder(id: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * 1. LocalStorage Storage Provider (Browser / Preview Runtime)
 */
export class LocalStorageReminderStorageProvider implements ReminderStorageProvider {
  public readonly name = 'LocalStorageStorageProvider';

  public isAvailable(): boolean {
    return typeof window !== 'undefined' && 'localStorage' in window;
  }

  public async getAll(): Promise<Reminder[]> {
    if (!this.isAvailable()) return [];
    try {
      let saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        // Check legacy storage key for seamless migration
        saved = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (saved) {
          localStorage.setItem(STORAGE_KEY, saved);
        }
      }
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[LocalStorageProvider] getAll error:', e);
    }
    return [];
  }

  public async saveAll(reminders: Reminder[]): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
    } catch (e) {
      console.error('[LocalStorageProvider] saveAll error:', e);
    }
  }

  public async getById(id: string): Promise<Reminder | null> {
    const all = await this.getAll();
    return all.find((r) => r.id === id) || null;
  }

  public async saveReminder(reminder: Reminder): Promise<void> {
    const all = await this.getAll();
    const existingIndex = all.findIndex((r) => r.id === reminder.id);
    let updated: Reminder[];
    if (existingIndex >= 0) {
      updated = all.map((r) => (r.id === reminder.id ? reminder : r));
    } else {
      updated = [reminder, ...all];
    }
    await this.saveAll(updated);
  }

  public async removeReminder(id: string): Promise<void> {
    const all = await this.getAll();
    const filtered = all.filter((r) => r.id !== id);
    await this.saveAll(filtered);
  }

  public async clear(): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('[LocalStorageProvider] clear error:', e);
    }
  }
}

/**
 * 2. Capacitor Native Preferences Storage Provider (iOS / Android Native Runtime)
 */
export class CapacitorPreferencesStorageProvider implements ReminderStorageProvider {
  public readonly name = 'CapacitorPreferencesStorageProvider';

  public isAvailable(): boolean {
    return typeof window !== 'undefined' && Capacitor.isPluginAvailable('Preferences');
  }

  public async getAll(): Promise<Reminder[]> {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (value) {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
      // If native preferences empty, check if LocalStorage has data to migrate
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        const legacy = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          const parsedLegacy = JSON.parse(legacy);
          if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
            await this.saveAll(parsedLegacy);
            return parsedLegacy;
          }
        }
      }
    } catch (e) {
      console.warn('[CapacitorPreferencesProvider] getAll error:', e);
    }
    return [];
  }

  public async saveAll(reminders: Reminder[]): Promise<void> {
    try {
      await Preferences.set({
        key: STORAGE_KEY,
        value: JSON.stringify(reminders),
      });
      // Also mirror to LocalStorage for safety
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
      }
    } catch (e) {
      console.error('[CapacitorPreferencesProvider] saveAll error:', e);
    }
  }

  public async getById(id: string): Promise<Reminder | null> {
    const all = await this.getAll();
    return all.find((r) => r.id === id) || null;
  }

  public async saveReminder(reminder: Reminder): Promise<void> {
    const all = await this.getAll();
    const existingIndex = all.findIndex((r) => r.id === reminder.id);
    let updated: Reminder[];
    if (existingIndex >= 0) {
      updated = all.map((r) => (r.id === reminder.id ? reminder : r));
    } else {
      updated = [reminder, ...all];
    }
    await this.saveAll(updated);
  }

  public async removeReminder(id: string): Promise<void> {
    const all = await this.getAll();
    const filtered = all.filter((r) => r.id !== id);
    await this.saveAll(filtered);
  }

  public async clear(): Promise<void> {
    try {
      await Preferences.remove({ key: STORAGE_KEY });
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.error('[CapacitorPreferencesProvider] clear error:', e);
    }
  }
}

/**
 * Storage Provider Factory
 */
export function getReminderStorageProvider(): ReminderStorageProvider {
  // If running in Capacitor Native Mobile runtime (iOS / Android), prefer Preferences provider
  if (Capacitor.isNativePlatform()) {
    const capProvider = new CapacitorPreferencesStorageProvider();
    if (capProvider.isAvailable()) {
      return capProvider;
    }
  }

  // Otherwise, use LocalStorage provider
  return new LocalStorageReminderStorageProvider();
}
