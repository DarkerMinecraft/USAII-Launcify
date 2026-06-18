import { NextRequest, NextResponse } from "next/server";
import { callGemini, parseJSON, GeminiError, GeminiParseError } from "@/lib/gemini";
import { ASSUMPTION_MAP_SYSTEM, buildAssumptionMapPrompt } from "@/prompts/agents";

type AssumptionStatus = "VALIDATED" | "UNVALIDATED" | "NEEDS_INFO";
type AgentSource = "SKEPTIC" | "STRATEGIST" | "OPERATOR";

interface RawNode {
  claim?: unknown;
  status?: unknown;
  explanation?: unknown;
  agentSource?: unknown;
  howToTest?: unknown;
}

// The exact node contract the Phase 7 React Flow map consumes — nothing else.
interface AssumptionNode {
  claim: string;
  status: AssumptionStatus;
  explanation: string;
  agentSource: AgentSource;
  howToTest?: string;
}

type QA = { question: string; answer: string };
type Message = { agent: string; round: number; content: string };

const VALID_STATUSES = new Set<AssumptionStatus>(["VALIDATED", "UNVALIDATED", "NEEDS_INFO"]);
const VALID_AGENTS = new Set<AgentSource>(["SKEPTIC", "STRATEGIST", "OPERATOR"]);

export async function POST(req: NextRequest) {
  let body: {
    ideaSummary?: string;
    questionnaireResponses?: QA[];
    transcript?: Message[];
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
  if (!Array.isArray(transcript) || transcript.length === 0) {
    return NextResponse.json({ error: "transcript is required" }, { status: 400 });
  }

  try {
    const userPrompt = buildAssumptionMapPrompt(ideaSummary, questionnaireResponses, transcript);
    // Low temperature: this is structured extraction, not creative prose.
    const raw = await callGemini(ASSUMPTION_MAP_SYSTEM, userPrompt, { temperature: 0.2 });
    const data = parseJSON<{ assumptions?: RawNode[] }>(raw);

    if (!Array.isArray(data?.assumptions)) {
      return NextResponse.json({ error: "AI returned an unexpected map format" }, { status: 502 });
    }

    // Rebuild each node from scratch so only contract fields survive — no stray
    // keys (ids, scores, etc.) leak through to the React Flow renderer.
    const assumptions: AssumptionNode[] = [];
    for (const n of data.assumptions) {
      if (
        typeof n.claim !== "string" || !n.claim.trim() ||
        typeof n.explanation !== "string" || !n.explanation.trim() ||
        !VALID_STATUSES.has(n.status as AssumptionStatus) ||
        !VALID_AGENTS.has(n.agentSource as AgentSource)
      ) {
        continue;
      }

      const status = n.status as AssumptionStatus;
      const node: AssumptionNode = {
        claim: n.claim.trim(),
        status,
        explanation: n.explanation.trim(),
        agentSource: n.agentSource as AgentSource,
      };
      // howToTest only applies to unresolved nodes, per the contract.
      if (status !== "VALIDATED" && typeof n.howToTest === "string" && n.howToTest.trim()) {
        node.howToTest = n.howToTest.trim();
      }
      assumptions.push(node);
    }

    if (assumptions.length === 0) {
      return NextResponse.json(
        { error: "AI produced no valid assumptions" },
        { status: 502 }
      );
    }

    return NextResponse.json({ assumptions });
  } catch (err) {
    if (err instanceof GeminiParseError) {
      return NextResponse.json({ error: "AI returned malformed map output" }, { status: 502 });
    }
    if (err instanceof GeminiError) {
      return NextResponse.json({ error: "AI service is unavailable" }, { status: 502 });
    }
    throw err;
  }
}
