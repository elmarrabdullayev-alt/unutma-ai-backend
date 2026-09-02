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

export class ApiClient {
  private customBaseUrl: string = '';

  constructor() {
    const envUrl = import.meta.env.VITE_API_BASE_URL || '';
    this.customBaseUrl = envUrl.trim().replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    if (this.customBaseUrl) {
      return this.customBaseUrl;
    }
    // If inside Capacitor Native WebView without explicit VITE_API_BASE_URL:
    // Notice: WebView runs on capacitor://localhost or https://localhost
    // In dev / preview it falls back to current window origin if available
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      if (Capacitor.isNativePlatform() && window.location.origin.includes('localhost')) {
        // Return empty string or prompt caution
        return '';
      }
      return window.location.origin;
    }
    return '';
  }

  public setBaseUrl(url: string) {
    this.customBaseUrl = url.trim().replace(/\/+$/, '');
  }

  public isConfiguredForNative(): boolean {
    if (!Capacitor.isNativePlatform()) return true;
    return !!this.customBaseUrl;
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
    const baseUrl = this.getBaseUrl();

    console.log(`[ApiClient] runtime=${isNative ? 'native' : 'web'}`);
    console.log(`[ApiClient] baseUrl=${baseUrl || '(none)'}`);
    console.log(`[ApiClient] request=${endpoint}`);

    if (isNative && !baseUrl) {
      throw new Error('AI server bağlantısı konfiqurasiya edilməyib.');
    }

    const url = this.buildUrl(endpoint);
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
          if (errData && errData.error) errMessage = errData.error;
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

