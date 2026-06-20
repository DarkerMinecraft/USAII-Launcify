"use server";

import { callLLM, parseJSON, LLMError, GeminiParseError } from "@/lib/llm";
import { OUTREACH_SYSTEM, buildOutreachPrompt, SUMMARY_SYSTEM, buildSummaryPrompt } from "@/prompts/agents";
import type { Canvas } from "@/lib/types";

export const generateOutreach = async (canvas: Canvas): Promise<Record<string, unknown>> => {
  if (!canvas || typeof canvas.ideaSummary !== "string" || !Array.isArray(canvas.assumptions)) {
    throw new Error("canvas is required");
  }
  try {
    const raw = await callLLM(OUTREACH_SYSTEM, buildOutreachPrompt(canvas), { temperature: 0.5 });
    return parseJSON<Record<string, unknown>>(raw);
  } catch (err) {
    if (err instanceof LLMError) throw new Error(err.message);
    if (err instanceof GeminiParseError) throw new Error("Could not parse the outreach draft");
    throw err;
  }
};

export const generateSummary = async (canvas: Canvas): Promise<Record<string, unknown>> => {
  if (!canvas || typeof canvas.ideaSummary !== "string" || !Array.isArray(canvas.assumptions)) {
    throw new Error("canvas is required");
  }
  try {
    const raw = await callLLM(SUMMARY_SYSTEM, buildSummaryPrompt(canvas), { temperature: 0.3 });
    return parseJSON<Record<string, unknown>>(raw);
  } catch (err) {
    if (err instanceof LLMError) throw new Error(err.message);
    if (err instanceof GeminiParseError) throw new Error("Could not parse the executive summary");
    throw err;
  }
};
