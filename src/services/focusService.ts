import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { FocusSession, FocusHistoryItem, FocusTodayStats, FocusAudioPreset } from '../types';
import { playReminderAlarmSound } from '../utils/soundUtils';
import { focusAudioService } from './focusAudioService';

export const FOCUS_SESSION_STORAGE_KEY = 'unutma_ai_focus_session_v1';
export const FOCUS_HISTORY_STORAGE_KEY = 'unutma_ai_focus_history_v1';
const FOCUS_NOTIFICATION_ID = 88888; // Fixed integer notification ID for active focus session

type FocusChangeListener = (session: FocusSession | null, history: FocusHistoryItem[]) => void;

class FocusService {
  private activeSession: FocusSession | null = null;
  private history: FocusHistoryItem[] = [];
  private listeners: Set<FocusChangeListener> = new Set();
  private isInitialized = false;

  constructor() {
    this.init();
  }

  /**
   * Initialize and load persisted session & history
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      let sessionRaw: string | null = null;
      let historyRaw: string | null = null;

      if (Capacitor.isNativePlatform()) {
        try {
          const s = await Preferences.get({ key: FOCUS_SESSION_STORAGE_KEY });
          sessionRaw = s.value;
          const h = await Preferences.get({ key: FOCUS_HISTORY_STORAGE_KEY });
          historyRaw = h.value;
        } catch (nativeErr) {
          console.warn('[FocusService] Native storage read error:', nativeErr);
        }
      }

      if (!sessionRaw && typeof window !== 'undefined' && 'localStorage' in window) {
        sessionRaw = localStorage.getItem(FOCUS_SESSION_STORAGE_KEY);
      }
      if (!historyRaw && typeof window !== 'undefined' && 'localStorage' in window) {
        historyRaw = localStorage.getItem(FOCUS_HISTORY_STORAGE_KEY);
      }

      if (sessionRaw) {
        try {
          const parsed = JSON.parse(sessionRaw);
          if (parsed && parsed.id && parsed.startedAt && parsed.expectedEndAt) {
            this.activeSession = parsed;
          }
        } catch (e) {
          console.warn('[FocusService] Failed to parse active session JSON:', e);
        }
      }

      if (historyRaw) {
        try {
          const parsedHistory = JSON.parse(historyRaw);
          if (Array.isArray(parsedHistory)) {
            this.history = parsedHistory;
          }
        } catch (e) {
          console.warn('[FocusService] Failed to parse history JSON:', e);
        }
      }
    } catch (err) {
      console.warn('[FocusService] Init error:', err);
    } finally {
      this.isInitialized = true;
      this.notifyListeners();
    }
  }

  public getActiveSession(): FocusSession | null {
    return this.activeSession;
  }

  public getHistory(): FocusHistoryItem[] {
    return [...this.history];
  }

  public subscribe(listener: FocusChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.activeSession, this.history);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((fn) => fn(this.activeSession, this.history));
  }

  private async saveActiveSession(): Promise<void> {
    const raw = this.activeSession ? JSON.stringify(this.activeSession) : null;
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        if (raw) {
          localStorage.setItem(FOCUS_SESSION_STORAGE_KEY, raw);
        } else {
          localStorage.removeItem(FOCUS_SESSION_STORAGE_KEY);
        }
      }
      if (Capacitor.isNativePlatform()) {
        if (raw) {
          await Preferences.set({ key: FOCUS_SESSION_STORAGE_KEY, value: raw });
        } else {
          await Preferences.remove({ key: FOCUS_SESSION_STORAGE_KEY });
        }
      }
    } catch (e) {
      console.warn('[FocusService] saveActiveSession error:', e);
    }
  }

  private async saveHistory(): Promise<void> {
    const raw = JSON.stringify(this.history.slice(0, 100));
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        localStorage.setItem(FOCUS_HISTORY_STORAGE_KEY, raw);
      }
      if (Capacitor.isNativePlatform()) {
        await Preferences.set({ key: FOCUS_HISTORY_STORAGE_KEY, value: raw });
      }
    } catch (e) {
      console.warn('[FocusService] saveHistory error:', e);
    }
  }

  // Haptic feedback helper
  private async triggerHaptic(type: 'light' | 'success') {
    try {
      if (Capacitor.isPluginAvailable('Haptics')) {
        if (type === 'light') {
          await Haptics.impact({ style: ImpactStyle.Light });
        } else {
          await Haptics.notification({ type: NotificationType.Success });
        }
      }
    } catch {
      // Haptics unavailable on web or disabled
    }
  }

  // Schedule native background notification for completion
  private async scheduleFocusNotification(session: FocusSession): Promise<void> {
    try {
      if (Capacitor.isPluginAvailable('LocalNotifications')) {
        await this.cancelFocusNotification();
        const expectedDate = new Date(session.expectedEndAt);
        if (expectedDate.getTime() > Date.now()) {
          await LocalNotifications.schedule({
            notifications: [
              {
                id: FOCUS_NOTIFICATION_ID,
                title: '✨ Unutma AI: Fokus sessiyan tamamlandı',
                body: `"${session.taskTitle}" üzərində fokus tamamlandı!`,
                schedule: {
                  at: expectedDate,
                  allowWhileIdle: true,
                },
                channelId: 'unutma_reminders_channel',
                sound: 'reminder_alarm.wav',
              },
            ],
          });
        }
      }
    } catch (err) {
      console.warn('[FocusService] Schedule notification error:', err);
    }
  }

  // Cancel scheduled focus notification
  private async cancelFocusNotification(): Promise<void> {
    try {
      if (Capacitor.isPluginAvailable('LocalNotifications')) {
        await LocalNotifications.cancel({
          notifications: [{ id: FOCUS_NOTIFICATION_ID }],
        });
      }
    } catch {
      // ignore
    }
  }

  /**
   * Start a new focus session
   */
  public async startSession(params: {
    taskTitle: string;
    plannedMinutes: number;
    linkedReminderId?: string;
    audioPreset?: string;
  }): Promise<FocusSession> {
    const now = new Date();
    const plannedMinutes = Math.max(1, Math.min(params.plannedMinutes || 25, 300));
    const expectedEndAt = new Date(now.getTime() + plannedMinutes * 60 * 1000).toISOString();

    const session: FocusSession = {
      id: `focus_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      taskTitle: params.taskTitle.trim() || 'Fokus Tapşırığı',
      linkedReminderId: params.linkedReminderId,
      plannedMinutes,
      startedAt: now.toISOString(),
      expectedEndAt,
      pausedAt: null,
      totalPausedMs: 0,
      status: 'running',
      audioPreset: params.audioPreset || 'silent',
    };

    this.activeSession = session;
    await this.saveActiveSession();
    await this.scheduleFocusNotification(session);
    await this.triggerHaptic('light');

    // Handle audio startup if configured
    if (params.audioPreset && params.audioPreset !== 'silent') {
      await focusAudioService.setPreset(params.audioPreset as FocusAudioPreset, false);
      const settings = focusAudioService.getSettings();
      if (settings.autoPlay || params.audioPreset !== 'silent') {
        focusAudioService.play().catch(() => {});
      }
    } else {
      const settings = focusAudioService.getSettings();
      if (settings.preset !== 'silent' && settings.autoPlay) {
        focusAudioService.play().catch(() => {});
      }
    }

    this.notifyListeners();

    return session;
  }

  /**
   * Pause the active focus session
   */
  public async pauseSession(): Promise<FocusSession | null> {
    if (!this.activeSession || this.activeSession.status !== 'running') {
      return this.activeSession;
    }

    this.activeSession.status = 'paused';
    this.activeSession.pausedAt = new Date().toISOString();

    await this.saveActiveSession();
    await this.cancelFocusNotification();
    await this.triggerHaptic('light');

    // Pause audio
    focusAudioService.pause();

    this.notifyListeners();

    return this.activeSession;
  }

  /**
   * Resume paused focus session with exact timestamp adjustments
   */
  public async resumeSession(): Promise<FocusSession | null> {
    if (!this.activeSession || this.activeSession.status !== 'paused') {
      return this.activeSession;
    }

    const now = Date.now();
    const pausedTime = this.activeSession.pausedAt ? new Date(this.activeSession.pausedAt).getTime() : now;
    const pauseDuration = Math.max(0, now - pausedTime);

    // Shift expectedEndAt into the future by the pause duration
    const currentExpectedMs = new Date(this.activeSession.expectedEndAt).getTime();
    const newExpectedEndAt = new Date(currentExpectedMs + pauseDuration).toISOString();

    this.activeSession.totalPausedMs += pauseDuration;
    this.activeSession.expectedEndAt = newExpectedEndAt;
    this.activeSession.pausedAt = null;
    this.activeSession.status = 'running';

    await this.saveActiveSession();
    await this.scheduleFocusNotification(this.activeSession);
    await this.triggerHaptic('light');

    // Resume audio if active session had audio preset
    if (this.activeSession.audioPreset && this.activeSession.audioPreset !== 'silent') {
      focusAudioService.resume().catch(() => {});
    }

    this.notifyListeners();

    return this.activeSession;
  }

  /**
   * Switch audio preset during active session
   */
  public async setSessionAudioPreset(preset: FocusAudioPreset): Promise<void> {
    if (this.activeSession) {
      this.activeSession.audioPreset = preset;
      await this.saveActiveSession();
    }
    await focusAudioService.setPreset(preset, true);
    if (this.activeSession && this.activeSession.status === 'running' && preset !== 'silent') {
      await focusAudioService.play();
    }
    this.notifyListeners();
  }

  /**
   * Add 1 (or N) minutes to the active session
   */
  public async addMinutes(minutes = 1): Promise<FocusSession | null> {
    if (!this.activeSession) return null;

    const msToAdd = minutes * 60 * 1000;
    const currentExpectedMs = new Date(this.activeSession.expectedEndAt).getTime();
    const newExpectedEndAt = new Date(currentExpectedMs + msToAdd).toISOString();

    this.activeSession.expectedEndAt = newExpectedEndAt;
    this.activeSession.plannedMinutes += minutes;

    await this.saveActiveSession();
    if (this.activeSession.status === 'running') {
      await this.scheduleFocusNotification(this.activeSession);
    }
    await this.triggerHaptic('light');
    this.notifyListeners();

    return this.activeSession;
  }

  /**
   * Calculate remaining milliseconds accurately from timestamps
   */
  public getRemainingMs(session: FocusSession | null = this.activeSession): number {
    if (!session) return 0;

    if (session.status === 'paused' && session.pausedAt) {
      const pausedAtMs = new Date(session.pausedAt).getTime();
      const expectedEndMs = new Date(session.expectedEndAt).getTime();
      return Math.max(0, expectedEndMs - pausedAtMs);
    }

    const now = Date.now();
    const expectedEndMs = new Date(session.expectedEndAt).getTime();
    return Math.max(0, expectedEndMs - now);
  }

  /**
   * Calculate actual focused minutes completed
   */
  private calculateActualMinutes(session: FocusSession): number {
    const startMs = new Date(session.startedAt).getTime();
    const nowMs = Date.now();
    let totalMs = nowMs - startMs - (session.totalPausedMs || 0);

    if (session.status === 'paused' && session.pausedAt) {
      const currentPause = nowMs - new Date(session.pausedAt).getTime();
      totalMs -= Math.max(0, currentPause);
    }

    const mins = Math.round(Math.max(0, totalMs) / (60 * 1000));
    return mins;
  }

  /**
   * Complete the session normally upon timer finish
   */
  public async completeSession(): Promise<FocusHistoryItem | null> {
    if (!this.activeSession) return null;

    const session = this.activeSession;
    const actualMinutes = Math.max(1, session.plannedMinutes);

    const historyItem: FocusHistoryItem = {
      id: session.id,
      taskTitle: session.taskTitle,
      linkedReminderId: session.linkedReminderId,
      startedAt: session.startedAt,
      endedAt: new Date().toISOString(),
      plannedMinutes: session.plannedMinutes,
      actualMinutes,
      completed: true,
      interrupted: false,
    };

    this.history.unshift(historyItem);
    this.activeSession = null;

    // Stop focus audio
    focusAudioService.stop();

    await this.cancelFocusNotification();
    await this.saveActiveSession();
    await this.saveHistory();

    playReminderAlarmSound();
    await this.triggerHaptic('success');
    this.notifyListeners();

    return historyItem;
  }

  /**
   * Stop session early by user choice
   */
  public async stopSessionEarly(): Promise<FocusHistoryItem | null> {
    if (!this.activeSession) return null;

    const session = this.activeSession;
    const actualMinutes = Math.max(1, this.calculateActualMinutes(session));

    const historyItem: FocusHistoryItem = {
      id: session.id,
      taskTitle: session.taskTitle,
      linkedReminderId: session.linkedReminderId,
      startedAt: session.startedAt,
      endedAt: new Date().toISOString(),
      plannedMinutes: session.plannedMinutes,
      actualMinutes,
      completed: false,
      interrupted: true,
    };

    this.history.unshift(historyItem);
    this.activeSession = null;

    // Stop focus audio
    focusAudioService.stop();

    await this.cancelFocusNotification();
    await this.saveActiveSession();
    await this.saveHistory();
    this.notifyListeners();

    return historyItem;
  }

  /**
   * Discard/cancel active session without recording (or reset)
   */
  public async discardActiveSession(): Promise<void> {
    this.activeSession = null;
    focusAudioService.stop();
    await this.cancelFocusNotification();
    await this.saveActiveSession();
    this.notifyListeners();
  }

  /**
   * Get stats for today
   */
  public getTodayStats(): FocusTodayStats {
    const today = new Date();
    const todayY = today.getFullYear();
    const todayM = today.getMonth();
    const todayD = today.getDate();

    let count = 0;
    let totalMinutes = 0;

    this.history.forEach((item) => {
      const itemDate = new Date(item.startedAt);
      if (
        itemDate.getFullYear() === todayY &&
        itemDate.getMonth() === todayM &&
        itemDate.getDate() === todayD
      ) {
        count++;
        totalMinutes += item.actualMinutes || 0;
      }
    });

    return { count, totalMinutes };
  }
}

export const focusService = new FocusService();
