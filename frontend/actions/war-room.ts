"use server";

import { callLLM, parseJSON, GeminiParseError, LLMError } from "@/lib/llm";
import { hasAnsweredQuestionnaire } from "@/lib/questionnaire";
import {
  QUESTION_GEN_PROMPT,
  SKEPTIC_SYSTEM,
  STRATEGIST_SYSTEM,
  OPERATOR_SYSTEM,
  buildRound1Prompt,
  buildRound2Prompt,
  buildRound3Prompt,
  ASSUMPTION_MAP_SYSTEM,
  buildAssumptionMapPrompt,
} from "@/prompts/agents";
import type { AgentRole, AssumptionNode, AssumptionStatus, DebateMessage, QA } from "@/lib/types";

const AGENT_SYSTEMS: Record<AgentRole, string> = {
  SKEPTIC: SKEPTIC_SYSTEM,
  STRATEGIST: STRATEGIST_SYSTEM,
  OPERATOR: OPERATOR_SYSTEM,
};

const VALID_STATUSES = new Set<AssumptionStatus>(["VALIDATED", "UNVALIDATED", "NEEDS_INFO"]);
const VALID_AGENTS = new Set<AgentRole>(["SKEPTIC", "STRATEGIST", "OPERATOR"]);

export const generateQuestions = async (ideaSummary: string): Promise<{ questions: string[] }> => {
  if (!ideaSummary.trim()) throw new Error("ideaSummary is required");
  try {
    const raw = await callLLM(QUESTION_GEN_PROMPT, `Founder's idea: ${ideaSummary}`, { temperature: 0.4 });
    const questions = parseJSON<string[]>(raw);
    if (!Array.isArray(questions) || questions.length !== 3 || !questions.every((q) => typeof q === "string")) {
      throw new Error("AI returned an unexpected question format");
    }
    return { questions };
  } catch (err) {
    if (err instanceof GeminiParseError) throw new Error("AI returned malformed output");
    if (err instanceof LLMError) throw new Error("AI service is unavailable");
    throw err;
  }
};

export const generateDebateRound = async (params: {
  agent: AgentRole;
  round: 1 | 2 | 3;
  ideaSummary: string;
  questionnaireResponses: QA[];
  transcript: DebateMessage[];
}): Promise<{ agent: AgentRole; round: number; content: string }> => {
  const { agent, round, ideaSummary, questionnaireResponses, transcript } = params;

  if (!agent || !(agent in AGENT_SYSTEMS)) throw new Error("agent must be SKEPTIC, STRATEGIST, or OPERATOR");
  if (round !== 1 && round !== 2 && round !== 3) throw new Error("round must be 1, 2, or 3");
  if (!ideaSummary.trim()) throw new Error("ideaSummary is required");
  if (!Array.isArray(questionnaireResponses) || questionnaireResponses.length === 0) throw new Error("questionnaireResponses is required");
  if (!hasAnsweredQuestionnaire(questionnaireResponses)) throw new Error("At least one questionnaire answer is required");
  if (round > 1 && (!Array.isArray(transcript) || transcript.length === 0)) throw new Error(`transcript is required for round ${round}`);

  const userPrompt =
    round === 1 ? buildRound1Prompt(ideaSummary, questionnaireResponses)
    : round === 2 ? buildRound2Prompt(ideaSummary, questionnaireResponses, transcript)
    : buildRound3Prompt(ideaSummary, questionnaireResponses, transcript);

  try {
    const content = await callLLM(AGENT_SYSTEMS[agent], userPrompt);
    return { agent, round, content };
  } catch (err) {
    if (err instanceof LLMError) throw new Error(`${agent} failed to respond in round ${round}`);
    throw err;
  }
};

export const generateAssumptions = async (params: {
  ideaSummary: string;
  questionnaireResponses: QA[];
  transcript: DebateMessage[];
}): Promise<{ assumptions: AssumptionNode[]; dropped: number }> => {
  const { ideaSummary, questionnaireResponses, transcript } = params;

  if (!ideaSummary.trim()) throw new Error("ideaSummary is required");
  if (!Array.isArray(questionnaireResponses) || questionnaireResponses.length === 0) throw new Error("questionnaireResponses is required");
  if (!hasAnsweredQuestionnaire(questionnaireResponses)) throw new Error("At least one questionnaire answer is required");
  if (!Array.isArray(transcript) || transcript.length === 0) throw new Error("transcript is required");

  try {
    const userPrompt = buildAssumptionMapPrompt(ideaSummary, questionnaireResponses, transcript);
    const raw = await callLLM(ASSUMPTION_MAP_SYSTEM, userPrompt, { temperature: 0.2 });
    const data = parseJSON<{ assumptions?: Record<string, unknown>[] }>(raw);

    if (!Array.isArray(data?.assumptions)) throw new Error("AI returned an unexpected map format");

    const sanitized: Omit<AssumptionNode, "id">[] = [];
    for (const n of data.assumptions) {
      if (
        typeof n.claim !== "string" || !n.claim.trim() ||
        typeof n.explanation !== "string" || !n.explanation.trim() ||
        !VALID_STATUSES.has(n.status as AssumptionStatus) ||
        !VALID_AGENTS.has(n.agentSource as AgentRole)
      ) continue;

      const status = n.status as AssumptionStatus;
      const node: Omit<AssumptionNode, "id"> = {
        claim: (n.claim as string).trim(),
        status,
        explanation: (n.explanation as string).trim(),
        agentSource: n.agentSource as AgentRole,
        remediation: null,
      };
      if (status !== "VALIDATED" && typeof n.howToTest === "string" && (n.howToTest as string).trim()) {
        node.howToTest = (n.howToTest as string).trim();
      }
      sanitized.push(node);
    }

    if (sanitized.length === 0) throw new Error("AI produced no valid assumptions");

    const assumptions: AssumptionNode[] = sanitized.map((node, i) => ({
      id: `node_${String(i + 1).padStart(3, "0")}`,
      ...node,
    }));

    return { assumptions, dropped: data.assumptions.length - assumptions.length };
  } catch (err) {
    if (err instanceof GeminiParseError) throw new Error("AI returned malformed map output");
    if (err instanceof LLMError) throw new Error("AI service is unavailable");
    throw err;
  }
};
