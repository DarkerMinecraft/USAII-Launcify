import { NextRequest, NextResponse } from "next/server";
import { callGemini, parseJSON, GeminiError, GeminiParseError } from "@/lib/gemini";
import { QUESTION_GEN_PROMPT } from "@/prompts/agents";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const ideaSummary: string = (body as { ideaSummary?: string })?.ideaSummary ?? "";
  if (!ideaSummary.trim()) {
    return NextResponse.json({ error: "ideaSummary is required" }, { status: 400 });
  }

  try {
    const raw = await callGemini(QUESTION_GEN_PROMPT, `Founder's idea: ${ideaSummary}`, {
      temperature: 0.4,
    });
    const questions = parseJSON<string[]>(raw);

    if (!Array.isArray(questions) || questions.length !== 3 || !questions.every((q) => typeof q === "string")) {
      return NextResponse.json({ error: "AI returned an unexpected question format" }, { status: 502 });
    }

    return NextResponse.json({ questions });
  } catch (err) {
    if (err instanceof GeminiParseError) {
      return NextResponse.json({ error: "AI returned malformed output" }, { status: 502 });
    }
    if (err instanceof GeminiError) {
      return NextResponse.json({ error: "AI service is unavailable" }, { status: 502 });
    }
    throw err;
  }
}
