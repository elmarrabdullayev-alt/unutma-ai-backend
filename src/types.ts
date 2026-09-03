export type UserGender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export interface UserProfile {
  firstName: string;
  lastName: string;
  gender: UserGender;
  birthDate: string; // ISO format e.g. YYYY-MM-DD
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

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

// Daily Planner Types
export interface PlanTask {
  id: string;
  title: string;
  dueDateTime: string; // ISO format
  timeString: string; // e.g. "09:30", "14:00"
  durationMinutes?: number;
  priority: ReminderPriority;
  category: ReminderCategory;
  isFixedTime: boolean;
  isFocusReady?: boolean;
  hasConflict?: boolean;
  conflictReason?: string;
  suggestedAlternativeTime?: string;
  suggestedAlternativeDueDateTime?: string;
}

export interface DailyPlanProposal {
  id: string;
  rawInput: string;
  createdAt: string;
  targetDate: string; // YYYY-MM-DD
  tasks: PlanTask[];
  summaryNote?: string;
}

// Routine Builder Types
export type RoutineType = 'morning' | 'afternoon' | 'evening' | 'custom';

export interface RoutineStep {
  id: string;
  title: string;
  time?: string; // e.g. "07:10"
  duration?: number; // duration in minutes
  notificationEnabled: boolean;
  completed?: boolean;
}

export interface Routine {
  id: string;
  type: RoutineType;
  title: string;
  icon?: string;
  daysOfWeek: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  startTime: string; // e.g. "07:00"
  steps: RoutineStep[];
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface RoutineProposal {
  id: string;
  type: RoutineType;
  title: string;
  icon?: string;
  daysOfWeek: number[];
  startTime: string;
  steps: Array<{
    title: string;
    time?: string;
    duration?: number;
    notificationEnabled: boolean;
  }>;
  rawPrompt?: string;
}

export interface RoutineStreakData {
  currentStreak: number;
  bestStreak: number;
  totalCompletions: number;
  lastCompletedDate?: string; // YYYY-MM-DD
}

export interface RoutineHistoryEntry {
  id: string;
  routineId: string;
  routineTitle: string;
  completedAt: string;
  date: string; // YYYY-MM-DD
  stepsCompleted: number;
  totalSteps: number;
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
  | 'plan_day'
  | 'create_routine'
  | 'clarification_needed'
  | 'general_chat';

export interface AIActionPayload {
  action: AIActionType;
  remindersToCreate?: ExtractedReminderDraft[];
  dailyPlanProposal?: DailyPlanProposal;
  routineProposal?: RoutineProposal;
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

// Focus Mode Types
export type FocusSessionStatus = 'running' | 'paused' | 'completed' | 'stopped';

export type FocusAudioPreset =
  | 'silent'
  | 'lofi'
  | 'rain'
  | 'cafe'
  | 'white-noise'
  | 'deep-focus'
  | 'nature';

export interface FocusAudioOption {
  id: FocusAudioPreset;
  name: string;
  subtitle?: string;
  iconName: string;
  fileName?: string;
}

export interface FocusAudioSettings {
  preset: FocusAudioPreset;
  volume: number; // 0 to 1
  autoPlay: boolean;
}

export interface FocusSession {
  id: string;
  taskTitle: string;
  linkedReminderId?: string;
  plannedMinutes: number;
  startedAt: string; // ISO string
  expectedEndAt: string; // ISO string
  pausedAt?: string | null; // ISO string or null
  totalPausedMs: number;
  status: FocusSessionStatus;
  audioPreset: string;
}

export interface FocusHistoryItem {
  id: string;
  taskTitle: string;
  linkedReminderId?: string;
  startedAt: string;
  endedAt: string;
  plannedMinutes: number;
  actualMinutes: number;
  completed: boolean;
  interrupted: boolean;
}

export interface FocusTodayStats {
  count: number;
  totalMinutes: number;
}

// Progress Dashboard Types
export type WeekDayShortAz = 'B.e' | 'Ç.a' | 'Ç.' | 'C.a' | 'C.' | 'Ş.' | 'B.';

export interface DayProgressItem {
  dayName: WeekDayShortAz;
  dayFull: string;
  dateStr: string; // YYYY-MM-DD
  isToday: boolean;
  isFuture: boolean;
  percent: number; // 0 - 100
  tasksCompleted: number;
  focusMinutes: number;
  routinesCompleted: number;
}

export interface RoutineStreakItem {
  routineId: string;
  title: string;
  type: RoutineType;
  icon?: string;
  currentStreak: number;
  bestStreak: number;
  thisWeekRate: number; // 0 - 100%
  completedDaysThisWeek: number;
  scheduledDaysThisWeek: number;
}

export interface ProgressDashboardData {
  streakSummary: {
    currentStreak: number;
    bestStreak: number;
  };
  todaySummary: {
    completedTasks: number;
    focusMinutes: number;
    completedRoutines: number;
  };
  weeklyProgress: {
    overallPercent: number | null; // null if no data exists
    days: DayProgressItem[];
  };
  weeklyMetrics: {
    completedTasks: number;
    tasksDiffPercent: number | null; // e.g. +12 or -5 or null if no comparison data
    focusMinutes: number;
    focusDiffPercent: number | null;
    completedRoutines: number;
    routinesDiffPercent: number | null;
  };
  routineStreaks: RoutineStreakItem[];
  focusStats: {
    todayMinutes: number;
    thisWeekMinutes: number;
    sessionCount: number;
    avgDurationMinutes: number;
  };
  taskStats: {
    todayCompleted: number;
    thisWeekCompleted: number;
    overdueCount: number;
  };
  personalBests: {
    longestFocusMinutes: number | null;
    bestRoutineStreak: number | null;
    maxTasksInOneDay: number | null;
  };
  hasAnyHistory: boolean;
  milestoneToCelebrate: number | null;
}
