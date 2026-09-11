/**
 * OpenAI Audio Transcription Service
 * Model: gpt-4o-mini-transcribe
 * Accepts: audio/m4a, audio/mp4, audio/webm, audio/wav, audio/mp3, audio/ogg, audio/flac, etc.
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

export interface OpenAIUploadDetails {
  filename: string;
  uploadMimeType: string;
}

/**
 * Returns upload filename and MIME type for OpenAI transcription.
 * For actual M4A input: filename is 'audio.m4a' and MIME is 'audio/m4a' (or 'audio/mp4').
 * Blind mapping of arbitrary audio/aac to audio.m4a has been removed.
 */
export function getOpenAIUploadDetails(mimeType: string): OpenAIUploadDetails {
  const lower = (mimeType || "").toLowerCase();

  // Actual M4A or MP4 container input
  if (lower.includes("m4a")) {
    return { filename: "audio.m4a", uploadMimeType: "audio/m4a" };
  }
  if (lower.includes("mp4")) {
    return { filename: "audio.m4a", uploadMimeType: "audio/mp4" };
  }

  // Standard web audio formats
  if (lower.includes("webm")) {
    return { filename: "audio.webm", uploadMimeType: "audio/webm" };
  }
  if (lower.includes("wav")) {
    return { filename: "audio.wav", uploadMimeType: "audio/wav" };
  }
  if (lower.includes("mp3") || lower.includes("mpeg")) {
    return { filename: "audio.mp3", uploadMimeType: "audio/mp3" };
  }
  if (lower.includes("ogg") || lower.includes("opus")) {
    return { filename: "audio.ogg", uploadMimeType: "audio/ogg" };
  }
  if (lower.includes("flac")) {
    return { filename: "audio.flac", uploadMimeType: "audio/flac" };
  }

  // If raw AAC is provided, do NOT blindly rename to .m4a
  if (lower.includes("aac")) {
    return { filename: "audio.aac", uploadMimeType: "audio/aac" };
  }

  // Default fallback
  return { filename: "audio.m4a", uploadMimeType: "audio/m4a" };
}

export function getOpenAICompatibleFilename(mimeType: string): string {
  return getOpenAIUploadDetails(mimeType).filename;
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

  const { filename, uploadMimeType } = getOpenAIUploadDetails(mimeType);

  console.log(`[TRANSCRIBE] upload filename: ${filename}`);
  console.log(`[TRANSCRIBE] upload mimeType: ${uploadMimeType}`);
  console.log(`[TRANSCRIBE] upload byte length: ${audioBuffer.length}`);

  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: uploadMimeType });
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
