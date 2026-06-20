import { NextRequest, NextResponse } from "next/server";
import { callLLM, LLMError } from "@/lib/llm";
import { hasAnsweredQuestionnaire } from "@/lib/questionnaire";
import {
  SKEPTIC_SYSTEM,
  STRATEGIST_SYSTEM,
  OPERATOR_SYSTEM,
  buildRound1Prompt,
  buildRound2Prompt,
  buildRound3Prompt,
} from "@/prompts/agents";
import type { AgentRole, DebateMessage, QA } from "@/lib/types";

const AGENT_SYSTEMS: Record<AgentRole, string> = {
  SKEPTIC: SKEPTIC_SYSTEM,
  STRATEGIST: STRATEGIST_SYSTEM,
  OPERATOR: OPERATOR_SYSTEM,
};

export const POST = async (req: NextRequest) => {
  let body: {
    agent?: AgentRole;
    round?: number;
    ideaSummary?: string;
    questionnaireResponses?: QA[];
    transcript?: DebateMessage[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const { agent, round, ideaSummary = "" } = body;
  const questionnaireResponses = body.questionnaireResponses ?? [];
  const transcript = body.transcript ?? [];

  if (!agent || !(agent in AGENT_SYSTEMS)) {
    return NextResponse.json({ error: "agent must be SKEPTIC, STRATEGIST, or OPERATOR" }, { status: 400 });
  }
  if (round !== 1 && round !== 2 && round !== 3) {
    return NextResponse.json({ error: "round must be 1, 2, or 3" }, { status: 400 });
  }
  if (!ideaSummary.trim()) {
    return NextResponse.json({ error: "ideaSummary is required" }, { status: 400 });
  }
  if (!Array.isArray(questionnaireResponses) || questionnaireResponses.length === 0) {
    return NextResponse.json({ error: "questionnaireResponses is required" }, { status: 400 });
  }
  if (!hasAnsweredQuestionnaire(questionnaireResponses)) {
    return NextResponse.json(
      { error: "At least one questionnaire answer is required" },
      { status: 400 }
    );
  }
  // Rounds 2 and 3 respond to prior rounds — a missing transcript means the
  // orchestration is out of order, not a model problem.
  if (round > 1 && (!Array.isArray(transcript) || transcript.length === 0)) {
    return NextResponse.json(
      { error: `transcript is required for round ${round}` },
      { status: 400 }
    );
  }

  let userPrompt: string;
  if (round === 1) {
    userPrompt = buildRound1Prompt(ideaSummary, questionnaireResponses);
  } else if (round === 2) {
    userPrompt = buildRound2Prompt(ideaSummary, questionnaireResponses, transcript);
  } else {
    userPrompt = buildRound3Prompt(ideaSummary, questionnaireResponses, transcript);
  }

  try {
    const content = await callLLM(AGENT_SYSTEMS[agent], userPrompt);
    return NextResponse.json({ agent, round, content });
  } catch (err) {
    if (err instanceof LLMError) {
      // Surface agent + round so the orchestration hook can show which step
      // failed and offer a retry without losing the rest of the debate.
      return NextResponse.json(
        { error: `${agent} failed to respond in round ${round}`, agent, round },
        { status: 502 }
      );
    }
    throw err;
  }
}
