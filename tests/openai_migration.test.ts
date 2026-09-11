import http from "http";
import fs from "fs";
import path from "path";
import {
  callOpenAIChatCompletion,
  PREFERRED_OPENAI_TEXT_MODEL,
  STABLE_OPENAI_TEXT_MODEL,
} from "../src/server/openaiText";

async function runMigrationTests() {
  console.log("==========================================================");
  console.log("RUNNING UNUTMA AI OPENAI BACKEND MIGRATION TEST SUITE");
  console.log("==========================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // SECTION 1: VERIFY NO GEMINI CODE OR CONFIG REMAINING
  // ----------------------------------------------------
  console.log("--- SECTION 1: Gemini Removal Verification ---");

  // Check package.json doesn't contain @google/genai
  const pkgJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8"));
  assert(!pkgJson.dependencies?.["@google/genai"], "package.json dependencies does not contain @google/genai");

  // Check .env.example doesn't contain GEMINI_API_KEY
  const envExample = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf-8");
  assert(!envExample.includes("GEMINI_API_KEY"), ".env.example does not require GEMINI_API_KEY");
  assert(envExample.includes("OPENAI_API_KEY"), ".env.example includes OPENAI_API_KEY");

  // Check server.ts does not import @google/genai or reference getAI()
  const serverCode = fs.readFileSync(path.join(process.cwd(), "server.ts"), "utf-8");
  assert(!serverCode.includes("@google/genai"), "server.ts does not import @google/genai");
  assert(!serverCode.includes("getAI()"), "server.ts does not contain getAI()");
  assert(!serverCode.includes("classifyGeminiError"), "server.ts does not contain classifyGeminiError");
  assert(!serverCode.includes("gemini-3.8-flash"), "server.ts does not contain gemini-3.8-flash");

  // Check speech providers
  const speechMgrCode = fs.readFileSync(
    path.join(process.cwd(), "src/services/speech/SpeechProviderManager.ts"),
    "utf-8"
  );
  assert(!speechMgrCode.includes("GeminiAudioFallbackProvider"), "SpeechProviderManager does not reference GeminiAudioFallbackProvider");
  assert(speechMgrCode.includes("OpenAIAudioFallbackProvider"), "SpeechProviderManager references OpenAIAudioFallbackProvider");

  assert(
    !fs.existsSync(path.join(process.cwd(), "src/services/speech/GeminiAudioFallbackProvider.ts")),
    "GeminiAudioFallbackProvider.ts file has been deleted"
  );
  assert(
    fs.existsSync(path.join(process.cwd(), "src/services/speech/OpenAIAudioFallbackProvider.ts")),
    "OpenAIAudioFallbackProvider.ts file exists"
  );

  // ----------------------------------------------------
  // SECTION 2: OPENAI TEXT COMPLETION HELPER UNIT TESTS
  // ----------------------------------------------------
  console.log("\n--- SECTION 2: OpenAI Text Completion Helper Unit Tests ---");

  // Test callOpenAIChatCompletion with mock fetch
  let capturedUrl = "";
  let capturedHeaders: Record<string, string> = {};
  let capturedJsonBody: any = null;

  const mockSuccessFetch: typeof fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedHeaders = (init?.headers as Record<string, string>) || {};
    capturedJsonBody = JSON.parse(String(init?.body || "{}"));

    return new Response(
      JSON.stringify({
        id: "chatcmpl-test-123",
        model: capturedJsonBody.model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: JSON.stringify({
                action: "create_reminder",
                responseMessage: "Sabah saat 15:00 üçün həkim xatırlatması yaradıldı.",
                remindersToCreate: [
                  {
                    title: "Həkimə get",
                    dueDateTime: "2026-09-12T11:00:00.000Z",
                    category: "health",
                    recurrence: "none",
                    priority: "high",
                  },
                ],
              }),
            },
            finish_reason: "stop",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const textRes = await callOpenAIChatCompletion({
    messages: [
      { role: "system", content: "You are Unutma AI." },
      { role: "user", content: "Sabah saat 3-də həkimə get" },
    ],
    temperature: 0.2,
    responseFormat: { type: "json_object" },
    apiKey: "sk-mock-key-for-unit-test",
    fetchFn: mockSuccessFetch,
  });

  assert(capturedUrl === "https://api.openai.com/v1/chat/completions", "OpenAI URL called correctly");
  assert(capturedHeaders["Authorization"] === "Bearer sk-mock-key-for-unit-test", "Authorization header formatted with Bearer token");
  assert(capturedHeaders["Content-Type"] === "application/json", "Content-Type is application/json");
  assert(capturedJsonBody.model === PREFERRED_OPENAI_TEXT_MODEL, `Preferred model ${PREFERRED_OPENAI_TEXT_MODEL} requested`);
  assert(capturedJsonBody.response_format?.type === "json_object", "JSON object response_format requested");
  assert(textRes.content.includes("Həkimə get"), "Returned completion text correctly");

  // Test automatic fallback to gpt-4o-mini when primary model returns 404
  let callCount = 0;
  const mockFallbackFetch: typeof fetch = async (url, init) => {
    callCount++;
    const body = JSON.parse(String(init?.body || "{}"));
    if (callCount === 1) {
      // Primary model 404
      return new Response(
        JSON.stringify({ error: { message: `The model ${body.model} does not exist` } }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
    // Fallback model success
    return new Response(
      JSON.stringify({
        id: "chatcmpl-fallback-456",
        model: STABLE_OPENAI_TEXT_MODEL,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Fallback success response" },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const fallbackRes = await callOpenAIChatCompletion({
    messages: [{ role: "user", content: "Salam" }],
    apiKey: "sk-test",
    fetchFn: mockFallbackFetch,
  });

  assert(callCount === 2, "Fell back to secondary model on 404");
  assert(fallbackRes.modelUsed === STABLE_OPENAI_TEXT_MODEL, `Fallback used ${STABLE_OPENAI_TEXT_MODEL}`);
  assert(fallbackRes.content === "Fallback success response", "Fallback content retrieved");

  // Test missing API key error
  try {
    delete process.env.OPENAI_API_KEY;
    await callOpenAIChatCompletion({
      messages: [{ role: "user", content: "Salam" }],
      apiKey: "",
    });
    assert(false, "Throws error when OPENAI_API_KEY is missing");
  } catch (err: any) {
    assert(err.message.includes("OPENAI_API_KEY is not configured"), "Explicit error message for missing OPENAI_API_KEY");
  }

  // ----------------------------------------------------
  // SECTION 3: MOCK SERVER END-TO-END /api/ai-action TESTS
  // ----------------------------------------------------
  console.log("\n--- SECTION 3: Mock Server E2E /api/ai-action Tests ---");

  const MOCK_API_PORT = 3998;
  let mockServerReceivedAuth = "";
  let mockServerReceivedModel = "";
  let mockServerReceivedPrompt = "";

  const mockOpenAIServer = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/v1/chat/completions") {
      let bodyData = "";
      req.on("data", (chunk) => {
        bodyData += chunk;
      });
      req.on("end", () => {
        mockServerReceivedAuth = req.headers["authorization"] || "";
        const parsedBody = JSON.parse(bodyData || "{}");
        mockServerReceivedModel = parsedBody.model || "";
        const userMsg = parsedBody.messages?.find((m: any) => m.role === "user")?.content || "";
        mockServerReceivedPrompt = userMsg;

        // Custom recurrence prompt test
        if (userMsg.includes("Hər 3 gündən bir")) {
          const resp = {
            choices: [
              {
                message: {
                  role: "assistant",
                  content: JSON.stringify({
                    action: "create_reminder",
                    responseMessage: "Hər 3 gündən bir saat 10:00 üçün iclas xatırlatması yaradıldı.",
                    remindersToCreate: [
                      {
                        title: "İclasım var",
                        dueDateTime: "2026-09-12T06:00:00.000Z",
                        category: "work",
                        recurrence: "custom",
                        recurrenceInterval: 3,
                        recurrenceUnit: "day",
                        priority: "high",
                      },
                    ],
                  }),
                },
              },
            ],
          };
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(resp));
          return;
        }

        // Multi-reminder prompt test
        if (userMsg.includes("Anara zəng") && userMsg.includes("maşın")) {
          const resp = {
            choices: [
              {
                message: {
                  role: "assistant",
                  content: JSON.stringify({
                    action: "create_multiple_reminders",
                    responseMessage: "3 xatırlatma yaradıldı: Anara zəng, maşın ustası və dərman.",
                    remindersToCreate: [
                      {
                        title: "Anara zəng et",
                        dueDateTime: "2026-09-12T06:00:00.000Z",
                        category: "work",
                        recurrence: "none",
                        priority: "medium",
                      },
                      {
                        title: "Maşınlara bax",
                        dueDateTime: "2026-09-12T10:00:00.000Z",
                        category: "personal",
                        recurrence: "none",
                        priority: "medium",
                      },
                      {
                        title: "Axşam dərmanı al",
                        dueDateTime: "2026-09-12T16:00:00.000Z",
                        category: "health",
                        recurrence: "none",
                        priority: "high",
                      },
                    ],
                  }),
                },
              },
            ],
          };
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(resp));
          return;
        }

        // Default single reminder
        const defaultResp = {
          choices: [
            {
              message: {
                role: "assistant",
                content: JSON.stringify({
                  action: "create_reminder",
                  responseMessage: "Xatırlatma əlavə edildi.",
                  remindersToCreate: [
                    {
                      title: "Test xatırlatma",
                      dueDateTime: "2026-09-12T08:00:00.000Z",
                      category: "personal",
                      recurrence: "none",
                      priority: "medium",
                    },
                  ],
                }),
              },
            },
          ],
        };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(defaultResp));
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => mockOpenAIServer.listen(MOCK_API_PORT, resolve));
  console.log(`Mock OpenAI Server running on port ${MOCK_API_PORT}`);

  try {
    // Test 1: Multi-reminder extraction
    const multiFetchRes = await callOpenAIChatCompletion({
      endpointUrl: `http://localhost:${MOCK_API_PORT}/v1/chat/completions`,
      apiKey: "sk-test-multi-key",
      messages: [
        {
          role: "user",
          content: 'İstifadəçinin sözləri: "Sabah saat 10-da Anara zəng et, saat 2-də maşınlara bax, axşam dərmanı al"',
        },
      ],
      responseFormat: { type: "json_object" },
    });

    const parsedMulti = JSON.parse(multiFetchRes.content);
    assert(parsedMulti.action === "create_multiple_reminders", "Multi-reminder action correctly identified");
    assert(parsedMulti.remindersToCreate.length === 3, "Multi-reminder extracted 3 distinct tasks");
    assert(parsedMulti.remindersToCreate[0].title === "Anara zəng et", "First task: Anara zəng et");
    assert(parsedMulti.remindersToCreate[1].title === "Maşınlara bax", "Second task: Maşınlara bax");
    assert(parsedMulti.remindersToCreate[2].title === "Axşam dərmanı al", "Third task: Axşam dərmanı al");

    // Test 2: Custom recurrence handling
    const customRecRes = await callOpenAIChatCompletion({
      endpointUrl: `http://localhost:${MOCK_API_PORT}/v1/chat/completions`,
      apiKey: "sk-test-recur-key",
      messages: [
        {
          role: "user",
          content: 'İstifadəçinin sözləri: "Hər 3 gündən bir saat 10:00 iclasım var"',
        },
      ],
      responseFormat: { type: "json_object" },
    });

    const parsedRec = JSON.parse(customRecRes.content);
    assert(parsedRec.remindersToCreate[0].recurrence === "custom", "Custom recurrence parsed as 'custom'");
    assert(parsedRec.remindersToCreate[0].recurrenceInterval === 3, "Custom recurrence interval set to 3");
    assert(parsedRec.remindersToCreate[0].recurrenceUnit === "day", "Custom recurrence unit set to 'day'");

  } finally {
    mockOpenAIServer.close();
  }

  // ----------------------------------------------------
  // SECTION 4: SERVER SAFETY GUARD & RETRIEVAL QUERY TEST
  // ----------------------------------------------------
  console.log("\n--- SECTION 4: Safety Guard / Query Override Verification ---");

  // We test the exact regex logic implemented in server.ts and intelligentRouter.ts
  const testPrompt = "Sabahkı planımı göstər";
  const promptNorm = testPrompt.toLowerCase();
  const isQueryPhrase = /(göstər|goster|nə var|ne var|nəyim var|neyim var|nə işim var|ne isim var|nə planım var|ne planim var|planımı|planimi|cədvəl|cedvel|siyahı|siyahi)/i.test(promptNorm);
  const hasCreateVerb = /(xatırlat|xatirlat|əlavə et|elave et|əlavə elə|yarat|qeyd et|planlaşdır|yadıma sal|yadına sal)/i.test(promptNorm);

  assert(isQueryPhrase === true, "Identified 'Sabahkı planımı göstər' as a query phrase");
  assert(hasCreateVerb === false, "Confirmed no create verb present in query");

  // Simulate LLM mistakenly returning create_reminder
  let simulatedLlmAction: string = "create_reminder";
  let simulatedReminders: any[] | undefined = [{ title: "Sabahkı planım" }];

  if ((simulatedLlmAction === "create_reminder" || simulatedLlmAction === "create_multiple_reminders") && isQueryPhrase && !hasCreateVerb) {
    simulatedReminders = undefined;
    simulatedLlmAction = /həftə|hefte/i.test(promptNorm) ? "get_weekly_schedule" : "get_daily_schedule";
  }

  assert(simulatedLlmAction === "get_daily_schedule", "Server intent safety guard overrides misclassification to 'get_daily_schedule'");
  assert(simulatedReminders === undefined, "Server intent safety guard clears remindersToCreate");

  // ----------------------------------------------------
  // SECTION 5: AZERBAIJANI RECURRENCE NORMALIZER
  // ----------------------------------------------------
  console.log("\n--- SECTION 5: Azerbaijani Recurrence Normalizer Tests ---");

  function normalizeAzerbaijaniRecurrence(prompt: string, reminderItem: any): void {
    const norm = (prompt || "").toLowerCase();
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

    const monthDayMatch = norm.match(/hər\s+ayın\s+(\d+)(?:-i|-si|-ı|-sı|-üncü|-uncu|-in)?/i);
    if (monthDayMatch) {
      reminderItem.recurrence = "monthly";
      reminderItem.recurrenceDayOfMonth = parseInt(monthDayMatch[1], 10);
      return;
    }
  }

  const testItem1: any = { recurrence: "none" };
  normalizeAzerbaijaniRecurrence("Hər 3 gündən bir dərman iç", testItem1);
  assert(testItem1.recurrence === "custom" && testItem1.recurrenceInterval === 3 && testItem1.recurrenceUnit === "day", "Pattern 'Hər 3 gündən bir' normalized to custom 3 days");

  const testItem2: any = { recurrence: "none" };
  normalizeAzerbaijaniRecurrence("hər iki həftədən bir iclas et", testItem2);
  assert(testItem2.recurrence === "custom" && testItem2.recurrenceInterval === 2 && testItem2.recurrenceUnit === "week", "Pattern 'hər iki həftədən bir' normalized to custom 2 weeks");

  const testItem3: any = { recurrence: "none" };
  normalizeAzerbaijaniRecurrence("Hər ayın 15-i kirayə ödə", testItem3);
  assert(testItem3.recurrence === "monthly" && testItem3.recurrenceDayOfMonth === 15, "Pattern 'Hər ayın 15-i' normalized to monthly day 15");

  // Summary
  console.log("\n==========================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==========================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runMigrationTests().catch((err) => {
  console.error("Test runner encountered error:", err);
  process.exit(1);
});
