import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { transcribeWithOpenAI } from "./src/server/openaiAudio";

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

// Initialize Gemini SDK lazily with User-Agent telemetry
let aiInstance: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY mühit dəyişəni təyin edilməyib. Zəhmət olmasa Settings menyusunda GEMINI_API_KEY əlavə edin."
      );
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// Public health check endpoints
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "unutma-ai-api" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "unutma-ai-api" });
});

// Helper to inspect whether an error is temporary overload (503), rate limit (429), or quota exhaustion
function classifyGeminiError(error: any): {
  is503: boolean;
  is429: boolean;
  isOverloadedOrQuota: boolean;
  retryAfterMs?: number;
} {
  const msg = String(error?.message || "");
  const status = Number(error?.status || error?.statusCode || error?.code);
  const statusStr = String(error?.status || error?.statusCode || error?.code || "");

  const is503 =
    status === 503 ||
    statusStr.includes("503") ||
    /503|UNAVAILABLE|high demand|overloaded|service unavailable|backend unavailable|currently experiencing high demand/i.test(msg);

  const is429 =
    status === 429 ||
    statusStr.includes("429") ||
    /429|RESOURCE_EXHAUSTED|resource exhausted|quota exceeded|too many requests|rate limit/i.test(msg);

  let retryAfterMs: number | undefined;
  if (error?.retryAfter && Number(error.retryAfter) > 0) {
    retryAfterMs = Number(error.retryAfter) * 1000;
  } else if (error?.response?.headers) {
    const headerVal =
      error.response.headers.get?.("retry-after") ||
      error.response.headers["retry-after"];
    if (headerVal && Number(headerVal) > 0) {
      retryAfterMs = Number(headerVal) * 1000;
    }
  }

  if (!retryAfterMs) {
    const match = msg.match(/retry (?:after|in) ([0-9.]+)s/i);
    if (match && match[1]) {
      const parsed = parseFloat(match[1]);
      if (!isNaN(parsed) && parsed > 0) {
        retryAfterMs = Math.round(parsed * 1000);
      }
    }
  }

  return {
    is503,
    is429,
    isOverloadedOrQuota: is503 || is429,
    retryAfterMs,
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getRetryDelay(attemptIndex: number, suggestedRetryAfterMs?: number): number {
  if (suggestedRetryAfterMs && suggestedRetryAfterMs >= 500 && suggestedRetryAfterMs <= 10000) {
    return suggestedRetryAfterMs;
  }
  return attemptIndex === 1 ? 2000 : 5000;
}

// =========================================================================
// TEXT AI CONFIGURATION (1 PRIMARY, 1 FALLBACK, MAX 1 RETRY, 10-15s BUDGET)
// =========================================================================
const TEXT_AI_MODELS = [
  "gemini-3.8-flash", // Primary fast model
  "gemini-flash-latest", // Fallback model
];
const MAX_TEXT_AI_BUDGET_MS = 14000; // 14s budget
const MAX_RETRIES_PER_TEXT_MODEL = 1; // Max 1 retry per model

async function generateTextAIWithBudget(configParams: {
  contents: any;
  config: any;
  tag?: string;
}): Promise<{ text: string | undefined; modelUsed: string }> {
  const startTime = Date.now();
  let lastError: any = null;
  const tag = configParams.tag || "TEXT-AI";

  for (let mIdx = 0; mIdx < TEXT_AI_MODELS.length; mIdx++) {
    const model = TEXT_AI_MODELS[mIdx];
    for (let attempt = 1; attempt <= MAX_RETRIES_PER_TEXT_MODEL + 1; attempt++) {
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_TEXT_AI_BUDGET_MS) {
        console.warn(`[${tag}] budget exceeded: ${elapsed}ms > ${MAX_TEXT_AI_BUDGET_MS}ms. Immediate fallback.`);
        throw new Error(`AI icra büdcəsi (${MAX_TEXT_AI_BUDGET_MS / 1000}s) başa çatdı`);
      }

      console.log(`[${tag}] model: ${model} (attempt ${attempt}/${MAX_RETRIES_PER_TEXT_MODEL + 1}, elapsed ${elapsed}ms)`);
      try {
        const response = await getAI().models.generateContent({
          model,
          contents: configParams.contents,
          config: configParams.config,
        });
        return { text: response.text, modelUsed: model };
      } catch (err: any) {
        lastError = err;
        const { isOverloadedOrQuota, retryAfterMs } = classifyGeminiError(err);
        console.warn(`[${tag}] error on ${model} (attempt ${attempt}):`, err?.message || err);

        if (isOverloadedOrQuota && attempt <= MAX_RETRIES_PER_TEXT_MODEL) {
          const delay = Math.min(getRetryDelay(attempt, retryAfterMs), 2000);
          console.log(`[${tag}] retrying ${model} in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        break; // switch to fallback model
      }
    }
  }
  throw lastError || new Error("Text AI models exhausted");
}

// =========================================================================
// API 1: PARSE VOICE/TEXT INTO STRUCTURED REMINDERS (MULTI-TASK EXTRACTION)
// =========================================================================
app.post("/api/parse-reminder", async (req, res) => {
  try {
    const { text, userNowISO, userTimezone } = req.body;

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

    const systemInstruction = `Sən "Unutma AI" tətbiqinin Azərbaycan dili üçün dərin təbii dil analizi və xatırlatma mühərrikisən.
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
   3. Başlıq: "Anamın dərmanını al", Vaxt: Sabah 20:00 (axşam), Kateqoriya: 'health', inferredTime: true (çünki konkret saat deyilməyib, axşam kimi qeyd edilib)

2. AZƏRBAYCAN DİLİ ZAMAN ANLAYIŞLARI (DƏQİQ ÇEVİRMƏ):
   - "bu gün" -> Hazırkı gün (${now.toISOString().slice(0, 10)})
   - "sabah" -> Sabahkı gün (+1 gün)
   - "birigün" -> Birigün (+2 gün)
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
   - digər hallar -> 'none'

5. KATEQORİYA (Category):
   'health' (sağlamlıq, həkim, dərman, analiz), 'work' (iş, görüş, iclas, hesabat, müştəri), 'finance' (ödəniş, bank, kart, kirayə, borc), 'personal' (şəxsi, ailə, zəng, idman), 'shopping' (market, alış-veriş, mağaza), 'education' (dərs, kurs, imtahan, kitab), 'home' (ev, usta, təmizlik, təmir), 'other'.

6. XÜLASƏ (summary):
   Azərbaycan dilində çox aydın, səliqəli və mehriban xülasə cümləsi qaytar (məsələn: "3 xatırlatma tapdım: Sabah 10:00 Anara zəng, 14:00 usta və axşam 20:00 dərman.").`;

    const aiResponse = await generateTextAIWithBudget({
      contents: `İstifadəçinin mətni: "${text}"`,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "Azərbaycan dilində qısa və aydın xülasə",
            },
            reminders: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Xatırlatmanın lakonik başlığı" },
                  description: { type: Type.STRING, description: "Əlavə qeydlər və ya təsvir" },
                  dueDateTime: { type: Type.STRING, description: "ISO 8601 formatında dəqiq tarix və vaxt (UTC formatında)" },
                  category: {
                    type: Type.STRING,
                    enum: ["health", "work", "finance", "personal", "shopping", "education", "home", "other"],
                  },
                  recurrence: {
                    type: Type.STRING,
                    enum: ["none", "daily", "weekly", "monthly", "yearly", "weekdays", "custom"],
                  },
                  priority: {
                    type: Type.STRING,
                    enum: ["high", "medium", "low"],
                  },
                  inferredTime: {
                    type: Type.BOOLEAN,
                    description: "Vaxtın dəqiq deyil, təxmini infer edildiyini bildirir",
                  },
                  timeConfidence: {
                    type: Type.STRING,
                    enum: ["exact", "inferred", "ambiguous"],
                  },
                },
                required: ["title", "dueDateTime", "category", "recurrence", "priority"],
              },
            },
          },
          required: ["summary", "reminders"],
        },
      },
      tag: "PARSE-REMINDER",
    });

    const parsed = JSON.parse(aiResponse.text || "{}");
    return res.json({
      success: true,
      summary: parsed.summary || `${(parsed.reminders || []).length} xatırlatma tapıldı.`,
      reminders: (parsed.reminders || []).map((item: any, idx: number) => ({
        id: `extracted-${Date.now()}-${idx}`,
        title: item.title,
        description: item.description || "",
        dueDateTime: item.dueDateTime,
        category: item.category || "other",
        recurrence: item.recurrence || "none",
        priority: item.priority || "medium",
        inferredTime: Boolean(item.inferredTime || item.timeConfidence === "inferred"),
        timeConfidence: item.timeConfidence || (item.inferredTime ? "inferred" : "exact"),
      })),
    });
  } catch (error: any) {
    console.error("Error in parse-reminder:", error);
    return res.status(500).json({
      error: "Xatırlatmanın analizi zamanı xəta baş verdi: " + (error?.message || "Bilinməyən xəta"),
    });
  }
});

// =========================================================================
// API 2: STRUCTURED AI ACTION ENGINE (DISPATCH ACTIONS & SCHEDULE QUERY)
// =========================================================================
app.post("/api/ai-action", async (req, res) => {
  console.log('[AI-ACTION] request received');
  try {
    const { userPrompt, reminders, userNowISO, userTimezone } = req.body;

    if (!userPrompt) {
      return res.status(400).json({ error: "Əmr və ya sual daxil edilməyib." });
    }

    const now = userNowISO ? new Date(userNowISO) : new Date();
    const timezone = userTimezone || "Asia/Baku";
    const userNowFormatted = now.toLocaleString("az-AZ", {
      timeZone: timezone,
      dateStyle: "full",
      timeStyle: "medium",
    });

    const systemInstruction = `Sən "Unutma AI" tətbiqinin İntellektual Əmr və İdarəetmə Mühərrikisən.
Hazırkı cari vaxt: ${userNowFormatted} (ISO: ${now.toISOString()}).
İstifadəçinin zaman qurşağı: ${timezone}.

İSTİFADƏÇİNİN HAZIRDA MÖVCUD OLAN XATIRLATMALARI:
${JSON.stringify(reminders || [], null, 2)}

SƏNİN MƏQSƏDİN:
İstifadəçinin Azərbaycan dilindəki istənilən əmrini, sualını və ya tapşırığını analiz edib DƏQİQ STRUKTURLAŞDIRILMIŞ FƏALİYYƏT (action) generasiya etməkdir.

QƏTİ VƏ MƏCBURİ TƏHLÜKƏSİZLİK QAYDALARI:
1. İstifadəçi xatırlatma, tapşırıq və ya fəaliyyət əmrləri verirsə (məs: "Sabah saat 10-da Anara zəng et, saat 2-də maşınlara bax, axşam dərmanı al", "Saat 3-də həkimə get", "Dərman içməyi xatırlat", "Zəng et", "Marketdən çörək al", "Axşam dərmanı al"), bu 'create_reminder' və ya 'create_multiple_reminders' kimi təsnif edilməlidir! Hər bir fəaliyyəti ayrıca xatırlatma kimi remindersToCreate massivinə daxil et.
2. Təqvim və ya zaman sözləri təkbaşına hərəkətsiz deyilirsə (məsələn sadəcə "sabah" və ya "bu gün") xatırlatma yaradılmır.
3. QƏTİ QADAĞA: İstifadəçi mövcud cədvəli, planı, işləri, xatırlatmaları soruşursa və ya "göstər", "nə planım var", "nəyim var" deyirsə:
   - Məsələn: "Sabahkı planımı göstər", "Bugünkü planımı göstər", "Sabah nə var?", "Bu gün nə işim var?", "Sabah nə planım var?", "Xatırlatmalarımı göstər", "Görüşlərimi göstər":
   - BU QƏTİYYƏN VƏ HEÇ VAXT 'create_reminder' OLA BİLMƏZ!
   - Bu HƏMİŞƏ 'get_daily_schedule' (və ya 'get_weekly_schedule', 'search_reminders') olmalıdır!
   - 'göstər' və ya 'nə planım var' sorğuları HƏMİŞƏ MƏLUMAT ƏLDƏ ETMƏK (retrieval/query) niyyətidir!

FƏALİYYƏTLƏR:

1. 'get_daily_schedule':
   - Məsələn: "Sabahkı planımı göstər", "Bugünkü planımı göstər", "Bu gün nə planım var?", "Sabah nə etməliyəm?", "Birigün nə var?", "Sabah nəyim var?".
   - responseMessage-də mövcud xatırlatmalardan istifadə edərək saatları ilə aydın və səliqəli cavab ver. Əgər plan yoxdursa "Həmin gün üçün heç bir planınız yoxdur, rahat istirahət edə bilərsiniz" de.

2. 'get_weekly_schedule':
   - Məsələn: "Bu həftə hansı günüm daha boşdur?", "Həftəlik cədvəlimi göstər", "Bu həftə planlarım".
   - Həftə günlərini xatırlatmaların sıxlığına görə analiz et və ən boş günləri qeyd edərək cavab ver.

3. 'search_reminders':
   - Məsələn: "Həkimlə bağlı nə xatırlatmam var?", "Anar haqqında planlar", "Görüşlərimi göstər", "Xatırlatmalarımı göstər".
   - targetQuery açar sözünü və responseMessage-də nəticəni təqdim et.

4. 'create_reminder' / 'create_multiple_reminders':
   - Məsələn: "Sabah saat 15:00-a görüş əlavə et", "Axşam saat 8-də dərman içməyi xatırlat", "Sabah saat 10-da Anara zəng et və 2-də maşını apar".
   - remindersToCreate massivində dəqiq ISO dueDateTime ilə xatırlatmaları tərtib et.

5. 'update_reminder':
   - Məsələn: "Sabahkı Anarla görüşümü 1 saat gecikdir", "Dərman xatırlatmasını saat 21:00-a dəyiş".
   - targetReminderId-ni mövcud siyahıdan tap və ya delayMinutes: 60 / updateFields təyin et.

3. 'delete_reminder':
   - Məsələn: "Cümə günü olan görüşümü sil", "İdman xatırlatmasını ləğv et".
   - targetReminderId-ni mövcud siyahıdan tap.

4. 'complete_reminder':
   - Məsələn: "Dərman içməyi tamamla", "Hesabat göndərməyi bitmiş kimi qeyd et".
   - targetReminderId-ni təyin et.

5. 'get_daily_schedule':
   - Məsələn: "Bu gün nə planım var?", "Sabah nə etməliyəm?", "Birigün nə var?".
   - responseMessage-də mövcud xatırlatmalardan istifadə edərək saatları ilə aydın və səliqəli cavab ver. Əgər plan yoxdursa "Həmin gün üçün heç bir planınız yoxdur, rahat istirahət edə bilərsiniz" de.

6. 'get_weekly_schedule':
   - Məsələn: "Bu həftə hansı günüm daha boşdur?", "Həftəlik cədvəlimi göstər".
   - Həftə günlərini xatırlatmaların sıxlığına görə analiz et və ən boş günləri qeyd edərək cavab ver.

7. 'search_reminders':
   - Məsələn: "Həkimlə bağlı nə xatırlatmam var?", "Anar haqqında planlar".
   - targetQuery açar sözünü və responseMessage-də nəticəni təqdim et.

8. 'plan_day':
   - Məsələn: "Bu gün saat 2-də görüşüm var, hesabatı bitirməliyəm, marketə getməliyəm və 30 dəqiqə idman etmək istəyirəm", "Günümü planla", "Bu günümü təşkil et".
   - İstifadəçinin gün ərzindəki bütün tapşırıqlarını optimal və balanslı cədvələ sal:
     * Dəqiq saat deyilən hadisələri həmin vaxta (məs: saat 2-də görüş -> 14:00) qoy.
     * Fokus/iş tapşırıqlarını səhərə (09:30), alış-veriş/market işlərini günorta-sonrasına (17:30), idman/istirahəti axşama (19:00) təyin et.
     * remindersToCreate massivində hər tapşırığı dəqiq dueDateTime və başlıqla təqdim et.
     * responseMessage-də "Günün üçün optimal plan hazırlandı. Zəhmət olmasa təsdiq edin." bildir.

9. 'create_routine':
   - Məsələn: "Hər səhər 7-də oyanım, 10 dəqiqə idman edim və 8-də evdən çıxım", "Axşam rutini qur", "Gündüz rejimi yarat".
   - Gündəlik təkrarlanan rutinləri addım-addım tərtib et:
     * routineProposal obyektində type ('morning', 'afternoon', 'evening', 'custom'), title, startTime, daysOfWeek və addımlar (steps) massivini təqdim et.
     * Hər addım üçün: title, time, duration (dəqiqələrlə), notificationEnabled (boolean) təyin et.
     * responseMessage-də "Rutininiz üçün cədvəl tərtib edildi. Zəhmət olmasa təsdiq edin." bildir.

10. 'general_chat':
   - Ümumi söhbət və ya köməkçi sualları üçün.`;

    console.log('[AI-ACTION] Text AI generation started (1 primary + 1 fallback, 10-15s budget)');
    const aiResponse = await generateTextAIWithBudget({
      contents: `İstifadəçinin sözləri: "${userPrompt}"`,
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: {
              type: Type.STRING,
              enum: [
                "create_reminder",
                "create_multiple_reminders",
                "update_reminder",
                "delete_reminder",
                "complete_reminder",
                "search_reminders",
                "get_daily_schedule",
                "get_weekly_schedule",
                "plan_day",
                "create_routine",
                "general_chat",
              ],
              description: "İcra ediləcək fəaliyyət növü",
            },
            responseMessage: {
              type: Type.STRING,
              description: "İstifadəçiyə Azərbaycan dilində qaytarılacaq aydın və səlis cavab",
            },
            targetReminderId: {
              type: Type.STRING,
              description: "Dəyişdiriləcək və ya silinəcək xatırlatmanın ID-si (varsa)",
            },
            targetQuery: {
              type: Type.STRING,
              description: "Axtarış üçün açar söz (varsa)",
            },
            delayMinutes: {
              type: Type.NUMBER,
              description: "Təxirə salınma dəqiqəsi (məs: 60)",
            },
            updateFields: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                dueDateTime: { type: Type.STRING },
                category: { type: Type.STRING },
                priority: { type: Type.STRING },
              },
            },
            remindersToCreate: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  dueDateTime: { type: Type.STRING },
                  category: {
                    type: Type.STRING,
                    enum: ["health", "work", "finance", "personal", "shopping", "education", "home", "other"],
                  },
                  recurrence: {
                    type: Type.STRING,
                    enum: ["none", "daily", "weekly", "monthly", "yearly", "weekdays", "custom"],
                  },
                  priority: {
                    type: Type.STRING,
                    enum: ["high", "medium", "low"],
                  },
                  inferredTime: { type: Type.BOOLEAN },
                },
                required: ["title", "dueDateTime", "category", "recurrence", "priority"],
              },
            },
            routineProposal: {
              type: Type.OBJECT,
              properties: {
                type: {
                  type: Type.STRING,
                  enum: ["morning", "afternoon", "evening", "custom"],
                },
                title: { type: Type.STRING },
                startTime: { type: Type.STRING },
                daysOfWeek: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER },
                },
                steps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      time: { type: Type.STRING },
                      duration: { type: Type.NUMBER },
                      notificationEnabled: { type: Type.BOOLEAN },
                    },
                    required: ["title", "notificationEnabled"],
                  },
                },
              },
            },
          },
          required: ["action", "responseMessage"],
        },
      },
      tag: "AI-ACTION",
    });

    console.log('[AI-ACTION] Text AI response received');
    const parsed = JSON.parse(aiResponse.text || "{}");
    let action = parsed.action || "general_chat";
    let responseMessage = parsed.responseMessage || "Sorğunuz cavablandırıldı.";
    let remindersToCreate = parsed.remindersToCreate;

    // SERVER-SIDE INTENT SAFETY GUARD:
    // Query phrases MUST NEVER create reminders.
    const promptNorm = String(userPrompt).toLowerCase();
    const isQueryPhrase = /(göstər|goster|nə var|ne var|nəyim var|neyim var|nə işim var|ne isim var|nə planım var|ne planim var|planımı|planimi|cədvəl|cedvel|siyahı|siyahi)/i.test(promptNorm);
    const hasCreateVerb = /(xatırlat|xatirlat|əlavə et|elave et|əlavə elə|yarat|qeyd et|planlaşdır|yadıma sal|yadına sal)/i.test(promptNorm);

    if ((action === 'create_reminder' || action === 'create_multiple_reminders') && isQueryPhrase && !hasCreateVerb) {
      console.warn(`[AI-ACTION] Guard triggered: Query phrase "${userPrompt}" misclassified by LLM as "${action}". Overriding to schedule inquiry.`);
      remindersToCreate = undefined;
      if (/həftə|hefte/i.test(promptNorm)) {
        action = 'get_weekly_schedule';
      } else {
        action = 'get_daily_schedule';
      }
    }

    return res.json({
      success: true,
      actionPayload: {
        action,
        responseMessage,
        targetReminderId: parsed.targetReminderId,
        targetQuery: parsed.targetQuery,
        delayMinutes: parsed.delayMinutes,
        updateFields: parsed.updateFields,
        routineProposal: parsed.routineProposal
          ? {
              id: `prop-${Date.now()}`,
              type: parsed.routineProposal.type || 'morning',
              title: parsed.routineProposal.title || 'Rutin',
              startTime: parsed.routineProposal.startTime || '08:00',
              daysOfWeek: parsed.routineProposal.daysOfWeek || [1, 2, 3, 4, 5, 6, 0],
              steps: parsed.routineProposal.steps || [],
            }
          : undefined,
        remindersToCreate: (remindersToCreate || []).map((r: any, idx: number) => ({
          id: `extracted-${Date.now()}-${idx}`,
          title: r.title,
          description: r.description || "",
          dueDateTime: r.dueDateTime,
          category: r.category || "other",
          recurrence: r.recurrence || "none",
          priority: r.priority || "medium",
          inferredTime: Boolean(r.inferredTime),
        })),
      },
    });
  } catch (error: any) {
    console.error("Error in ai-action:", error);
    return res.status(500).json({
      error: "AI fəaliyyətinin analizi zamanı xəta: " + (error?.message || "Bilinməyən xəta"),
    });
  }
});

// =========================================================================
// API 3: AUDIO TRANSCRIPTION WITH GEMINI (RESILIENT RETRIES & MODEL FALLBACK)
// =========================================================================

// Supported Gemini multimodal models for audio transcription
const AUDIO_TRANSCRIPTION_MODELS = [
  "gemini-3.5-transcribe",
  "gemini-3.8-flash",
];

const MAX_TRANSCRIPTION_BUDGET_MS = 15000; // Strict 15s overall budget for primary transcription

app.post("/api/transcribe-audio", async (req, res) => {
  const startTime = Date.now();
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

    // TEST D: Empty or invalid audio validation (do NOT fallback for empty audio, return HTTP 400)
    if (!cleanBase64 || cleanBase64.length < 100 || !/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
      console.warn("[TRANSCRIBE] payload validation failed: empty or invalid audio data");
      return res.status(400).json({
        error: "invalid_audio",
        message: "Səs məlumatı boşdur və ya düzgün formatda deyil.",
      });
    }

    const audioBuffer = Buffer.from(cleanBase64, "base64");
    if (audioBuffer.length === 0) {
      console.warn("[TRANSCRIBE] payload validation failed: decoded audio buffer is empty");
      return res.status(400).json({
        error: "invalid_audio",
        message: "Səs məlumatı boşdur və ya düzgün formatda deyil.",
      });
    }

    // 2. Primary provider: Gemini
    console.log("[TRANSCRIBE] primary provider: Gemini");
    let geminiSuccess = false;
    let geminiTranscript = "";
    let shouldTriggerOpenAIFallback = false;

    // Automated test hook headers/body (for reliable automated verification)
    const simulateGemini = req.headers["x-test-simulate-gemini"] || req.body.__testSimulateGemini;
    const simulateOpenAI = req.headers["x-test-simulate-openai"] || req.body.__testSimulateOpenAI;

    if (simulateGemini === "429") {
      console.warn("[TRANSCRIBE] Gemini status: 429 RESOURCE_EXHAUSTED (simulated)");
      shouldTriggerOpenAIFallback = true;
    } else if (simulateGemini === "503") {
      console.warn("[TRANSCRIBE] Gemini status: 503 UNAVAILABLE (simulated)");
      shouldTriggerOpenAIFallback = true;
    } else {
      const audioPart = {
        inlineData: {
          mimeType: cleanMimeType,
          data: cleanBase64,
        },
      };

      const promptText =
        "Bu səs faylı Azərbaycan dilindədir. Zəhmət olmasa tələffüz edilən sözləri dəqiq Azərbaycan əlifbası və orfoqrafiyası ilə transkripsiya et. Heç bir əlavə giriş və ya şərh yazma, yalnız təmiz mətni qaytar.";

      for (const model of AUDIO_TRANSCRIPTION_MODELS) {
        const elapsed = Date.now() - startTime;
        if (elapsed >= MAX_TRANSCRIPTION_BUDGET_MS) {
          console.warn(`[TRANSCRIBE] Gemini budget exceeded (${elapsed}ms)`);
          break;
        }

        try {
          console.log(`[TRANSCRIBE] Gemini attempt with model: ${model}`);
          const response = await getAI().models.generateContent({
            model,
            contents: {
              parts: [audioPart, { text: promptText }],
            },
          });

          geminiTranscript = (response.text || "").trim();
          if (geminiTranscript) {
            geminiSuccess = true;
            console.log("[TRANSCRIBE] Gemini status: success");
            break;
          }
        } catch (err: any) {
          const { is503, is429 } = classifyGeminiError(err);
          const statusDesc = is429
            ? "429 RESOURCE_EXHAUSTED"
            : is503
            ? "503 UNAVAILABLE"
            : err?.message || "error";
          console.warn(`[TRANSCRIBE] Gemini status: ${statusDesc}`);

          // On 429, 503, quota exhausted, unavailable, or times out: automatically activate OpenAI fallback
          if (is429 || is503) {
            shouldTriggerOpenAIFallback = true;
            break;
          }
        }
      }

      if (!geminiSuccess) {
        shouldTriggerOpenAIFallback = true;
      }
    }

    if (geminiSuccess && geminiTranscript) {
      console.log("[TRANSCRIBE] provider used: gemini");
      console.log(`[TRANSCRIBE] transcript length: ${geminiTranscript.length}`);
      return res.json({
        success: true,
        transcript: geminiTranscript,
        transcription: geminiTranscript,
        provider: "gemini",
      });
    }

    // 3. Fallback to OpenAI (gpt-4o-mini-transcribe)
    if (shouldTriggerOpenAIFallback) {
      console.log("[TRANSCRIBE] Gemini failed, activating OpenAI fallback");
      console.log("[TRANSCRIBE] OpenAI request started");

      try {
        if (simulateOpenAI === "503" || simulateOpenAI === "true") {
          throw new Error("OpenAI API unavailable (simulated)");
        }

        const openAITranscript = await transcribeWithOpenAI(audioBuffer, cleanMimeType, {
          timeoutMs: 15000,
        });

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
      } catch (openAIErr: any) {
        console.error("[TRANSCRIBE] OpenAI status: failed");
        console.error(`[TRANSCRIBE] OpenAI error: ${openAIErr?.message || openAIErr}`);
      }
    }

    // 4. Both providers failed: Return structured HTTP 503 error
    console.error("[TRANSCRIBE] error: Both Gemini and OpenAI transcription failed");
    return res.status(503).json({
      error: "transcription_unavailable",
      message: "Səsin mətnə çevrilməsi hazırda mümkün deyil. Bir qədər sonra yenidən cəhd edin.",
    });
  } catch (outerErr: any) {
    console.error(`[TRANSCRIBE] error: Unexpected error in transcribe-audio: ${outerErr?.message || outerErr}`);
    return res.status(503).json({
      error: "transcription_unavailable",
      message: "Səsin mətnə çevrilməsi hazırda mümkün deyil. Bir qədər sonra yenidən cəhd edin.",
    });
  }
});

// =========================================================================
// API 4: GENERAL ASSISTANT CHAT
// =========================================================================
app.post("/api/ask-assistant", async (req, res) => {
  try {
    const { question, reminders, userNowISO, userTimezone } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Sual daxil edilməyib." });
    }

    const now = userNowISO ? new Date(userNowISO) : new Date();
    const timezone = userTimezone || "Asia/Baku";
    const userNowFormatted = now.toLocaleString("az-AZ", {
      timeZone: timezone,
      dateStyle: "full",
      timeStyle: "medium",
    });

    const systemInstruction = `Sən "Unutma AI" tətbiqinin köməkçi mühərrikisən.
Hazırkı cari vaxt: ${userNowFormatted} (ISO: ${now.toISOString()}).
İstifadəçinin zaman qurşağı: ${timezone}.
İstifadəçinin hazırkı xatırlatmaları:
${JSON.stringify(reminders || [], null, 2)}

İstifadəçinin sualına Azərbaycan dilində aydın, mehriban və lakonik cavab ver.`;

    const response = await getAI().models.generateContent({
      model: "gemini-3.8-flash",
      contents: `İstifadəçinin sualı: "${question}"`,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    return res.json({
      success: true,
      answer: response.text?.trim() || "Cavab hazırlana bilmədi.",
    });
  } catch (error: any) {
    console.error("Error in ask-assistant:", error);
    return res.status(500).json({
      error: "Köməkçi ilə əlaqə zamanı xəta: " + (error?.message || "Bilinməyən xəta"),
    });
  }
});

// Production and dev server
async function startServer() {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Unutma AI server running on http://localhost:${PORT}`);
  });
}

startServer();
