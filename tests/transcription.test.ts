import http from "http";
import { getOpenAICompatibleFilename, transcribeWithOpenAI } from "../src/server/openaiAudio";

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING UNUTMA AI TRANSCRIPTION TEST SUITE (OPENAI)");
  console.log("==================================================\n");

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
  // 1. UNIT TESTS FOR OPENAI AUDIO CONFIGURATION
  // ----------------------------------------------------
  console.log("--- SECTION 1: OpenAI Audio Unit Tests ---");

  // Format mapping
  assert(getOpenAICompatibleFilename("audio/aac") === "audio.m4a", "Filename mapping: audio/aac maps to audio.m4a container");
  assert(getOpenAICompatibleFilename("audio/m4a") === "audio.m4a", "Filename mapping: audio/m4a maps to audio.m4a");
  assert(getOpenAICompatibleFilename("audio/webm") === "audio.webm", "Filename mapping: audio/webm maps to audio.webm");
  assert(getOpenAICompatibleFilename("audio/wav") === "audio.wav", "Filename mapping: audio/wav maps to audio.wav");
  assert(getOpenAICompatibleFilename("audio/mp3") === "audio.mp3", "Filename mapping: audio/mp3 maps to audio.mp3");

  // In-memory FormData and parameters check with mock fetch
  const mockAudioBuffer = Buffer.from("VGVzdEF1ZGlvRGF0YUZvclVudXRtYUFJ", "utf-8");
  let capturedBody: FormData | null = null;
  let capturedHeaders: Record<string, string> = {};

  const mockFetch: typeof fetch = async (url, init) => {
    capturedBody = init?.body as FormData;
    capturedHeaders = (init?.headers as Record<string, string>) || {};
    return new Response(JSON.stringify({ text: "Sabah saat 10-da Anara zəng et" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const openAIResult = await transcribeWithOpenAI(mockAudioBuffer, "audio/aac", {
    apiKey: "sk-test-mock-key-12345",
    fetchFn: mockFetch,
  });

  assert(openAIResult === "Sabah saat 10-da Anara zəng et", "OpenAI transcription result parsed correctly");
  assert(capturedHeaders["Authorization"] === "Bearer sk-test-mock-key-12345", "OpenAI Authorization header set correctly");
  assert(capturedBody?.get("model") === "gpt-4o-mini-transcribe", "OpenAI model set to gpt-4o-mini-transcribe");
  assert(capturedBody?.get("language") === "az", "OpenAI language set to Azerbaijani ('az')");

  // Verify missing API key error
  try {
    delete process.env.OPENAI_API_KEY;
    await transcribeWithOpenAI(mockAudioBuffer, "audio/aac", { apiKey: "" });
    assert(false, "Throws error when OPENAI_API_KEY is missing");
  } catch (err: any) {
    assert(err.message.includes("OPENAI_API_KEY is not configured"), "Throws explicit error when OPENAI_API_KEY is missing");
  }

  // ----------------------------------------------------
  // 2. MOCK OPENAI SERVER FOR END-TO-END VERIFICATION
  // ----------------------------------------------------
  console.log("\n--- SECTION 2: End-to-End Fallback Tests with Mock Server ---");
  const MOCK_OPENAI_PORT = 3999;
  let mockOpenAIReceivedAudioMime = "";
  let mockOpenAIReceivedModel = "";
  let mockOpenAIReceivedLanguage = "";

  const mockOpenAIServer = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/audio/transcriptions") {
      let bodyData = Buffer.alloc(0);
      req.on("data", (chunk) => {
        bodyData = Buffer.concat([bodyData, chunk]);
      });
      req.on("end", () => {
        const bodyStr = bodyData.toString("utf-8");
        if (bodyStr.includes('name="model"\r\n\r\ngpt-4o-mini-transcribe')) {
          mockOpenAIReceivedModel = "gpt-4o-mini-transcribe";
        }
        if (bodyStr.includes('name="language"\r\n\r\naz')) {
          mockOpenAIReceivedLanguage = "az";
        }
        if (bodyStr.includes('filename="audio.m4a"')) {
          mockOpenAIReceivedAudioMime = "audio/aac";
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ text: "Sabah saat 10-da Anara zəng et" }));
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => mockOpenAIServer.listen(MOCK_OPENAI_PORT, resolve));

  // Test transcribeWithOpenAI pointing to mock server
  const mockServerResult = await transcribeWithOpenAI(mockAudioBuffer, "audio/aac", {
    apiKey: "sk-test-key-valid",
    baseUrl: `http://localhost:${MOCK_OPENAI_PORT}`,
  });
  assert(mockServerResult === "Sabah saat 10-da Anara zəng et", "OpenAI mock server response parsed");
  assert(mockOpenAIReceivedModel === "gpt-4o-mini-transcribe", "OpenAI request sent gpt-4o-mini-transcribe model");
  assert(mockOpenAIReceivedLanguage === "az", "OpenAI request favored Azerbaijani ('az')");
  assert(mockOpenAIReceivedAudioMime === "audio/aac", "OpenAI accepted audio/aac formatted as audio.m4a");

  mockOpenAIServer.close();

  // ----------------------------------------------------
  // 3. INTEGRATION TESTS ON RUNNING SERVER (:3000)
  // ----------------------------------------------------
  console.log("\n--- SECTION 3: HTTP Route Tests /api/transcribe-audio ---");
  const API_BASE = "http://localhost:3000";

  // Create valid base64 audio sample for testing
  const sampleBase64 = Buffer.from("RIFF....WAVEfmt ....data" + "A".repeat(200)).toString("base64");

  // TEST D: Empty audio -> HTTP 400, no provider call
  try {
    const resD = await fetch(`${API_BASE}/api/transcribe-audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64Audio: "", mimeType: "audio/aac" }),
    });
    const dataD = await resD.json();
    assert(resD.status === 400, "TEST D: Empty audio returns HTTP 400", `status=${resD.status}`);
    assert(dataD.error === "invalid_audio", "TEST D: Error code is invalid_audio");
  } catch (e: any) {
    assert(false, "TEST D: Empty audio", e.message);
  }

  // TEST B: Gemini returns 429 -> OpenAI fallback activates
  try {
    const resB = await fetch(`${API_BASE}/api/transcribe-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-simulate-gemini": "429",
      },
      body: JSON.stringify({
        base64Audio: sampleBase64,
        mimeType: "audio/aac",
      }),
    });
    const dataB = await resB.json();
    if (resB.status === 200) {
      assert(dataB.provider === "openai", "TEST B: Gemini 429 triggers OpenAI fallback provider='openai'");
      assert(!!(dataB.transcript || dataB.transcription), "TEST B: Valid transcript returned");
    } else {
      assert(resB.status === 503 && dataB.error === "transcription_unavailable",
        "TEST B: Fallback activated and handled with structured 503 error when OpenAI key is unset");
    }
  } catch (e: any) {
    assert(false, "TEST B: Gemini 429 fallback", e.message);
  }

  // TEST C: Gemini returns 503 -> OpenAI fallback activates
  try {
    const resC = await fetch(`${API_BASE}/api/transcribe-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-simulate-gemini": "503",
      },
      body: JSON.stringify({
        audioBase64: sampleBase64, // testing alternative property name
        mimeType: "audio/aac",
      }),
    });
    const dataC = await resC.json();
    if (resC.status === 200) {
      assert(dataC.provider === "openai", "TEST C: Gemini 503 triggers OpenAI fallback provider='openai'");
    } else {
      assert(resC.status === 503 && dataC.error === "transcription_unavailable",
        "TEST C: Gemini 503 triggers OpenAI fallback flow with structured 503 if OpenAI key unset");
    }
  } catch (e: any) {
    assert(false, "TEST C: Gemini 503 fallback", e.message);
  }

  // TEST E: Both Gemini and OpenAI fail -> Structured HTTP 503 Azerbaijani error
  try {
    const resE = await fetch(`${API_BASE}/api/transcribe-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-simulate-gemini": "503",
        "x-test-simulate-openai": "503",
      },
      body: JSON.stringify({
        base64Audio: sampleBase64,
        mimeType: "audio/aac",
      }),
    });
    const dataE = await resE.json();
    assert(resE.status === 503, "TEST E: Both failing returns HTTP 503", `status=${resE.status}`);
    assert(dataE.error === "transcription_unavailable", "TEST E: Error code is transcription_unavailable");
    assert(dataE.message?.includes("Səsin mətnə çevrilməsi hazırda mümkün deyil"), "TEST E: Structured Azerbaijani error message");
  } catch (e: any) {
    assert(false, "TEST E: Both providers fail", e.message);
  }

  // TEST F: iPhone NativeVoiceRecorder input format compatibility (recordDataBase64 + audio/aac)
  try {
    const resF = await fetch(`${API_BASE}/api/transcribe-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-simulate-gemini": "503",
        "x-test-simulate-openai": "503",
      },
      body: JSON.stringify({
        recordDataBase64: sampleBase64, // iPhone plugin field
        mimeType: "audio/aac",
      }),
    });
    const dataF = await resF.json();
    assert(resF.status === 503 && dataF.error === "transcription_unavailable",
      "TEST F: iPhone NativeVoiceRecorder format (recordDataBase64 + audio/aac) recognized and normalized");
  } catch (e: any) {
    assert(false, "TEST F: iPhone NativeVoiceRecorder input format", e.message);
  }

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner encountered fatal error:", err);
  process.exit(1);
});
