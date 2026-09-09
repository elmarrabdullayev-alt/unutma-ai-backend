/**
 * Groq Whisper Audio Transcription Service
 * Model: whisper-large-v3-turbo
 * Language: Azerbaijani priority ('az')
 */

export interface GroqTranscriptionOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  model?: string;
  language?: string;
  fetchFn?: typeof fetch;
}

export function getGroqCompatibleFilename(mimeType: string): string {
  const lower = (mimeType || "").toLowerCase();
  if (lower.includes("webm")) return "audio.webm";
  if (lower.includes("wav")) return "audio.wav";
  if (lower.includes("mp3") || lower.includes("mpeg")) return "audio.mp3";
  if (lower.includes("ogg") || lower.includes("opus")) return "audio.ogg";
  // For iOS audio/aac, audio/m4a, audio/mp4:
  // Groq API accepted formats: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm
  // 'audio.m4a' (MPEG-4 Audio / AAC container) is fully supported and recommended
  return "audio.m4a";
}

export async function transcribeWithGroq(
  audioBuffer: Buffer,
  mimeType: string,
  options: GroqTranscriptionOptions = {}
): Promise<string> {
  const apiKey = options.apiKey || process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured in server environment");
  }

  const model = options.model || "whisper-large-v3-turbo";
  const language = options.language || "az";
  const timeoutMs = options.timeoutMs ?? 15000;
  const fetchImpl = options.fetchFn || globalThis.fetch;

  const filename = getGroqCompatibleFilename(mimeType);

  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType });
  formData.append("file", blob, filename);
  formData.append("model", model);
  formData.append("language", language);
  formData.append("response_format", "json");
  formData.append("temperature", "0");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const baseUrl = (options.baseUrl || process.env.GROQ_API_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
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
      throw new Error(`Groq API error (status ${response.status}): ${parsedMessage}`);
    }

    const data = (await response.json()) as { text?: string };
    return (data.text || "").trim();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error(`Groq transcription request timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}
