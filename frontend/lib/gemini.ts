import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = "gemini-3.1-flash-lite";

/** Thrown when the Gemini call itself fails or returns nothing usable. */
export class GeminiError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "GeminiError";
  }
}

/** Thrown when a response that should be JSON cannot be parsed. */
export class GeminiParseError extends Error {
  constructor(message: string, readonly raw: string) {
    super(message);
    this.name = "GeminiParseError";
  }
}

interface CallOptions {
  /** 0.7 default — debate prose. Use a low value (~0.2) for JSON-producing calls. */
  temperature?: number;
}

export const callGemini = async (
  systemPrompt: string,
  userPrompt: string,
  options: CallOptions = {}
): Promise<string> => {
  if (!process.env.GEMINI_API_KEY) {
    throw new GeminiError("GEMINI_API_KEY is not set");
  }

  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: options.temperature ?? 0.7,
      },
    });
    text = response.text;
  } catch (err) {
    // Network failure, auth rejection, rate limit, etc. Surface a clean error
    // so a mid-debate failure can be caught and shown rather than crashing.
    throw new GeminiError(
      `Gemini request failed: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }

  // Empty text usually means a safety block or an empty candidate — never
  // return "" silently, or downstream JSON parsing fails with a cryptic error.
  if (!text || !text.trim()) {
    throw new GeminiError("Gemini returned an empty response (possibly safety-blocked)");
  }

  return text;
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export const callGeminiChat = async (
  systemPrompt: string,
  history: ChatMessage[],
  currentMessage: string,
): Promise<string> => {
  if (!process.env.GEMINI_API_KEY) {
    throw new GeminiError("GEMINI_API_KEY is not set");
  }

  const contents = [
    ...history.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
    { role: "user" as const, parts: [{ text: currentMessage }] },
  ];

  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: { systemInstruction: systemPrompt, temperature: 0.7 },
    });
    text = response.text;
  } catch (err) {
    throw new GeminiError(
      `Gemini chat request failed: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }

  if (!text || !text.trim()) {
    throw new GeminiError("Gemini returned an empty chat response");
  }

  return text;
};

/** Strips markdown code fences a model may wrap JSON in, then parses. Throws a
 *  clear GeminiParseError (with the raw text) instead of a bare SyntaxError. */
export const parseJSON = <T>(text: string): T => {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const snippet = cleaned.slice(0, 200);
    throw new GeminiParseError(
      `Model did not return valid JSON. First 200 chars: ${snippet}`,
      text
    );
  }
}
