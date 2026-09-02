var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "50mb" }));
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
var ai = new import_genai.GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "unutma-ai-api" });
});
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "unutma-ai-api" });
});
function classifyGeminiError(error) {
  const msg = String(error?.message || "");
  const status = Number(error?.status || error?.statusCode || error?.code);
  const statusStr = String(error?.status || error?.statusCode || error?.code || "");
  const is503 = status === 503 || statusStr.includes("503") || /503|UNAVAILABLE|high demand|overloaded|service unavailable|backend unavailable|currently experiencing high demand/i.test(msg);
  const is429 = status === 429 || statusStr.includes("429") || /429|RESOURCE_EXHAUSTED|resource exhausted|quota exceeded|too many requests|rate limit/i.test(msg);
  let retryAfterMs;
  if (error?.retryAfter && Number(error.retryAfter) > 0) {
    retryAfterMs = Number(error.retryAfter) * 1e3;
  } else if (error?.response?.headers) {
    const headerVal = error.response.headers.get?.("retry-after") || error.response.headers["retry-after"];
    if (headerVal && Number(headerVal) > 0) {
      retryAfterMs = Number(headerVal) * 1e3;
    }
  }
  if (!retryAfterMs) {
    const match = msg.match(/retry (?:after|in) ([0-9.]+)s/i);
    if (match && match[1]) {
      const parsed = parseFloat(match[1]);
      if (!isNaN(parsed) && parsed > 0) {
        retryAfterMs = Math.round(parsed * 1e3);
      }
    }
  }
  return {
    is503,
    is429,
    isOverloadedOrQuota: is503 || is429,
    retryAfterMs
  };
}
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function getRetryDelay(attemptIndex, suggestedRetryAfterMs) {
  if (suggestedRetryAfterMs && suggestedRetryAfterMs >= 500 && suggestedRetryAfterMs <= 1e4) {
    return suggestedRetryAfterMs;
  }
  return attemptIndex === 1 ? 2e3 : 5e3;
}
var TEXT_AI_MODELS = [
  "gemini-3.7-flash",
  // Primary model
  "gemini-2.5-flash"
  // Fallback model
];
var MAX_TEXT_AI_BUDGET_MS = 14e3;
var MAX_RETRIES_PER_TEXT_MODEL = 1;
async function generateTextAIWithBudget(configParams) {
  const startTime = Date.now();
  let lastError = null;
  const tag = configParams.tag || "TEXT-AI";
  for (let mIdx = 0; mIdx < TEXT_AI_MODELS.length; mIdx++) {
    const model = TEXT_AI_MODELS[mIdx];
    for (let attempt = 1; attempt <= MAX_RETRIES_PER_TEXT_MODEL + 1; attempt++) {
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_TEXT_AI_BUDGET_MS) {
        console.warn(`[${tag}] budget exceeded: ${elapsed}ms > ${MAX_TEXT_AI_BUDGET_MS}ms. Immediate fallback.`);
        throw new Error(`AI icra b\xFCdc\u0259si (${MAX_TEXT_AI_BUDGET_MS / 1e3}s) ba\u015Fa \xE7atd\u0131`);
      }
      console.log(`[${tag}] model: ${model} (attempt ${attempt}/${MAX_RETRIES_PER_TEXT_MODEL + 1}, elapsed ${elapsed}ms)`);
      try {
        const response = await ai.models.generateContent({
          model,
          contents: configParams.contents,
          config: configParams.config
        });
        return { text: response.text, modelUsed: model };
      } catch (err) {
        lastError = err;
        const { isOverloadedOrQuota, retryAfterMs } = classifyGeminiError(err);
        console.warn(`[${tag}] error on ${model} (attempt ${attempt}):`, err?.message || err);
        if (isOverloadedOrQuota && attempt <= MAX_RETRIES_PER_TEXT_MODEL) {
          const delay = Math.min(getRetryDelay(attempt, retryAfterMs), 2e3);
          console.log(`[${tag}] retrying ${model} in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        break;
      }
    }
  }
  throw lastError || new Error("Text AI models exhausted");
}
app.post("/api/parse-reminder", async (req, res) => {
  try {
    const { text, userNowISO, userTimezone } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "M\u0259tn daxil edilm\u0259yib." });
    }
    const now = userNowISO ? new Date(userNowISO) : /* @__PURE__ */ new Date();
    const timezone = userTimezone || "Asia/Baku";
    const userNowFormatted = now.toLocaleString("az-AZ", {
      timeZone: timezone,
      dateStyle: "full",
      timeStyle: "medium"
    });
    const systemInstruction = `S\u0259n "Unutma AI" t\u0259tbiqinin Az\u0259rbaycan dili \xFC\xE7\xFCn d\u0259rin t\u0259bii dil analizi v\u0259 xat\u0131rlatma m\xFCh\u0259rrikis\u0259n.
Haz\u0131rk\u0131 cari vaxt: ${userNowFormatted} (ISO: ${now.toISOString()}).
\u0130stifad\u0259\xE7inin zaman qur\u015Fa\u011F\u0131: ${timezone}.

\u018FSAS QAYDALAR V\u018F T\u018FL\u018FBL\u018FR:
1. \xC7OXLU XATIRLATMA (MULTI-REMINDER) AYIRMA:
   \u0130stifad\u0259\xE7inin dediyi m\xFCr\u0259kk\u0259b c\xFCml\u0259ni ayr\u0131-ayr\u0131 m\xFCst\u0259qil xat\u0131rlatmalara b\xF6l.
   M\u0259s\u0259l\u0259n:
   "Sabah saat 10-da Anara z\u0259ng etm\u0259yi, g\xFCnorta 2-d\u0259 ma\u015F\u0131n\u0131 ustaya aparma\u011F\u0131, ax\u015Fam anam\u0131n d\u0259rman\u0131n\u0131 alma\u011F\u0131 xat\u0131rlat."
   -> N\u0259tic\u0259d\u0259 3 F\u018FRQL\u0130 xat\u0131rlatma obyekti olmal\u0131d\u0131r:
   1. Ba\u015Fl\u0131q: "Anara z\u0259ng et", Vaxt: Sabah 10:00, Kateqoriya: 'work' v\u0259 ya 'personal', inferredTime: false
   2. Ba\u015Fl\u0131q: "Ma\u015F\u0131n\u0131 ustaya apar", Vaxt: Sabah 14:00, Kateqoriya: 'personal', inferredTime: false
   3. Ba\u015Fl\u0131q: "Anam\u0131n d\u0259rman\u0131n\u0131 al", Vaxt: Sabah 20:00 (ax\u015Fam), Kateqoriya: 'health', inferredTime: true (\xE7\xFCnki konkret saat deyilm\u0259yib, ax\u015Fam kimi qeyd edilib)

2. AZ\u018FRBAYCAN D\u0130L\u0130 ZAMAN ANLAYI\u015ELARI (D\u018FQ\u0130Q \xC7EV\u0130RM\u018F):
   - "bu g\xFCn" -> Haz\u0131rk\u0131 g\xFCn (${now.toISOString().slice(0, 10)})
   - "sabah" -> Sabahk\u0131 g\xFCn (+1 g\xFCn)
   - "birig\xFCn" -> Birig\xFCn (+2 g\xFCn)
   - "bu ax\u015Fam" -> Bu g\xFCn saat 20:00
   - "sabah s\u0259h\u0259r" -> Sabah saat 09:00 (inferredTime: true)
   - "sabah g\xFCnorta" -> Sabah saat 13:00 / 14:00 (inferredTime: true)
   - "sabah ax\u015Fam" -> Sabah saat 20:00 (inferredTime: true)
   - "g\u0259l\u0259n h\u0259ft\u0259" -> N\xF6vb\u0259ti h\u0259ft\u0259nin bazar ert\u0259si (+7 g\xFCn)
   - "g\u0259l\u0259n bazar ert\u0259si" -> N\xF6vb\u0259ti h\u0259ft\u0259nin Bazar ert\u0259si saat 09:00
   - "c\xFCm\u0259 g\xFCn\xFC" -> Yax\u0131nla\u015Fan C\xFCm\u0259 g\xFCn\xFC
   - "ay\u0131n 15-i" -> Cari/n\xF6vb\u0259ti ay\u0131n 15-i saat 10:00
   - "2 saat sonra" -> Cari vaxtdan d\u0259qiq 2 saat sonra
   - "30 d\u0259qiq\u0259 sonra" -> Cari vaxtdan 30 d\u0259qiq\u0259 sonra

3. ZAMANIN \u0130NF\u018FR ED\u0130LM\u018FS\u0130 (inferredTime):
   - \u018Fg\u0259r istifad\u0259\xE7i "saat 10-da" v\u0259 ya "14:00-da" kimi d\u0259qiq saat dedis\u0259: inferredTime = false, timeConfidence = "exact".
   - \u018Fg\u0259r "ax\u015Fam", "s\u0259h\u0259r", "g\xFCnorta" kimi qeyri-d\u0259qiq ifad\u0259 i\u015Fl\u0259tdis\u0259: inferredTime = true, timeConfidence = "inferred".
   - \u018Fg\u0259r saat he\xE7 deyilm\u0259yibs\u0259 (m\u0259s. "Sabah Anarla g\xF6r\xFC\u015F"): inferredTime = true, timeConfidence = "inferred" (m\u0259s\u0259l\u0259n, sabah 10:00 qoy).

4. T\u018FKRARLANMA (Recurrence):
   - "h\u0259r g\xFCn" -> 'daily'
   - "h\u0259r h\u0259ft\u0259" / "h\u0259r bazar ert\u0259si" -> 'weekly'
   - "h\u0259r ay" / "h\u0259r ay\u0131n 5-i" -> 'monthly'
   - "h\u0259r il" -> 'yearly'
   - "h\u0259ft\u0259i\xE7i" -> 'weekdays'
   - dig\u0259r hallar -> 'none'

5. KATEQOR\u0130YA (Category):
   'health' (sa\u011Flaml\u0131q, h\u0259kim, d\u0259rman, analiz), 'work' (i\u015F, g\xF6r\xFC\u015F, iclas, hesabat, m\xFC\u015Ft\u0259ri), 'finance' (\xF6d\u0259ni\u015F, bank, kart, kiray\u0259, borc), 'personal' (\u015F\u0259xsi, ail\u0259, z\u0259ng, idman), 'shopping' (market, al\u0131\u015F-veri\u015F, ma\u011Faza), 'education' (d\u0259rs, kurs, imtahan, kitab), 'home' (ev, usta, t\u0259mizlik, t\u0259mir), 'other'.

6. X\xDCLAS\u018F (summary):
   Az\u0259rbaycan dilind\u0259 \xE7ox ayd\u0131n, s\u0259liq\u0259li v\u0259 mehriban x\xFClas\u0259 c\xFCml\u0259si qaytar (m\u0259s\u0259l\u0259n: "3 xat\u0131rlatma tapd\u0131m: Sabah 10:00 Anara z\u0259ng, 14:00 usta v\u0259 ax\u015Fam 20:00 d\u0259rman.").`;
    const aiResponse = await generateTextAIWithBudget({
      contents: `\u0130stifad\u0259\xE7inin m\u0259tni: "${text}"`,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            summary: {
              type: import_genai.Type.STRING,
              description: "Az\u0259rbaycan dilind\u0259 q\u0131sa v\u0259 ayd\u0131n x\xFClas\u0259"
            },
            reminders: {
              type: import_genai.Type.ARRAY,
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  title: { type: import_genai.Type.STRING, description: "Xat\u0131rlatman\u0131n lakonik ba\u015Fl\u0131\u011F\u0131" },
                  description: { type: import_genai.Type.STRING, description: "\u018Flav\u0259 qeydl\u0259r v\u0259 ya t\u0259svir" },
                  dueDateTime: { type: import_genai.Type.STRING, description: "ISO 8601 format\u0131nda d\u0259qiq tarix v\u0259 vaxt (UTC format\u0131nda)" },
                  category: {
                    type: import_genai.Type.STRING,
                    enum: ["health", "work", "finance", "personal", "shopping", "education", "home", "other"]
                  },
                  recurrence: {
                    type: import_genai.Type.STRING,
                    enum: ["none", "daily", "weekly", "monthly", "yearly", "weekdays", "custom"]
                  },
                  priority: {
                    type: import_genai.Type.STRING,
                    enum: ["high", "medium", "low"]
                  },
                  inferredTime: {
                    type: import_genai.Type.BOOLEAN,
                    description: "Vaxt\u0131n d\u0259qiq deyil, t\u0259xmini infer edildiyini bildirir"
                  },
                  timeConfidence: {
                    type: import_genai.Type.STRING,
                    enum: ["exact", "inferred", "ambiguous"]
                  }
                },
                required: ["title", "dueDateTime", "category", "recurrence", "priority"]
              }
            }
          },
          required: ["summary", "reminders"]
        }
      },
      tag: "PARSE-REMINDER"
    });
    const parsed = JSON.parse(aiResponse.text || "{}");
    return res.json({
      success: true,
      summary: parsed.summary || `${(parsed.reminders || []).length} xat\u0131rlatma tap\u0131ld\u0131.`,
      reminders: (parsed.reminders || []).map((item, idx) => ({
        id: `extracted-${Date.now()}-${idx}`,
        title: item.title,
        description: item.description || "",
        dueDateTime: item.dueDateTime,
        category: item.category || "other",
        recurrence: item.recurrence || "none",
        priority: item.priority || "medium",
        inferredTime: Boolean(item.inferredTime || item.timeConfidence === "inferred"),
        timeConfidence: item.timeConfidence || (item.inferredTime ? "inferred" : "exact")
      }))
    });
  } catch (error) {
    console.error("Error in parse-reminder:", error);
    return res.status(500).json({
      error: "Xat\u0131rlatman\u0131n analizi zaman\u0131 x\u0259ta ba\u015F verdi: " + (error?.message || "Bilinm\u0259y\u0259n x\u0259ta")
    });
  }
});
app.post("/api/ai-action", async (req, res) => {
  console.log("[AI-ACTION] request received");
  try {
    const { userPrompt, reminders, userNowISO, userTimezone } = req.body;
    if (!userPrompt) {
      return res.status(400).json({ error: "\u018Fmr v\u0259 ya sual daxil edilm\u0259yib." });
    }
    const now = userNowISO ? new Date(userNowISO) : /* @__PURE__ */ new Date();
    const timezone = userTimezone || "Asia/Baku";
    const userNowFormatted = now.toLocaleString("az-AZ", {
      timeZone: timezone,
      dateStyle: "full",
      timeStyle: "medium"
    });
    const systemInstruction = `S\u0259n "Unutma AI" t\u0259tbiqinin \u0130ntellektual \u018Fmr v\u0259 \u0130dar\u0259etm\u0259 M\xFCh\u0259rrikis\u0259n.
Haz\u0131rk\u0131 cari vaxt: ${userNowFormatted} (ISO: ${now.toISOString()}).
\u0130stifad\u0259\xE7inin zaman qur\u015Fa\u011F\u0131: ${timezone}.

\u0130ST\u0130FAD\u018F\xC7\u0130N\u0130N HAZIRDA M\xD6VCUD OLAN XATIRLATMALARI:
${JSON.stringify(reminders || [], null, 2)}

S\u018FN\u0130N M\u018FQS\u018FD\u0130N:
\u0130stifad\u0259\xE7inin Az\u0259rbaycan dilind\u0259ki ist\u0259nil\u0259n \u0259mrini, sual\u0131n\u0131 v\u0259 ya tap\u015F\u0131r\u0131\u011F\u0131n\u0131 analiz edib D\u018FQ\u0130Q STRUKTURLA\u015EDIRILMI\u015E F\u018FAL\u0130YY\u018FT (action) generasiya etm\u0259kdir:

1. 'create_reminder' / 'create_multiple_reminders':
   - M\u0259s\u0259l\u0259n: "Sabah saat 15:00-a g\xF6r\xFC\u015F \u0259lav\u0259 et" v\u0259 ya "Sabah saat 10-da Anara z\u0259ng et v\u0259 2-d\u0259 ma\u015F\u0131n\u0131 apar".
   - remindersToCreate massivind\u0259 d\u0259qiq ISO dueDateTime il\u0259 xat\u0131rlatmalar\u0131 t\u0259rtib et.

2. 'update_reminder':
   - M\u0259s\u0259l\u0259n: "Sabahk\u0131 Anarla g\xF6r\xFC\u015F\xFCm\xFC 1 saat gecikdir", "D\u0259rman xat\u0131rlatmas\u0131n\u0131 saat 21:00-a d\u0259yi\u015F".
   - targetReminderId-ni m\xF6vcud siyah\u0131dan tap v\u0259 ya delayMinutes: 60 / updateFields t\u0259yin et.

3. 'delete_reminder':
   - M\u0259s\u0259l\u0259n: "C\xFCm\u0259 g\xFCn\xFC olan g\xF6r\xFC\u015F\xFCm\xFC sil", "\u0130dman xat\u0131rlatmas\u0131n\u0131 l\u0259\u011Fv et".
   - targetReminderId-ni m\xF6vcud siyah\u0131dan tap.

4. 'complete_reminder':
   - M\u0259s\u0259l\u0259n: "D\u0259rman i\xE7m\u0259yi tamamla", "Hesabat g\xF6nd\u0259rm\u0259yi bitmi\u015F kimi qeyd et".
   - targetReminderId-ni t\u0259yin et.

5. 'get_daily_schedule':
   - M\u0259s\u0259l\u0259n: "Bu g\xFCn n\u0259 plan\u0131m var?", "Sabah n\u0259 etm\u0259liy\u0259m?", "Birig\xFCn n\u0259 var?".
   - responseMessage-d\u0259 m\xF6vcud xat\u0131rlatmalardan istifad\u0259 ed\u0259r\u0259k saatlar\u0131 il\u0259 ayd\u0131n v\u0259 s\u0259liq\u0259li cavab ver. \u018Fg\u0259r plan yoxdursa "H\u0259min g\xFCn \xFC\xE7\xFCn he\xE7 bir plan\u0131n\u0131z yoxdur, rahat istirah\u0259t ed\u0259 bil\u0259rsiniz" de.

6. 'get_weekly_schedule':
   - M\u0259s\u0259l\u0259n: "Bu h\u0259ft\u0259 hans\u0131 g\xFCn\xFCm daha bo\u015Fdur?", "H\u0259ft\u0259lik c\u0259dv\u0259limi g\xF6st\u0259r".
   - H\u0259ft\u0259 g\xFCnl\u0259rini xat\u0131rlatmalar\u0131n s\u0131xl\u0131\u011F\u0131na g\xF6r\u0259 analiz et v\u0259 \u0259n bo\u015F g\xFCnl\u0259ri qeyd ed\u0259r\u0259k cavab ver.

7. 'search_reminders':
   - M\u0259s\u0259l\u0259n: "H\u0259kiml\u0259 ba\u011Fl\u0131 n\u0259 xat\u0131rlatmam var?", "Anar haqq\u0131nda planlar".
   - targetQuery a\xE7ar s\xF6z\xFCn\xFC v\u0259 responseMessage-d\u0259 n\u0259tic\u0259ni t\u0259qdim et.

8. 'general_chat':
   - \xDCmumi s\xF6hb\u0259t v\u0259 ya k\xF6m\u0259k\xE7i suallar\u0131 \xFC\xE7\xFCn.`;
    console.log("[AI-ACTION] Text AI generation started (1 primary + 1 fallback, 10-15s budget)");
    const aiResponse = await generateTextAIWithBudget({
      contents: `\u0130stifad\u0259\xE7inin s\xF6zl\u0259ri: "${userPrompt}"`,
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            action: {
              type: import_genai.Type.STRING,
              enum: [
                "create_reminder",
                "create_multiple_reminders",
                "update_reminder",
                "delete_reminder",
                "complete_reminder",
                "search_reminders",
                "get_daily_schedule",
                "get_weekly_schedule",
                "general_chat"
              ],
              description: "\u0130cra edil\u0259c\u0259k f\u0259aliyy\u0259t n\xF6v\xFC"
            },
            responseMessage: {
              type: import_genai.Type.STRING,
              description: "\u0130stifad\u0259\xE7iy\u0259 Az\u0259rbaycan dilind\u0259 qaytar\u0131lacaq ayd\u0131n v\u0259 s\u0259lis cavab"
            },
            targetReminderId: {
              type: import_genai.Type.STRING,
              description: "D\u0259yi\u015Fdiril\u0259c\u0259k v\u0259 ya silin\u0259c\u0259k xat\u0131rlatman\u0131n ID-si (varsa)"
            },
            targetQuery: {
              type: import_genai.Type.STRING,
              description: "Axtar\u0131\u015F \xFC\xE7\xFCn a\xE7ar s\xF6z (varsa)"
            },
            delayMinutes: {
              type: import_genai.Type.NUMBER,
              description: "T\u0259xir\u0259 sal\u0131nma d\u0259qiq\u0259si (m\u0259s: 60)"
            },
            updateFields: {
              type: import_genai.Type.OBJECT,
              properties: {
                title: { type: import_genai.Type.STRING },
                description: { type: import_genai.Type.STRING },
                dueDateTime: { type: import_genai.Type.STRING },
                category: { type: import_genai.Type.STRING },
                priority: { type: import_genai.Type.STRING }
              }
            },
            remindersToCreate: {
              type: import_genai.Type.ARRAY,
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  title: { type: import_genai.Type.STRING },
                  description: { type: import_genai.Type.STRING },
                  dueDateTime: { type: import_genai.Type.STRING },
                  category: {
                    type: import_genai.Type.STRING,
                    enum: ["health", "work", "finance", "personal", "shopping", "education", "home", "other"]
                  },
                  recurrence: {
                    type: import_genai.Type.STRING,
                    enum: ["none", "daily", "weekly", "monthly", "yearly", "weekdays", "custom"]
                  },
                  priority: {
                    type: import_genai.Type.STRING,
                    enum: ["high", "medium", "low"]
                  },
                  inferredTime: { type: import_genai.Type.BOOLEAN }
                },
                required: ["title", "dueDateTime", "category", "recurrence", "priority"]
              }
            }
          },
          required: ["action", "responseMessage"]
        }
      },
      tag: "AI-ACTION"
    });
    console.log("[AI-ACTION] Text AI response received");
    const parsed = JSON.parse(aiResponse.text || "{}");
    return res.json({
      success: true,
      actionPayload: {
        action: parsed.action || "general_chat",
        responseMessage: parsed.responseMessage || "Sor\u011Funuz cavabland\u0131r\u0131ld\u0131.",
        targetReminderId: parsed.targetReminderId,
        targetQuery: parsed.targetQuery,
        delayMinutes: parsed.delayMinutes,
        updateFields: parsed.updateFields,
        remindersToCreate: (parsed.remindersToCreate || []).map((r, idx) => ({
          id: `extracted-${Date.now()}-${idx}`,
          title: r.title,
          description: r.description || "",
          dueDateTime: r.dueDateTime,
          category: r.category || "other",
          recurrence: r.recurrence || "none",
          priority: r.priority || "medium",
          inferredTime: Boolean(r.inferredTime)
        }))
      }
    });
  } catch (error) {
    console.error("Error in ai-action:", error);
    return res.status(500).json({
      error: "AI f\u0259aliyy\u0259tinin analizi zaman\u0131 x\u0259ta: " + (error?.message || "Bilinm\u0259y\u0259n x\u0259ta")
    });
  }
});
var AUDIO_TRANSCRIPTION_MODELS = [
  "gemini-2.5-flash",
  "gemini-3.7-flash"
];
var MAX_TRANSCRIPTION_BUDGET_MS = 15e3;
app.post("/api/transcribe-audio", async (req, res) => {
  const startTime = Date.now();
  console.log("[TRANSCRIBE] request received");
  try {
    const { base64Audio, mimeType } = req.body;
    const cleanBase64 = String(base64Audio || "").replace(/^data:.*?;base64,/, "").replace(/\s/g, "").trim();
    const rawLen = typeof base64Audio === "string" ? base64Audio.length : 0;
    console.log("[TRANSCRIBE] received mimeType:", mimeType);
    console.log("[TRANSCRIBE] base64 length:", rawLen);
    console.log("[TRANSCRIBE] normalized base64 length:", cleanBase64.length);
    if (!cleanBase64 || cleanBase64.length < 100 || !/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
      console.warn("[TRANSCRIBE] payload validation failed: invalid base64 string or length < 100");
      return res.status(400).json({ error: "S\u0259s m\u0259lumat\u0131 d\xFCzg\xFCn formatda deyil." });
    }
    console.log("[TRANSCRIBE] payload validation passed: true");
    const cleanMimeType = (mimeType || "audio/aac").trim();
    const audioPart = {
      inlineData: {
        mimeType: cleanMimeType,
        data: cleanBase64
      }
    };
    const promptText = "Bu s\u0259s fayl\u0131 Az\u0259rbaycan dilind\u0259dir. Z\u0259hm\u0259t olmasa t\u0259l\u0259ff\xFCz edil\u0259n s\xF6zl\u0259ri d\u0259qiq Az\u0259rbaycan \u0259lifbas\u0131 v\u0259 orfoqrafiyas\u0131 il\u0259 transkripsiya et. He\xE7 bir \u0259lav\u0259 giri\u015F v\u0259 ya \u015F\u0259rh yazma, yaln\u0131z t\u0259miz m\u0259tni qaytar.";
    let lastError = null;
    let hadOverloadOrQuota = false;
    const MAX_RETRIES_PER_MODEL = 1;
    for (let mIdx = 0; mIdx < AUDIO_TRANSCRIPTION_MODELS.length; mIdx++) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= MAX_TRANSCRIPTION_BUDGET_MS) {
        console.warn(`[TRANSCRIBE] Budget exhausted (${elapsed}ms >= ${MAX_TRANSCRIPTION_BUDGET_MS}ms) before trying ${AUDIO_TRANSCRIPTION_MODELS[mIdx]}`);
        break;
      }
      const model = AUDIO_TRANSCRIPTION_MODELS[mIdx];
      console.log(`[TRANSCRIBE] audio model selected: ${model}`);
      for (let attempt = 1; attempt <= MAX_RETRIES_PER_MODEL + 1; attempt++) {
        const attemptElapsed = Date.now() - startTime;
        if (attemptElapsed >= MAX_TRANSCRIPTION_BUDGET_MS) {
          console.warn(`[TRANSCRIBE] Budget exhausted (${attemptElapsed}ms >= ${MAX_TRANSCRIPTION_BUDGET_MS}ms) during attempt ${attempt} of ${model}`);
          break;
        }
        console.log(`[TRANSCRIBE] attempt: ${model} (attempt ${attempt}/${MAX_RETRIES_PER_MODEL + 1})`);
        try {
          console.log("[TRANSCRIBE] model request started");
          const response = await ai.models.generateContent({
            model,
            contents: {
              parts: [
                audioPart,
                { text: promptText }
              ]
            }
          });
          console.log("[TRANSCRIBE] model response received");
          const transcriptionText = response.text?.trim() || "";
          console.log(`[TRANSCRIBE] success: ${model} (length: ${transcriptionText.length} chars)`);
          return res.json({
            success: true,
            transcription: transcriptionText,
            modelUsed: model
          });
        } catch (err) {
          lastError = err;
          const { is503, is429, isOverloadedOrQuota, retryAfterMs } = classifyGeminiError(err);
          if (is503) {
            hadOverloadOrQuota = true;
            console.warn(`[TRANSCRIBE] 503 detected: ${model} (attempt ${attempt}) - ${err?.message || err}`);
          } else if (is429) {
            hadOverloadOrQuota = true;
            console.warn(`[TRANSCRIBE] 429 detected: ${model} (attempt ${attempt}) - ${err?.message || err}`);
          } else {
            console.warn(`[TRANSCRIBE] error: ${model} (attempt ${attempt}) - ${err?.message || err}`);
          }
          const currentElapsed = Date.now() - startTime;
          const remainingBudget = MAX_TRANSCRIPTION_BUDGET_MS - currentElapsed;
          if (isOverloadedOrQuota && attempt <= MAX_RETRIES_PER_MODEL && remainingBudget > 1500) {
            const delay = Math.min(getRetryDelay(attempt, retryAfterMs), remainingBudget - 1e3);
            if (delay > 0) {
              console.log(`[TRANSCRIBE] Retrying ${model} in ${delay}ms... (budget left: ${remainingBudget}ms)`);
              await sleep(delay);
              continue;
            }
          }
          break;
        }
      }
      if (mIdx < AUDIO_TRANSCRIPTION_MODELS.length - 1) {
        const nextModel = AUDIO_TRANSCRIPTION_MODELS[mIdx + 1];
        console.log(`[TRANSCRIBE] fallback model: switching from ${model} to ${nextModel}`);
      }
    }
    console.error(`[TRANSCRIBE] all models failed: all ${AUDIO_TRANSCRIPTION_MODELS.length} audio models exhausted or budget exceeded. Last error:`, lastError);
    if (hadOverloadOrQuota) {
      return res.status(503).json({
        error: "S\u0259s qeyd\u0259 al\u0131nd\u0131, lakin AI transkripsiya xidm\u0259ti haz\u0131rda m\u0259\u015F\u011Fuldur. Bir az sonra yenid\u0259n c\u0259hd edin."
      });
    }
    return res.status(500).json({
      error: "S\u0259sin transkripsiyas\u0131 zaman\u0131 x\u0259ta: " + (lastError?.message || "Bilinm\u0259y\u0259n x\u0259ta")
    });
  } catch (error) {
    console.error("Error in transcribe-audio route handler:", error);
    return res.status(500).json({
      error: "S\u0259sin transkripsiyas\u0131 zaman\u0131 x\u0259ta: " + (error?.message || "Bilinm\u0259y\u0259n x\u0259ta")
    });
  }
});
app.post("/api/ask-assistant", async (req, res) => {
  try {
    const { question, reminders, userNowISO, userTimezone } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Sual daxil edilm\u0259yib." });
    }
    const now = userNowISO ? new Date(userNowISO) : /* @__PURE__ */ new Date();
    const timezone = userTimezone || "Asia/Baku";
    const userNowFormatted = now.toLocaleString("az-AZ", {
      timeZone: timezone,
      dateStyle: "full",
      timeStyle: "medium"
    });
    const systemInstruction = `S\u0259n "Unutma AI" t\u0259tbiqinin k\xF6m\u0259k\xE7i m\xFCh\u0259rrikis\u0259n.
Haz\u0131rk\u0131 cari vaxt: ${userNowFormatted} (ISO: ${now.toISOString()}).
\u0130stifad\u0259\xE7inin zaman qur\u015Fa\u011F\u0131: ${timezone}.
\u0130stifad\u0259\xE7inin haz\u0131rk\u0131 xat\u0131rlatmalar\u0131:
${JSON.stringify(reminders || [], null, 2)}

\u0130stifad\u0259\xE7inin sual\u0131na Az\u0259rbaycan dilind\u0259 ayd\u0131n, mehriban v\u0259 lakonik cavab ver.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `\u0130stifad\u0259\xE7inin sual\u0131: "${question}"`,
      config: {
        systemInstruction,
        temperature: 0.3
      }
    });
    return res.json({
      success: true,
      answer: response.text?.trim() || "Cavab haz\u0131rlana bilm\u0259di."
    });
  } catch (error) {
    console.error("Error in ask-assistant:", error);
    return res.status(500).json({
      error: "K\xF6m\u0259k\xE7i il\u0259 \u0259laq\u0259 zaman\u0131 x\u0259ta: " + (error?.message || "Bilinm\u0259y\u0259n x\u0259ta")
    });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Unutma AI server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
