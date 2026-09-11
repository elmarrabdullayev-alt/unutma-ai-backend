/**
 * OpenAI Audio Transcription Service
 * Model: gpt-4o-mini-transcribe
 * Accepts: audio/aac, audio/m4a, audio/webm, audio/wav, audio/mp3, etc.
 * Language: Azerbaijani priority ('az')
 */

export interface OpenAITranscriptionOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  model?: string;
  language?: string;
  fetchFn?: typeof fetch;
}

export function getOpenAICompatibleFilename(mimeType: string): string {
  const lower = (mimeType || "").toLowerCase();
  if (lower.includes("webm")) return "audio.webm";
  if (lower.includes("wav")) return "audio.wav";
  if (lower.includes("mp3") || lower.includes("mpeg")) return "audio.mp3";
  if (lower.includes("ogg") || lower.includes("opus")) return "audio.ogg";
  if (lower.includes("flac")) return "audio.flac";
  // For iOS audio/aac, audio/m4a, audio/mp4:
  // OpenAI accepted formats: mp3, mp4, mpeg, mpga, m4a, wav, webm
  // 'audio.m4a' provides full compatibility with iOS AAC audio
  return "audio.m4a";
}

export async function transcribeWithOpenAI(
  audioBuffer: Buffer,
  mimeType: string,
  options: OpenAITranscriptionOptions = {}
): Promise<string> {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured in server environment");
  }

  const model = options.model || "gpt-4o-mini-transcribe";
  const language = options.language || "az";
  const timeoutMs = options.timeoutMs ?? 15000;
  const fetchImpl = options.fetchFn || globalThis.fetch;

  const filename = getOpenAICompatibleFilename(mimeType);

  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType });
  formData.append("file", blob, filename);
  formData.append("model", model);
  formData.append("language", language);
  formData.append("response_format", "json");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const baseUrl = (options.baseUrl || process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const endpoint = `${baseUrl}/audio/transcriptions`;

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let parsedMessage = errorText;
      try {
        const parsed = JSON.parse(errorText);
        parsedMessage = parsed?.error?.message || errorText;
      } catch {
        // ignore parse error
      }
      throw new Error(`OpenAI API error (status ${response.status}): ${parsedMessage}`);
    }

    const data = (await response.json()) as { text?: string };
    return (data.text || "").trim();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error(`OpenAI transcription request timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}
