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
import { Card } from "@/components/ui/card";
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

type TabId = "customer" | "summary" | "roadmap" | "market";

const TAB_CONFIG = [
  { id: "customer" as TabId, Icon: Users,      label: "Customer Connect",   accentClass: "text-agent-strategist", barClass: "bg-agent-strategist" },
  { id: "summary"  as TabId, Icon: FileText,   label: "Executive Summary",  accentClass: "text-agent-operator",   barClass: "bg-agent-operator"   },
  { id: "roadmap"  as TabId, Icon: Map,        label: "Validation Roadmap", accentClass: "text-agent-skeptic",    barClass: "bg-agent-skeptic"    },
  { id: "market"   as TabId, Icon: TrendingUp, label: "Market Research",    accentClass: "text-text-muted",       barClass: "bg-border"           },
];

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

  const [activeTab, setActiveTab] = useState<TabId>("customer");
  const [generatedTabs, setGeneratedTabs] = useState<Record<TabId, boolean>>({
    customer: false, summary: false, roadmap: false, market: false,
  });
  const markGenerated = useCallback((tab: TabId) => {
    setGeneratedTabs(prev => ({ ...prev, [tab]: true }));
  }, []);

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
          const results = {
            outreachDraft: (data.outreachDraft as Record<string, unknown>) ?? null,
            executiveSummary: (data.executiveSummary as Record<string, unknown>) ?? null,
            validationRoadmap: (data.validationRoadmap as Record<string, unknown>) ?? null,
            marketResearch: (data.marketResearch as Record<string, unknown>) ?? null,
          };
          setSavedResults(results);
          setGeneratedTabs({
            customer: !!results.outreachDraft,
            summary:  !!results.executiveSummary,
            roadmap:  !!results.validationRoadmap,
            market:   !!results.marketResearch,
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
          <Button className="mt-2 rounded-[9px] text-[14px]" asChild>
            <Link href="/war-room">
              <Swords className="w-4 h-4" />
              Go to War Room
            </Link>
          </Button>
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
        <div className="px-5 sm:px-10 pt-6 sm:pt-8 pb-0">
          <Button variant="ghost" className="eyebrow text-muted-foreground px-0 h-auto gap-1.5" asChild>
            <Link href={`/war-room/session/${sessionId}`}>
              <ArrowLeft className="w-3 h-3" />
              Back to War Room
            </Link>
          </Button>
        </div>
      )}

      <div className="px-5 sm:px-10 pt-6 sm:pt-7 pb-5 sm:pb-6 border-b border-border">
        <h1 className="font-serif italic text-foreground text-[30px] leading-[1.1]">
          Launchpad
        </h1>
        <p className="eyebrow mt-1.5">
          Stop thinking. Start doing.
        </p>

        <Card className="flex flex-col sm:flex-row sm:items-start gap-3 mt-5 p-4 rounded-[11px] bg-surface-2 border-border shadow-none ring-0">
          <div className="flex-1 min-w-0">
            <p className="eyebrow mb-[5px]">Active Idea</p>
            <p className="font-serif italic text-foreground text-[15px] leading-[1.45]">
              {canvas.ideaSummary}
            </p>
          </div>
          <div className="flex items-center flex-wrap gap-2 sm:gap-3 sm:shrink-0">
            {unvalidatedCount > 0 && (
              <AssumptionPill
                label={`${unvalidatedCount} unvalidated`}
                className="text-[#c2692a] bg-[rgba(194,105,42,0.12)] border-[rgba(194,105,42,0.4)]"
              />
            )}
            {validatedCount > 0 && (
              <AssumptionPill
                label={`${validatedCount} validated`}
                className="text-agent-operator bg-[rgba(74,124,89,0.09)] border-[rgba(111,163,126,0.3)]"
              />
            )}
          </div>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row flex-1">
        <nav className="flex flex-row sm:flex-col border-b sm:border-b-0 sm:border-r border-border shrink-0 sm:w-44 overflow-x-auto">
          {TAB_CONFIG.map(({ id, Icon, label, accentClass, barClass }) => {
            const isActive = activeTab === id;
            return (
              <Button
                key={id}
                variant="ghost"
                onClick={() => setActiveTab(id)}
                className={cn(
                  "relative flex items-center gap-2.5 px-4 py-3.5 justify-start h-auto rounded-none whitespace-nowrap sm:whitespace-normal sm:w-full",
                  isActive ? "bg-surface-2 text-foreground" : "text-text-muted",
                )}
              >
                {isActive && (
                  <>
                    <span className={cn("hidden sm:block absolute left-0 inset-y-0 w-[2px]", barClass)} />
                    <span className={cn("block sm:hidden absolute bottom-0 inset-x-0 h-[2px]", barClass)} />
                  </>
                )}
                <Icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? accentClass : "text-text-faint")} />
                <span className="font-mono uppercase text-[9px] tracking-[0.14em] leading-[1.3]">{label}</span>
                {generatedTabs[id] && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-agent-operator shrink-0" />
                )}
              </Button>
            );
          })}
        </nav>

        <div className="flex-1 min-w-0">
          <div className={activeTab !== "customer" ? "hidden" : ""}>
            <CustomerConnectCard canvas={canvas} sessionId={sessionId} initialResult={savedResults.outreachDraft} onGenerated={() => markGenerated("customer")} />
          </div>
          <div className={activeTab !== "summary" ? "hidden" : ""}>
            <ExecutiveSummaryCard canvas={canvas} sessionId={sessionId} initialResult={savedResults.executiveSummary} onGenerated={() => markGenerated("summary")} />
          </div>
          <div className={activeTab !== "roadmap" ? "hidden" : ""}>
            <ValidationRoadmapCard canvas={canvas} sessionId={sessionId} initialResult={savedResults.validationRoadmap} onGenerated={() => markGenerated("roadmap")} />
          </div>
          <div className={activeTab !== "market" ? "hidden" : ""}>
            <MarketResearchCard canvas={canvas} sessionId={sessionId} initialResult={savedResults.marketResearch} onGenerated={() => markGenerated("market")} />
          </div>
        </div>
      </div>
    </PageShell>
  );
};

const CustomerConnectCard = ({ canvas, sessionId, initialResult, onGenerated }: { canvas: Canvas; sessionId: string | null; initialResult: Record<string, unknown> | null; onGenerated: () => void }) => {
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
      onGenerated();
      if (sessionId) void saveLaunchpadResult(sessionId, "outreachDraft", data).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate outreach");
      setState("error");
    }
  };

  return (
    <ToolCard
      icon={<Users className="w-4 h-4 text-agent-strategist" />}
      title="Customer Connect"
      subtitle="Who should you talk to first?"
      description="The agent reads your assumption map and drafts personalized outreach targeting your most critical unvalidated assumption. You review and send — the AI never contacts anyone on your behalf."
      accentClass="text-agent-strategist"
      onGenerate={generate}
      state={state}
      error={error}
    >
      {result && <OutreachResults result={result} />}
    </ToolCard>
  );
};

const ExecutiveSummaryCard = ({ canvas, sessionId, initialResult, onGenerated }: { canvas: Canvas; sessionId: string | null; initialResult: Record<string, unknown> | null; onGenerated: () => void }) => {
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
      onGenerated();
      if (sessionId) void saveLaunchpadResult(sessionId, "executiveSummary", data).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate summary");
      setState("error");
    }
  };

  return (
    <ToolCard
      icon={<FileText className="w-4 h-4 text-agent-operator" />}
      title="Executive Summary"
      subtitle="One-page brief of your idea"
      description="The agent synthesizes your War Room canvas into a clear, honest brief — surfacing your key risks directly from the assumption map, not softening them."
      accentClass="text-agent-operator"
      onGenerate={generate}
      state={state}
      error={error}
    >
      {result && <SummaryResults result={result} />}
    </ToolCard>
  );
};

const ValidationRoadmapCard = ({ canvas, sessionId, initialResult, onGenerated }: { canvas: Canvas; sessionId: string | null; initialResult: Record<string, unknown> | null; onGenerated: () => void }) => {
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
      onGenerated();
      if (sessionId) void saveLaunchpadResult(sessionId, "validationRoadmap", data).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the roadmap");
      setState("error");
    }
  };

  return (
    <ToolCard
      icon={<Map className="w-4 h-4 text-agent-skeptic" />}
      title="Validation Roadmap"
      subtitle="What should you test first?"
      description="The agent reads your assumption map and builds a prioritized testing plan — ordered by risk and testability. Tells you the cheapest first move and what a result actually means."
      accentClass="text-agent-skeptic"
      onGenerate={generate}
      state={state}
      error={error}
    >
      {result && <ValidationRoadmapResults result={result} />}
    </ToolCard>
  );
};

const MarketResearchCard = ({ canvas, sessionId, initialResult, onGenerated }: { canvas: Canvas; sessionId: string | null; initialResult: Record<string, unknown> | null; onGenerated: () => void }) => {
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
      onGenerated();
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
      accentClass="text-text-muted"
      onGenerate={generate}
      state={state}
      error={error}
    >
      {result && <MarketResearchResults result={result} />}
    </ToolCard>
  );
};

const ToolCard = ({
  icon, title, subtitle, description, accentClass,
  onGenerate, state, error, children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  accentClass: string;
  onGenerate: () => void;
  state: "idle" | "loading" | "done" | "error";
  error: string | null;
  children?: React.ReactNode;
}) => (
  <Card className="flex flex-col bg-background min-h-[480px] sm:min-h-[520px] rounded-none shadow-none ring-0 border-0 gap-0 py-0">
    <div className="px-5 sm:px-8 pt-6 sm:pt-8 pb-5 sm:pb-6 border-b border-border">
      <div className="flex items-center gap-2.5 mb-4">
        {icon}
        <span className={cn("font-mono uppercase text-[9px] tracking-[0.16em]", accentClass)}>
          {title}
        </span>
      </div>
      <h2 className="font-serif italic text-foreground text-[20px] leading-[1.2] mb-[10px]">
        {subtitle}
      </h2>
      <p className="text-text-dim text-[13px] leading-[1.6]">{description}</p>
    </div>

    <div className="px-5 sm:px-8 py-4 sm:py-5 border-b border-hairline">
      {state === "idle" || state === "error" ? (
        <Button
          onClick={onGenerate}
          className="gap-2 rounded-[8px] px-[18px] py-2 text-[13.5px]"
        >
          Generate
        </Button>
      ) : state === "loading" ? (
        <div className="flex items-center gap-3">
          <Loader2 className={cn("w-4 h-4 animate-spin", accentClass)} />
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
  </Card>
);

const OutreachResults = ({ result }: { result: OutreachResult }) => {
  const emailCopy = useCopy();
  const linkedinCopy = useCopy();
  const emailText = `Subject: ${result.email.subject}\n\n${result.email.body}`;

  return (
    <div className="flex flex-col gap-6 px-5 sm:px-8 py-5 sm:py-6">
      <div>
        <Label>Targeting this assumption</Label>
        <p className="font-serif italic mt-2 text-foreground text-[13.5px] leading-[1.5]">
          &ldquo;{result.targetAssumption}&rdquo;
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Label>Who to reach</Label>
          <p className="text-text-muted text-[13px] leading-[1.55] mt-[5px]">{result.targetProfile}</p>
        </div>
        <div className="flex-1">
          <Label>Why them</Label>
          <p className="text-text-muted text-[13px] leading-[1.55] mt-[5px]">{result.why}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Cold email</Label>
          <CopyButton text={emailText} onClick={() => emailCopy.copy(emailText)} copied={emailCopy.copied} label="Copy" />
        </div>
        <div className="bg-surface-2 border border-border rounded-[9px] p-4">
          <p className="text-agent-operator font-mono text-[11px] tracking-[0.06em] mb-2">
            Subject: {result.email.subject}
          </p>
          <p className="text-foreground text-[12.5px] leading-[1.6] whitespace-pre-wrap">
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
          <p className="text-foreground text-[12.5px] leading-[1.6] whitespace-pre-wrap">
            {result.linkedin}
          </p>
        </div>
      </div>

      <div className="bg-[rgba(111,147,196,0.06)] border border-[rgba(111,147,196,0.2)] rounded-[9px] py-[12px] px-[14px]">
        <Label>Before you send</Label>
        <p className="text-text-muted text-[12.5px] leading-[1.55] mt-[6px]">{result.personalizationTips}</p>
      </div>

      <p className="font-serif italic text-text-faint text-[11.5px] leading-[1.5]">
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
    <div className="flex flex-col gap-5 px-5 sm:px-8 py-5 sm:py-6">
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
          <p className="text-text-faint italic text-[12.5px] mt-[6px]">
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
              <span className="font-mono shrink-0 text-agent-skeptic text-[10px] mt-[2px] tracking-[0.06em]">
                {i + 1}.
              </span>
              <span className="text-foreground text-[13px] leading-[1.55]">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="font-serif italic text-text-faint border-t border-border text-[11.5px] leading-[1.5] pt-[14px]">
        This brief reflects only what you told the system. It is information for your decision-making — not an endorsement of the idea.
      </p>
    </div>
  );
};

const ValidationRoadmapResults = ({ result }: { result: ValidationRoadmapResult }) => (
  <div className="flex flex-col gap-6 px-5 sm:px-8 py-5 sm:py-6">
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
              <span className="font-mono uppercase text-agent-skeptic text-[8px] tracking-[0.14em]">{m.week}</span>
            </div>
            <p className="text-text-dim text-[11px] mb-[6px] leading-[1.4]">
              Testing: <span className="text-text-muted">{m.assumption}</span>
            </p>
            <p className="text-foreground text-[13px] leading-[1.55] mb-2">{m.action}</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1">
                <p className="font-mono uppercase text-agent-operator text-[7.5px] tracking-[0.12em] mb-[3px]">If yes</p>
                <p className="text-text-muted text-[11.5px] leading-[1.4]">{m.successSignal}</p>
              </div>
              <div className="flex-1">
                <p className="font-mono uppercase text-agent-skeptic text-[7.5px] tracking-[0.12em] mb-[3px]">If no</p>
                <p className="text-text-muted text-[11.5px] leading-[1.4]">{m.failSignal}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div>
      <Label>Cheapest test this week</Label>
      <p className="text-foreground text-[13px] leading-[1.55] mt-[5px]">{result.cheapestTest}</p>
    </div>

    <div className="bg-[rgba(90,87,79,0.08)] border border-[rgba(90,87,79,0.3)] rounded-[9px] p-3">
      <Label>Honest caveat</Label>
      <p className="text-text-muted text-[12.5px] leading-[1.55] mt-[6px]">{result.warning}</p>
    </div>

    <p className="font-serif italic text-text-faint text-[11.5px] leading-[1.5]">
      This roadmap is built from your assumption map. Completing the milestones is your job — the AI cannot run these tests for you.
    </p>
  </div>
);

const MarketResearchResults = ({ result }: { result: MarketResearchResult }) => (
  <div className="flex flex-col gap-6 px-5 sm:px-8 py-5 sm:py-6">
    <div>
      <Label>The space</Label>
      <p className="text-text-muted text-[13px] leading-[1.6] mt-[5px]">{result.marketSummary}</p>
    </div>

    <Divider />

    <div>
      <Label>Competitive landscape</Label>
      <div className="flex flex-col gap-3 mt-2">
        {result.competitors.map((c, i) => (
          <div key={i} className="bg-surface-2 border border-border rounded-[9px] p-4">
            <p className="font-mono uppercase text-text-muted text-[8px] tracking-[0.14em] mb-[5px]">{c.category}</p>
            <p className="text-text-faint text-[11.5px] mb-2">{c.examples}</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1">
                <p className="font-mono uppercase text-agent-skeptic text-[7.5px] tracking-[0.12em] mb-[3px]">How they win</p>
                <p className="text-text-muted text-[11.5px] leading-[1.4]">{c.howTheyWin}</p>
              </div>
              <div className="flex-1">
                <p className="font-mono uppercase text-agent-operator text-[7.5px] tracking-[0.12em] mb-[3px]">Your opening</p>
                <p className="text-text-muted text-[11.5px] leading-[1.4]">{c.openingForYou}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    <Divider />

    <div>
      <Label>Timing</Label>
      <p className="text-text-muted text-[13px] leading-[1.6] mt-[5px]">{result.timingSignal}</p>
    </div>

    <div>
      <Label>Your differentiation hypothesis</Label>
      <p className="text-foreground text-[13px] leading-[1.55] mt-[5px]">{result.differentiationHypothesis}</p>
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

    <p className="font-serif italic text-text-faint border-t border-border text-[11.5px] leading-[1.5] pt-[14px]">
      This analysis is inferred from your idea description. Competitor details and market figures must be independently verified before you act on them.
    </p>
  </div>
);

const PageShell = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-screen flex-col bg-war-room-bg">
    {children}
  </div>
);

const AssumptionPill = ({ label, className }: { label: string; className: string }) => (
  <span className={cn("font-mono uppercase text-[8px] tracking-[0.12em] border rounded-[5px] px-2 py-[3px]", className)}>
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
    <p className="text-text-muted text-[13px] leading-[1.6] mt-[5px]">{body}</p>
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
