import { callGemini, GeminiError, parseJSON, GeminiParseError } from "@/lib/gemini";
import { callGroq } from "@/lib/groq";

export { parseJSON, GeminiParseError };

interface CallOptions {
  /** 0.7 default — debate prose. Use a low value (~0.2) for JSON-producing calls. */
  temperature?: number;
}

export class LLMError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "LLMError";
  }
}

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export const callLLM = async (
  systemPrompt: string,
  userPrompt: string,
  options: CallOptions = {}
): Promise<string> => {
  try {
    return await callGemini(systemPrompt, userPrompt, options);
  } catch (err) {
    if (!(err instanceof GeminiError)) {
      throw err;
    }

    console.warn("Gemini failed, falling back to Groq:", err.message);

    try {
      return await callGroq(systemPrompt, userPrompt, options);
    } catch (groqErr) {
      throw new LLMError(
        `All LLM providers failed. Gemini: ${err.message}; Groq: ${errorMessage(groqErr)}`,
        { gemini: err, groq: groqErr }
      );
    }
  }
}
