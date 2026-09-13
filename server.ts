import express from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import WebSocket, { WebSocketServer } from "ws";
import { transcribeWithOpenAI } from "./src/server/openaiAudio";
import {
  callOpenAIChatCompletion,
  PREFERRED_OPENAI_TEXT_MODEL,
  STABLE_OPENAI_TEXT_MODEL,
} from "./src/server/openaiText";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Mobile & Cross-Origin Resource Sharing (CORS) Middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, User-Agent"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Public health check endpoints
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "unutma-ai-api" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "unutma-ai-api" });
});

// Helper to post-process Azerbaijani custom recurrence patterns
function normalizeAzerbaijaniRecurrence(prompt: string, reminderItem: any): void {
  const norm = (prompt || "").toLowerCase();

  // Custom days: "hər 3 gündən bir", "hər 2 gunden bir"
  const dayMatch = norm.match(
    /hər\s+(\d+|bir|iki|üç|uc|dörd|dord|beş|bes|altı|alti|yeddi|səkkiz|sekkiz|doqquz|on)\s+(?:gündən|gunden)\s+bir/i
  );
  if (dayMatch) {
    const numMap: Record<string, number> = {
      bir: 1, iki: 2, üç: 3, uc: 3, dörd: 4, dord: 4,
      beş: 5, bes: 5, altı: 6, alti: 6, yeddi: 7,
      səkkiz: 8, sekkiz: 8, doqquz: 9, on: 10,
    };
    const rawVal = dayMatch[1].toLowerCase();
    const interval = /^\d+$/.test(rawVal) ? parseInt(rawVal, 10) : numMap[rawVal] || 1;
    reminderItem.recurrence = "custom";
    reminderItem.recurrenceInterval = interval;
    reminderItem.recurrenceUnit = "day";
    return;
  }

  // Custom weeks: "hər 2 həftədən bir"
  const weekMatch = norm.match(
    /hər\s+(\d+|bir|iki|üç|uc|dörd|dord|beş|bes|altı|alti|yeddi|səkkiz|sekkiz|doqquz|on)\s+(?:həftədən|hefteden)\s+bir/i
  );
  if (weekMatch) {
    const numMap: Record<string, number> = {
      bir: 1, iki: 2, üç: 3, uc: 3, dörd: 4, dord: 4,
      beş: 5, bes: 5, altı: 6, alti: 6, yeddi: 7,
      səkkiz: 8, sekkiz: 8, doqquz: 9, on: 10,
    };
    const rawVal = weekMatch[1].toLowerCase();
    const interval = /^\d+$/.test(rawVal) ? parseInt(rawVal, 10) : numMap[rawVal] || 1;
    reminderItem.recurrence = "custom";
    reminderItem.recurrenceInterval = interval;
    reminderItem.recurrenceUnit = "week";
    return;
  }

  // Monthly on day X: "hər ayın 15-i", "hər ayın 5-i"
  const monthDayMatch = norm.match(/hər\s+ayın\s+(\d+)(?:-i|-si|-ı|-sı|-üncü|-uncu|-in)?/i);
  if (monthDayMatch) {
    reminderItem.recurrence = "monthly";
    reminderItem.recurrenceDayOfMonth = parseInt(monthDayMatch[1], 10);
    return;
  }
}

/**
 * Normalizes dueDateTime to ensure that the time in the user's timezone matches
 * the user's intended explicit hour and dayparts (e.g. 18:00, "səhər 10", "günorta 2", "axşam 10", "gecə 1").
 * Prevents the UTC offset mutation (e.g. 18:00 UTC becoming 22:00 in Asia/Baku).
 */
export function normalizeDueDateTimeForTimezone(
  dueDateTime: string,
  text: string,
  timezone: string
): string {
  if (!dueDateTime) return dueDateTime;

  const lower = text.toLowerCase();

  // 1. Detect explicit hour and daypart intentions from text
  let targetHour: number | null = null;
  let targetMinute: number = 0;

  const morningMatch = lower.match(/(?:səhər|seher)\s+(?:saat\s+)?(\d{1,2})(?::(\d{2}))?/i);
  const afternoonMatch = lower.match(/(?:günorta|gunorta|nahar)\s+(?:saat\s+)?(\d{1,2})(?::(\d{2}))?/i);
  const eveningMatch = lower.match(/(?:axşam|axsam|axşamüstü|axsamustu)\s+(?:saat\s+)?(\d{1,2})(?::(\d{2}))?/i);
  const nightMatch = lower.match(/(?:gecə|gece)\s+(?:saat\s+)?(\d{1,2})(?::(\d{2}))?/i);

  const exactHourMatch = lower.match(/(?:saat\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:-|–)?\s*(?:da|də|de|ta|tə|yə|a|e|dək)?/i);

  if (morningMatch && morningMatch[1]) {
    const h = parseInt(morningMatch[1], 10);
    targetHour = h <= 12 ? h : h - 12;
    targetMinute = morningMatch[2] ? parseInt(morningMatch[2], 10) : 0;
  } else if (afternoonMatch && afternoonMatch[1]) {
    const h = parseInt(afternoonMatch[1], 10);
    targetHour = h >= 1 && h <= 6 ? h + 12 : (h === 12 ? 12 : h);
    targetMinute = afternoonMatch[2] ? parseInt(afternoonMatch[2], 10) : 0;
  } else if (eveningMatch && eveningMatch[1]) {
    const h = parseInt(eveningMatch[1], 10);
    targetHour = h >= 1 && h <= 11 ? h + 12 : (h === 12 ? 0 : h);
    targetMinute = eveningMatch[2] ? parseInt(eveningMatch[2], 10) : 0;
  } else if (nightMatch && nightMatch[1]) {
    const h = parseInt(nightMatch[1], 10);
    targetHour = h >= 1 && h <= 6 ? h : (h === 12 ? 0 : (h === 11 ? 23 : h));
    targetMinute = nightMatch[2] ? parseInt(nightMatch[2], 10) : 0;
  } else if (
    exactHourMatch &&
    exactHourMatch[1] &&
    (lower.includes('saat') || exactHourMatch[0].includes('də') || exactHourMatch[0].includes('da') || exactHourMatch[2])
  ) {
    const h = parseInt(exactHourMatch[1], 10);
    if (h >= 0 && h <= 24) {
      targetHour = h;
      targetMinute = exactHourMatch[2] ? parseInt(exactHourMatch[2], 10) : 0;
      if (/axşam|axsam/i.test(lower) && targetHour >= 1 && targetHour <= 11) {
        targetHour += 12;
      } else if (/günorta|gunorta/i.test(lower) && targetHour >= 1 && targetHour <= 6) {
        targetHour += 12;
      } else if (/gecə|gece/i.test(lower) && targetHour >= 1 && targetHour <= 6) {
        // night 1-6 stays 1-6
      } else if (/səhər|seher/i.test(lower) && targetHour > 12) {
        targetHour -= 12;
      } else if (targetHour >= 1 && targetHour <= 6 && !/gecə|gece/i.test(lower)) {
        targetHour += 12;
      }
    }
  }

  // If no explicit target hour found, keep dueDateTime as is
  if (targetHour === null) {
    return dueDateTime;
  }

  // 2. Check what hour dueDateTime represents in the specified timezone
  const baseDate = new Date(dueDateTime);
  if (isNaN(baseDate.getTime())) return dueDateTime;

  try {
    const dtfTime = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const timeParts = dtfTime.formatToParts(baseDate);
    let hInTz = Number(timeParts.find((p) => p.type === 'hour')?.value || 0);
    if (hInTz === 24) hInTz = 0;
    const minInTz = Number(timeParts.find((p) => p.type === 'minute')?.value || 0);

    // If it already matches the target hour and minute in timezone, return as is
    if (hInTz === targetHour && minInTz === targetMinute) {
      return dueDateTime;
    }

    // Otherwise, calculate the exact UTC date that yields targetHour:targetMinute in timezone
    const dtfDate = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dateParts = dtfDate.formatToParts(baseDate);
    const y = dateParts.find((p) => p.type === 'year')?.value;
    const m = dateParts.find((p) => p.type === 'month')?.value;
    const d = dateParts.find((p) => p.type === 'day')?.value;

    if (!y || !m || !d) return dueDateTime;

    const guess = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), targetHour, targetMinute, 0));
    const guessParts = dtfTime.formatToParts(guess);
    let guessH = Number(guessParts.find((p) => p.type === 'hour')?.value || 0);
    if (guessH === 24) guessH = 0;
    const guessMin = Number(guessParts.find((p) => p.type === 'minute')?.value || 0);

    const diffMs = ((guessH * 60 + guessMin) - (targetHour * 60 + targetMinute)) * 60 * 1000;
    const corrected = new Date(guess.getTime() - diffMs);
    return corrected.toISOString();
  } catch (tzErr) {
    console.warn('[SERVER-TZ] Timezone adjustment warning:', tzErr);
    return dueDateTime;
  }
}

// =========================================================================
// API 1: PARSE VOICE/TEXT INTO STRUCTURED REMINDERS (OPENAI)
// =========================================================================
app.post("/api/parse-reminder", async (req, res) => {
  try {
    const text = req.body.text || req.body.prompt || req.body.userPrompt || req.body.message;
    const { userNowISO, userTimezone } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Mətn daxil edilməyib." });
    }

    const now = userNowISO ? new Date(userNowISO) : new Date();
    const timezone = userTimezone || "Asia/Baku";
    const userNowFormatted = now.toLocaleString("az-AZ", {
      timeZone: timezone,
      dateStyle: "full",
      timeStyle: "medium",
    });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey && req.headers["x-test-simulate-openai"] !== "mock_success") {
      return res.status(503).json({
        error: "ai_unavailable",
        message:
          "OPENAI_API_KEY mühit dəyişəni təyin edilməyib. Zəhmət olmasa Settings menyusunda OPENAI_API_KEY əlavə edin.",
      });
    }

    const systemPrompt = `Sən "Unutma AI" tətbiqinin Azərbaycan dili üçün dərin təbii dil analizi və xatırlatma mühərrikisən.
Hazırkı cari vaxt: ${userNowFormatted} (ISO: ${now.toISOString()}).
İstifadəçinin zaman qurşağı: ${timezone}.

ƏSAS QAYDALAR VƏ TƏLƏBLƏR:
1. ÇOXLU XATIRLATMA (MULTI-REMINDER) AYIRMA:
   İstifadəçinin dediyi mürəkkəb cümləni ayrı-ayrı müstəqil xatırlatmalara böl.
   Məsələn:
   "Sabah saat 10-da Anara zəng etməyi, günorta 2-də maşını ustaya aparmağı, axşam anamın dərmanını almağı xatırlat."
   -> Nəticədə 3 FƏRQLİ xatırlatma obyekti olmalıdır:
   1. Başlıq: "Anara zəng et", Vaxt: Sabah 10:00, Kateqoriya: 'work' və ya 'personal', inferredTime: false
   2. Başlıq: "Maşını ustaya apar", Vaxt: Sabah 14:00, Kateqoriya: 'personal', inferredTime: false
   3. Başlıq: "Anamın dərmanını al", Vaxt: Sabah 20:00 (axşam), Kateqoriya: 'health', inferredTime: true

2. AZƏRBAYCAN DİLİ ZAMAN ANLAYIŞLARI (DƏQİQ ÇEVİRMƏ):
   - "bu gün" -> Hazırkı gün (${now.toISOString().slice(0, 10)})
   - "sabah" -> Sabahkı gün (+1 gün)
   - "birigün" -> Birigün (+2 gün)
   - "səhər 10" / "səhər saat 10" -> 10:00 (səhər saatı)
   - "günorta 2" / "günorta saat 2" -> 14:00 (günorta saatı)
   - "axşam 10" / "axşam saat 10" -> 22:00 (axşam saatı)
   - "gecə 1" / "gecə saat 1" -> 01:00 (gecə saatı)
   - "bu axşam" -> Bu gün saat 20:00
   - "sabah səhər" -> Sabah saat 09:00 (inferredTime: true)
   - "sabah günorta" -> Sabah saat 13:00 / 14:00 (inferredTime: true)
   - "sabah axşam" -> Sabah saat 20:00 (inferredTime: true)
   - "gələn həftə" -> Növbəti həftənin bazar ertəsi (+7 gün)
   - "gələn bazar ertəsi" -> Növbəti həftənin Bazar ertəsi saat 09:00
   - "cümə günü" -> Yaxınlaşan Cümə günü
   - "ayın 15-i" -> Cari/növbəti ayın 15-i saat 10:00
   - "2 saat sonra" -> Cari vaxtdan dəqiq 2 saat sonra
   - "30 dəqiqə sonra" -> Cari vaxtdan 30 dəqiqə sonra

3. ZAMANIN İNFƏR EDİLMƏSİ (inferredTime):
   - Əgər istifadəçi "saat 10-da" və ya "14:00-da" kimi dəqiq saat dedisə: inferredTime = false, timeConfidence = "exact".
   - Əgər "axşam", "səhər", "günorta" kimi qeyri-dəqiq ifadə işlətdisə: inferredTime = true, timeConfidence = "inferred".
   - Əgər saat heç deyilməyibsə (məs. "Sabah Anarla görüş"): inferredTime = true, timeConfidence = "inferred" (məsələn, sabah 10:00 qoy).

4. TƏKRARLANMA (Recurrence):
   - "hər gün" -> 'daily'
   - "hər həftə" / "hər bazar ertəsi" -> 'weekly'
   - "hər ay" / "hər ayın 5-i" -> 'monthly'
   - "hər il" -> 'yearly'
   - "həftəiçi" -> 'weekdays'
   - "hər 3 gündən bir" -> 'custom', recurrenceInterval: 3, recurrenceUnit: 'day'
   - "hər 2 həftədən bir" -> 'custom', recurrenceInterval: 2, recurrenceUnit: 'week'
   - digər hallar -> 'none'

5. KATEQORİYA (Category):
   'health', 'work', 'finance', 'personal', 'shopping', 'education', 'home', 'other'.

6. MÜTLƏQ YALNIZ AŞAĞIDAKI JSON FORMATINDA CAVAB VER:
{
  "summary": "Azərbaycan dilində qısa və aydın xülasə",
  "reminders": [
    {
      "title": "Xatırlatmanın lakonik başlığı",
      "description": "Əlavə qeydlər",
      "dueDateTime": "ISO 8601 UTC formatında tarix və vaxt",
      "category": "work",
      "recurrence": "none",
      "priority": "medium",
      "inferredTime": false,
      "timeConfidence": "exact"
    }
  ]
}`;

    const completion = await callOpenAIChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `İstifadəçinin mətni: "${text}"` },
      ],
      temperature: 0.1,
      responseFormat: { type: "json_object" },
      apiKey,
      tag: "PARSE-REMINDER",
    });

    const parsed = JSON.parse(completion.content || "{}");
    const rawReminders = Array.isArray(parsed.reminders) ? parsed.reminders : [];

    const reminders = rawReminders.map((item: any, idx: number) => {
      const rawDue = item.dueDateTime || new Date(now.getTime() + 3600000).toISOString();
      const normalizedDue = normalizeDueDateTimeForTimezone(rawDue, text, timezone);
      const mapped = {
        id: `extracted-${Date.now()}-${idx}`,
        title: item.title || text,
        description: item.description || "",
        dueDateTime: normalizedDue,
        category: item.category || "other",
        recurrence: item.recurrence || "none",
        priority: item.priority || "medium",
        inferredTime: Boolean(item.inferredTime || item.timeConfidence === "inferred"),
        timeConfidence: item.timeConfidence || (item.inferredTime ? "inferred" : "exact"),
      };
      normalizeAzerbaijaniRecurrence(text, mapped);
      return mapped;
    });

    return res.json({
      success: true,
      summary: parsed.summary || `${reminders.length} xatırlatma tapıldı.`,
      reminders,
    });
  } catch (error: any) {
    console.error("Error in parse-reminder:", error);
    return res.status(500).json({
      error: "Xatırlatmanın analizi zamanı xəta baş verdi: " + (error?.message || "Bilinməyən xəta"),
    });
  }
});

// =========================================================================
// API 2: STRUCTURED AI ACTION ENGINE (OPENAI ONLY)
// =========================================================================
app.post("/api/ai-action", async (req, res) => {
  console.log("[AI-ACTION] request received");
  console.log("[AI-ACTION] provider: OpenAI");

  try {
    const userPrompt = req.body.userPrompt || req.body.prompt || req.body.text || req.body.command;
    const { reminders, userNowISO, userTimezone } = req.body;

    if (!userPrompt) {
      return res.status(400).json({ error: "Əmr və ya sual daxil edilməyib." });
    }

    const simulateOpenAI = req.headers["x-test-simulate-openai"] || req.body.__testSimulateOpenAI;
    if (simulateOpenAI === "missing_key") {
      console.log("[AI-ACTION] OPENAI_API_KEY is not configured (simulated)");
      return res.status(503).json({
        error: "ai_unavailable",
        message:
          "OPENAI_API_KEY mühit dəyişəni təyin edilməyib. Zəhmət olmasa Settings menyusunda OPENAI_API_KEY əlavə edin.",
      });
    }

    if (simulateOpenAI === "503") {
      console.log("[AI-ACTION] OpenAI API error (status 503): Service Unavailable (simulated)");
      return res.status(503).json({
        error: "ai_unavailable",
        message: "OpenAI xidməti hazırda əlçatan deyil.",
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey && simulateOpenAI !== "mock_success") {
      console.log("[AI-ACTION] OPENAI_API_KEY is not configured");
      return res.status(503).json({
        error: "ai_unavailable",
        message:
          "OPENAI_API_KEY mühit dəyişəni təyin edilməyib. Zəhmət olmasa Settings menyusunda OPENAI_API_KEY əlavə edin.",
      });
    }

    const now = userNowISO ? new Date(userNowISO) : new Date();
    const timezone = userTimezone || "Asia/Baku";
    const userNowFormatted = now.toLocaleString("az-AZ", {
      timeZone: timezone,
      dateStyle: "full",
      timeStyle: "medium",
    });

    const systemPrompt = `Sən "Unutma AI" tətbiqinin İntellektual Əmr və İdarəetmə Mühərrikisən.
Hazırkı cari vaxt: ${userNowFormatted} (ISO: ${now.toISOString()}).
İstifadəçinin zaman qurşağı: ${timezone}.

İSTİFADƏÇİNİN HAZIRDA MÖVCUD OLAN XATIRLATMALARI:
${JSON.stringify(reminders || [], null, 2)}

SƏNİN MƏQSƏDİN:
İstifadəçinin Azərbaycan dilindəki istənilən əmrini, sualını və ya tapşırığını analiz edib DƏQİQ JSON formatında STRUKTURLAŞDIRILMIŞ FƏALİYYƏT (action) generasiya etməkdir.

QƏTİ VƏ MƏCBURİ TƏHLÜKƏSİZLİK QAYDALARI:
1. ÇOXLU XATIRLATMA (MULTI-REMINDER):
   Əgər istifadəçi bir neçə tapşırıq / xatırlatma deyirsə (məs: "Sabah saat 10-da Anara zəng et, saat 2-də maşınlara bax, axşam dərmanı al"):
   - action: "create_multiple_reminders"
   - remindersToCreate massivində HƏR BİRİNİ ayrı obyekt kimi tərtib et (məsələn 3 xatırlatma: 1. Anara zəng et (10:00), 2. Maşınlara bax (14:00), 3. Dərmanı al (20:00)).
   - responseMessage: "3 xatırlatma əlavə edildi." və ya oxşar Azərbaycan dilində aydın cümlə.
2. TƏK XATIRLATMA:
   - action: "create_reminder"
   - remindersToCreate massivinə 1 obyekt daxil et.
3. RETRIEVAL / CƏDVƏL SORĞUSU (QƏTİ QADAĞA):
   İstifadəçi "Sabahkı planımı göstər", "Bugünkü planımı göstər", "Sabah nə var?", "Bu gün nə işim var?", "Sabah nə planım var?", "Xatırlatmalarımı göstər", "Görüşlərimi göstər" dedikdə:
   - BU HEÇ VAXT 'create_reminder' və ya 'create_multiple_reminders' OLA BİLMƏZ!
   - Bu HƏMİŞƏ 'get_daily_schedule' (və ya 'get_weekly_schedule', 'search_reminders') olmalıdır!
   - remindersToCreate massivi BOŞ və ya daxil edilməməlidir.
   - responseMessage-də mövcud xatırlatmalardan istifadə edərək saatları ilə aydın və səliqəli cavab ver.
4. XÜSUSİ TƏKRARLANMA (CUSTOM RECURRENCE):
   - "hər 3 gündən bir saat 10:00 iclasım var":
     recurrence: "custom", recurrenceInterval: 3, recurrenceUnit: "day"
   - "hər 2 həftədən bir ...": recurrence: "custom", recurrenceInterval: 2, recurrenceUnit: "week"
   - "hər ayın 15-i ...": recurrence: "monthly", recurrenceDayOfMonth: 15
5. DİGƏR FƏALİYYƏTLƏR:
   - 'update_reminder': Təxirə salmaq və ya vaxtı dəyişmək (targetReminderId və ya delayMinutes)
   - 'delete_reminder': Ləğv etmək, silmək (targetReminderId)
   - 'complete_reminder': Tamamlandı qeyd etmək (targetReminderId)
   - 'search_reminders': Axtarış (targetQuery)
   - 'plan_day': Bütün günü planlaşdırmaq (remindersToCreate massivi və ya dailyPlanProposal)
   - 'create_routine': Rutin yaratmaq (routineProposal)
   - 'general_chat': Ümumi söhbət və ya köməkçi sualı

JSON CAVAB STRUKTURU:
{
  "action": "create_reminder" | "create_multiple_reminders" | "update_reminder" | "delete_reminder" | "complete_reminder" | "search_reminders" | "get_daily_schedule" | "get_weekly_schedule" | "plan_day" | "create_routine" | "general_chat",
  "responseMessage": "İstifadəçiyə Azərbaycan dilində qaytarılacaq aydın cavab",
  "targetReminderId": "dəyişdiriləcək və ya silinəcək xatırlatmanın id-si (varsa)",
  "targetQuery": "axtarış açar sözü (varsa)",
  "delayMinutes": 60,
  "remindersToCreate": [
    {
      "title": "Başlıq",
      "description": "",
      "dueDateTime": "ISO formatında UTC vaxtı",
      "category": "work",
      "recurrence": "none",
      "priority": "medium",
      "inferredTime": false,
      "timeConfidence": "exact",
      "recurrenceInterval": 3,
      "recurrenceUnit": "day"
    }
  ],
  "routineProposal": {
    "type": "morning",
    "title": "Səhər rejimi",
    "startTime": "08:00",
    "daysOfWeek": [1, 2, 3, 4, 5],
    "steps": [
      { "title": "Oyanmaq", "time": "08:00", "duration": 10, "notificationEnabled": true }
    ]
  }
}`;

    let parsed: any;
    let modelUsed = PREFERRED_OPENAI_TEXT_MODEL;

    if (simulateOpenAI === "mock_success" || req.body.__testMockParsed) {
      parsed = req.body.__testMockParsed || {
        action: "create_reminder",
        responseMessage: "Xatırlatma yaradıldı.",
        remindersToCreate: [
          {
            title: "Anara zəng et",
            dueDateTime: new Date(now.getTime() + 86400000).toISOString(),
            category: "work",
            recurrence: "none",
            priority: "medium",
            inferredTime: false,
          },
        ],
      };
    } else {
      const completion = await callOpenAIChatCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `İstifadəçinin sözləri: "${userPrompt}"` },
        ],
        temperature: 0.2,
        responseFormat: { type: "json_object" },
        apiKey: apiKey!,
        tag: "AI-ACTION",
      });
      modelUsed = completion.modelUsed;
      parsed = JSON.parse(completion.content || "{}");
    }

    console.log(`[AI-ACTION] model: ${modelUsed}`);
    console.log("[AI-ACTION] response received");

    let action = parsed.action || "general_chat";
    let responseMessage = parsed.responseMessage || "Sorğunuz cavablandırıldı.";
    let remindersToCreate = parsed.remindersToCreate;

    // SERVER-SIDE INTENT SAFETY GUARD:
    // Query phrases MUST NEVER create reminders.
    const promptNorm = String(userPrompt).toLowerCase();
    const isQueryPhrase =
      /(göstər|goster|nə var|ne var|nəyim var|neyim var|nə işim var|ne isim var|nə planım var|ne planim var|planımı|planimi|cədvəl|cedvel|siyahı|siyahi)/i.test(
        promptNorm
      );
    const hasCreateVerb =
      /(xatırlat|xatirlat|əlavə et|elave et|əlavə elə|yarat|qeyd et|planlaşdır|yadıma sal|yadına sal)/i.test(
        promptNorm
      );

    if (
      (action === "create_reminder" || action === "create_multiple_reminders") &&
      isQueryPhrase &&
      !hasCreateVerb
    ) {
      console.warn(
        `[AI-ACTION] Guard triggered: Query phrase "${userPrompt}" misclassified by LLM as "${action}". Overriding to schedule inquiry.`
      );
      remindersToCreate = undefined;
      if (/həftə|hefte/i.test(promptNorm)) {
        action = "get_weekly_schedule";
      } else {
        action = "get_daily_schedule";
      }
    }

    // If multi-reminder extraction detected by multiple reminder items
    if (action === "create_reminder" && Array.isArray(remindersToCreate) && remindersToCreate.length > 1) {
      action = "create_multiple_reminders";
    }

    console.log(`[AI-ACTION] action: ${action}`);

    // Map remindersToCreate and post-process recurrence
    const formattedReminders = (remindersToCreate || []).map((r: any, idx: number) => {
      const rawDue = r.dueDateTime || new Date(now.getTime() + 3600000).toISOString();
      const normalizedDue = normalizeDueDateTimeForTimezone(rawDue, userPrompt, timezone);
      const item = {
        id: `extracted-${Date.now()}-${idx}`,
        title: r.title || userPrompt,
        description: r.description || "",
        dueDateTime: normalizedDue,
        category: r.category || "other",
        recurrence: r.recurrence || "none",
        recurrenceInterval: r.recurrenceInterval,
        recurrenceUnit: r.recurrenceUnit,
        recurrenceDayOfMonth: r.recurrenceDayOfMonth,
        priority: r.priority || "medium",
        inferredTime: Boolean(r.inferredTime),
        timeConfidence: r.timeConfidence || (r.inferredTime ? "inferred" : "exact"),
      };
      normalizeAzerbaijaniRecurrence(userPrompt, item);
      return item;
    });

    return res.json({
      success: true,
      actionPayload: {
        action,
        responseMessage,
        targetReminderId: parsed.targetReminderId,
        targetQuery: parsed.targetQuery,
        delayMinutes: parsed.delayMinutes,
        updateFields: parsed.updateFields,
        dailyPlanProposal: parsed.dailyPlanProposal,
        routineProposal: parsed.routineProposal
          ? {
              id: `prop-${Date.now()}`,
              type: parsed.routineProposal.type || "morning",
              title: parsed.routineProposal.title || "Rutin",
              startTime: parsed.routineProposal.startTime || "08:00",
              daysOfWeek: parsed.routineProposal.daysOfWeek || [1, 2, 3, 4, 5, 6, 0],
              steps: parsed.routineProposal.steps || [],
            }
          : undefined,
        remindersToCreate: formattedReminders,
      },
    });
  } catch (error: any) {
    console.error("[AI-ACTION] error:", error?.message || error);
    return res.status(500).json({
      error: "AI fəaliyyətinin analizi zamanı xəta: " + (error?.message || "Bilinməyən xəta"),
    });
  }
});

// =========================================================================
// API 3: AUDIO TRANSCRIPTION WITH OPENAI (gpt-4o-mini-transcribe)
// =========================================================================

app.post("/api/transcribe-audio", async (req, res) => {
  console.log("[TRANSCRIBE] request received");

  try {
    // 1. Audit and normalize request fields from existing and alternate frontend formats
    const rawBase64 =
      req.body.base64Audio ||
      req.body.audioBase64 ||
      req.body.recordDataBase64 ||
      req.body.audio ||
      "";
    const rawMime =
      req.body.mimeType ||
      req.body.type ||
      req.body.format ||
      "audio/m4a";

    // Normalize Base64 defensively server-side
    const cleanBase64 = String(rawBase64 || "")
      .replace(/^data:.*?;base64,/, "")
      .replace(/\s/g, "")
      .trim();

    const cleanMimeType = String(rawMime || "audio/m4a").trim();

    console.log(`[TRANSCRIBE] audio length: ${cleanBase64.length}`);
    console.log(`[TRANSCRIBE] mimeType: ${cleanMimeType}`);

    // Empty or invalid audio validation (return HTTP 400)
    if (!cleanBase64 || cleanBase64.length < 100 || !/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
      console.log("[TRANSCRIBE] payload validation info: empty or invalid audio data received");
      return res.status(400).json({
        error: "invalid_audio",
        message: "Səs məlumatı boşdur və ya düzgün formatda deyil.",
      });
    }

    const audioBuffer = Buffer.from(cleanBase64, "base64");
    if (audioBuffer.length === 0) {
      console.log("[TRANSCRIBE] payload validation info: decoded audio buffer is empty");
      return res.status(400).json({
        error: "invalid_audio",
        message: "Səs məlumatı boşdur və ya düzgün formatda deyil.",
      });
    }

    // 2. Check test simulation flags or validate OpenAI API key
    const simulateOpenAI = req.headers["x-test-simulate-openai"] || req.body.__testSimulateOpenAI;
    if (simulateOpenAI === "503") {
      const errMsg = "OpenAI API error (status 503): Service Unavailable (simulated)";
      console.log(`[TRANSCRIBE] simulated service unavailable response returned`);
      return res.status(503).json({
        error: "transcription_unavailable",
        message: "Səsin mətnə çevrilməsi hazırda mümkün deyil. Bir qədər sonra yenidən cəhd edin.",
        details: errMsg,
      });
    }
    if (simulateOpenAI === "400") {
      const errMsg = "OpenAI API error (status 400): Audio file might be corrupted or unsupported (simulated)";
      console.log(`[TRANSCRIBE] simulated rejected audio response returned`);
      return res.status(400).json({
        error: "transcription_rejected",
        message: "Audio formatı qəbul edilmədi və ya fayl zədəlidir.",
        details: errMsg,
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey && simulateOpenAI !== "mock_success") {
      console.log("[TRANSCRIBE] OPENAI_API_KEY is not configured");
      return res.status(503).json({
        error: "transcription_unavailable",
        message: "OPENAI_API_KEY mühit dəyişəni təyin edilməyib. Zəhmət olmasa Settings menyusunda OPENAI_API_KEY əlavə edin.",
      });
    }

    // 3. Transcription using OpenAI only
    console.log("[TRANSCRIBE] provider: OpenAI");
    console.log("[TRANSCRIBE] OpenAI request started");

    let openAITranscript: string;
    if (simulateOpenAI === "mock_success") {
      openAITranscript = "Sabah saat 10-da Anara zəng et";
    } else {
      openAITranscript = await transcribeWithOpenAI(audioBuffer, cleanMimeType, {
        timeoutMs: 15000,
        apiKey: apiKey!,
      });
    }

    if (openAITranscript) {
      console.log("[TRANSCRIBE] OpenAI status: success");
      console.log("[TRANSCRIBE] provider used: openai");
      console.log(`[TRANSCRIBE] transcript length: ${openAITranscript.length}`);
      return res.json({
        success: true,
        transcript: openAITranscript,
        transcription: openAITranscript,
        provider: "openai",
      });
    } else {
      throw new Error("OpenAI returned empty transcription");
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.log(`[TRANSCRIBE] request handling result: ${errMsg}`);

    const isAudioRejected =
      errMsg.includes("status 400") ||
      errMsg.toLowerCase().includes("corrupted") ||
      errMsg.toLowerCase().includes("unsupported") ||
      errMsg.toLowerCase().includes("invalid format") ||
      errMsg.toLowerCase().includes("could not be decoded");

    if (isAudioRejected) {
      return res.status(400).json({
        error: "transcription_rejected",
        message: "Audio formatı qəbul edilmədi və ya fayl zədəlidir.",
        details: errMsg,
      });
    }

    return res.status(503).json({
      error: "transcription_unavailable",
      message: "Səsin mətnə çevrilməsi hazırda mümkün deyil. Bir qədər sonra yenidən cəhd edin.",
      details: errMsg,
    });
  }
});

// =========================================================================
// API 4: GENERAL ASSISTANT CHAT & /api/chat (OPENAI ONLY)
// =========================================================================
async function handleChatWithOpenAI(req: express.Request, res: express.Response) {
  try {
    const question =
      req.body.question ||
      req.body.message ||
      req.body.prompt ||
      (Array.isArray(req.body.messages) && req.body.messages[req.body.messages.length - 1]?.content);

    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Sual daxil edilməyib." });
    }

    const simulateOpenAI = req.headers["x-test-simulate-openai"] || req.body.__testSimulateOpenAI;
    if (simulateOpenAI === "missing_key") {
      return res.status(503).json({
        error: "ai_unavailable",
        message:
          "OPENAI_API_KEY mühit dəyişəni təyin edilməyib. Zəhmət olmasa Settings menyusunda OPENAI_API_KEY əlavə edin.",
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey && simulateOpenAI !== "mock_success") {
      return res.status(503).json({
        error: "ai_unavailable",
        message:
          "OPENAI_API_KEY mühit dəyişəni təyin edilməyib. Zəhmət olmasa Settings menyusunda OPENAI_API_KEY əlavə edin.",
      });
    }

    const now = req.body.userNowISO ? new Date(req.body.userNowISO) : new Date();
    const timezone = req.body.userTimezone || "Asia/Baku";
    const userNowFormatted = now.toLocaleString("az-AZ", {
      timeZone: timezone,
      dateStyle: "full",
      timeStyle: "medium",
    });

    const systemPrompt = `Sən "Unutma AI" tətbiqinin köməkçi mühərrikisən.
Hazırkı cari vaxt: ${userNowFormatted} (ISO: ${now.toISOString()}).
İstifadəçinin zaman qurşağı: ${timezone}.
İstifadəçinin hazırkı xatırlatmaları:
${JSON.stringify(req.body.reminders || [], null, 2)}

İstifadəçinin sualına Azərbaycan dilində aydın, mehriban və lakonik cavab ver.`;

    let answer: string;
    if (simulateOpenAI === "mock_success") {
      answer = "Bəli, sizə necə kömək edə bilərəm?";
    } else {
      const completion = await callOpenAIChatCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `İstifadəçinin sualı: "${question}"` },
        ],
        temperature: 0.3,
        apiKey: apiKey!,
        tag: "CHAT",
      });
      answer = completion.content?.trim() || "Cavab hazırlana bilmədi.";
    }

    return res.json({
      success: true,
      answer,
      message: answer,
    });
  } catch (error: any) {
    console.error("Error in chat/ask-assistant:", error);
    return res.status(500).json({
      error: "Köməkçi ilə əlaqə zamanı xəta: " + (error?.message || "Bilinməyən xəta"),
    });
  }
}

app.post("/api/ask-assistant", handleChatWithOpenAI);
app.post("/api/chat", handleChatWithOpenAI);

// =========================================================================
// [REALTIME-STT] OPENAI REALTIME TRANSCRIPTION GATEWAY
// Model: gpt-live-transcribe
// Handles: conversation.item.input_audio_transcription.delta
// Server-side WebSocket relay keeping OPENAI_API_KEY secure.
// Streams 16-bit PCM 24kHz audio chunks to OpenAI Realtime API.
// =========================================================================
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (clientWs: WebSocket, request: http.IncomingMessage) => {
  console.log("[REALTIME-STT] Client connected to OpenAI Realtime STT gateway");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[REALTIME-STT] Missing OPENAI_API_KEY server-side");
    clientWs.send(
      JSON.stringify({
        type: "error",
        error: "OPENAI_API_KEY server-side konfiqurasiya olunmayıb.",
      })
    );
    clientWs.close(1008, "Missing OPENAI_API_KEY");
    return;
  }

  // Upstream OpenAI Realtime endpoint
  const upstreamUrl =
    process.env.OPENAI_REALTIME_URL ||
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview";

  console.log(`[REALTIME-STT] Connecting to OpenAI Realtime upstream: ${upstreamUrl}`);

  let isUpstreamOpen = false;
  const pendingBufferQueue: string[] = [];

  const upstreamWs = new WebSocket(upstreamUrl, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  upstreamWs.on("open", () => {
    isUpstreamOpen = true;
    console.log("[REALTIME-STT] Connected to OpenAI Realtime upstream. Configuring session with model: gpt-live-transcribe");

    // Configure session for input audio transcription using model: gpt-live-transcribe
    const sessionUpdate = {
      type: "session.update",
      session: {
        modalities: ["text"],
        input_audio_format: "pcm16",
        input_audio_transcription: {
          model: "gpt-live-transcribe",
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 700,
          create_response: false,
        },
      },
    };

    upstreamWs.send(JSON.stringify(sessionUpdate));

    // Flush any pending audio chunks received before upstream was ready
    while (pendingBufferQueue.length > 0) {
      const chunk = pendingBufferQueue.shift();
      if (chunk && upstreamWs.readyState === WebSocket.OPEN) {
        upstreamWs.send(chunk);
      }
    }

    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: "session.ready",
          model: "gpt-live-transcribe",
        })
      );
    }
  });

  // Handle messages from upstream OpenAI Realtime
  upstreamWs.on("message", (data: WebSocket.RawData) => {
    try {
      const event = JSON.parse(data.toString());

      // [REALTIME-STT] Handle conversation.item.input_audio_transcription.delta
      if (event.type === "conversation.item.input_audio_transcription.delta") {
        console.log(
          `[REALTIME-STT] [gpt-live-transcribe] conversation.item.input_audio_transcription.delta: "${event.delta}"`
        );
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify(event));
        }
      } else if (event.type === "conversation.item.input_audio_transcription.completed") {
        console.log(
          `[REALTIME-STT] [gpt-live-transcribe] Final transcript completed: "${event.transcript}"`
        );
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify(event));
        }
      } else if (
        event.type === "input_audio_buffer.speech_started" ||
        event.type === "input_audio_buffer.speech_stopped"
      ) {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify(event));
        }
      } else if (event.type === "error") {
        console.warn("[REALTIME-STT] OpenAI Realtime upstream error:", event.error);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify(event));
        }
      }
    } catch (err) {
      console.error("[REALTIME-STT] Error parsing upstream message:", err);
    }
  });

  upstreamWs.on("error", (err: Error) => {
    console.warn("[REALTIME-STT] Upstream connection error:", err.message);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: "error",
          error: "Realtime audio upstream error: " + err.message,
        })
      );
    }
  });

  upstreamWs.on("close", () => {
    console.log("[REALTIME-STT] Upstream connection closed");
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close();
    }
  });

  // Forward audio chunks from client to upstream OpenAI Realtime
  clientWs.on("message", (data: WebSocket.RawData) => {
    try {
      let payload = "";
      if (Buffer.isBuffer(data)) {
        // Raw binary PCM data
        payload = JSON.stringify({
          type: "input_audio_buffer.append",
          audio: data.toString("base64"),
        });
      } else {
        const text = data.toString();
        // Check if JSON event
        if (text.startsWith("{")) {
          const parsed = JSON.parse(text);
          if (parsed.type === "input_audio_buffer.append") {
            payload = text;
          } else if (parsed.type === "input_audio_buffer.commit") {
            payload = text;
          }
        } else {
          // Plain base64 string
          payload = JSON.stringify({
            type: "input_audio_buffer.append",
            audio: text,
          });
        }
      }

      if (payload) {
        if (isUpstreamOpen && upstreamWs.readyState === WebSocket.OPEN) {
          upstreamWs.send(payload);
        } else if (pendingBufferQueue.length < 100) {
          pendingBufferQueue.push(payload);
        }
      }
    } catch (e) {
      console.error("[REALTIME-STT] Error handling client audio chunk:", e);
    }
  });

  clientWs.on("close", () => {
    console.log("[REALTIME-STT] Client disconnected");
    if (upstreamWs.readyState === WebSocket.OPEN) {
      upstreamWs.close();
    }
  });
});

// Production and dev server
async function startServer() {
  const server = http.createServer(app);

  // Attach WebSocket upgrade listener for /api/realtime-stt
  server.on("upgrade", (request: http.IncomingMessage, socket, head) => {
    const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
    if (url.pathname === "/api/realtime-stt") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Unutma AI server running on http://localhost:${PORT}`);
  });
}

startServer();
