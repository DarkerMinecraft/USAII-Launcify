"use server";

import { callLLM, parseJSON, LLMError, GeminiParseError } from "@/lib/llm";
import {
  OUTREACH_SYSTEM, buildOutreachPrompt,
  SUMMARY_SYSTEM, buildSummaryPrompt,
  VALIDATION_ROADMAP_SYSTEM, buildValidationRoadmapPrompt,
  MARKET_RESEARCH_SYSTEM, buildMarketResearchPrompt,
} from "@/prompts/agents";
import type { Canvas } from "@/lib/types";

export const generateOutreach = async (canvas: Canvas, userContext?: string): Promise<Record<string, unknown>> => {
  if (!canvas || typeof canvas.ideaSummary !== "string" || !Array.isArray(canvas.assumptions)) {
    throw new Error("canvas is required");
  }
  try {
    const raw = await callLLM(OUTREACH_SYSTEM, buildOutreachPrompt(canvas, userContext), { temperature: 0.5 });
    return parseJSON<Record<string, unknown>>(raw);
  } catch (err) {
    if (err instanceof LLMError) throw new Error(err.message);
    if (err instanceof GeminiParseError) throw new Error("Could not parse the outreach draft");
    throw err;
  }
};

export const generateSummary = async (canvas: Canvas, userContext?: string): Promise<Record<string, unknown>> => {
  if (!canvas || typeof canvas.ideaSummary !== "string" || !Array.isArray(canvas.assumptions)) {
    throw new Error("canvas is required");
  }
  try {
    const raw = await callLLM(SUMMARY_SYSTEM, buildSummaryPrompt(canvas, userContext), { temperature: 0.3 });
    return parseJSON<Record<string, unknown>>(raw);
  } catch (err) {
    if (err instanceof LLMError) throw new Error(err.message);
    if (err instanceof GeminiParseError) throw new Error("Could not parse the executive summary");
    throw err;
  }
};

export const generateValidationRoadmap = async (canvas: Canvas, userContext?: string): Promise<Record<string, unknown>> => {
  if (!canvas || typeof canvas.ideaSummary !== "string" || !Array.isArray(canvas.assumptions)) {
    throw new Error("canvas is required");
  }
  try {
    const raw = await callLLM(VALIDATION_ROADMAP_SYSTEM, buildValidationRoadmapPrompt(canvas, userContext), { temperature: 0.3 });
    return parseJSON<Record<string, unknown>>(raw);
  } catch (err) {
    if (err instanceof LLMError) throw new Error(err.message);
    if (err instanceof GeminiParseError) throw new Error("Could not parse the validation roadmap");
    throw err;
  }
};

export const generateMarketResearch = async (canvas: Canvas, userContext?: string): Promise<Record<string, unknown>> => {
  if (!canvas || typeof canvas.ideaSummary !== "string" || !Array.isArray(canvas.assumptions)) {
    throw new Error("canvas is required");
  }
  try {
    const raw = await callLLM(MARKET_RESEARCH_SYSTEM, buildMarketResearchPrompt(canvas, userContext), { temperature: 0.4 });
    return parseJSON<Record<string, unknown>>(raw);
  } catch (err) {
    if (err instanceof LLMError) throw new Error(err.message);
    if (err instanceof GeminiParseError) throw new Error("Could not parse the market research");
    throw err;
  }
};
