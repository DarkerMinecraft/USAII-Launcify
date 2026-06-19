import type { QA } from "@/lib/types";

// The 5 questions always asked, per the War Room spec in frontend/CLAUDE.md.
// These are UI questions (not LLM prompts), so they live here with the guard —
// the AI-generated 3 are appended at runtime to make the 8-question form.
export const DEFAULT_QUESTIONS: readonly string[] = [
  "Who specifically has this problem? Describe them in one sentence.",
  "How do they solve this problem today, without your product?",
  "Have you spoken to anyone who has this problem? What did they say?",
  "What does success look like in 90 days?",
  "What's the single biggest thing that could kill this idea?",
];

export function hasAnsweredQuestionnaire(questionnaire: QA[]): boolean {
  return questionnaire.some((q) => typeof q.answer === "string" && q.answer.trim().length > 0);
}
