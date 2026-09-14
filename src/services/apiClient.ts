import { Capacitor } from '@capacitor/core';
import { Reminder, AIActionPayload } from '../types';

export interface ParseReminderResponse {
  success: boolean;
  summary: string;
  reminders: Array<{
    title: string;
    description: string;
    dueDateTime: string;
    category: string;
    recurrence: string;
    priority: string;
    inferredTime?: boolean;
    timeConfidence?: 'exact' | 'inferred' | 'ambiguous';
  }>;
  error?: string;
}

export interface AIActionResponse {
  success: boolean;
  actionPayload: AIActionPayload;
  error?: string;
}

export interface TranscribeAudioResponse {
  success: boolean;
  transcription: string;
  error?: string;
}

export interface AskAssistantResponse {
  answer: string;
  actionPayload?: AIActionPayload;
  error?: string;
}

export const NATIVE_API_FALLBACK = 'https://unutma-ai-backend.onrender.com';

export class ApiClient {
  private customBaseUrl: string = '';

  constructor() {
    const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '';
    this.customBaseUrl = envUrl.trim().replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      return this.customBaseUrl || NATIVE_API_FALLBACK;
    }

    // Web runtime preserves relative /api behavior unless VITE_API_BASE_URL is explicitly configured
    return this.customBaseUrl || '';
  }

  public setBaseUrl(url: string) {
    this.customBaseUrl = url.trim().replace(/\/+$/, '');
  }

  public isConfiguredForNative(): boolean {
    return true;
  }

  public buildUrl(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const base = this.getBaseUrl();
    if (!base) {
      return normalizedPath;
    }
    return `${base}${normalizedPath}`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs: number = 25000
  ): Promise<T> {
    const isNative = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform();
    const envBaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '';
    const resolvedBaseUrl = this.getBaseUrl();
    const url = this.buildUrl(endpoint);

    console.log(`[ApiClient] runtime=${isNative ? 'native' : 'web'}`);
    console.log(`[ApiClient] platform=${platform}`);
    console.log(`[ApiClient] envBaseUrl=${envBaseUrl || '(none)'}`);
    console.log(`[ApiClient] resolvedBaseUrl=${resolvedBaseUrl || '(relative /api)'}`);
    console.log(`[ApiClient] full request URL=${url}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(options.headers || {}),
        },
      });

      clearTimeout(timer);
      console.log(`[ApiClient] status=${response.status}`);

      if (!response.ok) {
        let errMessage = `HTTP Xətası ${response.status}`;
        try {
          const errData = await response.json();
          if (errData) {
            if (typeof errData.message === 'string' && errData.message.trim()) {
              errMessage = errData.message;
            } else if (errData.error && typeof errData.error === 'object' && typeof errData.error.message === 'string' && errData.error.message.trim()) {
              errMessage = errData.error.message;
            } else if (typeof errData.error === 'string' && errData.error.trim()) {
              errMessage = errData.error;
            }
          }
        } catch (e) {}
        throw new Error(errMessage);
      }

      return (await response.json()) as T;
    } catch (err: any) {
      clearTimeout(timer);
      console.warn(`[ApiClient] request failed:`, err);
      if (err.name === 'AbortError') {
        throw new Error('AI xidmətinə qoşulma vaxtı bitdi. İnternet bağlantınızı yoxlayın.');
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('İnternet bağlantısı yoxdur. Zəhmət olmasa şəbəkəni yoxlayın.');
      }
      if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
        throw new Error('AI xidmətinə qoşulmaq mümkün olmadı. İnternet bağlantınızı yoxlayın.');
      }
      throw new Error(err.message || 'AI xidmətinə qoşulmaq mümkün olmadı. İnternet bağlantınızı yoxlayın.');
    }
  }

  public async parseReminder(
    text: string,
    userNowISO: string = new Date().toISOString(),
    userTimezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
  ): Promise<ParseReminderResponse> {
    return this.request<ParseReminderResponse>('/api/parse-reminder', {
      method: 'POST',
      body: JSON.stringify({ text, userNowISO, userTimezone }),
    });
  }

  public async executeAiAction(
    userPrompt: string,
    reminders: Reminder[],
    userNowISO: string = new Date().toISOString(),
    userTimezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
  ): Promise<AIActionResponse> {
    return this.request<AIActionResponse>('/api/ai-action', {
      method: 'POST',
      body: JSON.stringify({ userPrompt, reminders, userNowISO, userTimezone }),
    }, 90000);
  }

  public async transcribeAudio(
    base64Audio: string,
    mimeType: string = 'audio/webm'
  ): Promise<TranscribeAudioResponse> {
    const timeoutMs = 120000;
    console.log(`[TRANSCRIBE CLIENT] timeoutMs=${timeoutMs}`);
    try {
      return await this.request<TranscribeAudioResponse>(
        '/api/transcribe-audio',
        {
          method: 'POST',
          body: JSON.stringify({ base64Audio, mimeType }),
        },
        timeoutMs
      );
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('vaxtı bitdi')) {
        throw new Error(
          'Səs qeydə alındı, lakin transkripsiya xidməti cavab vermədi. Bir az sonra yenidən cəhd edin.'
        );
      }
      throw err;
    }
  }

  public async askAssistant(
    question: string,
    reminders: Reminder[],
    userNowISO: string = new Date().toISOString(),
    userTimezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
  ): Promise<AskAssistantResponse> {
    return this.request<AskAssistantResponse>('/api/ask-assistant', {
      method: 'POST',
      body: JSON.stringify({ question, reminders, userNowISO, userTimezone }),
    });
  }

  public async checkHealth(): Promise<{ status: string; service?: string }> {
    return this.request<{ status: string; service?: string }>('/api/health', {
      method: 'GET',
    }, 8000);
  }
}

export const apiClient = new ApiClient();

