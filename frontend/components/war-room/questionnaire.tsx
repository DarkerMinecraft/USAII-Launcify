"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { DEFAULT_QUESTIONS, hasAnsweredQuestionnaire } from "@/lib/questionnaire";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { SafetyBlockDialog } from "@/components/war-room/safety-refusal";
import type { QA, SafetyBlockResult } from "@/lib/types";
import { generateQuestions as generateQuestionsAction } from "@/actions/war-room";
import { createSession } from "@/actions/sessions";

type Stage = "intake" | "questionnaire";

const textareaClass =
  "bg-surface-3 border border-border rounded-[9px] px-[15px] py-3 text-foreground text-sm leading-relaxed placeholder:text-text-faint resize-y focus-visible:border-text-faint focus-visible:ring-1 focus-visible:ring-text-faint/20 min-h-0";

export const Questionnaire = () => {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("intake");
  const [idea, setIdea] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [generatingQuestions, startGenerating] = useTransition();
  const [submitting, startSubmitting] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [safetyBlock, setSafetyBlock] = useState<SafetyBlockResult | null>(null);

  const generateQuestions = () => {
    if (!idea.trim()) return;
    setError(null);
    startGenerating(async () => {
      try {
        const data = await generateQuestionsAction(idea.trim());
        if (data.status === "BLOCK") {
          setIdea("");
          setSafetyBlock(data);
          return;
        }
        const aiQuestions: string[] = data.questions;
        const all = [...DEFAULT_QUESTIONS, ...aiQuestions];
        setQuestions(all);
        setAnswers(new Array(all.length).fill(""));
        setStage("questionnaire");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  };

  const submit = () => {
    const qa: QA[] = questions.map((question, i) => ({
      question,
      answer: answers[i] ?? "",
    }));

    if (!hasAnsweredQuestionnaire(qa)) {
      setError("Answer at least one question before entering the War Room.");
      return;
    }

    setError(null);
    startSubmitting(async () => {
      try {
        const data = await createSession(idea.trim(), qa);
        if (data.status === "BLOCK") {
          setSafetyBlock(data);
          return;
        }
        router.push(`/war-room/session/${data.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-5 sm:px-8 py-10 sm:py-16">
      <AnimatePresence>
        {safetyBlock && (
          <SafetyBlockDialog
            block={safetyBlock}
            onDismiss={() => {
              setSafetyBlock(null);
              setIdea("");
              setQuestions([]);
              setAnswers([]);
              setStage("intake");
              setError(null);
            }}
          />
        )}
      </AnimatePresence>

      <div className="eyebrow font-mono mb-4">
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
            <h1 className="font-serif italic mb-3 text-[34px] leading-[1.1] text-foreground">
              What are you building?
            </h1>
            <p className="mb-8 leading-relaxed text-[15px] text-text-muted max-w-[32rem]">
              Describe your idea in a sentence or two. Three AI advisors will read it,
              then ask the questions that matter most before the debate begins.
            </p>

            <Label htmlFor="idea-input" className="eyebrow font-mono block mb-2">
              Your idea
            </Label>
            <Textarea
              id="idea-input"
              autoFocus
              rows={3}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="e.g. An AI comms layer that drafts freight brokers' carrier emails so they can cover more loads per rep."
              className={textareaClass}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void generateQuestions();
              }}
            />

            {error && <ErrorNote message={error} />}

            <div className="mt-6 flex items-center gap-4">
              <PrimaryButton
                disabled={!idea.trim() || generatingQuestions}
                onClick={generateQuestions}
                loading={generatingQuestions}
                loadingLabel="Reading your idea…"
                icon={<Sparkles className="w-4 h-4" />}
                label="Generate my questions"
              />
              <span className="eyebrow font-mono">
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
            <h1 className="font-serif italic mb-3 text-[30px] leading-[1.12] text-foreground">
              Brief the room.
            </h1>
            <p className="mb-8 leading-relaxed text-[14.5px] text-text-muted max-w-[34rem]">
              Answer what you can — honestly. Leaving a question blank is a signal too;
              the advisors will treat it as something you haven&apos;t worked out yet.
            </p>

            <div className="flex flex-col gap-6">
              {questions.map((q, i) => {
                const isAI = i >= DEFAULT_QUESTIONS.length;
                return (
                  <div key={i}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="eyebrow font-mono">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {isAI && (
                        <span className="font-mono inline-flex items-center gap-1 text-[8.5px] tracking-[0.12em] uppercase text-agent-skeptic">
                          <Sparkles className="w-2.5 h-2.5" />
                          Tailored
                        </span>
                      )}
                    </div>
                    <Label htmlFor={`q-${i}`} className="font-serif block mb-2 text-[16px] leading-[1.3] text-foreground">
                      {q}
                    </Label>
                    <Textarea
                      id={`q-${i}`}
                      rows={2}
                      value={answers[i] ?? ""}
                      onChange={(e) => {
                        const next = [...answers];
                        next[i] = e.target.value;
                        setAnswers(next);
                      }}
                      placeholder="Your answer…"
                      className={textareaClass}
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
              <Button
                onClick={() => { setStage("intake"); setError(null); }}
                disabled={submitting}
                variant="ghost"
                className="text-[13px] text-text-dim px-0"
              >
                ← Edit idea
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PrimaryButton = ({
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
}) => (
  <Button
    onClick={onClick}
    disabled={disabled}
    className="btn-primary"
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
  </Button>
);

const ErrorNote = ({ message }: { message: string }) => (
  <Alert variant="destructive" className="mt-4 border-agent-skeptic/40 bg-[rgba(194,105,42,0.06)] text-agent-skeptic [&>svg]:text-agent-skeptic">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription className="text-agent-skeptic/90">{message}</AlertDescription>
  </Alert>
);
