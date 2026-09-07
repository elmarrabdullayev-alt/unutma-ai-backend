import {
  Reminder,
  ExtractedReminderDraft,
  AIActionPayload,
  AIActionType,
  ReminderCategory,
  ReminderRecurrence,
  DailyPlanProposal,
  RoutineProposal,
} from '../types';
import { reminderService } from './reminderService';
import { apiClient } from './apiClient';
import { formatDateAz, formatTimeOnly } from '../utils/dateUtils';
import { dailyPlannerService } from './dailyPlannerService';
import { routineService } from './routineService';

export interface RouteOptions {
  executeDirectly?: boolean;
  userNowISO?: string;
  userTimezone?: string;
}

export interface RouterResult {
  source: 'local_fast_path' | 'gemini_path' | 'fallback_deterministic';
  intent: AIActionType;
  confidence: number;
  confidenceTier: 'high' | 'medium' | 'low';
  requiresGemini: boolean;
  actionPayload: AIActionPayload;
  executionTimeMs: number;
  reason: string;
  affectedReminders?: Reminder[];
  executionResult?: { success: boolean; message: string; affectedReminders?: Reminder[] };
}

export interface LocalEvaluationResult {
  handledLocally: boolean;
  action: AIActionType;
  payload: AIActionPayload;
  confidence: number;
  reason: string;
}

export interface ParsedDeterministicItem {
  title: string;
  description?: string;
  dueDateTime: string;
  category: ReminderCategory;
  recurrence: ReminderRecurrence;
  priority: 'high' | 'medium' | 'low';
  inferredTime: boolean;
  timeConfidence: 'exact' | 'inferred' | 'ambiguous';
}

const AZ_WEEKDAYS: Record<string, number> = {
  'bazar ertəsi': 1,
  'bazar ertesi': 1,
  'çərşənbə axşamı': 2,
  'cersenbe axsami': 2,
  'çərşənbə': 3,
  'cersenbe': 3,
  'cümə axşamı': 4,
  'cume axsami': 4,
  'cümə': 5,
  'cume': 5,
  'şənbə': 6,
  'senbe': 6,
  'bazar': 0,
};

/**
 * Normalizes Azerbaijani text for consistent keyword matching.
 */
export function normalizeAz(text: string): string {
  if (!text) return '';
  return text
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLowerCase()
    .replace(/[.,!?;:'"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mandatory Rule: CREATE intent must require an explicit creation semantic.
 * Temporal words alone (sabah, bu gün, axşam, həftə) must NEVER imply create_reminder.
 */
export const EXPLICIT_CREATE_REGEX =
  /\b(xatırlat|xatirlat|xatırlatsın|xatirlatsin|xatırlatmaq|xatirlatmaq|əlavə et|elave et|əlavə elə|elave ele|yarat|yaratsın|yaratmaq|qeyd et|qeyd elə|qeyd apar|planlaşdır|planlasdir|yadıma sal|yadima sal|yadına sal|yadina sal|yada sal|unutma)\b/i;

/**
 * Mandatory Rule: Query/view phrases MUST NEVER create reminders.
 * "göstər" must always be treated as retrieval/query intent.
 */
export const RETRIEVAL_QUERY_REGEX =
  /\b(göstər|goster|göstərin|gosterin|göstərərsən|gosterersen|nə var|ne var|nəyim var|neyim var|nə işim var|ne isim var|nə planım var|ne planim var|nə edəcəm|ne edecem|nə etməliyəm|ne etmeliyem|nələr var|neler var|nə vaxtdır|ne vaxtdir|hansı vaxtdır|hansi vaxtdir|planım|planim|planımı|planimi|planlarım|planlarim|planlarımı|planlarimi|xatırlatmam|xatirlatmam|xatırlatmamı|xatirlatmami|xatırlatmalarım|xatirlatmalarim|xatırlatmalarımı|xatirlatmalarimi|xatırlatmaları|xatirlatmalari|görüşlərim|goruslerim|görüşlərimi|goruslerimi|görüşləri|gorusleri|işlərim|islerim|işlərimi|islerimi|tapşırıqlarım|tapsiriqlarim|tapşırıqlarımı|tapsiriqlarimi|cədvəl|cedvel|cədvəli|cedveli|cədvəlim|cedvelim|cədvəlimi|cedvelimi|siyahı|siyahi|siyahısı|siyahisi|siyahımı|siyahimi|tap|axtar|oxu|baxaq|bax)\b/i;

export function hasExplicitCreateVerb(text: string): boolean {
  const norm = normalizeAz(text);
  return EXPLICIT_CREATE_REGEX.test(norm);
}

export function isRetrievalQuery(text: string): boolean {
  const norm = normalizeAz(text);
  if (hasExplicitCreateVerb(norm)) {
    return false;
  }
  return RETRIEVAL_QUERY_REGEX.test(norm);
}

export function isRetrievalQueryTitle(title: string): boolean {
  if (!title) return true;
  const norm = normalizeAz(title);
  if (norm.length < 2) return true;
  if (RETRIEVAL_QUERY_REGEX.test(norm) && !EXPLICIT_CREATE_REGEX.test(norm)) {
    return true;
  }
  return false;
}

export class IntelligentRouter {
  public isRetrievalQuery = isRetrievalQuery;
  public hasExplicitCreateVerb = hasExplicitCreateVerb;
  public isRetrievalQueryTitle = isRetrievalQueryTitle;

  private logIntentTrace(trace: {
    input: string;
    localClassification: string;
    backendClassification?: string;
    finalAction: string;
    reason: string;
  }): void {
    console.log(`[INTENT-TRACE] input: ${trace.input}`);
    console.log(`[INTENT-TRACE] local classification: ${trace.localClassification}`);
    console.log(`[INTENT-TRACE] backend classification: ${trace.backendClassification || 'none'}`);
    console.log(`[INTENT-TRACE] final action: ${trace.finalAction}`);
    console.log(`[INTENT-TRACE] reason: ${trace.reason}`);
  }

  /**
   * Main entry point: Route prompt through Local Fast Path first, or Gemini if complex.
   */
  public async route(
    prompt: string,
    reminders?: Reminder[],
    options: RouteOptions = { executeDirectly: true }
  ): Promise<RouterResult> {
    const startTime = performance.now();
    const cleanPrompt = prompt.trim();
    const currentReminders = reminders || reminderService.getAll();

    console.log(`[ROUTER] Request received: "${cleanPrompt}"`);

    // 0. Safety check: If input is a retrieval query without explicit create verb, evaluate locally directly
    if (this.isRetrievalQuery(cleanPrompt) && !this.hasExplicitCreateVerb(cleanPrompt)) {
      const queryEval = this.handleRetrievalQuery(cleanPrompt, currentReminders);
      this.logIntentTrace({
        input: cleanPrompt,
        localClassification: queryEval.payload.action,
        backendClassification: 'none (handled by local retrieval guard)',
        finalAction: queryEval.payload.action,
        reason: queryEval.reason,
      });

      const execTime = Math.round(performance.now() - startTime);
      return {
        source: 'local_fast_path',
        intent: queryEval.payload.action,
        confidence: queryEval.confidence,
        confidenceTier: 'high',
        requiresGemini: false,
        actionPayload: queryEval.payload,
        executionTimeMs: execTime,
        reason: queryEval.reason,
      };
    }

    // 1. Check for Complex Reasoning / Planning triggers that MUST go to Gemini
    const complexReasoningReason = this.detectComplexReasoningTriggers(cleanPrompt);
    if (complexReasoningReason) {
      console.log(`[CLIENT ROUTER] backend required: ${complexReasoningReason}`);
      console.log(`[ROUTER] intent: complex_planning_reasoning`);
      console.log(`[ROUTER] deterministic confidence: 0.35 (low)`);

      return this.executeGeminiPath(cleanPrompt, currentReminders, startTime, complexReasoningReason, options.executeDirectly);
    }

    // 2. Deterministic Intent Evaluation (LOCAL FAST PATH)
    const localEval = this.evaluateLocalFastPath(cleanPrompt, currentReminders);

    console.log(`[ROUTER] intent: ${localEval.payload.action}`);
    console.log(`[ROUTER] deterministic confidence: ${localEval.confidence.toFixed(2)} (${localEval.confidence >= 0.85 ? 'high' : 'low'})`);

    if (localEval.handledLocally && localEval.confidence >= 0.85) {
      console.log(`[CLIENT ROUTER] local: ${localEval.reason}`);
      let affectedReminders: Reminder[] | undefined;
      let executionResult: { success: boolean; message: string; affectedReminders?: Reminder[] } | undefined;

      if (
        options.executeDirectly &&
        localEval.payload.action !== 'general_chat' &&
        localEval.payload.action !== 'plan_day' &&
        localEval.payload.action !== 'create_routine'
      ) {
        const execution = reminderService.executeAIAction(localEval.payload);
        executionResult = execution;
        if (execution.affectedReminders) {
          affectedReminders = execution.affectedReminders;
        }
        if (execution.message && !localEval.payload.responseMessage) {
          localEval.payload.responseMessage = execution.message;
        }
      }

      const execTime = Math.round(performance.now() - startTime);
      console.log(`[CLIENT ROUTER] execution time ms: ${execTime}ms`);

      this.logIntentTrace({
        input: cleanPrompt,
        localClassification: localEval.payload.action,
        backendClassification: 'none (handled locally)',
        finalAction: localEval.payload.action,
        reason: localEval.reason,
      });

      return {
        source: 'local_fast_path',
        intent: localEval.payload.action,
        confidence: localEval.confidence,
        confidenceTier: 'high',
        requiresGemini: false,
        actionPayload: localEval.payload,
        executionTimeMs: execTime,
        reason: localEval.reason,
        affectedReminders,
        executionResult,
      };
    }

    // 3. Fallback to Gemini Path when confidence is moderate/low or ambiguous
    const fallbackReason = `Deterministic confidence below threshold (${localEval.confidence.toFixed(2)}) or ambiguous natural language`;
    console.log(`[CLIENT ROUTER] backend required: ${fallbackReason}`);
    return this.executeGeminiPath(cleanPrompt, currentReminders, startTime, fallbackReason, options.executeDirectly);
  }

  /**
   * Evaluates if a request can be handled locally with high confidence.
   */
  public evaluateLocalFastPath(
    prompt: string,
    currentReminders: Reminder[]
  ): LocalEvaluationResult {
    const clean = prompt.trim();
    const lower = clean.toLowerCase();

    // 0. MANDATORY SAFETY GUARD: Query/view phrases MUST NEVER create reminders.
    // "göstər" must always be treated as retrieval/query intent.
    if (this.isRetrievalQuery(clean) && !this.hasExplicitCreateVerb(clean)) {
      const res = this.handleRetrievalQuery(clean, currentReminders);
      return res;
    }

    // A. SCHEDULE INQUIRIES: Daily Schedule
    if (
      /^(bu gün|bugün|sabah|birigün|biri gün|dünən|cümə|şənbə|bazar|çərşənbə)/i.test(lower) &&
      /(nə planım var|nə etməliyəm|nəyim var|nə var|planlarım|planım|cədvəli|cədvəl|işlərim var|tapşırıqlar)/i.test(lower)
    ) {
      const res = this.handleDailyScheduleInquiry(lower, currentReminders);
      return { handledLocally: true, action: res.payload.action, ...res };
    }
    if (/(bugünkü planlarım|bugünkü planımı|sabahkı planlarım|sabahkı planımı|birigünkü planlarım)/i.test(lower)) {
      const res = this.handleDailyScheduleInquiry(lower, currentReminders);
      return { handledLocally: true, action: res.payload.action, ...res };
    }

    // B. SCHEDULE INQUIRIES: Weekly Schedule
    if (
      /(bu həftə|həftəlik|həftə)/i.test(lower) &&
      /(hansı günüm daha boşdur|ən boş gün|ən rahat gün|cədvəlimi göstər|planlarım|planımı|cədvəl|işlərim var)/i.test(lower)
    ) {
      const res = this.handleWeeklyScheduleInquiry(currentReminders);
      return { handledLocally: true, action: res.payload.action, ...res };
    }

    // C. SEARCH INQUIRIES
    if (
      /(ilə bağlı nə xatırlatmam var|haqqında nə planım var|xatırlatmalarını göstər|planlarını göstər|xatırlatmalarımı göstər|görüşlərimi göstər|haqqında nə var|haqqında xatırlatmalar)/i.test(lower) ||
      /^axtar\s+/i.test(lower)
    ) {
      const res = this.handleSearchInquiry(lower, currentReminders);
      return { handledLocally: true, action: res.payload.action, ...res };
    }

    // D. COMPLETION COMMANDS
    if (
      /(tamamla|tamamlandı|bitmiş kimi qeyd et|bitirdim|yerinə yetirildi|başa çatdı)/i.test(lower) &&
      !/(necə|nə vaxt|əlavə et)/i.test(lower)
    ) {
      const res = this.handleCompleteCommand(lower, currentReminders);
      return { handledLocally: true, action: res.payload.action, ...res };
    }

    // E. DELETION COMMANDS
    if (
      /(sil|ləğv et|yox et|təmizlə)/i.test(lower) &&
      /(xatırlatmanı|görüşümü|planı|tapşırığı|iclası|işi)/i.test(lower)
    ) {
      const res = this.handleDeleteCommand(lower, currentReminders);
      return { handledLocally: true, action: res.payload.action, ...res };
    }

    // F. SNOOZE / UPDATE COMMANDS
    if (
      /(gecikdir|təxirə sal|sonraya saxla|uzat)/i.test(lower) &&
      /(\d+|bir|iki|yarım)\s*(dəqiqə|saat|gün)/i.test(lower)
    ) {
      const res = this.handleSnoozeCommand(lower, currentReminders);
      return { handledLocally: true, action: res.payload.action, ...res };
    }

    // G. DAILY PLANNER (e.g. "Bu gün saat 2-də görüşüm var, hesabatı bitirməliyəm...", "Günümü planla")
    if (dailyPlannerService.isDailyPlanningIntent(prompt)) {
      const localProposal = dailyPlannerService.parseLocally(prompt, currentReminders);
      if (localProposal && localProposal.tasks.length >= 2) {
        const resolved = dailyPlannerService.detectAndResolveConflicts(localProposal, currentReminders);
        return {
          handledLocally: true,
          action: 'plan_day',
          payload: {
            action: 'plan_day',
            dailyPlanProposal: resolved,
            responseMessage: 'Bugünkü planın hazırlandı. Zəhmət olmasa təsdiq edin.',
            needsConfirmation: true,
          },
          confidence: 0.94,
          reason: 'Daily plan parsed and structured locally without premature creation.',
        };
      }
    }

    // H. ROUTINE BUILDER / RECURRING ROUTINES (e.g. "Hər səhər 7-də oyanım, 10 dəqiqə idman edim və 8-də evdən çıxım", "Səhər rutini")
    if (routineService.isRoutineIntent(prompt)) {
      const routineProposal = routineService.parseRoutinePrompt(prompt);
      if (routineProposal && routineProposal.steps.length >= 2) {
        return {
          handledLocally: true,
          action: 'create_routine',
          payload: {
            action: 'create_routine',
            routineProposal,
            responseMessage: `"${routineProposal.title}" üçün cədvəl tərtib edildi. Zəhmət olmasa təsdiq edin.`,
            responseSpeech: `${routineProposal.title} hazırlandı. Cədvəli nəzərdən keçirin.`,
            needsConfirmation: true,
          },
          confidence: 0.95,
          reason: 'Routine parsed and structured locally without premature creation.',
        };
      }
    }

    // I. REMINDER CREATION & RECURRENCE (e.g. "Sabah saat 10-da Anara zəng etməyi xatırlat", "Hər 3 gündən bir...")
    // MANDATORY RULE: CREATE intent must require an explicit creation semantic (xatırlat, əlavə et, yarat, qeyd et, planlaşdır, yadına sal).
    // Temporal words alone (sabah, bu gün, axşam, həftə) must NEVER imply create_reminder.
    if (this.hasExplicitCreateVerb(clean) && !this.isRetrievalQuery(clean)) {
      const parsedReminders = this.parseDeterministicReminders(prompt);
      if (parsedReminders.length > 0) {
        const isMulti = parsedReminders.length > 1;
        const summaries = parsedReminders.map(
          (r) => `${formatDateAz(r.dueDateTime)}: "${r.title}"`
        );

        const responseMessage = isMulti
          ? `${parsedReminders.length} xatırlatma yaradıldı:\n${summaries.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
          : `Xatırlatma yaradıldı: "${parsedReminders[0].title}" (${formatDateAz(parsedReminders[0].dueDateTime)}).`;

        const draftReminders: ExtractedReminderDraft[] = parsedReminders.map((r, idx) => ({
          id: `local-${Date.now()}-${idx}`,
          title: r.title,
          description: r.description || '',
          dueDateTime: r.dueDateTime,
          category: r.category,
          recurrence: r.recurrence,
          priority: r.priority,
          inferredTime: r.inferredTime,
          timeConfidence: r.timeConfidence,
          notificationEnabled: true,
        }));

        const action: AIActionType = isMulti ? 'create_multiple_reminders' : 'create_reminder';
        return {
          handledLocally: true,
          action,
          payload: {
            action,
            remindersToCreate: draftReminders,
            responseMessage,
          },
          confidence: isMulti ? 0.88 : 0.93,
          reason: isMulti
            ? `Parsed ${parsedReminders.length} discrete reminders deterministically.`
            : `Parsed single reminder with due date and category deterministically.`,
        };
      }
    }

    // Default fallback if no deterministic pattern matched
    return {
      handledLocally: false,
      action: 'general_chat',
      payload: {
        action: 'general_chat',
        responseMessage: 'Sorğunuz qəbul edildi.',
      },
      confidence: 0.2,
      reason: 'No deterministic rule matched.',
    };
  }

  /**
   * Deterministic extraction for single or multiple reminders, dates, and recurrence patterns.
   */
  public parseDeterministicReminders(text: string): ParsedDeterministicItem[] {
    const clean = text.trim();
    if (!clean) return [];

    // MANDATORY SAFETY GUARD: If input is a retrieval query without explicit create verb, NEVER parse reminders!
    if (this.isRetrievalQuery(clean) && !this.hasExplicitCreateVerb(clean)) {
      return [];
    }
    // MANDATORY RULE: CREATE intent must require an explicit creation semantic
    if (!this.hasExplicitCreateVerb(clean)) {
      return [];
    }

    // Check if multi-reminder compound: split by " və ", " sonra ", ",", " ardınca "
    const segments = this.splitMultiReminderSegments(clean);
    const results: ParsedDeterministicItem[] = [];

    for (const segment of segments) {
      const item = this.parseSingleReminderSegment(segment);
      if (item) {
        results.push(item);
      }
    }

    return results;
  }

  private splitMultiReminderSegments(text: string): string[] {
    // If text has " və saat ", " və axşam ", " və sabah ", or numbered lists
    if (/\s+və\s+(saat|sabah|günorta|axşam|bu gün|hər)/i.test(text)) {
      return text.split(/\s+və\s+/i).map((s) => s.trim()).filter(Boolean);
    }
    return [text];
  }

  private parseSingleReminderSegment(segment: string): ParsedDeterministicItem | null {
    const lower = segment.toLowerCase();
    const now = new Date();

    // MANDATORY RULE: CREATE intent must require an explicit creation semantic
    // Temporal words alone (sabah, bu gün, axşam, həftə) must NEVER imply create_reminder.
    if (!this.hasExplicitCreateVerb(segment)) {
      return null;
    }

    // 1. Recurrence Detection
    let recurrence: ReminderRecurrence = 'none';
    if (/hər\s+(\d+)\s+gündən\s+bir/i.test(lower)) {
      recurrence = 'custom';
    } else if (/hər\s+gün|hər\s+səhər|hər\s+axşam|günbəgün/i.test(lower)) {
      recurrence = 'daily';
    } else if (/hər\s+həftə|həftəlik|hər\s+bazar|hər\s+çərşənbə|hər\s+cümə/i.test(lower)) {
      recurrence = 'weekly';
    } else if (/hər\s+ay|aylıq|hər\s+ayın/i.test(lower)) {
      recurrence = 'monthly';
    } else if (/hər\s+il|illik/i.test(lower)) {
      recurrence = 'yearly';
    } else if (/həftəiçi|hər\s+iş\s+günü/i.test(lower)) {
      recurrence = 'weekdays';
    }

    // 2. Relative time offsets (e.g. "2 saat sonra", "30 dəqiqə sonra")
    const relativeMatch = lower.match(/(\d+)\s*(saat|dəqiqə|gün)\s*sonra/i);
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1], 10);
      const unit = relativeMatch[2].toLowerCase();
      const targetDate = new Date(now);

      if (unit.startsWith('dəqiqə') || unit.startsWith('deqiqe')) {
        targetDate.setMinutes(now.getMinutes() + amount);
      } else if (unit.startsWith('saat')) {
        targetDate.setHours(now.getHours() + amount);
      } else if (unit.startsWith('gün') || unit.startsWith('gun')) {
        targetDate.setDate(now.getDate() + amount);
      }

      const cleanTitle = this.cleanReminderTitle(segment, relativeMatch[0]);
      if (!cleanTitle) return null;

      return {
        title: cleanTitle,
        dueDateTime: targetDate.toISOString(),
        category: this.inferCategory(cleanTitle),
        recurrence,
        priority: 'medium',
        inferredTime: false,
        timeConfidence: 'exact',
      };
    }

    // 3. Date extraction (bu gün, sabah, birigün, specific weekday, or monthly date)
    let targetDate = new Date(now);
    let inferredDate = false;

    if (/\bsabah\b/i.test(lower)) {
      targetDate.setDate(now.getDate() + 1);
    } else if (/\bbirigün\b|\bbiri\s*gün\b/i.test(lower)) {
      targetDate.setDate(now.getDate() + 2);
    } else if (/\bbu\s*gün\b|\bbugün\b/i.test(lower)) {
      // today
    } else {
      // Check weekday
      let matchedWeekday: number | null = null;
      for (const [wdName, wdIndex] of Object.entries(AZ_WEEKDAYS)) {
        if (lower.includes(wdName)) {
          matchedWeekday = wdIndex;
          break;
        }
      }
      if (matchedWeekday !== null) {
        let diff = matchedWeekday - now.getDay();
        if (diff <= 0) diff += 7;
        targetDate.setDate(now.getDate() + diff);
      } else {
        inferredDate = true;
      }
    }

    // 4. Exact or Inferred Time of Day
    let targetHours = 10;
    let targetMinutes = 0;
    let timeConfidence: 'exact' | 'inferred' = 'inferred';

    // Match exact hours like "saat 10-da", "saat 15:30-da", "saat 10:00", "14:00-da", "saat 8-də", "saat 9-da"
    const exactTimeMatch = lower.match(/(?:saat\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:-|–)?\s*(?:da|də|ta|tə|yə|a|e|dək)?/i);
    const hourVal = exactTimeMatch && exactTimeMatch[1] ? parseInt(exactTimeMatch[1], 10) : null;

    // Filter out common false-positive hour captures (e.g. "hər 3 gündən bir")
    const isIntervalNumber = lower.includes(`hər ${hourVal} gündən`);

    if (hourVal !== null && hourVal >= 0 && hourVal <= 24 && !isIntervalNumber && (lower.includes('saat') || exactTimeMatch?.[2])) {
      targetHours = hourVal;
      targetMinutes = exactTimeMatch?.[2] ? parseInt(exactTimeMatch[2], 10) : 0;
      timeConfidence = 'exact';

      // If user says "axşam saat 8-də" or "günorta saat 2-də"
      if (targetHours < 12 && /axşam|axsami/i.test(lower)) {
        targetHours += 12;
      } else if (targetHours <= 5 && /günorta|gunorta/i.test(lower)) {
        targetHours += 12;
      }
    } else if (/axşam|axşamüstü/i.test(lower)) {
      targetHours = 20;
      targetMinutes = 0;
    } else if (/səhər/i.test(lower)) {
      targetHours = 9;
      targetMinutes = 0;
    } else if (/günorta/i.test(lower)) {
      targetHours = 14;
      targetMinutes = 0;
    } else if (/gecə/i.test(lower)) {
      targetHours = 23;
      targetMinutes = 0;
    } else {
      targetHours = 10;
      targetMinutes = 0;
    }

    targetDate.setHours(targetHours, targetMinutes, 0, 0);

    // If time is past for today and no explicit date was mentioned, push to tomorrow or future
    if (inferredDate && targetDate.getTime() < now.getTime()) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    const cleanTitle = this.cleanReminderTitle(segment);
    if (!cleanTitle || cleanTitle.length < 2) return null;

    // MANDATORY RULE: Never allow a reminder title that is itself a retrieval command
    // (e.g. "Sabahkı planımı göstər", "Bugünkü işlərimi göstər", "Xatırlatmalarımı göstər")
    if (this.isRetrievalQueryTitle(cleanTitle)) {
      return null;
    }

    return {
      title: cleanTitle,
      dueDateTime: targetDate.toISOString(),
      category: this.inferCategory(cleanTitle),
      recurrence,
      priority: /təcili|vacib|mütləq|qəti/i.test(lower) ? 'high' : 'medium',
      inferredTime: timeConfidence === 'inferred',
      timeConfidence,
    };
  }

  private cleanReminderTitle(rawText: string, specificTimePattern?: string): string {
    let t = rawText;

    if (specificTimePattern) {
      t = t.replace(specificTimePattern, ' ');
    }

    // Strip out auxiliary command suffixes, creation verbs and temporal prepositions
    t = t.replace(/\b(xatırlat|xatirlat|xatırlatsın|xatirlatsin|xatırlatmaq|xatirlatmaq|yadıma sal|yadima sal|yadına sal|yadina sal|yada sal|unutma|əlavə et|elave et|əlavə elə|elave ele|yarat|qeyd et|qeyd elə|planlaşdır|planlasdir|yaz)\b/gi, ' ');
    t = t.replace(/\b(etməyi|etmeyi|aparmağı|aparmagi|içməyi|icmeyi|alması|almasi|öyrənməyi|yoxlamağı|zəng etməyi|zeng etmeyi)\b/gi, ' ');
    t = t.replace(/\b(saat\s+\d{1,2}(?::\d{2})?\s*(?:-|–)?\s*(?:da|də|ta|tə|yə|a|e|dək)?)\b/gi, ' ');
    t = t.replace(/\b(sabah|birigün|biri gün|bu gün|bugün|bu axşam|sabah səhər|sabah axşam|günorta|axşam)\b/gi, ' ');
    t = t.replace(/\b(hər\s+\d+\s+gündən\s+bir|hər\s+gün|hər\s+həftə|hər\s+ay|hər\s+il|həftəiçi)\b/gi, ' ');
    t = t.replace(/\b(zəhmət olmasa|lütfən|mənim üçün|mənə)\b/gi, ' ');

    t = t.replace(/[.,!?;:]+/g, ' ').replace(/\s+/g, ' ').trim();

    // Capitalize first letter
    if (t.length > 0) {
      t = t.charAt(0).toUpperCase() + t.slice(1);
    }

    return t;
  }

  private inferCategory(title: string): ReminderCategory {
    const l = title.toLowerCase();
    if (/həkim|hekim|dərman|derman|analiz|resept|xəstəxana|klinika|vitamin|diş|stomatoloq|sağlamlıq|idman|trenajor|qaçış/i.test(l)) {
      return 'health';
    }
    if (/iş|is|iclas|meeting|zəng|zeng|hesabat|açot|acot|layihə|müqavilə|müştəri|ofis|boss|kod|təqdimat/i.test(l)) {
      return 'work';
    }
    if (/ödəniş|odenis|pul|bank|kart|kredit|kirayə|kiraye|kommunal|borc|maaş|vergi/i.test(l)) {
      return 'finance';
    }
    if (/al|almaq|market|bazar|mağaza|ərzaq|çörək|süd|alış-veriş|sifariş/i.test(l)) {
      return 'shopping';
    }
    if (/dərs|ders|imtahan|kurs|kitab|müəllim|universitet|məktəb|tapşırıq/i.test(l)) {
      return 'education';
    }
    if (/ev|usta|təmir|temir|təmizlik|santexnik|maşın|masin|yumaq/i.test(l)) {
      return 'home';
    }
    if (/dost|ailə|ana|ata|bacı|qardaş|ad günü|doğum günü|təbrik|film|kino/i.test(l)) {
      return 'personal';
    }
    return 'personal';
  }

  /**
   * Resolves retrieval queries (e.g. "Sabahkı planımı göstər", "Görüşlərimi göstər", "Xatırlatmalarımı göstər", "Bu gün nə işim var?")
   * locally without calling Gemini and without any risk of creating a reminder.
   */
  public handleRetrievalQuery(
    prompt: string,
    currentReminders: Reminder[]
  ): LocalEvaluationResult {
    const norm = normalizeAz(prompt);

    // 1. Weekly schedule inquiry
    if (/(bu həftə|həftəlik|bu hefte|heftelik|həftə|hefte)/i.test(norm)) {
      const res = this.handleWeeklyScheduleInquiry(currentReminders);
      return { handledLocally: true, action: res.payload.action, ...res };
    }

    // 2. Specific query for meetings / appointments: "Görüşlərimi göstər"
    if (/(görüş|gorus|iclas)/i.test(norm) && !/(xatırlatmalarımı|planımı|planim)/i.test(norm)) {
      const allReminders = currentReminders || reminderService.getAll();
      const meetings = allReminders.filter(
        (r) => !r.isCompleted && (r.category === 'work' || /(görüş|gorus|iclas|meeting)/i.test(r.title))
      );
      let responseMessage = '';
      if (meetings.length === 0) {
        responseMessage = 'Planlaşdırılmış heç bir aktiv görüşünüz və ya iclasınız yoxdur.';
      } else {
        responseMessage = `Hazırda ${meetings.length} aktiv görüşünüz var:\n` +
          meetings.map((r, i) => `${i + 1}. ${formatDateAz(r.dueDateTime)} — ${r.title}`).join('\n');
      }
      return {
        handledLocally: true,
        action: 'search_reminders',
        payload: {
          action: 'search_reminders',
          targetQuery: 'görüş',
          responseMessage,
        },
        confidence: 0.98,
        reason: 'View meetings inquiry resolved locally.',
      };
    }

    // 3. General "Xatırlatmalarımı göstər", "Xatırlatmalarımı oxu", "Bütün xatırlatmalar"
    if (
      /(xatırlatmalarımı|xatirlatmalarimi|xatırlatmalarım|xatirlatmalarim|xatırlatmaları|xatirlatmalari|bütün xatırlatmalar|butun xatirlatmalar)/i.test(norm) &&
      !/(sabah|bugün|bu gün|birigün)/i.test(norm)
    ) {
      const allReminders = currentReminders || reminderService.getAll();
      const active = allReminders.filter((r) => !r.isCompleted);
      let responseMessage = '';
      if (active.length === 0) {
        responseMessage = 'Hazırda heç bir aktiv xatırlatmanız yoxdur.';
      } else {
        responseMessage = `Hazırda ${active.length} aktiv xatırlatmanız var:\n` +
          active.slice(0, 10).map((r, i) => `${i + 1}. ${formatDateAz(r.dueDateTime)} — ${r.title}`).join('\n') +
          (active.length > 10 ? `\n...və daha ${active.length - 10} xatırlatma.` : '');
      }
      return {
        handledLocally: true,
        action: 'search_reminders',
        payload: {
          action: 'search_reminders',
          targetQuery: '',
          responseMessage,
        },
        confidence: 0.98,
        reason: 'View all reminders inquiry resolved locally.',
      };
    }

    // 4. Daily schedule inquiry:
    // Matches "Sabahkı planımı göstər", "Sabah nə var?", "Bugünkü planımı göstər", "Bu gün saat 5-də nə var?", etc.
    const dailyRes = this.handleDailyScheduleInquiry(norm, currentReminders);
    return {
      handledLocally: true,
      action: 'get_daily_schedule',
      ...dailyRes,
    };
  }

  private handleDailyScheduleInquiry(
    lower: string,
    currentReminders: Reminder[]
  ): { payload: AIActionPayload; confidence: number; reason: string } {
    const norm = normalizeAz(lower);
    let targetDate = new Date();
    let dayLabel = 'Bu gün';

    if (/\b(sabah|sabahkı|sabahki)\b/i.test(norm)) {
      targetDate.setDate(targetDate.getDate() + 1);
      dayLabel = 'Sabah';
    } else if (/\b(birigün|biri gün|birigünkü|birigunku)\b/i.test(norm)) {
      targetDate.setDate(targetDate.getDate() + 2);
      dayLabel = 'Birigün';
    } else if (/\b(dünən|dunen|dünənki|dunenki)\b/i.test(norm)) {
      targetDate.setDate(targetDate.getDate() - 1);
      dayLabel = 'Dünən';
    } else if (/\b(bu gün|bugün|bugünkü|bugunku)\b/i.test(norm)) {
      dayLabel = 'Bu gün';
    } else {
      // Check weekday name
      for (const [wdName, wdIdx] of Object.entries(AZ_WEEKDAYS)) {
        if (norm.includes(wdName)) {
          let diff = wdIdx - targetDate.getDay();
          if (diff <= 0) diff += 7;
          targetDate.setDate(targetDate.getDate() + diff);
          dayLabel = wdName.charAt(0).toUpperCase() + wdName.slice(1);
          break;
        }
      }
    }

    // Check if user asked for a specific hour (e.g. "Saat 5-də nə var?", "Saat 15:00-da nəyim var?")
    const hourMatch = norm.match(/saat\s+(\d{1,2})/i);
    let requestedHour: number | null = null;
    if (hourMatch && /(nə var|ne var|nəyim var|neyim var|nə işim var|ne isim var)/i.test(norm)) {
      const parsedH = parseInt(hourMatch[1], 10);
      if (parsedH >= 0 && parsedH <= 24) {
        requestedHour = parsedH;
      }
    }

    const items = reminderService.getDailySchedule(targetDate);
    const dateFormatted = targetDate.toLocaleDateString('az-AZ', { day: 'numeric', month: 'long' });

    let responseMessage = '';
    if (requestedHour !== null) {
      const matchingHourItems = items.filter((r) => {
        const d = new Date(r.dueDateTime);
        const h = d.getHours();
        return h === requestedHour || (requestedHour! < 12 && h === requestedHour! + 12);
      });
      const displayHour = requestedHour < 10 ? `0${requestedHour}:00` : `${requestedHour}:00`;
      if (matchingHourItems.length === 0) {
        responseMessage = `${dayLabel} saat ${displayHour} radələrində heç bir planınız və ya xatırlatmanız yoxdur.`;
      } else {
        responseMessage = `${dayLabel} saat ${displayHour} radələrindəki planlarınız:\n` +
          matchingHourItems.map((r, i) => `${i + 1}. ${formatTimeOnly(r.dueDateTime)} — ${r.title}`).join('\n');
      }
    } else {
      if (items.length === 0) {
        responseMessage = `${dayLabel} (${dateFormatted}) üçün heç bir planınız və ya xatırlatmanız yoxdur. Rahat istirahət edə bilərsiniz.`;
      } else {
        responseMessage = `${dayLabel} (${dateFormatted}) üçün ${items.length} xatırlatmanız var:\n` +
          items.map((r, i) => `${i + 1}. ${formatTimeOnly(r.dueDateTime)} — ${r.title}`).join('\n');
      }
    }

    return {
      payload: {
        action: 'get_daily_schedule',
        responseMessage,
        dateTarget: targetDate.toISOString(),
      },
      confidence: 0.98,
      reason: `Direct daily schedule query resolved locally for ${dayLabel}.`,
    };
  }

  private handleWeeklyScheduleInquiry(
    currentReminders: Reminder[]
  ): { payload: AIActionPayload; confidence: number; reason: string } {
    const analysis = reminderService.getWeeklyAnalysis();
    const statsText = analysis.dayStats
      .map((s) => `• ${s.dayName}: ${s.count === 0 ? 'Boşdur' : `${s.count} xatırlatma`}`)
      .join('\n');

    const responseMessage = `Bu həftə ən rahat gününüz: ${analysis.leastBusyDay}.\n\nHəftəlik cədvəliniz:\n${statsText}`;

    return {
      payload: {
        action: 'get_weekly_schedule',
        responseMessage,
      },
      confidence: 0.96,
      reason: 'Direct weekly schedule inquiry resolved locally.',
    };
  }

  private handleSearchInquiry(
    lower: string,
    currentReminders: Reminder[]
  ): { payload: AIActionPayload; confidence: number; reason: string } {
    const norm = normalizeAz(lower);
    let query = norm
      .replace(/(ilə bağlı nə xatırlatmam var|haqqında nə planım var|xatırlatmalarını göstər|xatırlatmalarımı göstər|xatırlatmalarımı|görüşlərimi göstər|haqqında nə var|haqqında xatırlatmalar|haqqında planlar|axtar|göstər)/gi, '')
      .replace(/[.,!?]/g, '')
      .trim();

    const matches = reminderService.search(query);
    let responseMessage = '';

    if (matches.length === 0) {
      responseMessage = query ? `"${query}" ilə bağlı heç bir xatırlatma tapılmadı.` : 'Heç bir xatırlatma tapılmadı.';
    } else {
      responseMessage = query
        ? `"${query}" üzrə ${matches.length} xatırlatma tapıldı:\n` +
          matches.map((r, i) => `${i + 1}. ${r.title} (${formatDateAz(r.dueDateTime)})`).join('\n')
        : `Tapılan xatırlatmalar (${matches.length}):\n` +
          matches.map((r, i) => `${i + 1}. ${r.title} (${formatDateAz(r.dueDateTime)})`).join('\n');
    }

    return {
      payload: {
        action: 'search_reminders',
        targetQuery: query,
        responseMessage,
      },
      confidence: 0.95,
      reason: `Search query "${query}" executed locally with ${matches.length} matches.`,
    };
  }

  private handleCompleteCommand(
    lower: string,
    currentReminders: Reminder[]
  ): { payload: AIActionPayload; confidence: number; reason: string } {
    const activeList = currentReminders.filter((r) => !r.isCompleted);
    if (activeList.length === 0) {
      return {
        payload: {
          action: 'complete_reminder',
          responseMessage: 'Tamamlanacaq aktiv xatırlatma tapılmadı.',
        },
        confidence: 0.9,
        reason: 'No active reminders to complete.',
      };
    }

    // Match keywords from lower in reminder titles
    let matchedReminder = activeList.find((r) =>
      lower.includes(r.title.toLowerCase().slice(0, 10))
    );

    // If user says "sonuncu" / "axırıncı"
    if (!matchedReminder && /sonuncu|axırıncı/i.test(lower)) {
      matchedReminder = activeList[0];
    }

    if (!matchedReminder) {
      // Find highest keyword overlap
      const words = lower.replace(/(tamamla|bitmiş kimi qeyd et|bitirdim|yerinə yetirildi|xatırlatmanı)/g, '').trim().split(/\s+/);
      for (const word of words) {
        if (word.length >= 3) {
          matchedReminder = activeList.find((r) => r.title.toLowerCase().includes(word));
          if (matchedReminder) break;
        }
      }
    }

    if (matchedReminder) {
      return {
        payload: {
          action: 'complete_reminder',
          targetReminderId: matchedReminder.id,
          responseMessage: `"${matchedReminder.title}" tamamlandı!`,
        },
        confidence: 0.92,
        reason: `Matched target reminder "${matchedReminder.title}" to complete.`,
      };
    }

    return {
      payload: {
        action: 'complete_reminder',
        responseMessage: 'Hansı xatırlatmanı tamamlamaq istədiyinizi dəqiqləşdirin.',
      },
      confidence: 0.5,
      reason: 'Could not uniquely match reminder to complete.',
    };
  }

  private handleDeleteCommand(
    lower: string,
    currentReminders: Reminder[]
  ): { payload: AIActionPayload; confidence: number; reason: string } {
    let matchedReminder = currentReminders.find((r) =>
      lower.includes(r.title.toLowerCase().slice(0, 10))
    );

    if (!matchedReminder) {
      const words = lower.replace(/(sil|ləğv et|xatırlatmanı|görüşümü|planı)/g, '').trim().split(/\s+/);
      for (const word of words) {
        if (word.length >= 3) {
          matchedReminder = currentReminders.find((r) => r.title.toLowerCase().includes(word));
          if (matchedReminder) break;
        }
      }
    }

    if (matchedReminder) {
      return {
        payload: {
          action: 'delete_reminder',
          targetReminderId: matchedReminder.id,
          responseMessage: `"${matchedReminder.title}" xatırlatması silindi.`,
        },
        confidence: 0.92,
        reason: `Matched target reminder "${matchedReminder.title}" to delete.`,
      };
    }

    return {
      payload: {
        action: 'delete_reminder',
        responseMessage: 'Silinəcək xatırlatmanı tapmaq mümkün olmadı.',
      },
      confidence: 0.5,
      reason: 'No matching reminder for deletion.',
    };
  }

  private handleSnoozeCommand(
    lower: string,
    currentReminders: Reminder[]
  ): { payload: AIActionPayload; confidence: number; reason: string } {
    let delayMinutes = 15;
    const matchMinutes = lower.match(/(\d+)\s*dəqiqə/i);
    const matchHours = lower.match(/(\d+)\s*saat/i);

    if (matchMinutes) {
      delayMinutes = parseInt(matchMinutes[1], 10);
    } else if (matchHours) {
      delayMinutes = parseInt(matchHours[1], 10) * 60;
    } else if (/yarım\s*saat/i.test(lower)) {
      delayMinutes = 30;
    } else if (/bir\s*saat/i.test(lower)) {
      delayMinutes = 60;
    }

    const activeList = currentReminders.filter((r) => !r.isCompleted);
    const targetReminder = activeList[0];

    return {
      payload: {
        action: 'update_reminder',
        targetReminderId: targetReminder?.id,
        delayMinutes,
        responseMessage: `Xatırlatma ${delayMinutes >= 60 ? `${delayMinutes / 60} saat` : `${delayMinutes} dəqiqə`} təxirə salındı.`,
      },
      confidence: targetReminder ? 0.9 : 0.6,
      reason: `Snooze by ${delayMinutes} minutes resolved.`,
    };
  }

  /**
   * Detects complex multi-step reasoning, optimization, or conversational queries.
   */
  private detectComplexReasoningTriggers(prompt: string): string | null {
    const l = prompt.toLowerCase();
    if (/(analiz et|təhlil et|müqayisə et)/i.test(l)) {
      return 'Reasoning keyword: schedule analysis or comparison requested.';
    }
    if (/(ən rahat|ən uyğun|boş vaxtımı seç|boş vaxt tap|vaxt seç|vaxt təklif et|uyğun saat seç)/i.test(l)) {
      return 'Optimization keyword: intelligent free slot selection requested.';
    }
    if (/(məsləhət ver|nə tövsiyə edirsən|fikrin nədir|hansı daha vacibdir|prioritetləşdir)/i.test(l)) {
      return 'Advisory reasoning requested.';
    }
    if (/(bütün həftəmi planla|strateji plan|günümü təşkil et)/i.test(l)) {
      return 'Complex scheduling workflow requested.';
    }
    return null;
  }

  /**
   * Executes the Gemini Path with fallback if needed.
   */
  private async executeGeminiPath(
    cleanPrompt: string,
    currentReminders: Reminder[],
    startTime: number,
    geminiReason: string,
    executeDirectly?: boolean
  ): Promise<RouterResult> {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Baku';
      const nowISO = new Date().toISOString();

      const response = await apiClient.executeAiAction(cleanPrompt, currentReminders, nowISO, timezone);

      if (response.success && response.actionPayload) {
        let actionPayload = response.actionPayload;
        const backendAction = actionPayload.action;

        // MANDATORY CLIENT-SIDE OVERRIDE GUARD (Rule 8):
        // If backend returned create_reminder / create_multiple_reminders for a query or title that is a retrieval query, OVERRIDE to query!
        const hasInvalidTitle = actionPayload.remindersToCreate?.some((r) => this.isRetrievalQueryTitle(r.title));
        if (
          (actionPayload.action === 'create_reminder' || actionPayload.action === 'create_multiple_reminders') &&
          (this.isRetrievalQuery(cleanPrompt) || hasInvalidTitle)
        ) {
          console.warn(`[INTENT-TRACE] Backend misclassified query as "${backendAction}". Applying client-side safety guard override.`);
          const queryEval = this.handleRetrievalQuery(cleanPrompt, currentReminders);
          actionPayload = queryEval.payload;

          this.logIntentTrace({
            input: cleanPrompt,
            localClassification: 'retrieval_guard_override',
            backendClassification: backendAction,
            finalAction: actionPayload.action,
            reason: 'Client-side guard rejected reminder creation for query phrase.',
          });
        } else {
          this.logIntentTrace({
            input: cleanPrompt,
            localClassification: 'delegated_to_backend',
            backendClassification: backendAction,
            finalAction: actionPayload.action,
            reason: geminiReason,
          });
        }

        let affectedReminders: Reminder[] | undefined;

        if (actionPayload.action === 'plan_day') {
          actionPayload.needsConfirmation = true;
          if (!actionPayload.dailyPlanProposal && actionPayload.remindersToCreate) {
            const todayYMD = new Date().toISOString().slice(0, 10);
            const tasks = actionPayload.remindersToCreate.map((d, idx) => ({
              id: `plan-task-${Date.now()}-${idx}`,
              title: d.title,
              dueDateTime: d.dueDateTime,
              timeString: formatTimeOnly(d.dueDateTime) || '10:00',
              priority: d.priority || 'medium',
              category: d.category || 'other',
              isFixedTime: !d.inferredTime,
              isFocusReady: /(hesabat|kod|analiz|dərs|məqalə)/i.test(d.title),
              durationMinutes: 45,
            }));
            const proposal: DailyPlanProposal = {
              id: `plan-${Date.now()}`,
              rawInput: cleanPrompt,
              createdAt: new Date().toISOString(),
              targetDate: todayYMD,
              tasks,
              summaryNote: actionPayload.responseMessage,
            };
            actionPayload.dailyPlanProposal = dailyPlannerService.detectAndResolveConflicts(
              proposal,
              currentReminders
            );
          }
        } else if (executeDirectly && actionPayload.action !== 'general_chat') {
          const execResult = reminderService.executeAIAction(actionPayload);
          if (execResult.affectedReminders) {
            affectedReminders = execResult.affectedReminders;
          }
          if (execResult.message && !actionPayload.responseMessage) {
            actionPayload.responseMessage = execResult.message;
          }
        }

        const execTime = Math.round(performance.now() - startTime);
        console.log(`[CLIENT ROUTER] execution time ms: ${execTime}ms`);

        return {
          source: 'gemini_path',
          intent: actionPayload.action,
          confidence: 0.95,
          confidenceTier: 'high',
          requiresGemini: true,
          actionPayload,
          executionTimeMs: execTime,
          reason: geminiReason,
          affectedReminders,
        };
      }
      throw new Error(response.error || 'AI cavab verə bilmədi');
    } catch (err: any) {
      console.warn(`[ROUTER] fallback activated: Gemini error (${err.message}). Falling back to deterministic handler.`);

      // Activate deterministic fallback
      const fallbackEval = this.evaluateLocalFastPath(cleanPrompt, currentReminders);
      const execTime = Math.round(performance.now() - startTime);
      console.log(`[CLIENT ROUTER] execution time ms: ${execTime}ms`);

      this.logIntentTrace({
        input: cleanPrompt,
        localClassification: fallbackEval.payload.action,
        backendClassification: `error: ${err.message}`,
        finalAction: fallbackEval.payload.action,
        reason: fallbackEval.reason,
      });

      return {
        source: 'fallback_deterministic',
        intent: fallbackEval.payload.action,
        confidence: fallbackEval.confidence,
        confidenceTier: 'medium',
        requiresGemini: false,
        actionPayload: {
          ...fallbackEval.payload,
          responseMessage: fallbackEval.payload.responseMessage ||
            'Xidmət hazırda məşğuldur, sorğunuz ehtiyat qaydalarla icra edildi.',
        },
        executionTimeMs: execTime,
        reason: `Gemini unavailable (${err.message}); deterministic fallback executed.`,
      };
    }
  }
}

export const intelligentRouter = new IntelligentRouter();
