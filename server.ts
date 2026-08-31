import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

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

// Initialize Gemini SDK with User-Agent telemetry
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Public health check endpoints
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "unutma-ai-api" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "unutma-ai-api" });
});

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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
    });

    const parsed = JSON.parse(response.text || "{}");
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
İstifadəçinin Azərbaycan dilindəki istənilən əmrini, sualını və ya tapşırığını analiz edib DƏQİQ STRUKTURLAŞDIRILMIŞ FƏALİYYƏT (action) generasiya etməkdir:

1. 'create_reminder' / 'create_multiple_reminders':
   - Məsələn: "Sabah saat 15:00-a görüş əlavə et" və ya "Sabah saat 10-da Anara zəng et və 2-də maşını apar".
   - remindersToCreate massivində dəqiq ISO dueDateTime ilə xatırlatmaları tərtib et.

2. 'update_reminder':
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

8. 'general_chat':
   - Ümumi söhbət və ya köməkçi sualları üçün.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
          },
          required: ["action", "responseMessage"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json({
      success: true,
      actionPayload: {
        action: parsed.action || "general_chat",
        responseMessage: parsed.responseMessage || "Sorğunuz cavablandırıldı.",
        targetReminderId: parsed.targetReminderId,
        targetQuery: parsed.targetQuery,
        delayMinutes: parsed.delayMinutes,
        updateFields: parsed.updateFields,
        remindersToCreate: (parsed.remindersToCreate || []).map((r: any, idx: number) => ({
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
// API 3: AUDIO TRANSCRIPTION WITH GEMINI
// =========================================================================
app.post("/api/transcribe-audio", async (req, res) => {
  try {
    const { base64Audio, mimeType } = req.body;
    if (!base64Audio) {
      return res.status(400).json({ error: "Səs faylı göndərilməyib." });
    }

    const audioPart = {
      inlineData: {
        mimeType: mimeType || "audio/webm",
        data: base64Audio,
      },
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          audioPart,
          {
            text: "Bu səs faylı Azərbaycan dilindədir. Zəhmət olmasa tələffüz edilən sözləri dəqiq Azərbaycan əlifbası və orfoqrafiyası ilə transkripsiya et. Heç bir əlavə giriş və ya şərh yazma, yalnız təmiz mətni qaytar.",
          },
        ],
      },
    });

    return res.json({
      success: true,
      transcription: response.text?.trim() || "",
    });
  } catch (error: any) {
    console.error("Error in transcribe-audio:", error);
    return res.status(500).json({
      error: "Səsin transkripsiyası zamanı xəta: " + (error?.message || "Bilinməyən xəta"),
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
