"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Copy, Check, Loader2, AlertCircle,
  Users, FileText, AlertTriangle, Swords, Map, TrendingUp, RotateCw,
} from "lucide-react";
import type { Canvas } from "@/lib/types";
import { generateOutreach, generateSummary, generateValidationRoadmap, generateMarketResearch } from "@/actions/launchpad";
import { getSession, saveLaunchpadResult } from "@/actions/sessions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface OutreachResult {
  targetAssumption: string;
  targetProfile: string;
  why: string;
  email: { subject: string; body: string };
  linkedin: string;
  personalizationTips: string;
}

interface SummaryResult {
  headline: string;
  problem: string;
  solution: string;
  targetCustomer: string;
  keyRisks: string[];
  validatedSignals: string[];
  nextSteps: string[];
}

interface ValidationMilestone {
  week: string;
  assumption: string;
  action: string;
  successSignal: string;
  failSignal: string;
}

interface ValidationRoadmapResult {
  biggestRisk: string;
  milestones: ValidationMilestone[];
  cheapestTest: string;
  warning: string;
}

interface Competitor {
  category: string;
  examples: string;
  howTheyWin: string;
  openingForYou: string;
}

interface MarketResearchResult {
  marketSummary: string;
  competitors: Competitor[];
  timingSignal: string;
  differentiationHypothesis: string;
  thingsToVerify: string[];
}

const useCopy = () => {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }, []);
  return { copied, copy };
};

export const LaunchpadClient = () => {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedResults, setSavedResults] = useState<{
    outreachDraft: Record<string, unknown> | null;
    executiveSummary: Record<string, unknown> | null;
    validationRoadmap: Record<string, unknown> | null;
    marketResearch: Record<string, unknown> | null;
  }>({
    outreachDraft: null,
    executiveSummary: null,
    validationRoadmap: null,
    marketResearch: null,
  });

  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId)
      .then((data) => {
        if (data?.canvas && typeof data.canvas.ideaSummary === "string") {
          setCanvas(data.canvas as Canvas);
          setSavedResults({
            outreachDraft: (data.outreachDraft as Record<string, unknown>) ?? null,
            executiveSummary: (data.executiveSummary as Record<string, unknown>) ?? null,
            validationRoadmap: (data.validationRoadmap as Record<string, unknown>) ?? null,
            marketResearch: (data.marketResearch as Record<string, unknown>) ?? null,
          });
          setLoadState("ready");
        } else {
          throw new Error("Session has no canvas yet — complete the War Room first.");
        }
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "Could not load session");
        setLoadState("error");
      });
  }, [sessionId]);

  if (!sessionId) {
    return (
      <PageShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 py-32 text-center">
          <Swords className="h-6 w-6 text-text-faint" />
          <p className="font-serif italic text-foreground text-[22px]">
            Complete the War Room first.
          </p>
          <p className="text-text-muted text-[14px] max-w-[26rem] leading-[1.6]">
            The Launchpad reads your Assumption Map. Start a War Room session to build one.
          </p>
          <Link
            href="/war-room"
            className="inline-flex items-center gap-2 font-semibold bg-primary text-primary-foreground rounded-[9px] px-5 py-2.5 text-[14px] no-underline mt-2"
          >
            <Swords className="w-4 h-4" />
            Go to War Room
          </Link>
        </div>
      </PageShell>
    );
  }

  if (loadState === "loading") {
    return (
      <PageShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-32">
          <Loader2 className="h-5 w-5 animate-spin text-agent-skeptic" />
          <p className="eyebrow">Loading your canvas…</p>
        </div>
      </PageShell>
    );
  }

  if (loadState === "error" || !canvas) {
    return (
      <PageShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-32 text-center">
          <AlertTriangle className="h-6 w-6 text-agent-skeptic" />
          <p className="font-serif italic text-foreground text-[20px]">
            Could not load session.
          </p>
          <p className="text-text-muted text-[14px]">{loadError}</p>
        </div>
      </PageShell>
    );
  }

  const unvalidatedCount = canvas.assumptions.filter(
    (a) => (a.status === "UNVALIDATED" || a.status === "NEEDS_INFO") && !a.remediation
  ).length;
  const validatedCount = canvas.assumptions.filter(
    (a) => a.status === "VALIDATED" || a.remediation?.action === "VALIDATE"
  ).length;

  return (
    <PageShell>
      {sessionId && (
        <div className="px-10 pt-8 pb-0">
          <Link
            href={`/war-room/session/${sessionId}`}
            className="inline-flex items-center gap-2 eyebrow text-muted-foreground no-underline"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to War Room
          </Link>
        </div>
      )}

      <div className="px-10 pt-7 pb-6 border-b border-border">
        <h1 className="font-serif italic text-foreground text-[30px] leading-[1.1]">
          Launchpad
        </h1>
        <p className="eyebrow mt-1.5">
          Stop thinking. Start doing.
        </p>

        <div
          className="flex items-start gap-4 mt-5 p-4 rounded-[11px] bg-surface-2 border border-border"
        >
          <div className="flex-1 min-w-0">
            <p className="eyebrow mb-[5px]">Active Idea</p>
            <p className="font-serif italic text-foreground text-[15px] leading-[1.45]">
              {canvas.ideaSummary}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {unvalidatedCount > 0 && (
              <AssumptionPill label={`${unvalidatedCount} unvalidated`} color="#c2692a" bg="rgba(194,105,42,0.12)" border="rgba(194,105,42,0.4)" />
            )}
            {validatedCount > 0 && (
              <AssumptionPill label={`${validatedCount} validated`} color="#6fa37e" bg="rgba(74,124,89,0.09)" border="rgba(111,163,126,0.3)" />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-px bg-border">
        <CustomerConnectCard canvas={canvas} sessionId={sessionId} initialResult={savedResults.outreachDraft} />
        <ExecutiveSummaryCard canvas={canvas} sessionId={sessionId} initialResult={savedResults.executiveSummary} />
        <ValidationRoadmapCard canvas={canvas} sessionId={sessionId} initialResult={savedResults.validationRoadmap} />
        <MarketResearchCard canvas={canvas} sessionId={sessionId} initialResult={savedResults.marketResearch} />
      </div>
    </PageShell>
  );
};

const CustomerConnectCard = ({ canvas, sessionId, initialResult }: { canvas: Canvas; sessionId: string | null; initialResult: Record<string, unknown> | null }) => {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(initialResult ? "done" : "idle");
  const [result, setResult] = useState<OutreachResult | null>(initialResult ? initialResult as unknown as OutreachResult : null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setState("loading");
    setError(null);
    try {
      const data = await generateOutreach(canvas);
      setResult(data as unknown as OutreachResult);
      setState("done");
      if (sessionId) void saveLaunchpadResult(sessionId, "outreachDraft", data).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate outreach");
      setState("error");
    }
  };

  return (
    <ToolCard
      icon={<Users className="w-4 h-4" style={{ color: "#6f93c4" }} />}
      title="Customer Connect"
      subtitle="Who should you talk to first?"
      description="The agent reads your assumption map and drafts personalized outreach targeting your most critical unvalidated assumption. You review and send — the AI never contacts anyone on your behalf."
      accentColor="#6f93c4"
      onGenerate={generate}
      state={state}
      error={error}
    >
      {result && <OutreachResults result={result} />}
    </ToolCard>
  );
};

const ExecutiveSummaryCard = ({ canvas, sessionId, initialResult }: { canvas: Canvas; sessionId: string | null; initialResult: Record<string, unknown> | null }) => {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(initialResult ? "done" : "idle");
  const [result, setResult] = useState<SummaryResult | null>(initialResult ? initialResult as unknown as SummaryResult : null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setState("loading");
    setError(null);
    try {
      const data = await generateSummary(canvas);
      setResult(data as unknown as SummaryResult);
      setState("done");
      if (sessionId) void saveLaunchpadResult(sessionId, "executiveSummary", data).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate summary");
      setState("error");
    }
  };

  return (
    <ToolCard
      icon={<FileText className="w-4 h-4" style={{ color: "#6fa37e" }} />}
      title="Executive Summary"
      subtitle="One-page brief of your idea"
      description="The agent synthesizes your War Room canvas into a clear, honest brief — surfacing your key risks directly from the assumption map, not softening them."
      accentColor="#6fa37e"
      onGenerate={generate}
      state={state}
      error={error}
    >
      {result && <SummaryResults result={result} />}
    </ToolCard>
  );
};

const ValidationRoadmapCard = ({ canvas, sessionId, initialResult }: { canvas: Canvas; sessionId: string | null; initialResult: Record<string, unknown> | null }) => {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(initialResult ? "done" : "idle");
  const [result, setResult] = useState<ValidationRoadmapResult | null>(initialResult ? initialResult as unknown as ValidationRoadmapResult : null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setState("loading");
    setError(null);
    try {
      const data = await generateValidationRoadmap(canvas);
      setResult(data as unknown as ValidationRoadmapResult);
      setState("done");
      if (sessionId) void saveLaunchpadResult(sessionId, "validationRoadmap", data).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the roadmap");
      setState("error");
    }
  };

  return (
    <ToolCard
      icon={<Map className="w-4 h-4" style={{ color: "#c2692a" }} />}
      title="Validation Roadmap"
      subtitle="What should you test first?"
      description="The agent reads your assumption map and builds a prioritized testing plan — ordered by risk and testability. Tells you the cheapest first move and what a result actually means."
      accentColor="#c2692a"
      onGenerate={generate}
      state={state}
      error={error}
    >
      {result && <ValidationRoadmapResults result={result} />}
    </ToolCard>
  );
};

const MarketResearchCard = ({ canvas, sessionId, initialResult }: { canvas: Canvas; sessionId: string | null; initialResult: Record<string, unknown> | null }) => {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(initialResult ? "done" : "idle");
  const [result, setResult] = useState<MarketResearchResult | null>(initialResult ? initialResult as unknown as MarketResearchResult : null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setState("loading");
    setError(null);
    try {
      const data = await generateMarketResearch(canvas);
      setResult(data as unknown as MarketResearchResult);
      setState("done");
      if (sessionId) void saveLaunchpadResult(sessionId, "marketResearch", data).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate market research");
      setState("error");
    }
  };

  return (
    <ToolCard
      icon={<TrendingUp className="w-4 h-4 text-text-muted" />}
      title="Market Research"
      subtitle="Who else is doing this?"
      description="The agent maps the competitive landscape from your idea canvas — who's already solving this, how they win, and where your opening is. Flags what you must verify before trusting the analysis."
      accentColor="#9a958c"
      onGenerate={generate}
      state={state}
      error={error}
    >
      {result && <MarketResearchResults result={result} />}
    </ToolCard>
  );
};

const ToolCard = ({
  icon, title, subtitle, description, accentColor,
  onGenerate, state, error, children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  accentColor: string;
  onGenerate: () => void;
  state: "idle" | "loading" | "done" | "error";
  error: string | null;
  children?: React.ReactNode;
}) => (
  <div className="flex flex-col bg-background min-h-[520px]">
    <div className="px-8 pt-8 pb-6 border-b border-border">
      <div className="flex items-center gap-2.5 mb-4">
        {icon}
        <span className="font-mono uppercase" style={{ fontSize: "9px", letterSpacing: "0.16em", color: accentColor }}>
          {title}
        </span>
      </div>
      <h2 className="font-serif italic text-foreground text-[20px] leading-[1.2] mb-[10px]">
        {subtitle}
      </h2>
      <p className="text-text-dim text-[13px] leading-[1.6]">{description}</p>
    </div>

    <div className="px-8 py-5 border-b border-hairline">
      {state === "idle" || state === "error" ? (
        <Button
          onClick={onGenerate}
          className="gap-2 rounded-[8px] px-[18px] py-2 text-[13.5px]"
        >
          Generate
        </Button>
      ) : state === "loading" ? (
        <div className="flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: accentColor }} />
          <span className="eyebrow text-muted-foreground">Reading your canvas…</span>
        </div>
      ) : (
        <Button
          onClick={onGenerate}
          variant="ghost"
          className="eyebrow text-text-faint gap-1.5 px-0 h-auto"
        >
          <RotateCw className="w-3 h-3" />
          Regenerate
        </Button>
      )}

      {state === "error" && error && (
        <Alert variant="destructive" className="mt-3 border-[rgba(194,105,42,0.4)] bg-[rgba(194,105,42,0.06)] text-agent-skeptic [&>svg]:text-agent-skeptic">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-text-muted text-[12.5px]">{error}</AlertDescription>
        </Alert>
      )}
    </div>

    <div className="flex-1 overflow-y-auto">
      <AnimatePresence mode="wait">
        {state === "done" && children && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </div>
);

const OutreachResults = ({ result }: { result: OutreachResult }) => {
  const emailCopy = useCopy();
  const linkedinCopy = useCopy();
  const emailText = `Subject: ${result.email.subject}\n\n${result.email.body}`;

  return (
    <div className="flex flex-col gap-6 px-8 py-6">
      <div>
        <Label>Targeting this assumption</Label>
        <p className="font-serif italic mt-2 text-foreground text-[13.5px] leading-[1.5]">
          &ldquo;{result.targetAssumption}&rdquo;
        </p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <Label>Who to reach</Label>
          <p className="text-text-muted text-[13px] leading-[1.55]" style={{ marginTop: "5px" }}>{result.targetProfile}</p>
        </div>
        <div className="flex-1">
          <Label>Why them</Label>
          <p className="text-text-muted text-[13px] leading-[1.55]" style={{ marginTop: "5px" }}>{result.why}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Cold email</Label>
          <CopyButton text={emailText} onClick={() => emailCopy.copy(emailText)} copied={emailCopy.copied} label="Copy" />
        </div>
        <div className="bg-surface-2 border border-border rounded-[9px] p-4">
          <p className="text-agent-operator font-mono" style={{ fontSize: "11px", letterSpacing: "0.06em", marginBottom: "8px" }}>
            Subject: {result.email.subject}
          </p>
          <p className="text-foreground text-[12.5px] leading-[1.6]" style={{ whiteSpace: "pre-wrap" }}>
            {result.email.body}
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>LinkedIn DM</Label>
          <CopyButton text={result.linkedin} onClick={() => linkedinCopy.copy(result.linkedin)} copied={linkedinCopy.copied} label="Copy" />
        </div>
        <div className="bg-surface-2 border border-border rounded-[9px] p-4">
          <p className="text-foreground text-[12.5px] leading-[1.6]" style={{ whiteSpace: "pre-wrap" }}>
            {result.linkedin}
          </p>
        </div>
      </div>

      <div className="bg-[rgba(111,147,196,0.06)] border border-[rgba(111,147,196,0.2)] rounded-[9px] p-[12px_14px]">
        <Label>Before you send</Label>
        <p className="text-text-muted text-[12.5px] leading-[1.55]" style={{ marginTop: "6px" }}>{result.personalizationTips}</p>
      </div>

      <p className="font-serif italic text-text-faint" style={{ fontSize: "11.5px", lineHeight: 1.5 }}>
        You review and send every message. The AI never contacts anyone on your behalf.
      </p>
    </div>
  );
};

const SummaryResults = ({ result }: { result: SummaryResult }) => {
  const fullCopy = useCopy();

  const fullText = [
    result.headline, "",
    "PROBLEM", result.problem, "",
    "SOLUTION", result.solution, "",
    "TARGET CUSTOMER", result.targetCustomer, "",
    "KEY RISKS", ...result.keyRisks.map((r) => `• ${r}`), "",
    "VALIDATED SIGNALS",
    result.validatedSignals.length > 0 ? result.validatedSignals.map((s) => `• ${s}`).join("\n") : "• None yet", "",
    "NEXT STEPS", ...result.nextSteps.map((s, i) => `${i + 1}. ${s}`),
  ].join("\n");

  return (
    <div className="flex flex-col gap-5 px-8 py-6">
      <div className="flex items-center justify-between">
        <p className="font-serif italic text-foreground text-[13.5px]">{result.headline}</p>
        <CopyButton text={fullText} onClick={() => fullCopy.copy(fullText)} copied={fullCopy.copied} label="Copy brief" />
      </div>

      <Divider />

      <SummarySection label="The Problem" body={result.problem} />
      <SummarySection label="The Solution" body={result.solution} />
      <SummarySection label="Target Customer" body={result.targetCustomer} />

      <Divider />

      <div>
        <Label>Key Risks</Label>
        <ul className="flex flex-col gap-2 mt-2">
          {result.keyRisks.map((risk, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="w-[5px] h-[5px] rounded-full bg-agent-skeptic shrink-0 mt-[7px]" />
              <span className="text-text-muted text-[13px] leading-[1.55]">{risk}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <Label>Validated Signals</Label>
        {result.validatedSignals.length > 0 ? (
          <ul className="flex flex-col gap-2 mt-2">
            {result.validatedSignals.map((signal, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-[5px] h-[5px] rounded-full bg-agent-operator shrink-0 mt-[7px]" />
                <span className="text-text-muted text-[13px] leading-[1.55]">{signal}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-faint italic text-[12.5px]" style={{ marginTop: "6px" }}>
            None evidenced yet — this is the work ahead.
          </p>
        )}
      </div>

      <Divider />

      <div>
        <Label>Your Next 3 Steps</Label>
        <ol className="flex flex-col gap-3 mt-2">
          {result.nextSteps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="font-mono shrink-0 text-agent-skeptic" style={{ fontSize: "10px", marginTop: "2px", letterSpacing: "0.06em" }}>
                {i + 1}.
              </span>
              <span className="text-foreground text-[13px] leading-[1.55]">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="font-serif italic text-text-faint border-t border-border text-[11.5px] leading-[1.5]" style={{ paddingTop: "14px" }}>
        This brief reflects only what you told the system. It is information for your decision-making — not an endorsement of the idea.
      </p>
    </div>
  );
};

const ValidationRoadmapResults = ({ result }: { result: ValidationRoadmapResult }) => (
  <div className="flex flex-col gap-6 px-8 py-6">
    <div className="bg-[rgba(194,105,42,0.07)] border border-[rgba(194,105,42,0.28)] rounded-[9px] p-3">
      <Label>Biggest risk to kill first</Label>
      <p className="font-serif italic mt-2 text-foreground text-[13.5px] leading-[1.5]">
        &ldquo;{result.biggestRisk}&rdquo;
      </p>
    </div>

    <div>
      <Label>Testing milestones</Label>
      <div className="flex flex-col gap-3 mt-2">
        {result.milestones.map((m, i) => (
          <div key={i} className="bg-surface-2 border border-border rounded-[9px] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono uppercase text-agent-skeptic" style={{ fontSize: "8px", letterSpacing: "0.14em" }}>{m.week}</span>
            </div>
            <p className="text-text-dim" style={{ fontSize: "11px", marginBottom: "6px", lineHeight: 1.4 }}>
              Testing: <span className="text-text-muted">{m.assumption}</span>
            </p>
            <p className="text-foreground text-[13px] leading-[1.55]" style={{ marginBottom: "8px" }}>{m.action}</p>
            <div className="flex gap-4">
              <div className="flex-1">
                <p className="font-mono uppercase text-agent-operator" style={{ fontSize: "7.5px", letterSpacing: "0.12em", marginBottom: "3px" }}>If yes</p>
                <p className="text-text-muted" style={{ fontSize: "11.5px", lineHeight: 1.4 }}>{m.successSignal}</p>
              </div>
              <div className="flex-1">
                <p className="font-mono uppercase text-agent-skeptic" style={{ fontSize: "7.5px", letterSpacing: "0.12em", marginBottom: "3px" }}>If no</p>
                <p className="text-text-muted" style={{ fontSize: "11.5px", lineHeight: 1.4 }}>{m.failSignal}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div>
      <Label>Cheapest test this week</Label>
      <p className="text-foreground text-[13px] leading-[1.55]" style={{ marginTop: "5px" }}>{result.cheapestTest}</p>
    </div>

    <div className="bg-[rgba(90,87,79,0.08)] border border-[rgba(90,87,79,0.3)] rounded-[9px] p-3">
      <Label>Honest caveat</Label>
      <p className="text-text-muted text-[12.5px] leading-[1.55]" style={{ marginTop: "6px" }}>{result.warning}</p>
    </div>

    <p className="font-serif italic text-text-faint" style={{ fontSize: "11.5px", lineHeight: 1.5 }}>
      This roadmap is built from your assumption map. Completing the milestones is your job — the AI cannot run these tests for you.
    </p>
  </div>
);

const MarketResearchResults = ({ result }: { result: MarketResearchResult }) => (
  <div className="flex flex-col gap-6 px-8 py-6">
    <div>
      <Label>The space</Label>
      <p className="text-text-muted text-[13px] leading-[1.6]" style={{ marginTop: "5px" }}>{result.marketSummary}</p>
    </div>

    <Divider />

    <div>
      <Label>Competitive landscape</Label>
      <div className="flex flex-col gap-3 mt-2">
        {result.competitors.map((c, i) => (
          <div key={i} className="bg-surface-2 border border-border rounded-[9px] p-4">
            <p className="font-mono uppercase text-text-muted" style={{ fontSize: "8px", letterSpacing: "0.14em", marginBottom: "5px" }}>{c.category}</p>
            <p className="text-text-faint" style={{ fontSize: "11.5px", marginBottom: "8px" }}>{c.examples}</p>
            <div className="flex gap-4">
              <div className="flex-1">
                <p className="font-mono uppercase text-agent-skeptic" style={{ fontSize: "7.5px", letterSpacing: "0.12em", marginBottom: "3px" }}>How they win</p>
                <p className="text-text-muted" style={{ fontSize: "11.5px", lineHeight: 1.4 }}>{c.howTheyWin}</p>
              </div>
              <div className="flex-1">
                <p className="font-mono uppercase text-agent-operator" style={{ fontSize: "7.5px", letterSpacing: "0.12em", marginBottom: "3px" }}>Your opening</p>
                <p className="text-text-muted" style={{ fontSize: "11.5px", lineHeight: 1.4 }}>{c.openingForYou}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    <Divider />

    <div>
      <Label>Timing</Label>
      <p className="text-text-muted text-[13px] leading-[1.6]" style={{ marginTop: "5px" }}>{result.timingSignal}</p>
    </div>

    <div>
      <Label>Your differentiation hypothesis</Label>
      <p className="text-foreground text-[13px] leading-[1.55]" style={{ marginTop: "5px" }}>{result.differentiationHypothesis}</p>
    </div>

    <div>
      <Label>Verify before trusting this</Label>
      <ul className="flex flex-col gap-2 mt-2">
        {result.thingsToVerify.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="w-[5px] h-[5px] rounded-full bg-agent-skeptic shrink-0 mt-[7px]" />
            <span className="text-text-muted text-[13px] leading-[1.55]">{item}</span>
          </li>
        ))}
      </ul>
    </div>

    <p className="font-serif italic text-text-faint border-t border-border text-[11.5px] leading-[1.5]" style={{ paddingTop: "14px" }}>
      This analysis is inferred from your idea description. Competitor details and market figures must be independently verified before you act on them.
    </p>
  </div>
);

const PageShell = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-screen flex-col bg-war-room-bg">
    {children}
  </div>
);

const AssumptionPill = ({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) => (
  <span
    className="font-mono uppercase"
    style={{ fontSize: "8px", letterSpacing: "0.12em", color, background: bg, border: `1px solid ${border}`, borderRadius: "5px", padding: "3px 8px" }}
  >
    {label}
  </span>
);

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="eyebrow-sm">
    {children}
  </p>
);

const SummarySection = ({ label, body }: { label: string; body: string }) => (
  <div>
    <Label>{label}</Label>
    <p className="text-text-muted text-[13px] leading-[1.6]" style={{ marginTop: "5px" }}>{body}</p>
  </div>
);

const Divider = () => <Separator className="my-0.5" />;

const CopyButton = ({ text, copied, onClick, label = "Copy" }: { text: string; copied: boolean; onClick: () => void; label?: string }) => {
  const { copied: internalCopied, copy } = useCopy();
  const isCopied = copied ?? internalCopied;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={onClick ?? (() => copy(text))}
          variant="ghost"
          size="icon-sm"
          className={cn(isCopied ? "text-agent-operator" : "text-text-faint")}
        >
          {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isCopied ? "Copied!" : label === "Copy" ? "Copy to clipboard" : label}</TooltipContent>
    </Tooltip>
  );
};
