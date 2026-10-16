/**
 * Checks that Azerbaijani transcription sends the language and the vocabulary
 * prompt to OpenAI, and uses the stronger model by default.
 * Run: npx tsx tests/az_transcription.test.ts
 */
import { transcribeWithOpenAI, AZ_TRANSCRIPTION_PROMPT } from "../src/server/openaiAudio";

let passed = 0;
let failed = 0;
function check(ok: boolean, msg: string) {
  if (ok) {
    passed++;
    process.stdout.write(`✅ [PASS] ${msg}\n`);
  } else {
    failed++;
    process.stdout.write(`❌ [FAIL] ${msg}\n`);
  }
}

async function main() {
  let sentForm: FormData | null = null;
  const fakeFetch = (async (_url: any, init: any) => {
    sentForm = init.body as FormData;
    return new Response(JSON.stringify({ text: "sabah saat 10-da zəng et" }), { status: 200 });
  }) as unknown as typeof fetch;

  const audio = Buffer.alloc(200, 1);
  const text = await transcribeWithOpenAI(audio, "audio/m4a", { apiKey: "test", fetchFn: fakeFetch });

  check(text === "sabah saat 10-da zəng et", "transcript text is returned");
  const form = sentForm as unknown as FormData;
  check(form.get("language") === "az", "language is sent as 'az'");
  check(form.get("model") === "gpt-4o-transcribe", "default model is gpt-4o-transcribe");
  const prompt = String(form.get("prompt") || "");
  check(prompt === AZ_TRANSCRIPTION_PROMPT, "Azerbaijani vocabulary prompt is sent");
  check(/ə/.test(prompt) && /xatırlat/.test(prompt), "prompt contains Azerbaijani letters and app words");

  process.stdout.write(`\nTEST SUMMARY: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  process.stdout.write(`Test crashed: ${e?.stack || e}\n`);
  process.exit(1);
});
