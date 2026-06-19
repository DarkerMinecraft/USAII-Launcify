"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { DEFAULT_QUESTIONS, hasAnsweredQuestionnaire } from "@/lib/questionnaire";
import type { QA } from "@/lib/types";

type Stage = "intake" | "questionnaire";

// Shared input chrome per the design system (surface-3 well, hairline border).
const inputStyle: React.CSSProperties = {
  background: "#1a1916",
  border: "1px solid #2e2c28",
  borderRadius: "9px",
  padding: "12px 15px",
  color: "#ede9e0",
  outline: "none",
  fontSize: "14px",
  lineHeight: 1.5,
  width: "100%",
  resize: "vertical",
};

const eyebrow: React.CSSProperties = {
  fontSize: "9.5px",
  letterSpacing: "0.16em",
  color: "#5a574f",
  textTransform: "uppercase",
};

export function Questionnaire() {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("intake");
  const [idea, setIdea] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateQuestions() {
    if (!idea.trim()) return;
    setError(null);
    setLoadingQuestions(true);
    try {
      const res = await fetch("/api/war-room/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaSummary: idea.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Could not generate questions");
      }
      const aiQuestions: string[] = Array.isArray(data?.questions) ? data.questions : [];
      const all = [...DEFAULT_QUESTIONS, ...aiQuestions];
      setQuestions(all);
      setAnswers(new Array(all.length).fill(""));
      setStage("questionnaire");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoadingQuestions(false);
    }
  }

  async function submit() {
    const qa: QA[] = questions.map((question, i) => ({
      question,
      answer: answers[i] ?? "",
    }));

    if (!hasAnsweredQuestionnaire(qa)) {
      setError("Answer at least one question before entering the War Room.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaSummary: idea.trim(), questionnaireResponses: qa }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Could not create your session");
      }
      router.push(`/war-room/session/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-16">
      <div style={eyebrow} className="font-mono mb-4">
        War Room · Idea Intake
      </div>

      <AnimatePresence mode="wait">
        {stage === "intake" ? (
          <motion.div
            key="intake"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <h1
              className="font-serif italic mb-3"
              style={{ fontSize: "34px", color: "#ede9e0", lineHeight: 1.1 }}
            >
              What are you building?
            </h1>
            <p
              className="mb-8 leading-relaxed"
              style={{ fontSize: "15px", color: "#9a958c", maxWidth: "32rem" }}
            >
              Describe your idea in a sentence or two. Three AI advisors will read it,
              then ask the questions that matter most before the debate begins.
            </p>

            <label style={eyebrow} className="font-mono block mb-2">
              Your idea
            </label>
            <textarea
              autoFocus
              rows={3}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="e.g. An AI comms layer that drafts freight brokers' carrier emails so they can cover more loads per rep."
              style={inputStyle}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generateQuestions();
              }}
            />

            {error && <ErrorNote message={error} />}

            <div className="mt-6 flex items-center gap-4">
              <PrimaryButton
                disabled={!idea.trim() || loadingQuestions}
                onClick={generateQuestions}
                loading={loadingQuestions}
                loadingLabel="Reading your idea…"
                icon={<Sparkles className="w-4 h-4" />}
                label="Generate my questions"
              />
              <span style={eyebrow} className="font-mono">
                ⌘↵ to continue
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="questionnaire"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <h1
              className="font-serif italic mb-3"
              style={{ fontSize: "30px", color: "#ede9e0", lineHeight: 1.12 }}
            >
              Brief the room.
            </h1>
            <p
              className="mb-8 leading-relaxed"
              style={{ fontSize: "14.5px", color: "#9a958c", maxWidth: "34rem" }}
            >
              Answer what you can — honestly. Leaving a question blank is a signal too;
              the advisors will treat it as something you haven&apos;t worked out yet.
            </p>

            <div className="flex flex-col gap-6">
              {questions.map((q, i) => {
                const isAI = i >= DEFAULT_QUESTIONS.length;
                return (
                  <div key={i}>
                    <div className="flex items-center gap-2 mb-2">
                      <span style={eyebrow} className="font-mono">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {isAI && (
                        <span
                          className="font-mono inline-flex items-center gap-1"
                          style={{
                            fontSize: "8.5px",
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: "#c2692a",
                          }}
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          Tailored
                        </span>
                      )}
                    </div>
                    <label
                      className="font-serif block mb-2"
                      style={{ fontSize: "16px", color: "#ede9e0", lineHeight: 1.3 }}
                    >
                      {q}
                    </label>
                    <textarea
                      rows={2}
                      value={answers[i] ?? ""}
                      onChange={(e) => {
                        const next = [...answers];
                        next[i] = e.target.value;
                        setAnswers(next);
                      }}
                      placeholder="Your answer…"
                      style={inputStyle}
                    />
                  </div>
                );
              })}
            </div>

            {error && <ErrorNote message={error} />}

            <div className="mt-8 flex items-center gap-4">
              <PrimaryButton
                disabled={submitting}
                onClick={submit}
                loading={submitting}
                loadingLabel="Convening the room…"
                icon={<ArrowRight className="w-4 h-4" />}
                label="Enter the War Room"
              />
              <button
                onClick={() => {
                  setStage("intake");
                  setError(null);
                }}
                disabled={submitting}
                className="font-medium transition-colors"
                style={{ fontSize: "13px", color: "#7a7670", background: "none", border: "none" }}
              >
                ← Edit idea
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PrimaryButton({
  disabled,
  onClick,
  loading,
  loadingLabel,
  icon,
  label,
}: {
  disabled?: boolean;
  onClick: () => void;
  loading?: boolean;
  loadingLabel: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2.5 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: "#ede9e0",
        color: "#131210",
        borderRadius: "9px",
        padding: "12px 22px",
        fontSize: "14.5px",
        border: "none",
      }}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {loadingLabel}
        </>
      ) : (
        <>
          {icon}
          {label}
        </>
      )}
    </button>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p
      className="mt-4"
      style={{ fontSize: "13px", color: "#c2692a", lineHeight: 1.5 }}
      role="alert"
    >
      {message}
    </p>
  );
}
