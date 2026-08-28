export type ReminderCategory =
  | 'health'
  | 'work'
  | 'finance'
  | 'personal'
  | 'shopping'
  | 'education'
  | 'home'
  | 'other';

export type ReminderRecurrence =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'weekdays'
  | 'custom';

export type ReminderPriority = 'high' | 'medium' | 'low';

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  dueDateTime: string; // ISO 8601 string e.g. 2026-08-29T10:00:00.000Z
  category: ReminderCategory;
  recurrence: ReminderRecurrence;
  recurrenceDays?: number[]; // [1, 2, 3, 4, 5] for Mon-Fri
  priority: ReminderPriority;
  isCompleted: boolean;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  notificationEnabled: boolean;
  sourceVoiceText?: string;
  inferredTime?: boolean; // True if the time was reasonably inferred rather than explicitly stated
  notified?: boolean;
}

export type TabFilter = 'today' | 'tomorrow' | 'upcoming' | 'recurring' | 'completed' | 'assistant';

export interface ExtractedReminderDraft {
  id: string;
  title: string;
  description?: string;
  dueDateTime: string;
  category: ReminderCategory;
  recurrence: ReminderRecurrence;
  priority: ReminderPriority;
  notificationEnabled?: boolean;
  inferredTime?: boolean;
  timeConfidence?: 'exact' | 'inferred' | 'ambiguous';
}

export interface ParsedReminderResult {
  summary: string;
  reminders: ExtractedReminderDraft[];
  needsClarification?: boolean;
  clarificationPrompt?: string;
}

// AI Structured Action Layer
export type AIActionType =
  | 'create_reminder'
  | 'create_multiple_reminders'
  | 'update_reminder'
  | 'delete_reminder'
  | 'complete_reminder'
  | 'search_reminders'
  | 'get_daily_schedule'
  | 'get_weekly_schedule'
  | 'clarification_needed'
  | 'general_chat';

export interface AIActionPayload {
  action: AIActionType;
  remindersToCreate?: ExtractedReminderDraft[];
  targetReminderId?: string;
  targetQuery?: string;
  updateFields?: Partial<Reminder>;
  delayMinutes?: number;
  dateTarget?: string; // e.g. "today", "tomorrow", or ISO
  responseSpeech?: string;
  responseMessage: string;
  needsConfirmation?: boolean;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actionPayload?: AIActionPayload;
  executed?: boolean;
}

export interface CategoryMeta {
  id: ReminderCategory;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}
