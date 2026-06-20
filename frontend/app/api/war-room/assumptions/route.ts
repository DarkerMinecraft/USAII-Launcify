import { NextRequest, NextResponse } from "next/server";
import { callLLM, parseJSON, GeminiParseError, LLMError } from "@/lib/llm";
import { hasAnsweredQuestionnaire } from "@/lib/questionnaire";
import type { AssumptionNode, AssumptionStatus, DebateMessage, QA, AgentRole } from "@/lib/types";
import { ASSUMPTION_MAP_SYSTEM, buildAssumptionMapPrompt } from "@/prompts/agents";

interface RawNode {
  claim?: unknown;
  status?: unknown;
  explanation?: unknown;
  agentSource?: unknown;
  howToTest?: unknown;
}

const VALID_STATUSES = new Set<AssumptionStatus>(["VALIDATED", "UNVALIDATED", "NEEDS_INFO"]);
const VALID_AGENTS = new Set<AgentRole>(["SKEPTIC", "STRATEGIST", "OPERATOR"]);

export const POST = async (req: NextRequest) => {
  let body: {
    ideaSummary?: string;
    questionnaireResponses?: QA[];
    transcript?: DebateMessage[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const ideaSummary = body.ideaSummary ?? "";
  const questionnaireResponses = body.questionnaireResponses ?? [];
  const transcript = body.transcript ?? [];

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
  if (!Array.isArray(transcript) || transcript.length === 0) {
    return NextResponse.json({ error: "transcript is required" }, { status: 400 });
  }

  try {
    const userPrompt = buildAssumptionMapPrompt(ideaSummary, questionnaireResponses, transcript);
    // Low temperature: this is structured extraction, not creative prose.
    const raw = await callLLM(ASSUMPTION_MAP_SYSTEM, userPrompt, { temperature: 0.2 });
    const data = parseJSON<{ assumptions?: RawNode[] }>(raw);

    if (!Array.isArray(data?.assumptions)) {
      return NextResponse.json({ error: "AI returned an unexpected map format" }, { status: 502 });
    }

    // Rebuild each node from scratch so only canonical canvas fields survive.
    const sanitized: Omit<AssumptionNode, "id">[] = [];
    for (const n of data.assumptions) {
      if (
        typeof n.claim !== "string" || !n.claim.trim() ||
        typeof n.explanation !== "string" || !n.explanation.trim() ||
        !VALID_STATUSES.has(n.status as AssumptionStatus) ||
        !VALID_AGENTS.has(n.agentSource as AgentRole)
      ) {
        continue;
      }

      const status = n.status as AssumptionStatus;
      const node: Omit<AssumptionNode, "id"> = {
        claim: n.claim.trim(),
        status,
        explanation: n.explanation.trim(),
        agentSource: n.agentSource as AgentRole,
        remediation: null,
      };
      // howToTest only applies to unresolved nodes, per the contract.
      if (status !== "VALIDATED" && typeof n.howToTest === "string" && n.howToTest.trim()) {
        node.howToTest = n.howToTest.trim();
      }
      sanitized.push(node);
    }

    if (sanitized.length === 0) {
      return NextResponse.json(
        { error: "AI produced no valid assumptions" },
        { status: 502 }
      );
    }

    const assumptions: AssumptionNode[] = sanitized.map((node, i) => ({
      id: `node_${String(i + 1).padStart(3, "0")}`,
      ...node,
    }));
    const dropped = data.assumptions.length - assumptions.length;

    return NextResponse.json({ assumptions, dropped });
  } catch (err) {
    if (err instanceof GeminiParseError) {
      return NextResponse.json({ error: "AI returned malformed map output" }, { status: 502 });
    }
    if (err instanceof LLMError) {
      return NextResponse.json({ error: "AI service is unavailable" }, { status: 502 });
    }
    throw err;
  }
}
