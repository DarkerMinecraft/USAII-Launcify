"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, RotateCw, AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type {
  AgentRole,
  AssumptionNode,
  Canvas,
  DebateMessage,
  QA,
  SafetyBlockResult,
} from "@/lib/types";
import { AssumptionMap } from "@/components/war-room/assumption-map";
import { SafetyBlockCard } from "@/components/war-room/safety-refusal";
import { classifyIdea, generateDebateRound, generateAssumptions } from "@/actions/war-room";
import { getSession, updateSession } from "@/actions/sessions";

const DEBATE_STEPS: { agent: AgentRole; round: 1 | 2 | 3 }[] = [
  { agent: "SKEPTIC", round: 1 },
  { agent: "STRATEGIST", round: 1 },
  { agent: "OPERATOR", round: 1 },
  { agent: "SKEPTIC", round: 2 },
  { agent: "STRATEGIST", round: 2 },
  { agent: "OPERATOR", round: 2 },
  { agent: "SKEPTIC", round: 3 },
  { agent: "STRATEGIST", round: 3 },
  { agent: "OPERATOR", round: 3 },
];

const ROUND_NAMES: Record<1 | 2 | 3, string> = {
  1: "Opening Statements",
  2: "Rebuttals",
  3: "Closing Statements",
};

const ROUND_BREAK_SECONDS = 10;

const AGENT_META: Record<
  AgentRole,
  {
    name: string; verb: string; base: string; ring: string; text: string; fill: string;
    cx: number; cy: number; r: number;
    textClass: string; topBorderClass: string; dotClass: string;
  }
> = {
  SKEPTIC: {
    name: "The Skeptic", verb: "CHALLENGES",
    base: "#c2692a", ring: "#c2692a", text: "#c2692a", fill: "rgba(194,105,42,0.15)",
    cx: 600, cy: 190, r: 34,
    textClass: "text-agent-skeptic", topBorderClass: "border-t-agent-skeptic", dotClass: "bg-agent-skeptic",
  },
  STRATEGIST: {
    name: "The Strategist", verb: "REFRAMES",
    base: "#3a5a8a", ring: "#5a7db0", text: "#6f93c4", fill: "rgba(58,90,138,0.18)",
    cx: 250, cy: 430, r: 34,
    textClass: "text-agent-strategist", topBorderClass: "border-t-[#3a5a8a]", dotClass: "bg-[#3a5a8a]",
  },
  OPERATOR: {
    name: "The Operator", verb: "GROUNDS",
    base: "#4a7c59", ring: "#4a7c59", text: "#6fa37e", fill: "rgba(74,124,89,0.18)",
    cx: 950, cy: 430, r: 34,
    textClass: "text-agent-operator", topBorderClass: "border-t-[#4a7c59]", dotClass: "bg-[#4a7c59]",
  },
};

const THINK_DOT_DELAYS = [
  "[animation:thinkDot_1.2s_0s_infinite_ease-in-out]",
  "[animation:thinkDot_1.2s_0.15s_infinite_ease-in-out]",
  "[animation:thinkDot_1.2s_0.3s_infinite_ease-in-out]",
] as const;

type Phase = "loading" | "blocked" | "debating" | "synthesizing" | "ready" | "error";
type ErrorKind = "load" | "turn" | "synth";
type Intermission = {
  afterRound: 1 | 2;
  nextRound: 2 | 3;
  secondsRemaining: number;
};


export const WarRoomArena = ({ id }: { id: string }) => {
  const [phase, setPhase] = useState<Phase>("loading");
  const [ideaSummary, setIdeaSummary] = useState("");
  const [questionnaire, setQuestionnaire] = useState<QA[]>([]);
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [activeAgent, setActiveAgent] = useState<AgentRole | null>(null);
  const [thinkingRound, setThinkingRound] = useState<1 | 2 | 3 | null>(null);
  const [assumptionCount, setAssumptionCount] = useState(0);
  const [assumptions, setAssumptions] = useState<AssumptionNode[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [failedStep, setFailedStep] = useState<number | null>(null);
  const [persistWarned, setPersistWarned] = useState(false);
  const [intermission, setIntermission] = useState<Intermission | null>(null);
  const [safetyBlock, setSafetyBlock] = useState<SafetyBlockResult | null>(null);

  const startedRef = useRef(false);
  const stoppedRef = useRef(false);
  const dialogueScrollRef = useRef<HTMLDivElement>(null);
  const dialogueBottomRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const intermissionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intermissionResolverRef = useRef<(() => void) | null>(null);

  const finishIntermission = useCallback(() => {
    if (intermissionTimerRef.current) {
      clearInterval(intermissionTimerRef.current);
      intermissionTimerRef.current = null;
    }
    setIntermission(null);
    const resolve = intermissionResolverRef.current;
    intermissionResolverRef.current = null;
    resolve?.();
  }, []);

  const waitForNextRound = useCallback(
    (afterRound: 1 | 2) =>
      new Promise<void>((resolve) => {
        if (intermissionTimerRef.current) {
          clearInterval(intermissionTimerRef.current);
        }

        let secondsRemaining = ROUND_BREAK_SECONDS;
        intermissionResolverRef.current = resolve;
        setIntermission({
          afterRound,
          nextRound: (afterRound + 1) as 2 | 3,
          secondsRemaining,
        });

        intermissionTimerRef.current = setInterval(() => {
          secondsRemaining -= 1;
          if (secondsRemaining <= 0) {
            finishIntermission();
            return;
          }
          setIntermission({
            afterRound,
            nextRound: (afterRound + 1) as 2 | 3,
            secondsRemaining,
          });
        }, 1000);
      }),
    [finishIntermission]
  );

  useEffect(() => {
    stoppedRef.current = false;
    return () => {
      stoppedRef.current = true;
      if (intermissionTimerRef.current) {
        clearInterval(intermissionTimerRef.current);
        intermissionTimerRef.current = null;
      }
      const resolve = intermissionResolverRef.current;
      intermissionResolverRef.current = null;
      resolve?.();
    };
  }, []);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    const frame = requestAnimationFrame(() => {
      const rail = dialogueScrollRef.current;
      if (!rail) return;
      rail.scrollTo({ top: rail.scrollHeight, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages.length, activeAgent, phase, intermission?.afterRound]);

  const handleDialogueScroll = useCallback(() => {
    const rail = dialogueScrollRef.current;
    if (!rail) return;
    shouldAutoScrollRef.current =
      rail.scrollHeight - rail.scrollTop - rail.clientHeight < 96;
  }, []);

  const persistMessages = useCallback(
    async (roundMessages: DebateMessage[]) => {
      try {
        await updateSession(id, { messages: roundMessages });
      } catch {
        setPersistWarned(true);
      }
    },
    [id]
  );

  const runSynthesis = useCallback(
    async (transcript: DebateMessage[], idea: string, responses: QA[]) => {
      setActiveAgent(null);
      setThinkingRound(null);
      setError(null);
      setErrorKind(null);
      setPhase("synthesizing");
      try {
        const data = await generateAssumptions({ ideaSummary: idea, questionnaireResponses: responses, transcript });
        const assumptionNodes: AssumptionNode[] = data.assumptions;
        setAssumptionCount(assumptionNodes.length);
        setAssumptions(assumptionNodes);

        const canvas: Canvas = {
          ideaSummary: idea,
          questionnaireResponses: responses,
          assumptions: assumptionNodes,
          lastUpdated: new Date().toISOString(),
        };
        try {
          await updateSession(id, { canvas, assumptions: assumptionNodes, status: "COMPLETE" });
        } catch {
          setPersistWarned(true);
        }

        setPhase("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Synthesis failed");
        setErrorKind("synth");
        setPhase("error");
      }
    },
    [id]
  );

  const runFrom = useCallback(
    async (start: number, initial: DebateMessage[], idea: string, responses: QA[]) => {
      setError(null);
      setErrorKind(null);
      setFailedStep(null);
      setPhase("debating");

      let working = [...initial];
      for (let i = start; i < DEBATE_STEPS.length; i++) {
        const { agent, round } = DEBATE_STEPS[i];
        setActiveAgent(agent);
        setThinkingRound(round);
        try {
          const data = await generateDebateRound({ agent, round, ideaSummary: idea, questionnaireResponses: responses, transcript: working });
          working = [...working, { agent, round, content: data.content }];
          setMessages(working);
          setThinkingRound(null);

          if ((i + 1) % 3 === 0) {
            setActiveAgent(null);
            await persistMessages(working.filter((m) => m.round === round));
            if (round < 3) {
              await waitForNextRound(round as 1 | 2);
              if (stoppedRef.current) return;
            }
          }
        } catch (err) {
          setActiveAgent(null);
          setThinkingRound(null);
          setFailedStep(i);
          setError(
            err instanceof Error
              ? err.message
              : `${AGENT_META[agent].name} could not respond in round ${round}.`
          );
          setErrorKind("turn");
          setPhase("error");
          return;
        }
      }

      await runSynthesis(working, idea, responses);
    },
    [persistMessages, runSynthesis, waitForNextRound]
  );

  const init = useCallback(async () => {
    setPhase("loading");
    setError(null);
    setErrorKind(null);
    try {
      const data = await getSession(id);
      if (!data) throw new Error("Could not load this session");

      const idea: string = typeof data?.ideaSummary === "string" ? data.ideaSummary : "";
      const responses: QA[] = Array.isArray(data?.questionnaireResponses) ? data.questionnaireResponses : [];
      setIdeaSummary(idea);
      setQuestionnaire(responses);

      const transcript: { agent?: AgentRole; round?: number; content?: string }[] =
        Array.isArray(data?.transcript) ? data.transcript : [];
      const existing: DebateMessage[] = [];
      let resume = 0;
      for (let i = 0; i < DEBATE_STEPS.length; i++) {
        const { agent, round } = DEBATE_STEPS[i];
        const m = transcript.find((t) => t.agent === agent && t.round === round);
        if (m && typeof m.content === "string") {
          existing.push({ agent, round, content: m.content });
          resume = i + 1;
        } else {
          break;
        }
      }
      setMessages(existing);

      const canvasAssumptions: unknown = data?.canvas?.assumptions;
      const rowAssumptions: unknown = data?.assumptions;
      const completedAssumptions = Array.isArray(canvasAssumptions)
        ? canvasAssumptions
        : Array.isArray(rowAssumptions)
          ? rowAssumptions
          : [];

      if (data?.status === "COMPLETE" || completedAssumptions.length > 0) {
        setAssumptionCount(completedAssumptions.length);
        setAssumptions(completedAssumptions as AssumptionNode[]);
        setPhase("ready");
        return;
      }

      if (existing.length === 0) {
        const verdict = await classifyIdea(idea, responses);
        if (verdict.decision === "BLOCK") {
          setSafetyBlock({
            status: "BLOCK",
            category: verdict.category ?? "ILLEGAL_GOODS_SERVICES",
            reason: verdict.reason,
          });
          setPhase("blocked");
          return;
        }
      }

      if (resume >= DEBATE_STEPS.length) {
        await runSynthesis(existing, idea, responses);
        return;
      }

      await runFrom(resume, existing, idea, responses);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this session");
      setErrorKind("load");
      setPhase("error");
    }
  }, [id, runFrom, runSynthesis]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void init();
  }, [init]);

  const currentRound: 1 | 2 | 3 =
    thinkingRound ??
    (messages.length > 0 ? messages[messages.length - 1].round : 1);
  const stepperRound: 1 | 2 | 3 = phase === "synthesizing" || phase === "ready" ? 3 : currentRound;
  const errorRound =
    phase === "error" && errorKind === "turn" && failedStep !== null
      ? DEBATE_STEPS[failedStep].round
      : null;

  if (phase === "loading") {
    return (
      <Stage>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24">
          <Loader2 className="h-5 w-5 animate-spin text-agent-skeptic" />
          <p className="eyebrow font-mono">Convening the room…</p>
        </div>
      </Stage>
    );
  }

  if (phase === "error" && errorKind === "load") {
    return (
      <Stage>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 py-24 text-center">
          <AlertTriangle className="h-6 w-6 text-agent-skeptic" />
          <p className="font-serif italic text-[22px] text-foreground">
            We couldn&apos;t load this session.
          </p>
          <p className="text-[14px] text-text-muted max-w-[26rem]">{error}</p>
          <RetryButton label="Try again" onClick={() => void init()} />
        </div>
      </Stage>
    );
  }

  if (phase === "blocked" && safetyBlock) {
    return (
      <Stage>
        <SafetyBlockCard block={safetyBlock} />
      </Stage>
    );
  }

  return (
    <Stage>
      <AnimatePresence mode="wait">
        {phase === "ready" ? (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.7 }} className="flex flex-1 flex-col">
            {assumptions.length > 0 ? (
              <AssumptionMap
                sessionId={id}
                assumptions={assumptions}
                ideaSummary={ideaSummary}
                questionnaire={questionnaire}
              />
            ) : (
              <ReadyInterstitial assumptionCount={assumptionCount} />
            )}
          </motion.div>
        ) : (
          <motion.div
            key="debate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
            className="flex min-h-screen flex-1 flex-col xl:h-[100dvh] xl:min-h-0 xl:flex-none xl:overflow-hidden"
          >
            <div className="grid flex-1 grid-cols-1 xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_390px] xl:grid-rows-[minmax(0,1fr)]">
              <section className="flex min-h-[600px] min-w-0 flex-col xl:min-h-0">
                <div className="flex items-end justify-between gap-5 px-8 pb-1 pt-8">
                  <div className="min-w-0">
                    <p className="eyebrow font-mono">The Roundtable · Live debate</p>
                    {ideaSummary && (
                      <p
                        className="mt-2 truncate font-serif italic"
                        style={{ fontSize: "15px", color: "#9a958c" }}
                        title={ideaSummary}
                      >
                        {truncate(ideaSummary, 96)}
                      </p>
                    )}
                  </div>
                  <span
                    className="shrink-0 font-mono"
                    style={{
                      fontSize: "9px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "#5a574f",
                    }}
                  >
                    {messages.length} / 9 statements
                  </span>
                </div>

                <div className="flex min-h-0 flex-1 items-center justify-center">
                  <Arena activeAgent={phase === "debating" ? activeAgent : null} />
                </div>

                <div className="mx-auto w-full max-w-[820px] px-8 pb-8 pt-1">
                  <Progress
                    value={Math.round((messages.length / 9) * 100)}
                    className="h-[2px] bg-surface-3 [&>[data-slot=progress-indicator]]:bg-agent-skeptic"
                  />
                </div>
              </section>

              <DialogueRail
                currentRound={stepperRound}
                messages={messages}
                phase={phase}
                activeAgent={activeAgent}
                thinkingRound={thinkingRound}
                intermission={intermission}
                error={error}
                errorKind={errorKind}
                errorRound={errorRound}
                persistWarned={persistWarned}
                scrollRef={dialogueScrollRef}
                bottomRef={dialogueBottomRef}
                onScroll={handleDialogueScroll}
                onContinue={finishIntermission}
                onRetryTurn={() => {
                  if (failedStep !== null) {
                    void runFrom(failedStep, messages, ideaSummary, questionnaire);
                  }
                }}
                onRetrySynthesis={() =>
                  void runSynthesis(messages, ideaSummary, questionnaire)
                }
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Stage>
  );
};

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-screen flex-col bg-war-room-bg">
    {children}
  </div>
);

type DialogueRailProps = {
  currentRound: 1 | 2 | 3;
  messages: DebateMessage[];
  phase: Phase;
  activeAgent: AgentRole | null;
  thinkingRound: 1 | 2 | 3 | null;
  intermission: Intermission | null;
  error: string | null;
  errorKind: ErrorKind | null;
  errorRound: 1 | 2 | 3 | null;
  persistWarned: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  onContinue: () => void;
  onRetryTurn: () => void;
  onRetrySynthesis: () => void;
};

const DialogueRail = ({
  currentRound,
  messages,
  phase,
  activeAgent,
  thinkingRound,
  intermission,
  error,
  errorKind,
  errorRound,
  persistWarned,
  scrollRef,
  bottomRef,
  onScroll,
  onContinue,
  onRetryTurn,
  onRetrySynthesis,
}: DialogueRailProps) => {
  const groupedMessages: Record<1 | 2 | 3, DebateMessage[]> = {
    1: messages.filter((message) => message.round === 1),
    2: messages.filter((message) => message.round === 2),
    3: messages.filter((message) => message.round === 3),
  };
  const visibleRounds = ([1, 2, 3] as const).filter(
    (round) =>
      groupedMessages[round].length > 0 ||
      thinkingRound === round ||
      errorRound === round
  );

  return (
    <aside
      aria-label="Round dialogue"
      className="flex h-[70vh] min-h-[560px] flex-col border-t border-hairline bg-surface-2 xl:h-auto xl:min-h-0 xl:border-l xl:border-t-0"
    >
      <div
        className="shrink-0 border-b border-hairline px-5 py-5"
        style={{ background: "rgba(21,20,15,0.96)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <RoundStepper current={currentRound} />
          <span className="eyebrow font-mono">Round {currentRound} of 3</span>
        </div>
        <h2
          className="mt-3 font-serif italic"
          style={{ fontSize: "22px", lineHeight: 1.15, color: "#ede9e0" }}
        >
          {phase === "synthesizing"
            ? "Reading the room"
            : ROUND_NAMES[currentRound]}
        </h2>
        <p
          className="mt-1.5 font-sans"
          style={{ fontSize: "12.5px", lineHeight: 1.5, color: "#7a7670" }}
        >
          The room speaks one voice at a time. Earlier rounds remain here for review.
        </p>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
      >
        <div className="flex flex-col gap-5">
          {visibleRounds.map((round) => (
            <div key={round} className="flex flex-col gap-3.5">
              <RoundSection
                round={round}
                messages={groupedMessages[round]}
                activeAgent={
                  phase === "debating" && thinkingRound === round
                    ? activeAgent
                    : null
                }
              />

              {intermission?.afterRound === round && (
                <IntermissionCard
                  intermission={intermission}
                  onContinue={onContinue}
                />
              )}

              {phase === "error" && errorKind === "turn" && errorRound === round && (
                <TurnError message={error} onRetry={onRetryTurn} />
              )}
            </div>
          ))}

          {phase === "synthesizing" && <SynthesizingCard />}

          {phase === "error" && errorKind === "synth" && (
            <TurnError
              message={error ?? "Could not build the assumption map."}
              onRetry={onRetrySynthesis}
              retryLabel="Retry synthesis"
              detail="The complete debate is preserved — retry only the map synthesis."
            />
          )}

          {persistWarned && phase !== "error" && (
            <p
              className="font-mono"
              style={{
                fontSize: "10px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#5a574f",
              }}
            >
              Note · the debate is running but progress isn&apos;t being saved.
            </p>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    </aside>
  );
};

const RoundSection = ({
  round,
  messages,
  activeAgent,
}: {
  round: 1 | 2 | 3;
  messages: DebateMessage[];
  activeAgent: AgentRole | null;
}) => (
  <section aria-labelledby={`round-${round}-heading`} className="flex flex-col gap-3.5">
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1" style={{ background: "#322b24" }} />
      <span
        id={`round-${round}-heading`}
        className="shrink-0 font-mono"
        style={{
          fontSize: "8.5px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#7a7670",
        }}
      >
        Round {round} · {ROUND_NAMES[round]}
      </span>
      <span className="h-px flex-1" style={{ background: "#322b24" }} />
    </div>

    {messages.map((message) => (
      <MessageBubble
        key={`${message.agent}-${message.round}`}
        message={message}
      />
    ))}

    {activeAgent && <TypingBubble agent={activeAgent} round={round} />}
  </section>
);

const IntermissionCard = ({
  intermission,
  onContinue,
}: {
  intermission: Intermission;
  onContinue: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    style={{
      background: "#16140f",
      border: "1px solid #4a443a",
      borderRadius: "13px",
      padding: "15px 17px",
      boxShadow: "0 18px 44px -24px rgba(0,0,0,0.85)",
    }}
  >
    <div className="flex items-start justify-between gap-4">
      <div>
        <div
          className="font-mono"
          style={{
            fontSize: "8.5px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#8a7a6a",
          }}
        >
          Round {intermission.afterRound} complete
        </div>
        <p
          className="mt-2 font-serif italic"
          style={{ fontSize: "15px", lineHeight: 1.5, color: "#b8b2a7" }}
        >
          A moment to read. Round {intermission.nextRound} begins in{" "}
          {intermission.secondsRemaining}s.
        </p>
      </div>
      <span
        aria-hidden="true"
        className="flex h-8 min-w-8 items-center justify-center rounded-full border font-mono"
        style={{
          borderColor: "#4a443a",
          color: "#ede9e0",
          fontSize: "10px",
        }}
      >
        {intermission.secondsRemaining}
      </span>
    </div>
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={onContinue}
      className="mt-3 gap-2"
    >
      Continue now
      <ArrowRight className="h-3.5 w-3.5" />
    </Button>
  </motion.div>
);

const Arena = ({ activeAgent }: { activeAgent: AgentRole | null }) => {
  const nodes = (Object.keys(AGENT_META) as AgentRole[]).map((role) => ({ role, ...AGENT_META[role] }));

  return (
    <div className="mx-auto w-full max-w-[820px] px-1 sm:px-8">
      <svg viewBox="0 0 1200 800" width="1200" height="800" className="block w-full" role="img" aria-label="War Room debate arena — three AI advisors positioned around a central debate floor">
        <defs>
          <radialGradient id="overhead" cx="50%" cy="34%" r="46%">
            <stop offset="0%" stopColor="rgba(237,233,224,0.06)" />
            <stop offset="100%" stopColor="rgba(237,233,224,0)" />
          </radialGradient>
        </defs>

        <ellipse cx="600" cy="430" rx="300" ry="190" fill="#241f19" stroke="#322b24" strokeWidth="3" />
        <ellipse cx="600" cy="430" rx="250" ry="150" fill="none" stroke="#3a332b" strokeWidth="1.5" />
        <ellipse cx="600" cy="430" rx="298" ry="188" fill="url(#overhead)" />

        <text x="600" y="438" textAnchor="middle" fill="#ede9e0" fontFamily="var(--font-serif), Georgia, serif" fontStyle="italic" fontSize="40" fontWeight="600">
          War Room
        </text>

        {nodes.map((n) => {
          const active = activeAgent === n.role;
          return (
            <g key={n.role}>
              {active && (
                <circle
                  cx={n.cx} cy={n.cy} r={n.r + 4}
                  fill="none" stroke={n.ring} strokeWidth={6}
                  className="blur-[7px] [animation:arenaGlow_1.8s_ease-in-out_infinite]"
                />
              )}
              <circle
                cx={n.cx} cy={n.cy} r={n.r}
                fill={n.fill} stroke={n.ring} strokeWidth={5}
                className={cn("transition-[filter,opacity] duration-[400ms]", activeAgent && !active ? "opacity-[0.55]" : "opacity-100")}
                style={{ filter: active ? `drop-shadow(0 0 12px ${n.ring})` : "none" }}
              />
              <text
                x={n.cx} y={n.cy + n.r + 30}
                textAnchor="middle" fill={n.text}
                fontFamily="var(--font-serif), Georgia, serif" fontStyle="italic" fontSize="20"
                className={activeAgent && !active ? "opacity-60" : "opacity-100"}
              >
                {n.name}
              </text>
              <text x={n.cx} y={n.cy + n.r + 50} textAnchor="middle" fill="#5a574f"
                fontFamily="var(--font-mono), monospace" fontSize="11" letterSpacing="2.4">
                {n.verb}
              </text>
            </g>
          );
        })}

        <circle cx="600" cy="660" r="38" fill="rgba(138,122,106,0.2)" stroke="#a8987f" strokeWidth="5" />
        <text x="600" y="726" textAnchor="middle" fill="#a8987f" fontFamily="var(--font-serif), Georgia, serif" fontStyle="italic" fontSize="19">
          You
        </text>
        <text x="600" y="746" textAnchor="middle" fill="#5a574f" fontFamily="var(--font-mono), monospace" fontSize="11" letterSpacing="2.4">
          FOUNDER
        </text>
      </svg>
    </div>
  );
};

const RoundStepper = ({ current }: { current: 1 | 2 | 3 }) => (
  <div className="flex items-center gap-1.5">
    {([1, 2, 3] as const).map((r) => (
      <span
        key={r}
        className={cn(
          "inline-block w-[26px] h-[5px] rounded-[3px] transition-colors duration-300",
          r < current ? "bg-[#8a7a6a]" : r === current ? "bg-foreground" : "bg-border"
        )}
      />
    ))}
  </div>
);

const MessageBubble = ({ message }: { message: DebateMessage }) => {
  const meta = AGENT_META[message.agent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={cn(
        "bg-surface-4 border border-border-strong rounded-[13px] px-[18px] py-[15px] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] border-t-2",
        meta.topBorderClass
      )}
    >
      <div className={cn("font-mono text-[10px] tracking-[0.12em] uppercase mb-2", meta.textClass)}>
        {meta.name} · Round {message.round}
      </div>
      <p className="font-serif text-[15px] leading-[1.55] text-foreground whitespace-pre-wrap m-0">
        {message.content}
      </p>
    </motion.div>
  );
};

const TypingBubble = ({ agent, round }: { agent: AgentRole; round: 1 | 2 | 3 }) => {
  const meta = AGENT_META[agent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "bg-surface-4 border border-border-strong rounded-[13px] px-[18px] py-[15px] border-t-2",
        meta.topBorderClass
      )}
    >
      <div className={cn("font-mono text-[10px] tracking-[0.12em] uppercase mb-[10px]", meta.textClass)}>
        {meta.name} · Round {round}
      </div>
      <ThinkDots colorClass={meta.dotClass} />
    </motion.div>
  );
};

const ThinkDots = ({ colorClass }: { colorClass: string }) => (
  <div className="flex items-center gap-1.5" aria-label="thinking">
    {([0, 1, 2] as const).map((i) => (
      <span
        key={i}
        className={cn("w-[6px] h-[6px] rounded-full", colorClass, THINK_DOT_DELAYS[i])}
      />
    ))}
  </div>
);

const SynthesizingCard = () => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="bg-well border border-border-strong rounded-[13px] px-[22px] py-[18px]"
  >
    <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-text-dim mb-[10px]">
      Synthesis
    </div>
    <div className="flex items-center gap-3">
      <ThinkDots colorClass="bg-text-soft" />
      <span className="font-serif italic text-[15px] text-text-soft">
        Reading all three rounds to surface your key assumptions…
      </span>
    </div>
  </motion.div>
);

const ReadyInterstitial = ({ assumptionCount }: { assumptionCount: number }) => (
  <div className="flex flex-1 flex-col items-center justify-center px-8 py-24 text-center">
    <div className="eyebrow font-mono mb-[18px]">
      The debate has concluded
    </div>
    <h1 className="font-serif italic text-[34px] text-foreground leading-[1.12] mb-[14px]">
      Your assumption map is ready.
    </h1>
    <p className="text-[15px] text-text-muted max-w-[30rem] leading-[1.6]">
      {assumptionCount > 0
        ? `Three advisors surfaced ${assumptionCount} assumption${assumptionCount === 1 ? "" : "s"} across three rounds of debate. The Launchpad will help you act on them.`
        : "The room has finished debating your idea. The Launchpad will help you act on what surfaced."}
    </p>
    <p className="font-serif text-[12.5px] text-text-dim max-w-[28rem] leading-[1.55] mt-5 italic">
      This reflects only what you told the room — it doesn&apos;t replace talking to real customers.
    </p>
    <Button
      disabled
      variant="secondary"
      className="mt-9 gap-2.5 rounded-[9px] px-[22px] py-3 text-[14.5px]"
    >
      <Lock className="h-3.5 w-3.5" />
      Open the Launchpad
      <ArrowRight className="h-4 w-4" />
    </Button>
    <span className="eyebrow mt-3 font-mono">Interactive map coming next</span>
  </div>
);

const TurnError = ({
  message,
  onRetry,
  retryLabel = "Retry this turn",
  detail = "The rest of the debate is preserved — retry just this step.",
}: {
  message: string | null;
  onRetry: () => void;
  retryLabel?: string;
  detail?: string;
}) => (
  <Alert className="border-[rgba(194,105,42,0.40)] bg-[rgba(194,105,42,0.08)]">
    <AlertTriangle className="h-4 w-4 text-agent-skeptic" />
    <div className="flex flex-col gap-1">
      <AlertDescription className="text-foreground text-[14px] leading-[1.5]">
        {message ?? "Something interrupted the debate."}
      </AlertDescription>
      <AlertDescription className="text-text-muted text-[13px]">
        {detail}
      </AlertDescription>
      <div className="mt-3">
        <RetryButton label={retryLabel} onClick={onRetry} />
      </div>
    </div>
  </Alert>
);

const RetryButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <Button
    onClick={onClick}
    variant="secondary"
    size="sm"
    className="gap-2"
  >
    <RotateCw className="h-3.5 w-3.5" />
    {label}
  </Button>
);

const truncate = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
