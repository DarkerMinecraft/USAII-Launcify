import Groq from "groq-sdk";

const MODEL = "qwen/qwen3-32b";

/** Thrown when the Groq call itself fails or returns nothing usable. */
export class GroqError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "GroqError";
  }
}

interface CallOptions {
  /** 0.7 default — debate prose. Use a low value (~0.2) for JSON-producing calls. */
  temperature?: number;
}

const stripReasoning = (text: string): string =>
  text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

export const callGroq = async (
  systemPrompt: string,
  userPrompt: string,
  options: CallOptions = {}
): Promise<string> => {
  if (!process.env.GROQ_API_KEY) {
    throw new GroqError("GROQ_API_KEY is not set");
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  let text: string | undefined;
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: options.temperature ?? 0.7,
    });
    text = response.choices[0]?.message?.content ?? undefined;
  } catch (err) {
    throw new GroqError(
      `Groq request failed: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }

  if (!text || !text.trim()) {
    throw new GroqError("Groq returned an empty response");
  }

  const cleaned = stripReasoning(text);
  if (!cleaned) {
    throw new GroqError("Groq returned only reasoning content");
  }

  return cleaned;
}
