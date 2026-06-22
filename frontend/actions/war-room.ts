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
  ASSUMPTION_REVIEW_SYSTEM,
  buildAssumptionReviewPrompt,
  SAFETY_CLASSIFIER_SYSTEM,
  buildSafetyClassifierPrompt,
} from "@/prompts/agents";
import type {
  AgentRole,
  AssumptionNode,
  AssumptionStatus,
  DebateMessage,
  QA,
  SafetyBlockResult,
  SafetyVerdict,
} from "@/lib/types";

const AGENT_SYSTEMS: Record<AgentRole, string> = {
  SKEPTIC: SKEPTIC_SYSTEM,
  STRATEGIST: STRATEGIST_SYSTEM,
  OPERATOR: OPERATOR_SYSTEM,
};

const VALID_STATUSES = new Set<AssumptionStatus>(["VALIDATED", "UNVALIDATED", "NEEDS_INFO"]);
const VALID_AGENTS = new Set<AgentRole>(["SKEPTIC", "STRATEGIST", "OPERATOR"]);

const SAFETY_CATEGORIES = {
  ILLEGAL_GOODS_SERVICES: "illegal goods or services",
  VIOLENCE_PHYSICAL_HARM: "violence or serious physical harm",
  CBRN_WEAPONS: "weapons intended for mass harm",
  EXPLOITATION_OF_PEOPLE: "the exploitation or coercion of people",
  CHILD_SAFETY_NONCONSENSUAL_SEXUAL_CONTENT: "sexual exploitation or non-consensual abuse",
  FRAUD_DECEPTION: "fraud or deliberate deception",
  CYBER_HARM: "malicious cyber activity",
  REGULATORY_EVASION: "harmful evasion of safety or professional regulation",
  DISCRIMINATION_TARGETED_HARM: "targeted harassment, stalking, or discrimination",
} as const;

type SafetyCategory = keyof typeof SAFETY_CATEGORIES;

const HARD_BLOCK_CATEGORIES = new Set<SafetyCategory>([
  "CBRN_WEAPONS",
  "CHILD_SAFETY_NONCONSENSUAL_SEXUAL_CONTENT",
]);

const safetyRefusal = (category: SafetyCategory): string => {
  if (HARD_BLOCK_CATEGORIES.has(category)) {
    return "FOUNDR can't help develop this idea. It falls outside what this tool will engage with. FOUNDR is built to validate lawful, non-harmful businesses. You can submit a different idea.";
  }

  return `FOUNDR can't help develop this idea. It describes a business centered on ${SAFETY_CATEGORIES[category]}, which falls outside what this tool will assist with. FOUNDR is built to validate lawful businesses. If you think this was flagged in error, you can submit a different idea.`;
};

export const classifyIdea = async (
  ideaSummary: string,
  questionnaireResponses: QA[] = []
): Promise<SafetyVerdict> => {
  if (!ideaSummary.trim()) throw new Error("ideaSummary is required");

  try {
    const raw = await callLLM(
      SAFETY_CLASSIFIER_SYSTEM,
      buildSafetyClassifierPrompt(ideaSummary.trim(), questionnaireResponses),
      { temperature: 0 }
    );
    const verdict = parseJSON<{
      decision?: unknown;
      category?: unknown;
      reason?: unknown;
    }>(raw);

    if (verdict?.decision === "ALLOW") {
      return { decision: "ALLOW", category: null, reason: "" };
    }

    if (verdict?.decision === "BLOCK") {
      if (
        typeof verdict.category !== "string" ||
        !Object.hasOwn(SAFETY_CATEGORIES, verdict.category)
      ) {
        throw new Error("AI returned an unexpected safety category");
      }
      const category = verdict.category as SafetyCategory;
      return {
        decision: "BLOCK",
        category,
        reason: safetyRefusal(category),
      };
    }

    throw new Error("AI returned an unexpected safety verdict");
  } catch (err) {
    if (err instanceof GeminiParseError || err instanceof LLMError || err instanceof Error) {
      throw new Error(
        "We couldn't verify this idea safely right now. Nothing was submitted—please try again."
      );
    }
    throw err;
  }
};

export const generateQuestions = async (
  ideaSummary: string
): Promise<{ status: "ALLOW"; questions: string[] } | SafetyBlockResult> => {
  if (!ideaSummary.trim()) throw new Error("ideaSummary is required");
  const verdict = await classifyIdea(ideaSummary);
  if (verdict.decision === "BLOCK") {
    return {
      status: "BLOCK",
      category: verdict.category ?? "ILLEGAL_GOODS_SERVICES",
      reason: verdict.reason,
    };
  }

  try {
    const raw = await callLLM(QUESTION_GEN_PROMPT, `Founder's idea: ${ideaSummary}`, { temperature: 0.4 });
    const questions = parseJSON<string[]>(raw);
    if (!Array.isArray(questions) || questions.length !== 3 || !questions.every((q) => typeof q === "string")) {
      throw new Error("AI returned an unexpected question format");
    }
    return { status: "ALLOW", questions };
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

export const reviewAssumption = async (params: {
  ideaSummary: string;
  questionnaireResponses: QA[];
  claim: string;
  agentSource: AgentRole;
  explanation: string;
  founderInput: string;
  kind: "EVIDENCE" | "MODIFY";
}): Promise<{ status: AssumptionStatus; explanation: string; howToTest?: string }> => {
  const { ideaSummary, questionnaireResponses, claim, agentSource, explanation, founderInput, kind } = params;

  if (!ideaSummary.trim()) throw new Error("ideaSummary is required");
  if (!claim.trim()) throw new Error("claim is required");
  if (!VALID_AGENTS.has(agentSource)) throw new Error("invalid agentSource");
  if (kind !== "EVIDENCE" && kind !== "MODIFY") throw new Error("invalid review kind");
  // Evidence re-review needs something to assess; a claim rewrite is itself the input.
  if (kind === "EVIDENCE" && !founderInput.trim()) throw new Error("Add some information first");

  try {
    const userPrompt = buildAssumptionReviewPrompt({
      ideaSummary,
      questionnaire: questionnaireResponses,
      claim,
      agentSource,
      explanation,
      founderInput,
      kind,
    });
    const raw = await callLLM(ASSUMPTION_REVIEW_SYSTEM, userPrompt, { temperature: 0.2 });
    const data = parseJSON<{ status?: string; explanation?: string; howToTest?: string }>(raw);

    if (
      !data ||
      !VALID_STATUSES.has(data.status as AssumptionStatus) ||
      typeof data.explanation !== "string" ||
      !data.explanation.trim()
    ) {
      throw new Error("AI returned an unexpected review format");
    }

    const status = data.status as AssumptionStatus;
    const result: { status: AssumptionStatus; explanation: string; howToTest?: string } = {
      status,
      explanation: data.explanation.trim(),
    };
    if (status !== "VALIDATED" && typeof data.howToTest === "string" && data.howToTest.trim()) {
      result.howToTest = data.howToTest.trim();
    }
    return result;
  } catch (err) {
    if (err instanceof GeminiParseError) throw new Error("AI returned malformed review output");
    if (err instanceof LLMError) throw new Error("AI service is unavailable");
    throw err;
  }
};
