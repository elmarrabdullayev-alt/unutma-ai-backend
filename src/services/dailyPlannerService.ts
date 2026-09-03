import {
  Reminder,
  PlanTask,
  DailyPlanProposal,
  ReminderCategory,
  ReminderPriority,
  ExtractedReminderDraft,
} from '../types';
import { reminderService } from './reminderService';
import { apiClient } from './apiClient';
import { isReminderToday, formatTimeOnly } from '../utils/dateUtils';

export class DailyPlannerService {
  /**
   * Detects if the prompt is an explicit request or sentence to plan the day.
   */
  public isDailyPlanningIntent(text: string): boolean {
    const l = text.toLowerCase().trim();
    if (
      /(günümü planla|bu günümü planla|bugünümü planla|günlük plan|günümü təşkil et|günümü qur|bu günüm üçün plan)/i.test(
        l
      )
    ) {
      return true;
    }

    // Compound daily tasks listing pattern: e.g. "Bu gün ... görüşüm var, ... bitirməliyəm, ... və ... istəyirəm"
    const hasTodayOrDaily = /(bu gün|bugün|gün ərzində)/i.test(l);
    const hasMultipleActions =
      (l.includes('və') || l.includes(',')) &&
      /(görüş|iclas|hesabat|market|idman|zəng|dərs|həkim|təmizlik|aptek)/i.test(l) &&
      /(bitirməli|etməli|getməli|almalı|lazımdır|istəyirəm|var)/i.test(l);

    return hasTodayOrDaily && hasMultipleActions;
  }

  /**
   * Main entry point to generate a proposed daily plan without creating reminders.
   */
  public async planDay(
    input: string,
    existingReminders: Reminder[] = reminderService.getAll()
  ): Promise<DailyPlanProposal> {
    const cleanInput = input.trim();
    const todayReminders = existingReminders.filter(
      (r) => isReminderToday(r) && !r.isCompleted
    );

    // 1. Try deterministic fast local parser
    const localProposal = this.parseLocally(cleanInput, todayReminders);

    if (localProposal && localProposal.tasks.length >= 2) {
      console.log('[DailyPlanner] Handled via local deterministic scheduler');
      return this.detectAndResolveConflicts(localProposal, todayReminders);
    }

    // 2. If ambiguous or local extraction found <2 items, call Gemini via existing /api/ai-action
    try {
      console.log('[DailyPlanner] Calling Gemini path via /api/ai-action');
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Baku';
      const nowISO = new Date().toISOString();

      const aiResponse = await apiClient.executeAiAction(
        `Bu günümü planla: "${cleanInput}"`,
        existingReminders,
        nowISO,
        timezone
      );

      if (aiResponse.success && aiResponse.actionPayload) {
        const payload = aiResponse.actionPayload;

        // Check if Gemini returned structured dailyPlanProposal or remindersToCreate
        if (payload.dailyPlanProposal && payload.dailyPlanProposal.tasks.length > 0) {
          return this.detectAndResolveConflicts(payload.dailyPlanProposal, todayReminders);
        }

        if (payload.remindersToCreate && payload.remindersToCreate.length > 0) {
          const tasksFromAi = this.convertDraftsToPlanTasks(
            payload.remindersToCreate,
            cleanInput
          );
          const proposal: DailyPlanProposal = {
            id: `plan-${Date.now()}`,
            rawInput: cleanInput,
            createdAt: new Date().toISOString(),
            targetDate: new Date().toISOString().slice(0, 10),
            tasks: tasksFromAi,
            summaryNote: payload.responseMessage,
          };
          return this.detectAndResolveConflicts(proposal, todayReminders);
        }
      }
    } catch (err) {
      console.warn('[DailyPlanner] Gemini path error, falling back to local heuristic:', err);
    }

    // Fallback: If AI fails or returns empty, build best-effort local plan
    const fallback = this.buildFallbackPlan(cleanInput, todayReminders);
    return this.detectAndResolveConflicts(fallback, todayReminders);
  }

  /**
   * Deterministic local parser for natural Azerbaijani daily task descriptions.
   */
  public parseLocally(
    input: string,
    existingReminders: Reminder[]
  ): DailyPlanProposal | null {
    const rawClauses = this.splitIntoClauses(input);
    if (rawClauses.length === 0) return null;

    const parsedTasks: Array<{
      title: string;
      fixedTime?: string; // "14:00"
      durationMinutes?: number;
      category: ReminderCategory;
      priority: ReminderPriority;
      isFocusReady: boolean;
      timeWindowPreference: 'morning' | 'afternoon' | 'evening' | 'late_afternoon';
    }> = [];

    for (const clause of rawClauses) {
      const parsed = this.parseClause(clause);
      if (parsed) {
        parsedTasks.push(parsed);
      }
    }

    if (parsedTasks.length === 0) return null;

    // Slot Allocation Algorithm
    const allocatedTasks = this.allocateSlots(parsedTasks, existingReminders);

    return {
      id: `plan-${Date.now()}`,
      rawInput: input,
      createdAt: new Date().toISOString(),
      targetDate: new Date().toISOString().slice(0, 10),
      tasks: allocatedTasks,
    };
  }

  /**
   * Splits input text into discrete action clauses.
   */
  private splitIntoClauses(input: string): string[] {
    let clean = input
      .replace(/^(bu günümü planla|günümü planla|bu günüm üçün plan tərtib et)[:,\s]*/i, '')
      .trim();

    // Split on commas, "və", semicolons, newlines, "ardınca", "sonra"
    const rawParts = clean
      .split(/(?:,|\bvə\b|;|\n|\bardınca\b|\bsonra\b)+/i)
      .map((p) => p.trim())
      .filter((p) => p.length > 2);

    return rawParts;
  }

  /**
   * Parses an individual task clause.
   */
  private parseClause(clause: string): {
    title: string;
    fixedTime?: string;
    durationMinutes?: number;
    category: ReminderCategory;
    priority: ReminderPriority;
    isFocusReady: boolean;
    timeWindowPreference: 'morning' | 'afternoon' | 'evening' | 'late_afternoon';
  } | null {
    const l = clause.toLowerCase();

    // 1. Duration extraction
    let durationMinutes: number | undefined;
    const durMatch = l.match(/(\d+)\s*(?:dəqiqə|deqiqe|dəq|deq)/i);
    if (durMatch) {
      durationMinutes = parseInt(durMatch[1], 10);
    } else if (/yarım\s*saat/i.test(l)) {
      durationMinutes = 30;
    } else if (/(\d+)\s*saat/i.test(l)) {
      const hMatch = l.match(/(\d+)\s*saat/i);
      durationMinutes = hMatch ? parseInt(hMatch[1], 10) * 60 : 60;
    }

    // 2. Fixed time extraction (e.g. "saat 2-də", "saat 14:00-da", "15:30-da")
    let fixedTime: string | undefined;
    const timeMatch1 = l.match(/saat\s*(\d{1,2})(?::(\d{2}))?[-–]?(?:də|da|ya|yə|a|ə)?/i);
    const timeMatch2 = l.match(/(\d{1,2}):(\d{2})[-–]?(?:də|da|ya|yə)?/i);

    if (timeMatch2) {
      const hh = parseInt(timeMatch2[1], 10);
      const mm = parseInt(timeMatch2[2], 10);
      fixedTime = `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
    } else if (timeMatch1) {
      let hh = parseInt(timeMatch1[1], 10);
      const mm = timeMatch1[2] ? parseInt(timeMatch1[2], 10) : 0;
      // Convert 12h colloquial e.g. "saat 2-də" -> 14:00 if daytime/görüş, "saat 7-də" -> 19:00
      if (hh <= 6 && !l.includes('gecə') && !l.includes('səhər')) {
        hh += 12; // 2 -> 14:00
      } else if (hh >= 7 && hh <= 11 && l.includes('axşam')) {
        hh += 12;
      }
      fixedTime = `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
    }

    // 3. Category & Focus determination
    let category: ReminderCategory = 'other';
    let isFocusReady = false;
    let priority: ReminderPriority = 'medium';
    let timeWindowPreference: 'morning' | 'afternoon' | 'evening' | 'late_afternoon' = 'morning';

    if (/(hesabat|kod|proqram|təhlil|analiz|yazmalıyam|məqalə|layihə|oxumaq)/i.test(l)) {
      category = 'work';
      isFocusReady = true;
      priority = 'high';
      timeWindowPreference = 'morning';
      if (!durationMinutes) durationMinutes = 45;
    } else if (/(görüş|iclas|müştəri|danışıq|müzakirə)/i.test(l)) {
      category = 'work';
      priority = 'high';
      timeWindowPreference = 'afternoon';
      if (!durationMinutes) durationMinutes = 60;
    } else if (/(market|mağaza|alış-veriş|ərzaq|aptek)/i.test(l)) {
      category = 'shopping';
      priority = 'medium';
      timeWindowPreference = 'late_afternoon';
      if (!durationMinutes) durationMinutes = 30;
    } else if (/(idman|məşq|qaçış|fitnes|yoga|gəzinti)/i.test(l)) {
      category = 'health';
      priority = 'medium';
      timeWindowPreference = 'evening';
      if (!durationMinutes) durationMinutes = 30;
    } else if (/(həkim|dərman|analiz|xəstəxana)/i.test(l)) {
      category = 'health';
      priority = 'high';
      timeWindowPreference = 'afternoon';
      if (!durationMinutes) durationMinutes = 45;
    } else if (/(zəng|əlaqə|mesaj|valideyn|dost)/i.test(l)) {
      category = 'personal';
      priority = 'medium';
      timeWindowPreference = 'afternoon';
      if (!durationMinutes) durationMinutes = 20;
    }

    // 4. Clean human-readable title formatting
    const cleanTitle = this.formatTaskTitle(clause, isFocusReady, durationMinutes);
    if (!cleanTitle) return null;

    return {
      title: cleanTitle,
      fixedTime,
      durationMinutes,
      category,
      priority,
      isFocusReady,
      timeWindowPreference,
    };
  }

  /**
   * Nicely cleans up Azerbaijani task descriptions into display titles.
   * e.g. "hesabatı bitirməliyəm" -> "Hesabat üzərində fokus"
   * e.g. "30 dəqiqə idman etmək istəyirəm" -> "30 dəqiqə idman"
   * e.g. "saat 2-də görüşüm var" -> "Görüş"
   */
  private formatTaskTitle(
    clause: string,
    isFocusReady: boolean,
    durationMinutes?: number
  ): string {
    const l = clause.toLowerCase().trim();

    if (/(hesabat|hesabatı bitir)/i.test(l)) {
      return 'Hesabat üzərində fokus';
    }
    if (/(görüşüm var|görüş)/i.test(l)) {
      return 'Görüş';
    }
    if (/(marketə getməliyəm|market|ərzaq al)/i.test(l)) {
      return 'Market';
    }
    if (/(idman|məşq)/i.test(l)) {
      if (durationMinutes) {
        return `${durationMinutes} dəqiqə idman`;
      }
      return 'İdman';
    }

    // Generic cleanup
    let title = clause
      .replace(/bu gün\s*/gi, '')
      .replace(/saat\s*\d{1,2}(?::\d{2})?[-–]?(?:də|da|ya|yə|a|ə)?/gi, '')
      .replace(/\d{1,2}:\d{2}[-–]?(?:də|da|ya|yə)?/gi, '')
      .replace(/(?:etmək\s*istəyirəm|etməliyəm|getməliyəm|almalıyam|bitirməliyəm|var|lazımdır)/gi, '')
      .trim();

    title = title.replace(/^[,.\s-]+|[,.\s-]+$/g, '').trim();

    if (!title) {
      title = isFocusReady ? 'Fokus tapşırığı' : 'Günün tapşırığı';
    }

    // Capitalize first letter
    return title.charAt(0).toUpperCase() + title.slice(1);
  }

  /**
   * Allocates conflict-free, energy-aligned time slots for parsed tasks.
   */
  private allocateSlots(
    items: Array<{
      title: string;
      fixedTime?: string;
      durationMinutes?: number;
      category: ReminderCategory;
      priority: ReminderPriority;
      isFocusReady: boolean;
      timeWindowPreference: 'morning' | 'afternoon' | 'evening' | 'late_afternoon';
    }>,
    existingReminders: Reminder[]
  ): PlanTask[] {
    const now = new Date();
    const todayYMD = now.toISOString().slice(0, 10);

    // Baseline window slots in hours/mins
    const defaultSlots: Record<string, string[]> = {
      morning: ['09:30', '10:30', '11:30'],
      afternoon: ['14:00', '15:00', '16:00'],
      late_afternoon: ['17:30', '18:00', '18:30'],
      evening: ['19:00', '19:30', '20:00', '20:30'],
    };

    const takenTimes = new Set<string>();

    // 1. Mark existing reminders for today as occupied
    existingReminders.forEach((r) => {
      const timeStr = formatTimeOnly(r.dueDateTime);
      if (timeStr) takenTimes.add(timeStr);
    });

    const resultTasks: PlanTask[] = [];

    // Separate fixed vs flexible
    const fixedItems = items.filter((it) => !!it.fixedTime);
    const flexibleItems = items.filter((it) => !it.fixedTime);

    // Place fixed items first
    for (const it of fixedItems) {
      const timeStr = it.fixedTime!;
      const dueDateTime = `${todayYMD}T${timeStr}:00.000Z`;

      resultTasks.push({
        id: `plan-task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: it.title,
        dueDateTime,
        timeString: timeStr,
        durationMinutes: it.durationMinutes,
        priority: it.priority,
        category: it.category,
        isFixedTime: true,
        isFocusReady: it.isFocusReady,
      });

      takenTimes.add(timeStr);
    }

    // Place flexible items in their preferred windows
    for (const it of flexibleItems) {
      const prefList = defaultSlots[it.timeWindowPreference] || defaultSlots.morning;
      let chosenTime: string | null = null;

      // Find first untaken slot in preferred window
      for (const slot of prefList) {
        if (!takenTimes.has(slot)) {
          chosenTime = slot;
          break;
        }
      }

      // If preferred is full, try any reasonable slot between 09:00 and 21:00
      if (!chosenTime) {
        const allPossible = [
          '09:30', '10:30', '11:30', '13:30', '14:30', '15:30',
          '16:30', '17:30', '18:30', '19:00', '20:00', '20:30',
        ];
        for (const slot of allPossible) {
          if (!takenTimes.has(slot)) {
            chosenTime = slot;
            break;
          }
        }
      }

      // Final fallback
      if (!chosenTime) {
        chosenTime = '16:00';
      }

      takenTimes.add(chosenTime);
      const dueDateTime = `${todayYMD}T${chosenTime}:00.000Z`;

      resultTasks.push({
        id: `plan-task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: it.title,
        dueDateTime,
        timeString: chosenTime,
        durationMinutes: it.durationMinutes,
        priority: it.priority,
        category: it.category,
        isFixedTime: false,
        isFocusReady: it.isFocusReady,
      });
    }

    // Chronologically sort all tasks by timeString
    return resultTasks.sort((a, b) => a.timeString.localeCompare(b.timeString));
  }

  /**
   * Detects conflicts with existing reminders and suggests alternative slots.
   */
  public detectAndResolveConflicts(
    proposal: DailyPlanProposal,
    existingReminders: Reminder[]
  ): DailyPlanProposal {
    const todayReminders = existingReminders.filter(
      (r) => isReminderToday(r) && !r.isCompleted
    );

    const updatedTasks: PlanTask[] = proposal.tasks.map((task) => {
      const taskTimeParts = task.timeString.split(':').map(Number);
      const taskMinutes = taskTimeParts[0] * 60 + (taskTimeParts[1] || 0);

      // Check if any existing reminder falls within 30 minutes
      const conflictingReminder = todayReminders.find((r) => {
        const rTimeStr = formatTimeOnly(r.dueDateTime);
        if (!rTimeStr) return false;
        const [rh, rm] = rTimeStr.split(':').map(Number);
        const rMinutes = rh * 60 + rm;
        return Math.abs(taskMinutes - rMinutes) < 30;
      });

      if (conflictingReminder) {
        const altTime = this.findFreeSlot(
          taskMinutes,
          todayReminders,
          proposal.tasks.filter((t) => t.id !== task.id)
        );
        const todayYMD = new Date().toISOString().slice(0, 10);

        return {
          ...task,
          hasConflict: true,
          conflictReason: `Bu saatda artıq planın var: "${conflictingReminder.title}" (${formatTimeOnly(
            conflictingReminder.dueDateTime
          )})`,
          suggestedAlternativeTime: altTime,
          suggestedAlternativeDueDateTime: `${todayYMD}T${altTime}:00.000Z`,
        };
      }

      return {
        ...task,
        hasConflict: false,
        conflictReason: undefined,
        suggestedAlternativeTime: undefined,
        suggestedAlternativeDueDateTime: undefined,
      };
    });

    return {
      ...proposal,
      tasks: updatedTasks.sort((a, b) => a.timeString.localeCompare(b.timeString)),
    };
  }

  /**
   * Finds the nearest open time slot avoiding all existing reminders and planned tasks.
   */
  private findFreeSlot(
    targetMinutes: number,
    existingReminders: Reminder[],
    otherTasks: PlanTask[]
  ): string {
    const candidateSlots = [
      '09:30', '10:30', '11:30', '13:30', '14:30', '15:30',
      '16:30', '17:30', '18:30', '19:30', '20:30',
    ];

    const busyMinutes: number[] = [];

    existingReminders.forEach((r) => {
      const s = formatTimeOnly(r.dueDateTime);
      if (s) {
        const [h, m] = s.split(':').map(Number);
        busyMinutes.push(h * 60 + m);
      }
    });

    otherTasks.forEach((t) => {
      if (t.timeString) {
        const [h, m] = t.timeString.split(':').map(Number);
        busyMinutes.push(h * 60 + m);
      }
    });

    // Sort candidate slots by distance to targetMinutes (preferably after targetMinutes)
    const sorted = [...candidateSlots].sort((a, b) => {
      const [ah, am] = a.split(':').map(Number);
      const [bh, bm] = b.split(':').map(Number);
      const diffA = ah * 60 + am - targetMinutes;
      const diffB = bh * 60 + bm - targetMinutes;

      // Prefer future slots over past slots
      const scoreA = diffA >= 0 ? diffA : Math.abs(diffA) + 500;
      const scoreB = diffB >= 0 ? diffB : Math.abs(diffB) + 500;
      return scoreA - scoreB;
    });

    for (const slot of sorted) {
      const [h, m] = slot.split(':').map(Number);
      const slotMins = h * 60 + m;
      const isColliding = busyMinutes.some((b) => Math.abs(b - slotMins) < 40);
      if (!isColliding) {
        return slot;
      }
    }

    return '16:30';
  }

  /**
   * Converts ExtractedReminderDraft array from AI into PlanTasks.
   */
  private convertDraftsToPlanTasks(
    drafts: ExtractedReminderDraft[],
    rawInput: string
  ): PlanTask[] {
    return drafts.map((d, idx) => {
      const timeStr = formatTimeOnly(d.dueDateTime) || '10:00';
      const isFocus = /(hesabat|kod|analiz|dərs|məqalə)/i.test(d.title);
      return {
        id: `plan-task-${Date.now()}-${idx}`,
        title: d.title,
        dueDateTime: d.dueDateTime,
        timeString: timeStr,
        priority: d.priority || 'medium',
        category: d.category || 'other',
        isFixedTime: !d.inferredTime,
        isFocusReady: isFocus,
        durationMinutes: isFocus ? 45 : 30,
      };
    });
  }

  /**
   * Fallback plan generator when both AI and local parsing yield minimal tasks.
   */
  private buildFallbackPlan(
    input: string,
    existingReminders: Reminder[]
  ): DailyPlanProposal {
    const todayYMD = new Date().toISOString().slice(0, 10);
    const tasks: PlanTask[] = [
      {
        id: `plan-fallback-1`,
        title: 'Fokus və iş tapşırığı',
        timeString: '10:00',
        dueDateTime: `${todayYMD}T10:00:00.000Z`,
        durationMinutes: 45,
        priority: 'high',
        category: 'work',
        isFixedTime: false,
        isFocusReady: true,
      },
      {
        id: `plan-fallback-2`,
        title: input.slice(0, 40) || 'Günün əsas tapşırığı',
        timeString: '15:00',
        dueDateTime: `${todayYMD}T15:00:00.000Z`,
        durationMinutes: 30,
        priority: 'medium',
        category: 'personal',
        isFixedTime: false,
      },
    ];

    return {
      id: `plan-${Date.now()}`,
      rawInput: input,
      createdAt: new Date().toISOString(),
      targetDate: todayYMD,
      tasks,
    };
  }

  /**
   * Applies the suggested alternative slot to a conflicted task.
   */
  public applyAlternativeSlot(task: PlanTask): PlanTask {
    if (!task.suggestedAlternativeTime) return task;
    const todayYMD = new Date().toISOString().slice(0, 10);
    const newTimeString = task.suggestedAlternativeTime;
    const newDueDateTime = `${todayYMD}T${newTimeString}:00.000Z`;

    return {
      ...task,
      timeString: newTimeString,
      dueDateTime: newDueDateTime,
      hasConflict: false,
      conflictReason: undefined,
      suggestedAlternativeTime: undefined,
      suggestedAlternativeDueDateTime: undefined,
    };
  }

  /**
   * Changes task time manually and updates dueDateTime.
   */
  public updateTaskTime(task: PlanTask, newTimeString: string): PlanTask {
    const todayYMD = new Date().toISOString().slice(0, 10);
    const newDueDateTime = `${todayYMD}T${newTimeString}:00.000Z`;

    return {
      ...task,
      timeString: newTimeString,
      dueDateTime: newDueDateTime,
      hasConflict: false,
      conflictReason: undefined,
    };
  }

  /**
   * Confirms the plan: creates reminders via reminderService and schedules notifications.
   * Does NOT overwrite existing reminders.
   */
  public confirmPlan(proposal: DailyPlanProposal): Reminder[] {
    const drafts: ExtractedReminderDraft[] = proposal.tasks.map((task) => {
      // Form description
      const descParts: string[] = [];
      if (task.durationMinutes) {
        descParts.push(`Müddət: ${task.durationMinutes} dəqiqə`);
      }
      if (task.isFocusReady) {
        descParts.push('Fokus sessiyası üçün uyğundur');
      }

      return {
        id: `plan-rem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: task.title,
        description: descParts.join(' • '),
        dueDateTime: task.dueDateTime,
        category: task.category,
        recurrence: 'none',
        priority: task.priority,
        notificationEnabled: true,
        inferredTime: !task.isFixedTime,
        timeConfidence: task.isFixedTime ? 'exact' : 'inferred',
      };
    });

    const createdReminders = reminderService.createMultipleReminders(drafts);
    console.log(`[DailyPlanner] Confirmed plan: created ${createdReminders.length} reminders.`);
    return createdReminders;
  }
}

export const dailyPlannerService = new DailyPlannerService();
