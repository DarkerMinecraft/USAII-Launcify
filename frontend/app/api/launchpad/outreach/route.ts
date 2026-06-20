import { NextRequest, NextResponse } from "next/server";
import { callLLM, parseJSON, LLMError, GeminiParseError } from "@/lib/llm";
import { OUTREACH_SYSTEM, buildOutreachPrompt } from "@/prompts/agents";
import type { Canvas } from "@/lib/types";

export const POST = async (req: NextRequest) => {
  let body: { canvas?: Canvas };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const canvas = body.canvas;
  if (!canvas || typeof canvas.ideaSummary !== "string" || !Array.isArray(canvas.assumptions)) {
    return NextResponse.json({ error: "canvas is required" }, { status: 400 });
  }

  try {
    const raw = await callLLM(OUTREACH_SYSTEM, buildOutreachPrompt(canvas), { temperature: 0.5 });
    const data = parseJSON<Record<string, unknown>>(raw);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof LLMError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    if (err instanceof GeminiParseError) {
      return NextResponse.json({ error: "Could not parse the outreach draft" }, { status: 502 });
    }
    return NextResponse.json({ error: "An error occurred generating outreach" }, { status: 500 });
  }
}
