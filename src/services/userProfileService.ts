import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { UserProfile, UserGender } from '../types';

export const USER_PROFILE_STORAGE_KEY = 'unutma_ai_user_profile_v1';

class UserProfileService {
  private profile: UserProfile | null = null;
  private isInitialized = false;
  private listeners: Set<(profile: UserProfile | null) => void> = new Set();

  /**
   * Initializes profile from Capacitor Preferences or LocalStorage.
   * Runs local-only without network requests.
   */
  public async initialize(): Promise<UserProfile | null> {
    if (this.isInitialized && this.profile) {
      return this.profile;
    }

    try {
      let rawData: string | null = null;

      if (Capacitor.isNativePlatform()) {
        try {
          const { value } = await Preferences.get({ key: USER_PROFILE_STORAGE_KEY });
          rawData = value;
        } catch (nativeErr) {
          console.warn('[UserProfileService] Capacitor Preferences get error:', nativeErr);
        }
      }

      // Web / fallback read
      if (!rawData && typeof window !== 'undefined' && 'localStorage' in window) {
        rawData = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
      }

      if (rawData) {
        const parsed = JSON.parse(rawData);
        if (parsed && typeof parsed === 'object' && parsed.firstName) {
          this.profile = {
            firstName: parsed.firstName || '',
            lastName: parsed.lastName || '',
            gender: (parsed.gender as UserGender) || 'prefer_not_to_say',
            birthDate: parsed.birthDate || '',
            onboardingCompleted: Boolean(parsed.onboardingCompleted),
            createdAt: parsed.createdAt || new Date().toISOString(),
            updatedAt: parsed.updatedAt || new Date().toISOString(),
          };
        }
      }
    } catch (err) {
      console.warn('[UserProfileService] initialization parse error:', err);
    } finally {
      this.isInitialized = true;
      this.notifyListeners();
    }

    return this.profile;
  }

  public async init(): Promise<UserProfile | null> {
    return this.initialize();
  }

  /**
   * Synchronously returns cached profile.
   */
  public getProfile(): UserProfile | null {
    // If not initialized yet, try quick localStorage sync read for web
    if (!this.profile && typeof window !== 'undefined' && 'localStorage' in window) {
      try {
        const raw = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.firstName) {
            this.profile = parsed;
          }
        }
      } catch (e) {
        // ignore
      }
    }
    return this.profile;
  }

  /**
   * Checks whether onboarding has been completed.
   */
  public hasCompletedOnboarding(): boolean {
    const p = this.getProfile();
    return Boolean(p && p.onboardingCompleted);
  }

  /**
   * Saves or updates the complete user profile.
   */
  public async saveProfile(profile: UserProfile): Promise<void> {
    this.profile = {
      ...profile,
      updatedAt: new Date().toISOString(),
    };

    const jsonStr = JSON.stringify(this.profile);

    // Save to LocalStorage immediately
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      try {
        localStorage.setItem(USER_PROFILE_STORAGE_KEY, jsonStr);
      } catch (lsErr) {
        console.warn('[UserProfileService] LocalStorage save error:', lsErr);
      }
    }

    // Save to Capacitor Preferences if native
    if (Capacitor.isNativePlatform()) {
      try {
        await Preferences.set({
          key: USER_PROFILE_STORAGE_KEY,
          value: jsonStr,
        });
      } catch (prefErr) {
        console.warn('[UserProfileService] Capacitor Preferences set error:', prefErr);
      }
    }

    this.notifyListeners();
  }

  /**
   * Completes the onboarding flow and stores the user profile.
   */
  public async completeOnboarding(data: {
    firstName: string;
    lastName: string;
    gender: UserGender;
    birthDate: string;
  }): Promise<UserProfile> {
    const now = new Date().toISOString();
    const newProfile: UserProfile = {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      gender: data.gender,
      birthDate: data.birthDate,
      onboardingCompleted: true,
      createdAt: this.profile?.createdAt || now,
      updatedAt: now,
    };

    await this.saveProfile(newProfile);
    return newProfile;
  }

  /**
   * Resets onboarding completion state (allows user to replay onboarding if chosen).
   */
  public async resetOnboarding(): Promise<void> {
    if (this.profile) {
      await this.saveProfile({
        ...this.profile,
        onboardingCompleted: false,
      });
    }
  }

  /**
   * Derives uppercase initials from user's first and last name.
   */
  public getInitials(profileOverride?: UserProfile | null): string {
    const p = profileOverride || this.profile;
    if (!p) return 'U';
    const first = (p.firstName || '').trim().charAt(0).toUpperCase();
    const last = (p.lastName || '').trim().charAt(0).toUpperCase();
    if (first && last) return `${first}${last}`;
    if (first) return first;
    return 'U';
  }

  /**
   * Subscribes to profile changes.
   */
  public subscribe(listener: (profile: UserProfile | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.profile);
      } catch (err) {
        console.error('[UserProfileService] listener notification error:', err);
      }
    }
  }
}

export const userProfileService = new UserProfileService();
