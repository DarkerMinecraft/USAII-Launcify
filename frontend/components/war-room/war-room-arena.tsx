"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, RotateCw, AlertTriangle, Lock } from "lucide-react";
import type {
  AgentRole,
  AssumptionNode,
  Canvas,
  DebateMessage,
  QA,
} from "@/lib/types";
import { AssumptionMap } from "@/components/war-room/assumption-map";

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

const AGENT_META: Record<
  AgentRole,
  { name: string; verb: string; base: string; ring: string; text: string; fill: string; cx: number; cy: number; r: number; }
> = {
  SKEPTIC: { name: "The Skeptic", verb: "CHALLENGES", base: "#c2692a", ring: "#c2692a", text: "#c2692a", fill: "rgba(194,105,42,0.15)", cx: 600, cy: 190, r: 34 },
  STRATEGIST: { name: "The Strategist", verb: "REFRAMES", base: "#3a5a8a", ring: "#5a7db0", text: "#6f93c4", fill: "rgba(58,90,138,0.18)", cx: 250, cy: 430, r: 34 },
  OPERATOR: { name: "The Operator", verb: "GROUNDS", base: "#4a7c59", ring: "#4a7c59", text: "#6fa37e", fill: "rgba(74,124,89,0.18)", cx: 950, cy: 430, r: 34 },
};

type Phase = "loading" | "debating" | "synthesizing" | "ready" | "error";
type ErrorKind = "load" | "turn" | "synth";

const eyebrow: React.CSSProperties = {
  fontSize: "9.5px",
  letterSpacing: "0.16em",
  color: "#5a574f",
  textTransform: "uppercase",
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

  const startedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, activeAgent, phase]);

  const persistMessages = useCallback(
    async (roundMessages: DebateMessage[]) => {
      try {
        const res = await fetch(`/api/sessions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: roundMessages }),
        });
        if (!res.ok) setPersistWarned(true);
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
        const res = await fetch("/api/war-room/assumptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ideaSummary: idea, questionnaireResponses: responses, transcript }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Could not build the assumption map");
        const assumptionNodes: AssumptionNode[] = Array.isArray(data?.assumptions) ? data.assumptions : [];
        setAssumptionCount(assumptionNodes.length);
        setAssumptions(assumptionNodes);

        const canvas: Canvas = {
          ideaSummary: idea,
          questionnaireResponses: responses,
          assumptions: assumptionNodes,
          lastUpdated: new Date().toISOString(),
        };
        try {
          const save = await fetch(`/api/sessions/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ canvas, assumptions: assumptionNodes, status: "COMPLETE" }),
          });
          if (!save.ok) setPersistWarned(true);
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
          const res = await fetch("/api/war-room/debate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agent, round, ideaSummary: idea, questionnaireResponses: responses, transcript: working }),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok || typeof data?.content !== "string") {
            throw new Error(data?.error ?? "The advisor did not respond");
          }
          working = [...working, { agent, round, content: data.content }];
          setMessages(working);
          setThinkingRound(null);

          if ((i + 1) % 3 === 0) {
            await persistMessages(working.filter((m) => m.round === round));
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
    [persistMessages, runSynthesis]
  );

  const init = useCallback(async () => {
    setPhase("loading");
    setError(null);
    setErrorKind(null);
    try {
      const res = await fetch(`/api/sessions/${id}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Could not load this session");

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

  if (phase === "loading") {
    return (
      <Stage>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#c2692a" }} />
          <p style={{ ...eyebrow }} className="font-mono">Convening the room…</p>
        </div>
      </Stage>
    );
  }

  if (phase === "error" && errorKind === "load") {
    return (
      <Stage>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 py-24 text-center">
          <AlertTriangle className="h-6 w-6" style={{ color: "#c2692a" }} />
          <p className="font-serif italic" style={{ fontSize: "22px", color: "#ede9e0" }}>
            We couldn&apos;t load this session.
          </p>
          <p style={{ fontSize: "14px", color: "#9a958c", maxWidth: "26rem" }}>{error}</p>
          <RetryButton label="Try again" onClick={() => void init()} />
        </div>
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
          <motion.div key="debate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.7 }} className="flex flex-1 flex-col">
            <div className="mx-auto w-full max-w-3xl px-8 pt-10 pb-2">
              <div className="flex items-center gap-3">
                <RoundStepper current={stepperRound} />
                <span className="font-mono" style={eyebrow}>
                  Round {stepperRound} · {ROUND_NAMES[stepperRound]}
                </span>
              </div>
              {ideaSummary && (
                <p className="mt-3 font-mono" style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#5a574f" }}>
                  War Room · {truncate(ideaSummary, 88)}
                </p>
              )}
            </div>

            <Arena activeAgent={phase === "debating" ? activeAgent : null} />

            <div className="mx-auto flex w-full max-w-3xl flex-col gap-3.5 px-8 pb-16 pt-2">
              {messages.map((m, i) => (
                <MessageBubble key={`${m.agent}-${m.round}-${i}`} message={m} />
              ))}

              {phase === "debating" && activeAgent && thinkingRound && (
                <TypingBubble agent={activeAgent} round={thinkingRound} />
              )}

              {phase === "synthesizing" && <SynthesizingCard />}

              {phase === "error" && errorKind === "turn" && (
                <TurnError
                  message={error}
                  onRetry={() =>
                    failedStep !== null &&
                    void runFrom(failedStep, messages, ideaSummary, questionnaire)
                  }
                />
              )}

              {phase === "error" && errorKind === "synth" && (
                <TurnError
                  message={error ?? "Could not build the assumption map."}
                  onRetry={() => void runSynthesis(messages, ideaSummary, questionnaire)}
                />
              )}

              {persistWarned && phase !== "error" && (
                <p className="font-mono" style={{ fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#5a574f" }}>
                  Note · the debate is running but progress isn&apos;t being saved.
                </p>
              )}

              <div ref={bottomRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Stage>
  );
};

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-screen flex-col" style={{ background: "var(--war-room-bg)" }}>
    {children}
  </div>
);

const Arena = ({ activeAgent }: { activeAgent: AgentRole | null }) => {
  const nodes = (Object.keys(AGENT_META) as AgentRole[]).map((role) => ({ role, ...AGENT_META[role] }));

  return (
    <div className="mx-auto w-full max-w-[820px] px-8">
      <svg viewBox="0 0 1200 800" className="block w-full" role="img" aria-label="War Room debate arena">
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
                <circle cx={n.cx} cy={n.cy} r={n.r + 4} fill="none" stroke={n.ring} strokeWidth={6}
                  style={{ filter: "blur(7px)", animation: "arenaGlow 1.8s ease-in-out infinite" }} />
              )}
              <circle cx={n.cx} cy={n.cy} r={n.r} fill={n.fill} stroke={n.ring} strokeWidth={5}
                style={{
                  filter: active ? `drop-shadow(0 0 12px ${n.ring})` : "none",
                  transition: "filter .4s ease",
                  opacity: activeAgent && !active ? 0.55 : 1,
                }} />
              <text x={n.cx} y={n.cy + n.r + 30} textAnchor="middle" fill={n.text}
                fontFamily="var(--font-serif), Georgia, serif" fontStyle="italic" fontSize="20"
                style={{ opacity: activeAgent && !active ? 0.6 : 1 }}>
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
        style={{
          width: "26px", height: "5px", borderRadius: "3px",
          background: r < current ? "#8a7a6a" : r === current ? "#ede9e0" : "#2e2c28",
          transition: "background .3s ease",
        }}
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
      style={{
        background: "#1c1a16", border: "1px solid #38332b",
        borderTop: `2px solid ${meta.base}`, borderRadius: "13px",
        padding: "15px 18px", boxShadow: "0 20px 50px -20px rgba(0,0,0,0.8)",
      }}
    >
      <div className="font-mono" style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: meta.text, marginBottom: "8px" }}>
        {meta.name} · Round {message.round}
      </div>
      <p className="font-serif" style={{ fontSize: "15px", lineHeight: 1.55, color: "#ede9e0", whiteSpace: "pre-wrap", margin: 0 }}>
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
      style={{ background: "#1c1a16", border: "1px solid #38332b", borderTop: `2px solid ${meta.base}`, borderRadius: "13px", padding: "15px 18px" }}
    >
      <div className="font-mono" style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: meta.text, marginBottom: "10px" }}>
        {meta.name} · Round {round}
      </div>
      <ThinkDots color={meta.text} />
    </motion.div>
  );
};

const ThinkDots = ({ color }: { color: string }) => (
  <div className="flex items-center gap-1.5" aria-label="thinking">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        style={{
          width: "6px", height: "6px", borderRadius: "50%", background: color,
          animation: `thinkDot 1.2s ${i * 0.15}s infinite ease-in-out`,
        }}
      />
    ))}
  </div>
);

const SynthesizingCard = () => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    style={{ background: "#16140f", border: "1px solid #38332b", borderRadius: "13px", padding: "18px 22px" }}
  >
    <div className="font-mono" style={{ fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#7a7670", marginBottom: "10px" }}>
      Synthesis
    </div>
    <div className="flex items-center gap-3">
      <ThinkDots color="#b8b2a7" />
      <span className="font-serif italic" style={{ fontSize: "15px", color: "#b8b2a7" }}>
        Reading all three rounds to surface your key assumptions…
      </span>
    </div>
  </motion.div>
);

const ReadyInterstitial = ({ assumptionCount }: { assumptionCount: number }) => (
  <div className="flex flex-1 flex-col items-center justify-center px-8 py-24 text-center">
    <div className="font-mono" style={{ ...eyebrow, marginBottom: "18px" }}>
      The debate has concluded
    </div>
    <h1 className="font-serif italic" style={{ fontSize: "34px", color: "#ede9e0", lineHeight: 1.12, marginBottom: "14px" }}>
      Your assumption map is ready.
    </h1>
    <p style={{ fontSize: "15px", color: "#9a958c", maxWidth: "30rem", lineHeight: 1.6 }}>
      {assumptionCount > 0
        ? `Three advisors surfaced ${assumptionCount} assumption${assumptionCount === 1 ? "" : "s"} across three rounds of debate. The Launchpad will help you act on them.`
        : "The room has finished debating your idea. The Launchpad will help you act on what surfaced."}
    </p>
    <p style={{ fontSize: "12.5px", color: "#7a7670", maxWidth: "28rem", lineHeight: 1.55, marginTop: "20px", fontStyle: "italic" }} className="font-serif">
      This reflects only what you told the room — it doesn&apos;t replace talking to real customers.
    </p>
    <button
      disabled
      className="mt-9 inline-flex items-center gap-2.5 font-semibold disabled:cursor-not-allowed"
      style={{ background: "#1a1916", color: "#7a7670", border: "1px solid #2e2c28", borderRadius: "9px", padding: "12px 22px", fontSize: "14.5px", opacity: 0.7 }}
    >
      <Lock className="h-3.5 w-3.5" />
      Open the Launchpad
      <ArrowRight className="h-4 w-4" />
    </button>
    <span className="mt-3 font-mono" style={eyebrow}>Interactive map coming next</span>
  </div>
);

const TurnError = ({ message, onRetry }: { message: string | null; onRetry: () => void }) => (
  <div style={{ background: "rgba(194,105,42,0.08)", border: "1px solid rgba(194,105,42,0.40)", borderRadius: "13px", padding: "15px 18px" }}>
    <div className="flex items-start gap-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#c2692a" }} />
      <div className="flex-1">
        <p style={{ fontSize: "14px", color: "#ede9e0", lineHeight: 1.5 }}>
          {message ?? "Something interrupted the debate."}
        </p>
        <p style={{ fontSize: "13px", color: "#9a958c", marginTop: "4px", lineHeight: 1.5 }}>
          The rest of the debate is preserved — retry just this step.
        </p>
        <div className="mt-3">
          <RetryButton label="Retry this turn" onClick={onRetry} />
        </div>
      </div>
    </div>
  </div>
);

const RetryButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-2 font-semibold transition-colors"
    style={{ background: "#1a1916", border: "1px solid #2e2c28", color: "#ede9e0", borderRadius: "8px", padding: "8px 14px", fontSize: "13px" }}
  >
    <RotateCw className="h-3.5 w-3.5" />
    {label}
  </button>
);

const truncate = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
