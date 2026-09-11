import http from "http";
import { getOpenAICompatibleFilename, getOpenAIUploadDetails, transcribeWithOpenAI } from "../src/server/openaiAudio";

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

  // Format and MIME mapping
  const m4aDetails = getOpenAIUploadDetails("audio/m4a");
  assert(m4aDetails.filename === "audio.m4a" && m4aDetails.uploadMimeType === "audio/m4a", "M4A upload details: filename audio.m4a, MIME audio/m4a");

  const mp4Details = getOpenAIUploadDetails("audio/mp4");
  assert(mp4Details.filename === "audio.m4a" && mp4Details.uploadMimeType === "audio/mp4", "MP4 upload details: filename audio.m4a, MIME audio/mp4");

  const aacDetails = getOpenAIUploadDetails("audio/aac");
  assert(aacDetails.filename === "audio.aac" && aacDetails.uploadMimeType === "audio/aac", "Raw AAC is NOT blindly renamed to audio.m4a (filename audio.aac, MIME audio/aac)");

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

  const openAIResult = await transcribeWithOpenAI(mockAudioBuffer, "audio/m4a", {
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
    await transcribeWithOpenAI(mockAudioBuffer, "audio/m4a", { apiKey: "" });
    assert(false, "Throws error when OPENAI_API_KEY is missing");
  } catch (err: any) {
    assert(err.message.includes("OPENAI_API_KEY is not configured"), "Throws explicit error when OPENAI_API_KEY is missing");
  }

  // ----------------------------------------------------
  // 2. MOCK OPENAI SERVER FOR END-TO-END VERIFICATION
  // ----------------------------------------------------
  console.log("\n--- SECTION 2: End-to-End Transcription Tests with Mock Server ---");
  const MOCK_OPENAI_PORT = 3999;
  let mockOpenAIReceivedAudioFilename = "";
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
          mockOpenAIReceivedAudioFilename = "audio.m4a";
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

  // Test transcribeWithOpenAI pointing to mock server with audio/m4a
  const mockServerResult = await transcribeWithOpenAI(mockAudioBuffer, "audio/m4a", {
    apiKey: "sk-test-key-valid",
    baseUrl: `http://localhost:${MOCK_OPENAI_PORT}`,
  });
  assert(mockServerResult === "Sabah saat 10-da Anara zəng et", "OpenAI mock server response parsed");
  assert(mockOpenAIReceivedModel === "gpt-4o-mini-transcribe", "OpenAI request sent gpt-4o-mini-transcribe model");
  assert(mockOpenAIReceivedLanguage === "az", "OpenAI request favored Azerbaijani ('az')");
  assert(mockOpenAIReceivedAudioFilename === "audio.m4a", "OpenAI uploaded with filename audio.m4a");

  mockOpenAIServer.close();

  // ----------------------------------------------------
  // 3. INTEGRATION TESTS ON RUNNING SERVER (:3000)
  // ----------------------------------------------------
  console.log("\n--- SECTION 3: HTTP Route Tests /api/transcribe-audio (OpenAI Only) ---");
  const API_BASE = "http://localhost:3000";

  // Create valid base64 audio sample for testing
  const sampleBase64 = Buffer.from("RIFF....WAVEfmt ....data" + "A".repeat(200)).toString("base64");

  // TEST A: iPhone NativeVoiceRecorder input format (recordDataBase64 + audio/m4a)
  try {
    const resA = await fetch(`${API_BASE}/api/transcribe-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-simulate-openai": "mock_success",
      },
      body: JSON.stringify({
        recordDataBase64: sampleBase64,
        mimeType: "audio/m4a",
      }),
    });
    const dataA = await resA.json();
    assert(resA.status === 200, "TEST A: iPhone format returns HTTP 200", `status=${resA.status}`);
    assert(dataA.provider === "openai", "TEST A: Provider is strictly 'openai'");
    assert(dataA.transcript === "Sabah saat 10-da Anara zəng et", "TEST A: Transcript returned correctly");
    assert(dataA.transcription === "Sabah saat 10-da Anara zəng et", "TEST A: Transcription field populated");
    assert(dataA.success === true, "TEST A: success is true");
  } catch (e: any) {
    assert(false, "TEST A: iPhone format transcription", e.message);
  }

  // TEST B: Alternate web format (base64Audio + audio/mp4)
  try {
    const resB = await fetch(`${API_BASE}/api/transcribe-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-simulate-openai": "mock_success",
      },
      body: JSON.stringify({
        base64Audio: sampleBase64,
        mimeType: "audio/mp4",
      }),
    });
    const dataB = await resB.json();
    assert(resB.status === 200, "TEST B: MP4 audio format returns HTTP 200", `status=${resB.status}`);
    assert(dataB.provider === "openai", "TEST B: Provider is 'openai'");
  } catch (e: any) {
    assert(false, "TEST B: MP4 audio format", e.message);
  }

  // TEST C: Empty audio -> HTTP 400 invalid_audio
  try {
    const resC = await fetch(`${API_BASE}/api/transcribe-audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64Audio: "", mimeType: "audio/m4a" }),
    });
    const dataC = await resC.json();
    assert(resC.status === 400, "TEST C: Empty audio returns HTTP 400", `status=${resC.status}`);
    assert(dataC.error === "invalid_audio", "TEST C: Error code is invalid_audio");
  } catch (e: any) {
    assert(false, "TEST C: Empty audio", e.message);
  }

  // TEST D: OpenAI audio rejection (HTTP 400 / corrupted) -> returns structured 400 diagnostic error
  try {
    const resD = await fetch(`${API_BASE}/api/transcribe-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-simulate-openai": "400",
      },
      body: JSON.stringify({
        recordDataBase64: sampleBase64,
        mimeType: "audio/m4a",
      }),
    });
    const dataD = await resD.json();
    assert(resD.status === 400, "TEST D: Rejected audio returns HTTP 400", `status=${resD.status}`);
    assert(dataD.error === "transcription_rejected", "TEST D: Error code is transcription_rejected");
    assert(!!dataD.details, "TEST D: Diagnostic details are provided");
  } catch (e: any) {
    assert(false, "TEST D: Audio rejection", e.message);
  }

  // TEST E: OpenAI 503 error -> returns structured 503 error
  try {
    const resE = await fetch(`${API_BASE}/api/transcribe-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-simulate-openai": "503",
      },
      body: JSON.stringify({
        base64Audio: sampleBase64,
        mimeType: "audio/m4a",
      }),
    });
    const dataE = await resE.json();
    assert(resE.status === 503, "TEST E: OpenAI 503 returns HTTP 503", `status=${resE.status}`);
    assert(dataE.error === "transcription_unavailable", "TEST E: Error code is transcription_unavailable");
    assert(dataE.message?.includes("Səsin mətnə çevrilməsi hazırda mümkün deyil"), "TEST E: Structured Azerbaijani message");
  } catch (e: any) {
    assert(false, "TEST E: OpenAI 503", e.message);
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
