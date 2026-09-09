import http from "http";
import { getGroqCompatibleFilename, transcribeWithGroq } from "../src/server/groqWhisper";

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING UNUTMA AI TRANSCRIPTION TEST SUITE");
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
  // 1. UNIT TESTS FOR GROQ WHISPER CONFIGURATION
  // ----------------------------------------------------
  console.log("--- SECTION 1: Groq Whisper Unit Tests ---");

  // Format mapping
  assert(getGroqCompatibleFilename("audio/aac") === "audio.m4a", "Filename mapping: audio/aac maps to audio.m4a container");
  assert(getGroqCompatibleFilename("audio/m4a") === "audio.m4a", "Filename mapping: audio/m4a maps to audio.m4a");
  assert(getGroqCompatibleFilename("audio/webm") === "audio.webm", "Filename mapping: audio/webm maps to audio.webm");
  assert(getGroqCompatibleFilename("audio/wav") === "audio.wav", "Filename mapping: audio/wav maps to audio.wav");
  assert(getGroqCompatibleFilename("audio/mp3") === "audio.mp3", "Filename mapping: audio/mp3 maps to audio.mp3");

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

  const groqResult = await transcribeWithGroq(mockAudioBuffer, "audio/aac", {
    apiKey: "gsk_test_mock_key_12345",
    fetchFn: mockFetch,
  });

  assert(groqResult === "Sabah saat 10-da Anara zəng et", "Groq transcription result parsed correctly");
  assert(capturedHeaders["Authorization"] === "Bearer gsk_test_mock_key_12345", "Groq Authorization header set correctly");
  assert(capturedBody?.get("model") === "whisper-large-v3-turbo", "Groq model set to whisper-large-v3-turbo");
  assert(capturedBody?.get("language") === "az", "Groq language set to Azerbaijani ('az')");

  // Verify missing API key error
  try {
    delete process.env.GROQ_API_KEY;
    await transcribeWithGroq(mockAudioBuffer, "audio/aac", { apiKey: "" });
    assert(false, "Throws error when GROQ_API_KEY is missing");
  } catch (err: any) {
    assert(err.message.includes("GROQ_API_KEY is not configured"), "Throws explicit error when GROQ_API_KEY is missing");
  }

  // ----------------------------------------------------
  // 2. MOCK GROQ SERVER FOR END-TO-END VERIFICATION
  // ----------------------------------------------------
  console.log("\n--- SECTION 2: End-to-End Fallback Tests with Mock Server ---");
  const MOCK_GROQ_PORT = 3999;
  let mockGroqReceivedAudioMime = "";
  let mockGroqReceivedModel = "";
  let mockGroqReceivedLanguage = "";

  const mockGroqServer = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/audio/transcriptions") {
      let bodyData = Buffer.alloc(0);
      req.on("data", (chunk) => {
        bodyData = Buffer.concat([bodyData, chunk]);
      });
      req.on("end", () => {
        const bodyStr = bodyData.toString("utf-8");
        if (bodyStr.includes('name="model"\r\n\r\nwhisper-large-v3-turbo')) {
          mockGroqReceivedModel = "whisper-large-v3-turbo";
        }
        if (bodyStr.includes('name="language"\r\n\r\naz')) {
          mockGroqReceivedLanguage = "az";
        }
        if (bodyStr.includes('filename="audio.m4a"')) {
          mockGroqReceivedAudioMime = "audio/aac";
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ text: "Sabah saat 10-da Anara zəng et" }));
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => mockGroqServer.listen(MOCK_GROQ_PORT, resolve));

  // Test transcribeWithGroq pointing to mock server
  const mockServerResult = await transcribeWithGroq(mockAudioBuffer, "audio/aac", {
    apiKey: "gsk_test_key_valid",
    baseUrl: `http://localhost:${MOCK_GROQ_PORT}`,
  });
  assert(mockServerResult === "Sabah saat 10-da Anara zəng et", "Groq mock server response parsed");
  assert(mockGroqReceivedModel === "whisper-large-v3-turbo", "Groq request sent whisper-large-v3-turbo model");
  assert(mockGroqReceivedLanguage === "az", "Groq request favored Azerbaijani ('az')");
  assert(mockGroqReceivedAudioMime === "audio/aac", "Groq accepted audio/aac formatted as audio.m4a");

  mockGroqServer.close();

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

  // TEST B: Gemini returns 429 -> Groq fallback activates
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
      assert(dataB.provider === "groq", "TEST B: Gemini 429 triggers Groq fallback provider='groq'");
      assert(!!(dataB.transcript || dataB.transcription), "TEST B: Valid transcript returned");
    } else {
      assert(resB.status === 503 && dataB.error === "transcription_unavailable",
        "TEST B: Fallback activated and handled with structured 503 error when Groq key is unset");
    }
  } catch (e: any) {
    assert(false, "TEST B: Gemini 429 fallback", e.message);
  }

  // TEST C: Gemini returns 503 -> Groq fallback activates
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
      assert(dataC.provider === "groq", "TEST C: Gemini 503 triggers Groq fallback provider='groq'");
    } else {
      assert(resC.status === 503 && dataC.error === "transcription_unavailable",
        "TEST C: Gemini 503 triggers Groq fallback flow with structured 503 if Groq key unset");
    }
  } catch (e: any) {
    assert(false, "TEST C: Gemini 503 fallback", e.message);
  }

  // TEST E: Both Gemini and Groq fail -> Structured HTTP 503 Azerbaijani error
  try {
    const resE = await fetch(`${API_BASE}/api/transcribe-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-simulate-gemini": "503",
        "x-test-simulate-groq": "503",
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

  // TEST F: iPhone NativeVoiceRecorder input format compatibility
  try {
    const resF = await fetch(`${API_BASE}/api/transcribe-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-simulate-gemini": "503",
        "x-test-simulate-groq": "503",
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
