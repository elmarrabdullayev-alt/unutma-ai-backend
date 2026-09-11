/**
 * OpenAI Text Generation & Structured Action Service
 * Primary Models: gpt-4.1-mini (preferred) / gpt-4o-mini (closest stable low-cost)
 * Language: Azerbaijani ('az')
 */

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAITextOptions {
  apiKey?: string;
  baseUrl?: string;
  endpointUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'json_object' | 'text' };
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  tag?: string;
}

export interface OpenAITextConfig extends OpenAITextOptions {
  messages: OpenAIChatMessage[];
}

export interface OpenAITextResult {
  content: string;
  model: string;
  modelUsed: string;
}

// Preferred text model with fallback to closest stable low-cost model (gpt-4o-mini)
export const PREFERRED_OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini';
export const STABLE_OPENAI_TEXT_MODEL = 'gpt-4o-mini';

/**
 * Executes a Chat Completion request against the OpenAI API.
 * Safely handles model availability, timeouts, and JSON structured output.
 * Accepts either:
 * - callOpenAIChatCompletion({ messages, apiKey, ...options })
 * - callOpenAIChatCompletion(messages, options)
 */
export async function callOpenAIChatCompletion(
  arg1: OpenAIChatMessage[] | OpenAITextConfig,
  arg2?: OpenAITextOptions
): Promise<OpenAITextResult> {
  let messages: OpenAIChatMessage[];
  let options: OpenAITextOptions;

  if (Array.isArray(arg1)) {
    messages = arg1;
    options = arg2 || {};
  } else {
    messages = arg1.messages;
    options = arg1;
  }

  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured in server environment');
  }

  const requestedModel = options.model || PREFERRED_OPENAI_TEXT_MODEL;
  const baseUrl = (options.baseUrl || process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const endpoint = options.endpointUrl || `${baseUrl}/chat/completions`;
  const timeoutMs = options.timeoutMs ?? 15000;
  const fetchImpl = options.fetchFn || globalThis.fetch;

  async function executeRequest(modelToUse: string): Promise<OpenAITextResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const payload: Record<string, any> = {
      model: modelToUse,
      messages,
      temperature: options.temperature ?? 0.1,
    };

    if (options.maxTokens) {
      payload.max_tokens = options.maxTokens;
    }

    if (options.responseFormat) {
      payload.response_format = options.responseFormat;
    }

    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let parsedMessage = errorText;
        let errorCode = '';
        try {
          const parsed = JSON.parse(errorText);
          parsedMessage = parsed?.error?.message || errorText;
          errorCode = parsed?.error?.code || '';
        } catch {
          // ignore json parse error
        }

        // If the preferred model (e.g. gpt-4.1-mini) is not found (404/model_not_found), fallback to stable gpt-4o-mini
        if (
          (response.status === 404 || errorCode === 'model_not_found' || parsedMessage.toLowerCase().includes('model')) &&
          modelToUse !== STABLE_OPENAI_TEXT_MODEL
        ) {
          console.warn(`[OPENAI-TEXT] Model ${modelToUse} not available, falling back to ${STABLE_OPENAI_TEXT_MODEL}`);
          return await executeRequest(STABLE_OPENAI_TEXT_MODEL);
        }

        throw new Error(`OpenAI API error (status ${response.status}): ${parsedMessage}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
        model?: string;
      };

      const content = data.choices?.[0]?.message?.content || '';
      const resolvedModel = data.model || modelToUse;
      return {
        content: content.trim(),
        model: resolvedModel,
        modelUsed: resolvedModel,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`OpenAI text generation timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
  }

  return await executeRequest(requestedModel);
}
