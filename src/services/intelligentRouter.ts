import {
  Reminder,
  ExtractedReminderDraft,
  AIActionPayload,
  AIActionType,
  ReminderCategory,
  ReminderRecurrence,
  RecurrenceUnit,
  RecurrenceConfig,
  ReminderConflict,
  DailyPlanProposal,
  RoutineProposal,
} from '../types';
import { reminderService } from './reminderService';
import { apiClient } from './apiClient';
import { formatDateAz, formatTimeOnly } from '../utils/dateUtils';
import { dailyPlannerService } from './dailyPlannerService';
import { routineService } from './routineService';
import { conflictDetector } from './conflictDetector';

export interface RouteOptions {
  executeDirectly?: boolean;
  forceCreate?: boolean;
  userNowISO?: string;
  userTimezone?: string;
}

export interface RouterResult {
  source: 'local_fast_path' | 'ai_path' | 'gemini_path' | 'fallback_deterministic';
  intent: AIActionType;
  confidence: number;
  confidenceTier: 'high' | 'medium' | 'low';
  requiresAi: boolean;
  requiresGemini?: boolean;
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
  recurrenceDays?: number[];
  recurrenceInterval?: number;
  recurrenceUnit?: RecurrenceUnit;
  recurrenceRule?: RecurrenceConfig;
  recurrenceDayOfMonth?: number;
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

const AZ_WORD_NUMBERS: Record<string, number> = {
  bir: 1, iki: 2, 'üç': 3, uc: 3, 'dörd': 4, dord: 4, 'beş': 5, bes: 5,
  'altı': 6, alti: 6, yeddi: 7, 'səkkiz': 8, sekkiz: 8, doqquz: 9, on: 10,
  'on bir': 11, 'on iki': 12, onda: 10, 'ikidə': 2, 'üçdə': 3, 'dörddə': 4, 'beşdə': 5,
};

/**
 * Mandatory Rule: CREATE intent must require an explicit creation semantic.
 * Temporal words alone (sabah, bu gün, axşam, həftə) must NEVER imply create_reminder.
 */
export const EXPLICIT_CREATE_REGEX =
  /\b(xatırlat|xatirlat|xatırlatsın|xatirlatsin|xatırlatmaq|xatirlatmaq|əlavə et|elave et|əlavə elə|elave ele|yarat|yaratsın|yaratmaq|qeyd et|qeyd elə|qeyd apar|planlaşdır|planlasdir|yadıma sal|yadima sal|yadına sal|yadina sal|yada sal|unutma)\b/i;

/**
 * Mandatory Rule: Query/view phrases MUST NEVER create reminders.
 * "göstər" or "nə planım var" must always be treated as retrieval/query intent.
 */
export const RETRIEVAL_QUERY_REGEX =
  /(?:göstər|goster|göstərin|gosterin|göstərərsən|gosterersen|nə\s+var|ne\s+var|nəyim\s+var|neyim\s+var|nə\s+işim\s+var|ne\s+isim\s+var|nə\s+planım\s+var|ne\s+planim\s+var|nə\s+edəcəm|ne\s+edecem|nə\s+etməliyəm|ne\s+etmeliyem|nələr\s+var|neler\s+var|nə\s+vaxtdır|ne\s+vaxtdir|hansı\s+vaxtdır|hansi\s+vaxtdir|(?:plan|cədvəl|xatırlatma|iş|görüş)lar[ıi]?(?:m[ıi]z?)?\s*(?:göstər|oxu|baxaq)|(?:planlara|cədvələ|xatırlatmalara)\s*bax|xatırlatmalarımı\s+göstər|planımı\s+göstər|planlarımı\s+göstər|cədvəlimi\s+göstər)/i;

export function hasExplicitCreateVerb(text: string): boolean {
  const norm = normalizeAz(text);
  return EXPLICIT_CREATE_REGEX.test(norm);
}

export function hasActionDirective(text: string): boolean {
  const l = text.toLowerCase();
  const hasTimeIndicator = /(?:sabah|bu gün|bugün|birigün|biri gün|axşam|axsam|səhər|seher|günorta|gunorta|gecə|gece|saat|\d+\s*[-–]?(?:də|da|ta|tə|de)|onda|ikidə|üçdə|dörddə|beşdə|hər|her|həftə|hefte)/i.test(l);
  const hasActionKeyword = /(?:zəng|zeng|al|almaq|bax|yoxla|get|getmək|getmeliyem|getməliyəm|apar|gətir|getir|iç|ic|öyrən|oyren|ödə|ode|hazırla|hazirla|yaz|oxu|oxumaq|yat|yatmaq|evə|eve|ev|görüş|gorus|təmir|temir|təmizlə|temizle|maşın|masin|dərman|derman|çörək|corek|market|iş|is|həkim|hekim|iclas|et|etmək)/i.test(l);
  return hasTimeIndicator && hasActionKeyword;
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
  public hasActionDirective = hasActionDirective;
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
    console.log(`[VOICE-FLOW] router called: "${cleanPrompt}"`);

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
        requiresAi: false,
        requiresGemini: false,
        actionPayload: queryEval.payload,
        executionTimeMs: execTime,
        reason: queryEval.reason,
      };
    }

    // 1. Check for Complex Reasoning / Planning triggers that MUST go to AI backend
    const complexReasoningReason = this.detectComplexReasoningTriggers(cleanPrompt);
    if (complexReasoningReason) {
      console.log(`[CLIENT ROUTER] backend required: ${complexReasoningReason}`);
      console.log(`[ROUTER] intent: complex_planning_reasoning`);
      console.log(`[ROUTER] deterministic confidence: 0.35 (low)`);

      return this.executeAiPath(cleanPrompt, currentReminders, startTime, complexReasoningReason, options.executeDirectly);
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
        if (localEval.payload.hasConflict && !options.forceCreate) {
          executionResult = {
            success: false,
            message: localEval.payload.conflicts?.[0]?.message || 'Xatırlatmalar arasında vaxt toqquşması aşkarlandı.',
          };
          affectedReminders = [];
          localEval.payload.needsConfirmation = true;
        } else {
          if (localEval.payload.hasConflict && options.forceCreate) {
            conflictDetector.logUserDecision('Yenə də əlavə et');
          }
          const execution = reminderService.executeAIAction(localEval.payload);
          executionResult = execution;
          if (execution.affectedReminders) {
            affectedReminders = execution.affectedReminders;
          }
          if (execution.message && !localEval.payload.responseMessage) {
            localEval.payload.responseMessage = execution.message;
          }
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

      console.log(
        `[VOICE-FLOW] router result: ${localEval.payload.action}, source=local_fast_path, reminders=${localEval.payload.remindersToCreate?.length || 0}`
      );

      return {
        source: 'local_fast_path',
        intent: localEval.payload.action,
        confidence: localEval.confidence,
        confidenceTier: 'high',
        requiresAi: false,
        requiresGemini: false,
        actionPayload: localEval.payload,
        executionTimeMs: execTime,
        reason: localEval.reason,
        affectedReminders,
        executionResult,
      };
    }

    // 3. Fallback to AI Path when confidence is moderate/low or ambiguous
    const fallbackReason = `Deterministic confidence below threshold (${localEval.confidence.toFixed(2)}) or ambiguous natural language`;
    console.log(`[CLIENT ROUTER] backend required: ${fallbackReason}`);
    return this.executeAiPath(cleanPrompt, currentReminders, startTime, fallbackReason, options.executeDirectly);
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

    // I. REMINDER CREATION & RECURRENCE (e.g. "Sabah saat 10-da Anara zəng et, 2-də maşınlar, axşam dərmanı al", "Sabah saat 10-da Anara zəng etməyi xatırlat")
    const isQuery = this.isRetrievalQuery(clean);
    const isActionable = (this.hasExplicitCreateVerb(clean) || this.hasActionDirective(clean)) && !isQuery;

    if (isActionable) {
      const parsedReminders = this.parseDeterministicReminders(prompt);
      if (parsedReminders.length > 0) {
        const isMulti = parsedReminders.length > 1;
        const summaries = parsedReminders.map(
          (r) => `${formatDateAz(r.dueDateTime)}: "${r.title}"`
        );

        const draftReminders: ExtractedReminderDraft[] = parsedReminders.map((r, idx) => ({
          id: `local-${Date.now()}-${idx}`,
          title: r.title,
          description: r.description || '',
          dueDateTime: r.dueDateTime,
          category: r.category,
          recurrence: r.recurrence,
          recurrenceDays: r.recurrenceDays,
          recurrenceInterval: r.recurrenceInterval,
          recurrenceUnit: r.recurrenceUnit,
          recurrenceRule: r.recurrenceRule,
          recurrenceDayOfMonth: r.recurrenceDayOfMonth,
          priority: r.priority,
          inferredTime: r.inferredTime,
          timeConfidence: r.timeConfidence,
          notificationEnabled: true,
        }));

        console.log(`[VOICE-FLOW] reminders parsed: count=${draftReminders.length}`, draftReminders.map(d => d.title));

        const conflicts = conflictDetector.detectConflicts(draftReminders, currentReminders);
        const hasConflict = conflicts.length > 0;

        let responseMessage = '';
        if (hasConflict) {
          responseMessage = `${conflicts[0].message} Yenə də əlavə edilsin?`;
        } else if (isMulti) {
          responseMessage = `${parsedReminders.length} xatırlatma tərtib edildi:\n${summaries.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
        } else {
          responseMessage = `Xatırlatma tərtib edildi: "${parsedReminders[0].title}" (${formatDateAz(parsedReminders[0].dueDateTime)}).`;
        }

        const action: AIActionType = isMulti ? 'create_multiple_reminders' : 'create_reminder';
        return {
          handledLocally: true,
          action,
          payload: {
            action,
            remindersToCreate: draftReminders,
            responseMessage,
            hasConflict,
            conflicts,
            needsConfirmation: hasConflict,
          },
          confidence: isMulti ? 0.90 : 0.93,
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

    console.log('[RECURRENCE-TEST] input:', clean);

    // MANDATORY SAFETY GUARD: If input is a retrieval query without explicit create verb, NEVER parse reminders!
    if (this.isRetrievalQuery(clean) && !this.hasExplicitCreateVerb(clean)) {
      return [];
    }
    if (!this.hasExplicitCreateVerb(clean) && !this.hasActionDirective(clean)) {
      return [];
    }

    // Check if multi-reminder compound: split by punctuation, conjunctions, or time transitions
    const segments = this.splitMultiReminderSegments(clean);
    console.log('[RECURRENCE-TEST] segments:', segments);
    const results: ParsedDeterministicItem[] = [];
    let contextDate: Date | null = null;

    for (const segment of segments) {
      const item = this.parseSingleReminderSegment(segment, contextDate);
      if (item) {
        console.log('[RECURRENCE-TEST] recurrenceInterval:', item.recurrenceInterval);
        console.log('[RECURRENCE-TEST] recurrenceUnit:', item.recurrenceUnit);
        console.log('[RECURRENCE-TEST] parsed result:', item);
        results.push(item);
        contextDate = new Date(item.dueDateTime);
      }
    }

    return results;
  }

  private splitMultiReminderSegments(text: string): string[] {
    // 1. Split by punctuation: commas, semicolons, newlines
    if (/[,\n;]+/.test(text)) {
      const parts = text.split(/[,\n;]+/).map((s) => s.trim().replace(/\.+$/, '')).filter(Boolean);
      if (parts.length > 1) return parts;
    }

    // 2. Split by conjunctions: və, ardınca, sonra, daha sonra
    if (/\s+(?:və|ardınca|sonra|daha sonra)\s+/i.test(text)) {
      const parts = text.split(/\s+(?:və|ardınca|sonra|daha sonra)\s+/i).map((s) => s.trim().replace(/\.+$/, '')).filter(Boolean);
      if (parts.length > 1) return parts;
    }

    // 3. Split by spoken time transitions without punctuation
    // Must NOT split after recurrence phrases or daypart/date prefixes (e.g. "axşam 10-da", "bu gün saat 18:00", "hər gün", etc.)
    const timeTransitionRegex = /(?<=\S\s+)(?<!saat\s+)(?<!\b(?:bu\s+gün|bugün|sabah|birigün|axşam|axsam|günorta|gunorta|səhər|seher|gecə|gece)\s+)(?<!\b(?:hər|her)\s+(?:\d+|bir|iki|üç|uc|dörd|dord|beş|bes|altı|alti|yeddi|səkkiz|sekkiz|doqquz|on)\s+(?:gündən|gunden|həftədən|hefteden|aydan|ildən|ilden)\s+bir\s+)(?<!\b(?:hər|her)\s+(?:gün|gun|həftə|hefte|ay|il|səhər|seher|axşam|axsam)\s+)(?<!\b(?:gündən|gunden|həftədən|hefteden|aydan|ildən|ilden)\s+bir\s+)(?<!\bbir\s+)(?<!\b(?:hər|her)\s+)(?=(?:saat\s+\d+|saat\s+(?:bir|iki|üç|dörd|beş|altı|yeddi|səkkiz|doqquz|on)|\d+\s*[-–]?(?:də|da|de|ta|tə)\s+|(?:bir|iki|üç|dörd|beş|altı|yeddi|səkkiz|doqquz|on)\s*[-–]?(?:də|da|de|ta|tə)\s+|axşam|axsam|günorta|gunorta|səhər|seher|gecə|gece)\b)/giu;
    const rawParts = text.split(timeTransitionRegex).map((s) => s.trim().replace(/\.+$/, '')).filter(Boolean);

    // Safeguard: If any segment is an incomplete recurrence phrase (e.g. "hər 3 gündən bir"), re-attach to the next segment
    const parts: string[] = [];
    for (let i = 0; i < rawParts.length; i++) {
      const cur = rawParts[i];
      if (/^hər\s+(?:\d+|bir|iki|üç|uc|dörd|dord|beş|bes|altı|alti|yeddi|səkkiz|sekkiz|doqquz|on)?\s*(?:gündən|gunden|həftədən|hefteden|aydan|ildən|ilden)?\s*bir$/iu.test(cur) && i + 1 < rawParts.length) {
        rawParts[i + 1] = cur + ' ' + rawParts[i + 1];
      } else {
        parts.push(cur);
      }
    }

    return parts.length > 1 ? parts : [text];
  }

  private parseSingleReminderSegment(segment: string, contextDate?: Date | null): ParsedDeterministicItem | null {
    const lower = segment.toLowerCase();
    const now = new Date();

    if (!this.hasExplicitCreateVerb(segment) && !this.hasActionDirective(segment)) {
      return null;
    }

    // 1. Recurrence Detection & Parameter Extraction
    let recurrence: ReminderRecurrence = 'none';
    let recurrenceInterval = 1;
    let recurrenceUnit: RecurrenceUnit = 'day';
    let recurrenceDays: number[] | undefined = undefined;
    let recurrenceDayOfMonth: number | undefined = undefined;
    let isRecurring = false;

    const intervalDay = lower.match(/hər\s+(\d+|bir|iki|üç|uc|dörd|dord|beş|bes|altı|alti|yeddi|səkkiz|sekkiz|doqquz|on)\s+(?:gündən|gunden)\s+bir/iu);
    const intervalWeek = lower.match(/hər\s+(\d+|bir|iki|üç|uc|dörd|dord|beş|bes|altı|alti|yeddi|səkkiz|sekkiz|doqquz|on)\s+(?:həftədən|hefteden)\s+bir/iu);
    const intervalMonth = lower.match(/hər\s+(\d+|bir|iki|üç|uc|dörd|dord|beş|bes|altı|alti|yeddi|səkkiz|sekkiz|doqquz|on)\s+(?:aydan)\s+bir/iu);
    const intervalYear = lower.match(/hər\s+(\d+|bir|iki|üç|uc|dörd|dord|beş|bes|altı|alti|yeddi|səkkiz|sekkiz|doqquz|on)\s+(?:ildən|ilden)\s+bir/iu);
    const monthDayMatch = lower.match(/hər\s+ayın\s+(\d+)(?:[-–]?(?:i|si|ı|sı|u|su|ü|sü))?/iu);

    const parseIntervalNumber = (raw: string): number => {
      const val = raw.trim().toLowerCase();
      if (/^\d+$/.test(val)) return parseInt(val, 10);
      return AZ_WORD_NUMBERS[val] || 1;
    };

    const weekdaysMap: Record<string, number> = {
      'bazar ertəsi': 1, 'bazar ertesi': 1,
      'çərşənbə axşamı': 2, 'cersenbe axsami': 2,
      'çərşənbə': 3, 'cersenbe': 3,
      'cümə axşamı': 4, 'cume axsami': 4,
      'cümə': 5, 'cume': 5,
      'şənbə': 6, 'senbe': 6,
      'bazar': 0
    };

    if (intervalDay) {
      recurrence = 'custom';
      recurrenceInterval = parseIntervalNumber(intervalDay[1]);
      recurrenceUnit = 'day';
      isRecurring = true;
    } else if (intervalWeek) {
      recurrence = 'custom';
      recurrenceInterval = parseIntervalNumber(intervalWeek[1]);
      recurrenceUnit = 'week';
      isRecurring = true;
    } else if (intervalMonth) {
      recurrence = 'custom';
      recurrenceInterval = parseIntervalNumber(intervalMonth[1]);
      recurrenceUnit = 'month';
      isRecurring = true;
    } else if (intervalYear) {
      recurrence = 'custom';
      recurrenceInterval = parseIntervalNumber(intervalYear[1]);
      recurrenceUnit = 'year';
      isRecurring = true;
    } else if (monthDayMatch) {
      recurrence = 'monthly';
      recurrenceInterval = 1;
      recurrenceUnit = 'month';
      recurrenceDayOfMonth = parseInt(monthDayMatch[1], 10);
      isRecurring = true;
    } else {
      let matchedWd: number | null = null;
      for (const [name, idx] of Object.entries(weekdaysMap)) {
        if (new RegExp(`hər\\s+${name}`, 'i').test(lower)) {
          matchedWd = idx;
          break;
        }
      }
      if (matchedWd !== null) {
        recurrence = 'weekly';
        recurrenceInterval = 1;
        recurrenceUnit = 'week';
        recurrenceDays = [matchedWd];
        isRecurring = true;
      } else if (/hər\s+gün|hər\s+səhər|hər\s+axşam|günbəgün/i.test(lower)) {
        recurrence = 'daily';
        recurrenceInterval = 1;
        recurrenceUnit = 'day';
        isRecurring = true;
      } else if (/hər\s+həftə|həftəlik/i.test(lower)) {
        recurrence = 'weekly';
        recurrenceInterval = 1;
        recurrenceUnit = 'week';
        isRecurring = true;
      } else if (/hər\s+ay|aylıq/i.test(lower)) {
        recurrence = 'monthly';
        recurrenceInterval = 1;
        recurrenceUnit = 'month';
        isRecurring = true;
      } else if (/hər\s+il|illik/i.test(lower)) {
        recurrence = 'yearly';
        recurrenceInterval = 1;
        recurrenceUnit = 'year';
        isRecurring = true;
      } else if (/həftəiçi|hər\s+iş\s+günü/i.test(lower)) {
        recurrence = 'weekdays';
        recurrenceInterval = 1;
        recurrenceUnit = 'day';
        recurrenceDays = [1, 2, 3, 4, 5];
        isRecurring = true;
      }
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
        recurrenceDays,
        recurrenceInterval,
        recurrenceUnit,
        recurrenceRule: isRecurring && recurrence !== 'none'
          ? {
              type: recurrence === 'custom' ? 'interval' : recurrence,
              unit: recurrenceUnit,
              interval: recurrenceInterval,
              daysOfWeek: recurrenceDays,
              dayOfMonth: recurrenceDayOfMonth,
            }
          : undefined,
        recurrenceDayOfMonth,
        priority: 'medium',
        inferredTime: false,
        timeConfidence: 'exact',
      };
    }

    // 3. Prepare text for time searching (strip recurring interval numbers to prevent false hour matches)
    let textForTimeSearch = lower.replace(/hər\s+(?:\d+|bir|iki|üç|uc|dörd|dord|beş|bes|altı|alti|yeddi|səkkiz|sekkiz|doqquz|on)\s+(?:gündən|gunden|həftədən|hefteden|aydan|ildən|ilden)\s+bir/giu, ' ');
    textForTimeSearch = textForTimeSearch.replace(/hər\s+ayın\s+\d+(?:[-–]?(?:i|si|ı|sı|u|su|ü|sü))?/giu, ' ');
    textForTimeSearch = textForTimeSearch.replace(/hər\s+(?:gün|gun|həftə|hefte|ay|il|bazar\s*ertəsi|bazar\s*ertesi)/giu, ' ');

    // 4. Exact or Inferred Time of Day
    let targetHours = 10;
    let targetMinutes = 0;
    let timeConfidence: 'exact' | 'inferred' = 'inferred';

    // Daypart + hour patterns:
    // Examples: "səhər 10", "günorta 2", "axşam 10", "gecə 1", "səhər saat 10-da", "axşam saat 8-də"
    const morningMatch = textForTimeSearch.match(/(?:səhər|seher)\s+(?:saat\s+)?(?:(\d{1,2})(?::(\d{2}))?|(onda|ikidə|üçdə|dörddə|beşdə|bir|iki|üç|dörd|beş|altı|yeddi|səkkiz|doqquz|on))(?:\s*[-–]?(?:də|da|de|ta|tə))?/i);
    const afternoonMatch = textForTimeSearch.match(/(?:günorta|gunorta|nahar)\s+(?:saat\s+)?(?:(\d{1,2})(?::(\d{2}))?|(onda|ikidə|üçdə|dörddə|beşdə|bir|iki|üç|dörd|beş|altı|yeddi|səkkiz|doqquz|on))(?:\s*[-–]?(?:də|da|de|ta|tə))?/i);
    const eveningMatch = textForTimeSearch.match(/(?:axşam|axsam|axşamüstü|axsamustu)\s+(?:saat\s+)?(?:(\d{1,2})(?::(\d{2}))?|(onda|ikidə|üçdə|dörddə|beşdə|bir|iki|üç|dörd|beş|altı|yeddi|səkkiz|doqquz|on))(?:\s*[-–]?(?:də|da|de|ta|tə))?/i);
    const nightMatch = textForTimeSearch.match(/(?:gecə|gece)\s+(?:saat\s+)?(?:(\d{1,2})(?::(\d{2}))?|(onda|ikidə|üçdə|dörddə|beşdə|bir|iki|üç|dörd|beş|altı|yeddi|səkkiz|doqquz|on))(?:\s*[-–]?(?:də|da|de|ta|tə))?/i);

    // Match exact hours like "saat 10-da", "saat 15:30-da", "saat 10:00", "14:00-da", "saat 8-də", "saat 9-da", "2-də", "2 də", "saat 18:00"
    const exactTimeMatch = textForTimeSearch.match(/(?:saat\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:-|–)?\s*(?:da|də|de|ta|tə|yə|a|e|dək)?/i);
    const hourVal = exactTimeMatch && exactTimeMatch[1] ? parseInt(exactTimeMatch[1], 10) : null;

    // Spoken number words: "saat onda", "saat ikidə", "onda", "ikidə"
    const wordMatch = textForTimeSearch.match(/(?:saat\s+)?(onda|ikidə|üçdə|dörddə|beşdə|bir|iki|üç|dörd|beş|altı|yeddi|səkkiz|doqquz|on)(?:\s*[-–]?(?:də|da|de|ta|tə))?/i);

    if (morningMatch) {
      const h = morningMatch[1] ? parseInt(morningMatch[1], 10) : (morningMatch[3] ? AZ_WORD_NUMBERS[morningMatch[3]] : 9);
      // "səhər" = AM. Explicit 24-hour time must never be changed.
      targetHours = h;
      targetMinutes = morningMatch[2] ? parseInt(morningMatch[2], 10) : 0;
      timeConfidence = 'exact';
    } else if (afternoonMatch) {
      const h = afternoonMatch[1] ? parseInt(afternoonMatch[1], 10) : (afternoonMatch[3] ? AZ_WORD_NUMBERS[afternoonMatch[3]] : 2);
      // "günorta" converts 1–5 to 13–17. Explicit 24-hour time must never be changed.
      targetHours = h >= 1 && h <= 5 ? h + 12 : h;
      targetMinutes = afternoonMatch[2] ? parseInt(afternoonMatch[2], 10) : 0;
      timeConfidence = 'exact';
    } else if (eveningMatch) {
      const h = eveningMatch[1] ? parseInt(eveningMatch[1], 10) : (eveningMatch[3] ? AZ_WORD_NUMBERS[eveningMatch[3]] : 8);
      // "axşam" = PM (converts 1–11 to 13–23). Explicit 24-hour time must never be changed.
      targetHours = h >= 1 && h <= 11 ? h + 12 : (h === 12 ? 0 : h);
      targetMinutes = eveningMatch[2] ? parseInt(eveningMatch[2], 10) : 0;
      timeConfidence = 'exact';
    } else if (nightMatch) {
      const h = nightMatch[1] ? parseInt(nightMatch[1], 10) : (nightMatch[3] ? AZ_WORD_NUMBERS[nightMatch[3]] : 1);
      // "gecə" keeps 1–4 as 01–04. Explicit 24-hour time must never be changed.
      targetHours = h >= 1 && h <= 4 ? h : (h === 12 ? 0 : (h === 11 ? 23 : h));
      targetMinutes = nightMatch[2] ? parseInt(nightMatch[2], 10) : 0;
      timeConfidence = 'exact';
    } else if (
      hourVal !== null &&
      hourVal >= 0 &&
      hourVal <= 24 &&
      (textForTimeSearch.includes('saat') || exactTimeMatch?.[0]?.includes('də') || exactTimeMatch?.[0]?.includes('da') || textForTimeSearch.includes(`${hourVal} də`) || exactTimeMatch?.[2])
    ) {
      targetHours = hourVal;
      targetMinutes = exactTimeMatch?.[2] ? parseInt(exactTimeMatch[2], 10) : 0;
      timeConfidence = 'exact';

      // Explicit 24-hour time must never be changed (hours >= 12 preserved)
      if (targetHours >= 1 && targetHours <= 11) {
        if (/axşam|axsam/i.test(lower)) {
          // "axşam" = PM
          targetHours += 12;
        } else if (/günorta|gunorta/i.test(lower) && targetHours <= 5) {
          // "günorta" converts 1–5 to 13–17
          targetHours += 12;
        } else if (/gecə|gece/i.test(lower) && targetHours <= 4) {
          // "gecə" keeps 1–4 as 01–04
        }
        // Bare 1–11 hours with no daypart = AM (targetHours unchanged)
      }
    } else if (wordMatch && wordMatch[1] && AZ_WORD_NUMBERS[wordMatch[1]]) {
      targetHours = AZ_WORD_NUMBERS[wordMatch[1]];
      timeConfidence = 'exact';
      // Explicit 24-hour time must never be changed
      if (targetHours >= 1 && targetHours <= 11) {
        if (/axşam|axsam/i.test(lower)) {
          // "axşam" = PM
          targetHours += 12;
        } else if (/günorta|gunorta/i.test(lower) && targetHours <= 5) {
          // "günorta" converts 1–5 to 13–17
          targetHours += 12;
        } else if (/gecə|gece/i.test(lower) && targetHours <= 4) {
          // "gecə" keeps 1–4 as 01–04
        }
        // Bare 1–11 hours with no daypart = AM (targetHours unchanged)
      }
    } else if (/axşam|axşamüstü|axsam/i.test(lower)) {
      targetHours = 20;
      targetMinutes = 0;
    } else if (/səhər|seher/i.test(lower)) {
      targetHours = 9;
      targetMinutes = 0;
    } else if (/günorta|gunorta/i.test(lower)) {
      targetHours = 14;
      targetMinutes = 0;
    } else if (/gecə|gece/i.test(lower)) {
      targetHours = 23;
      targetMinutes = 0;
    } else {
      targetHours = 10;
      targetMinutes = 0;
    }

    // 5. Calculate First Occurrence Date
    let targetDate = new Date(now);
    targetDate.setHours(targetHours, targetMinutes, 0, 0);

    if (isRecurring) {
      if (recurrenceDayOfMonth) {
        targetDate.setDate(recurrenceDayOfMonth);
        if (targetDate.getTime() <= now.getTime()) {
          targetDate.setMonth(targetDate.getMonth() + 1);
        }
      } else if (recurrenceDays && recurrenceDays.length === 1) {
        let diff = recurrenceDays[0] - now.getDay();
        if (diff < 0 || (diff === 0 && targetDate.getTime() <= now.getTime())) {
          diff += 7;
        }
        targetDate.setDate(now.getDate() + diff);
      } else {
        // Daily or custom interval: first occurrence is today if in future, else tomorrow
        if (targetDate.getTime() <= now.getTime()) {
          targetDate.setDate(targetDate.getDate() + 1);
        }
      }
    } else {
      // Non-recurring date extraction
      targetDate = new Date(contextDate || now);
      let inferredDate = !contextDate;

      if (/\bsabah\b/i.test(lower)) {
        targetDate = new Date(now);
        targetDate.setDate(now.getDate() + 1);
        inferredDate = false;
      } else if (/\bbirigün\b|\bbiri\s*gün\b/i.test(lower)) {
        targetDate = new Date(now);
        targetDate.setDate(now.getDate() + 2);
        inferredDate = false;
      } else if (/\bbu\s*gün\b|\bbugün\b/i.test(lower)) {
        targetDate = new Date(now);
        inferredDate = false;
      } else if (!contextDate) {
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
          inferredDate = false;
        }
      }

      targetDate.setHours(targetHours, targetMinutes, 0, 0);
      if (inferredDate && targetDate.getTime() < now.getTime()) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
    }

    const timeStr = `${targetHours.toString().padStart(2, '0')}:${targetMinutes.toString().padStart(2, '0')}`;
    if (isRecurring) {
      console.log(`[RECURRENCE] input: ${segment}`);
      console.log(`[RECURRENCE] detected: true`);
      console.log(`[RECURRENCE] interval: ${recurrenceInterval}`);
      console.log(`[RECURRENCE] unit: ${recurrenceUnit}`);
      console.log(`[RECURRENCE] time: ${timeStr}`);
    }

    const cleanTitle = this.cleanReminderTitle(segment);
    if (!cleanTitle || cleanTitle.length < 2) return null;

    // MANDATORY RULE: Never allow a reminder title that is itself a retrieval command
    if (this.isRetrievalQueryTitle(cleanTitle)) {
      return null;
    }

    const recurrenceRule: RecurrenceConfig | undefined = isRecurring && recurrence !== 'none'
      ? {
          type: recurrence === 'custom' ? 'interval' : recurrence,
          unit: recurrenceUnit,
          interval: recurrenceInterval,
          daysOfWeek: recurrenceDays,
          dayOfMonth: recurrenceDayOfMonth,
        }
      : undefined;

    return {
      title: cleanTitle,
      dueDateTime: targetDate.toISOString(),
      category: this.inferCategory(cleanTitle),
      recurrence,
      recurrenceDays,
      recurrenceInterval,
      recurrenceUnit,
      recurrenceRule,
      recurrenceDayOfMonth,
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

    // Strip recurrence phrases
    t = t.replace(/hər\s+(?:\d+|bir|iki|üç|uc|dörd|dord|beş|bes|altı|alti|yeddi|səkkiz|sekkiz|doqquz|on)\s+(?:gündən|gunden|həftədən|hefteden|aydan|ildən|ilden)\s+bir/giu, ' ');
    t = t.replace(/hər\s+ayın\s+\d+(?:[-–]?(?:i|si|ı|sı|u|su|ü|sü))?/giu, ' ');
    t = t.replace(/hər\s+(?:gün|gun|həftə|hefte|ay|il|bazar\s*ertəsi|bazar\s*ertesi|çərşənbə\s*axşamı|cersenbe\s*axsami|çərşənbə|cersenbe|cümə\s*axşamı|cume\s*axsami|cümə|cume|şənbə|senbe|bazar|həftəiçi|hefteici|iş\s*günü|is\s*gunu)/giu, ' ');

    // Strip out numbers with time suffixes: saat 10-da, 2-də, 2 də
    t = t.replace(/(?:saat\s+)?\d{1,2}(?::\d{2})?(?:\s*[-–]?\s*(?:da|də|de|ta|tə|yə|a|e|dək)(?!\p{L}))?/giu, ' ');
    // Strip out spoken numbers: saat onda, onda, ikidə, saat ikidə
    t = t.replace(/(?:saat\s+)?(onda|ikidə|üçdə|dörddə|beşdə|altıda|yeddida|səkkizdə|doqquzda|on bir də|on iki də|bir|iki|üç|dörd|beş|altı|yeddi|səkkiz|doqquz|on)(?:\s*[-–]?(?:da|də|de|ta|tə)(?!\p{L}))?/giu, ' ');

    // Normalize specific possessive nouns to base forms
    t = t.replace(/\biclasım\b/gi, 'iclas');
    t = t.replace(/\biclasim\b/gi, 'iclas');
    t = t.replace(/\bgörüşüm\b/gi, 'görüş');
    t = t.replace(/\bgorusum\b/gi, 'görüş');
    t = t.replace(/\bdərsim\b/gi, 'dərs');
    t = t.replace(/\bdersim\b/gi, 'dərs');

    // Strip out auxiliary command suffixes, creation verbs and temporal prepositions
    t = t.replace(/\b(xatırlat|xatirlat|xatırlatsın|xatirlatsin|xatırlatmaq|xatirlatmaq|yadıma sal|yadima sal|yadına sal|yadina sal|yada sal|unutma|əlavə et|elave et|əlavə elə|elave ele|yarat|qeyd et|qeyd elə|planlaşdır|planlasdir|yaz)\b/gi, ' ');
    t = t.replace(/\b(etməyi|etmeyi|aparmağı|aparmagi|içməyi|icmeyi|alması|almasi|öyrənməyi|yoxlamağı|zəng etməyi|zeng etmeyi)\b/gi, ' ');
    t = t.replace(/\b(sabah|birigün|biri gün|bu gün|bugün|bu axşam|sabah səhər|sabah axşam|günorta|axşam|axsam|səhər|seher)\b/gi, ' ');
    t = t.replace(/\b(zəhmət olmasa|lütfən|mənim üçün|mənə|var|olsun|olacaq|etməliyəm|etmeliyem|lazımdır|lazimdir)\b/gi, ' ');

    t = t.replace(/[-–,.;:!?]+/g, ' ').replace(/\s+/g, ' ').trim();

    // Capitalize first letter with Azerbaijani locale
    if (t.length > 0) {
      t = t.charAt(0).toLocaleUpperCase('az-AZ') + t.slice(1);
    }

    return t;
  }

  private inferCategory(title: string): ReminderCategory {
    const l = normalizeAz(title);
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
   * Executes the AI Path (OpenAI backend) with fallback if needed.
   */
  private async executeAiPath(
    cleanPrompt: string,
    currentReminders: Reminder[],
    startTime: number,
    aiReason: string,
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
            reason: aiReason,
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
        } else if (actionPayload.action === 'create_reminder' || actionPayload.action === 'create_multiple_reminders') {
          if (actionPayload.remindersToCreate && actionPayload.remindersToCreate.length > 0) {
            const conflicts = conflictDetector.detectConflicts(actionPayload.remindersToCreate, currentReminders);
            if (conflicts.length > 0) {
              actionPayload.hasConflict = true;
              actionPayload.conflicts = conflicts;
              actionPayload.needsConfirmation = true;
              actionPayload.responseMessage = `${conflicts[0].message} Yenə də əlavə edilsin?`;
            }
          }

          if (executeDirectly && !actionPayload.hasConflict) {
            const execResult = reminderService.executeAIAction(actionPayload);
            if (execResult.affectedReminders) {
              affectedReminders = execResult.affectedReminders;
            }
            if (execResult.message && !actionPayload.responseMessage) {
              actionPayload.responseMessage = execResult.message;
            }
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
        console.log(
          `[VOICE-FLOW] router result: ${actionPayload.action}, source=ai_path, reminders=${actionPayload.remindersToCreate?.length || 0}`
        );

        return {
          source: 'ai_path',
          intent: actionPayload.action,
          confidence: 0.95,
          confidenceTier: 'high',
          requiresAi: true,
          requiresGemini: false,
          actionPayload,
          executionTimeMs: execTime,
          reason: aiReason,
          affectedReminders,
        };
      }
      throw new Error(response.error || 'AI cavab verə bilmədi');
    } catch (err: any) {
      console.warn(`[ROUTER] fallback activated: AI backend error (${err.message}). Falling back to deterministic handler.`);

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
        requiresAi: false,
        requiresGemini: false,
        actionPayload: {
          ...fallbackEval.payload,
          responseMessage: fallbackEval.payload.responseMessage ||
            'Xidmət hazırda məşğuldur, sorğunuz ehtiyat qaydalarla icra edildi.',
        },
        executionTimeMs: execTime,
        reason: `AI backend unavailable (${err.message}); deterministic fallback executed.`,
      };
    }
  }

  /**
   * Backward-compatible delegation for executeGeminiPath.
   */
  private async executeGeminiPath(
    cleanPrompt: string,
    currentReminders: Reminder[],
    startTime: number,
    reason: string,
    executeDirectly?: boolean
  ): Promise<RouterResult> {
    return this.executeAiPath(cleanPrompt, currentReminders, startTime, reason, executeDirectly);
  }
}

export const intelligentRouter = new IntelligentRouter();
