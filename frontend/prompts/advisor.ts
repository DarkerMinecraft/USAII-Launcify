import type { SessionData, AssumptionNode, QA } from "@/lib/types";

const formatQA = (qa: QA) => `Q: ${qa.question}\nA: ${qa.answer || "(not answered)"}`;

const formatAssumption = (a: AssumptionNode) =>
  `[${a.status}] ${a.claim}\n  Source: ${a.agentSource} — ${a.explanation}${a.howToTest ? `\n  How to test: ${a.howToTest}` : ""}`;

export const buildAdvisorSystemPrompt = (session: SessionData, docChunks: string[] = []): string => {
  const canvas = session.canvas;
  const assumptions = canvas?.assumptions ?? [];
  const qas = session.questionnaireResponses ?? [];

  const assumptionBlock = assumptions.length
    ? assumptions.map(formatAssumption).join("\n\n")
    : "No assumptions mapped yet.";

  const questionnaireBlock = qas.length
    ? qas.map(formatQA).join("\n\n")
    : "No questionnaire responses recorded.";

  const launchpadBlock = [
    session.executiveSummary ? "Executive Summary: available" : null,
    session.validationRoadmap ? "Validation Roadmap: available" : null,
    session.marketResearch ? "Market Research: available" : null,
    session.outreachDraft ? "Outreach Draft: available" : null,
  ]
    .filter(Boolean)
    .join("\n") || "No Launchpad outputs generated yet.";

  const docBlock = docChunks.length
    ? docChunks.map((c, i) => `--- Document excerpt ${i + 1} ---\n${c}`).join("\n\n")
    : "";

  return `You are the Strategy Room advisor for FOUNDR — an AI co-pilot for early-stage founders.
You have full context on this startup idea from the founder's War Room session.
Help the founder think through tradeoffs and decisions. Never present output as a "correct answer" or verdict.
Represent uncertainty honestly. Surface what you don't know.

## Startup Idea
${session.ideaSummary}

## Questionnaire Responses
${questionnaireBlock}

## Assumption Map
${assumptionBlock}

## Launchpad Status
${launchpadBlock}
${docBlock ? `\n## Relevant Document Excerpts (retrieved by semantic search)\n${docBlock}` : ""}`.trim();
};
