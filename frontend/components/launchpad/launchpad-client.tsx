"use client";

import { useState, useEffect, useCallback, useTransition, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Copy, Check, Loader2, AlertCircle, X, ChevronDown,
  Users, FileText, AlertTriangle, Swords, Map, TrendingUp, RotateCw, BookOpen,
} from "lucide-react";
import type { Canvas, FounderLog, ConversationNote } from "@/lib/types";
import { generateOutreach, generateSummary, generateValidationRoadmap, generateMarketResearch } from "@/actions/launchpad";
import { getSession, saveLaunchpadResult, updateSession } from "@/actions/sessions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

type TabId = "customer" | "summary" | "roadmap" | "market" | "notes";

const TAB_CONFIG = [
  { id: "customer" as TabId, Icon: Users,      label: "Customer Connect",   accentClass: "text-agent-strategist", barClass: "bg-agent-strategist" },
  { id: "summary"  as TabId, Icon: FileText,   label: "Executive Summary",  accentClass: "text-agent-operator",   barClass: "bg-agent-operator"   },
  { id: "roadmap"  as TabId, Icon: Map,        label: "Validation Roadmap", accentClass: "text-agent-skeptic",    barClass: "bg-agent-skeptic"    },
  { id: "market"   as TabId, Icon: TrendingUp, label: "Market Research",    accentClass: "text-text-muted",       barClass: "bg-border"           },
  { id: "notes"    as TabId, Icon: BookOpen,   label: "Founder's Log",      accentClass: "text-text-muted",       barClass: "bg-border"           },
];

const EMPTY_LOG: FounderLog = { conversations: [], learnings: [], openQuestions: [] };

const useCopy = () => {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }, []);
  return { copied, copy };
};

const formatFounderLogForContext = (log: FounderLog): string => {
  const parts: string[] = [];
  if (log.conversations.length > 0) {
    parts.push(`CUSTOMER CONVERSATIONS:\n${log.conversations.map(c => `- ${c.who}: ${c.insight}`).join("\n")}`);
  }
  if (log.learnings.length > 0) {
    parts.push(`KEY LEARNINGS:\n${log.learnings.map(l => `- ${l}`).join("\n")}`);
  }
  if (log.openQuestions.length > 0) {
    parts.push(`OPEN QUESTIONS:\n${log.openQuestions.map(q => `- ${q}`).join("\n")}`);
  }
  return parts.join("\n\n");
};

export const LaunchpadClient = () => {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [activeTab, setActiveTab] = useState<TabId>("customer");
  const [generatedTabs, setGeneratedTabs] = useState<Record<TabId, boolean>>({
    customer: false, summary: false, roadmap: false, market: false, notes: false,
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

  const [founderLog, setFounderLog] = useState<FounderLog>(EMPTY_LOG);
  const [contextInputs, setContextInputs] = useState<Record<Exclude<TabId, "notes">, string>>({
    customer: "", summary: "", roadmap: "", market: "",
  });

  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId)
      .then((data) => {
        if (data?.canvas && typeof data.canvas.ideaSummary === "string") {
          const c = data.canvas as Canvas;
          setCanvas(c);
          if (c.founderLog) setFounderLog(c.founderLog);
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
            notes:    false,
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

  const handleLogChange = useCallback((log: FounderLog) => {
    setFounderLog(log);
    if (canvas) setCanvas(prev => prev ? { ...prev, founderLog: log } : prev);
  }, [canvas]);

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

  const hasLogEntries = founderLog.conversations.length + founderLog.learnings.length + founderLog.openQuestions.length > 0;

  const buildCombinedContext = (tabContext: string): string | undefined => {
    const logBlock = formatFounderLogForContext(founderLog);
    const parts = [logBlock, tabContext.trim()].filter(Boolean);
    return parts.length > 0 ? parts.join("\n\n") : undefined;
  };

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
            {hasLogEntries && (
              <AssumptionPill
                label="log active"
                className="text-agent-strategist bg-[rgba(111,147,196,0.09)] border-[rgba(111,147,196,0.3)]"
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
                {id === "notes" && hasLogEntries && !isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-agent-strategist shrink-0" />
                )}
              </Button>
            );
          })}
        </nav>

        <div className="flex-1 min-w-0">
          <div className={activeTab !== "customer" ? "hidden" : ""}>
            <CustomerConnectCard
              canvas={canvas} sessionId={sessionId}
              initialResult={savedResults.outreachDraft}
              onGenerated={() => markGenerated("customer")}
              autoGenerate={!savedResults.outreachDraft}
              userContext={contextInputs.customer}
              onContextChange={(v) => setContextInputs(prev => ({ ...prev, customer: v }))}
              buildContext={() => buildCombinedContext(contextInputs.customer)}
            />
          </div>
          <div className={activeTab !== "summary" ? "hidden" : ""}>
            <ExecutiveSummaryCard
              canvas={canvas} sessionId={sessionId}
              initialResult={savedResults.executiveSummary}
              onGenerated={() => markGenerated("summary")}
              autoGenerate={!savedResults.executiveSummary}
              userContext={contextInputs.summary}
              onContextChange={(v) => setContextInputs(prev => ({ ...prev, summary: v }))}
              buildContext={() => buildCombinedContext(contextInputs.summary)}
            />
          </div>
          <div className={activeTab !== "roadmap" ? "hidden" : ""}>
            <ValidationRoadmapCard
              canvas={canvas} sessionId={sessionId}
              initialResult={savedResults.validationRoadmap}
              onGenerated={() => markGenerated("roadmap")}
              autoGenerate={!savedResults.validationRoadmap}
              userContext={contextInputs.roadmap}
              onContextChange={(v) => setContextInputs(prev => ({ ...prev, roadmap: v }))}
              buildContext={() => buildCombinedContext(contextInputs.roadmap)}
            />
          </div>
          <div className={activeTab !== "market" ? "hidden" : ""}>
            <MarketResearchCard
              canvas={canvas} sessionId={sessionId}
              initialResult={savedResults.marketResearch}
              onGenerated={() => markGenerated("market")}
              autoGenerate={!savedResults.marketResearch}
              userContext={contextInputs.market}
              onContextChange={(v) => setContextInputs(prev => ({ ...prev, market: v }))}
              buildContext={() => buildCombinedContext(contextInputs.market)}
            />
          </div>
          <div className={activeTab !== "notes" ? "hidden" : ""}>
            <FounderLogTab
              founderLog={founderLog}
              sessionId={sessionId}
              canvas={canvas}
              onChange={handleLogChange}
            />
          </div>
        </div>
      </div>
    </PageShell>
  );
};

interface CardProps {
  canvas: Canvas;
  sessionId: string | null;
  initialResult: Record<string, unknown> | null;
  onGenerated: () => void;
  autoGenerate?: boolean;
  userContext: string;
  onContextChange: (v: string) => void;
  buildContext: () => string | undefined;
}

const CustomerConnectCard = ({ canvas, sessionId, initialResult, onGenerated, autoGenerate, userContext, onContextChange, buildContext }: CardProps) => {
  const [state, setState] = useState<"idle" | "done" | "error">(initialResult ? "done" : "idle");
  const [result, setResult] = useState<OutreachResult | null>(initialResult ? initialResult as unknown as OutreachResult : null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const autoStartedRef = useRef(false);

  const generate = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const data = await generateOutreach(canvas, buildContext());
        setResult(data as unknown as OutreachResult);
        setState("done");
        onGenerated();
        if (sessionId) try { await saveLaunchpadResult(sessionId, "outreachDraft", data); } catch {}
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not generate outreach");
        setState("error");
      }
    });
  }, [canvas, sessionId, onGenerated, buildContext]);

  useEffect(() => {
    if (autoGenerate && !autoStartedRef.current && state === "idle") {
      autoStartedRef.current = true;
      generate();
    }
  }, [autoGenerate, generate, state]);

  return (
    <ToolCard
      icon={<Users className="w-4 h-4 text-agent-strategist" />}
      title="Customer Connect"
      subtitle="Who should you talk to first?"
      description="The agent reads your assumption map and drafts personalized outreach targeting your most critical unvalidated assumption. You review and send — the AI never contacts anyone on your behalf."
      accentClass="text-agent-strategist"
      onGenerate={generate}
      isPending={isPending}
      state={state}
      error={error}
      userContext={userContext}
      onContextChange={onContextChange}
    >
      {result && <OutreachResults result={result} />}
    </ToolCard>
  );
};

const ExecutiveSummaryCard = ({ canvas, sessionId, initialResult, onGenerated, autoGenerate, userContext, onContextChange, buildContext }: CardProps) => {
  const [state, setState] = useState<"idle" | "done" | "error">(initialResult ? "done" : "idle");
  const [result, setResult] = useState<SummaryResult | null>(initialResult ? initialResult as unknown as SummaryResult : null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const autoStartedRef = useRef(false);

  const generate = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const data = await generateSummary(canvas, buildContext());
        setResult(data as unknown as SummaryResult);
        setState("done");
        onGenerated();
        if (sessionId) try { await saveLaunchpadResult(sessionId, "executiveSummary", data); } catch {}
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not generate summary");
        setState("error");
      }
    });
  }, [canvas, sessionId, onGenerated, buildContext]);

  useEffect(() => {
    if (autoGenerate && !autoStartedRef.current && state === "idle") {
      autoStartedRef.current = true;
      generate();
    }
  }, [autoGenerate, generate, state]);

  return (
    <ToolCard
      icon={<FileText className="w-4 h-4 text-agent-operator" />}
      title="Executive Summary"
      subtitle="One-page brief of your idea"
      description="The agent synthesizes your War Room canvas into a clear, honest brief — surfacing your key risks directly from the assumption map, not softening them."
      accentClass="text-agent-operator"
      onGenerate={generate}
      isPending={isPending}
      state={state}
      error={error}
      userContext={userContext}
      onContextChange={onContextChange}
    >
      {result && <SummaryResults result={result} />}
    </ToolCard>
  );
};

const ValidationRoadmapCard = ({ canvas, sessionId, initialResult, onGenerated, autoGenerate, userContext, onContextChange, buildContext }: CardProps) => {
  const [state, setState] = useState<"idle" | "done" | "error">(initialResult ? "done" : "idle");
  const [result, setResult] = useState<ValidationRoadmapResult | null>(initialResult ? initialResult as unknown as ValidationRoadmapResult : null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const autoStartedRef = useRef(false);

  const generate = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const data = await generateValidationRoadmap(canvas, buildContext());
        setResult(data as unknown as ValidationRoadmapResult);
        setState("done");
        onGenerated();
        if (sessionId) try { await saveLaunchpadResult(sessionId, "validationRoadmap", data); } catch {}
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not generate the roadmap");
        setState("error");
      }
    });
  }, [canvas, sessionId, onGenerated, buildContext]);

  useEffect(() => {
    if (autoGenerate && !autoStartedRef.current && state === "idle") {
      autoStartedRef.current = true;
      generate();
    }
  }, [autoGenerate, generate, state]);

  return (
    <ToolCard
      icon={<Map className="w-4 h-4 text-agent-skeptic" />}
      title="Validation Roadmap"
      subtitle="What should you test first?"
      description="The agent reads your assumption map and builds a prioritized testing plan — ordered by risk and testability. Tells you the cheapest first move and what a result actually means."
      accentClass="text-agent-skeptic"
      onGenerate={generate}
      isPending={isPending}
      state={state}
      error={error}
      userContext={userContext}
      onContextChange={onContextChange}
    >
      {result && <ValidationRoadmapResults result={result} />}
    </ToolCard>
  );
};

const MarketResearchCard = ({ canvas, sessionId, initialResult, onGenerated, autoGenerate, userContext, onContextChange, buildContext }: CardProps) => {
  const [state, setState] = useState<"idle" | "done" | "error">(initialResult ? "done" : "idle");
  const [result, setResult] = useState<MarketResearchResult | null>(initialResult ? initialResult as unknown as MarketResearchResult : null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const autoStartedRef = useRef(false);

  const generate = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const data = await generateMarketResearch(canvas, buildContext());
        setResult(data as unknown as MarketResearchResult);
        setState("done");
        onGenerated();
        if (sessionId) try { await saveLaunchpadResult(sessionId, "marketResearch", data); } catch {}
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not generate market research");
        setState("error");
      }
    });
  }, [canvas, sessionId, onGenerated, buildContext]);

  useEffect(() => {
    if (autoGenerate && !autoStartedRef.current && state === "idle") {
      autoStartedRef.current = true;
      generate();
    }
  }, [autoGenerate, generate, state]);

  return (
    <ToolCard
      icon={<TrendingUp className="w-4 h-4 text-text-muted" />}
      title="Market Research"
      subtitle="Who else is doing this?"
      description="The agent maps the competitive landscape from your idea canvas — who's already solving this, how they win, and where your opening is. Flags what you must verify before trusting the analysis."
      accentClass="text-text-muted"
      onGenerate={generate}
      isPending={isPending}
      state={state}
      error={error}
      userContext={userContext}
      onContextChange={onContextChange}
    >
      {result && <MarketResearchResults result={result} />}
    </ToolCard>
  );
};

const FounderLogTab = ({
  founderLog,
  sessionId,
  canvas,
  onChange,
}: {
  founderLog: FounderLog;
  sessionId: string | null;
  canvas: Canvas;
  onChange: (log: FounderLog) => void;
}) => {
  const [convWho, setConvWho] = useState("");
  const [convInsight, setConvInsight] = useState("");
  const [newLearning, setNewLearning] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [saving, startSave] = useTransition();

  const save = useCallback((log: FounderLog) => {
    if (!sessionId) return;
    startSave(async () => {
      try {
        await updateSession(sessionId, { canvas: { ...canvas, founderLog: log } });
      } catch {}
    });
  }, [sessionId, canvas]);

  const addConversation = () => {
    if (!convWho.trim() || !convInsight.trim()) return;
    const note: ConversationNote = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      who: convWho.trim(),
      insight: convInsight.trim(),
      date: new Date().toISOString(),
    };
    const newLog = { ...founderLog, conversations: [...founderLog.conversations, note] };
    onChange(newLog);
    save(newLog);
    setConvWho("");
    setConvInsight("");
  };

  const removeConversation = (id: string) => {
    const newLog = { ...founderLog, conversations: founderLog.conversations.filter(c => c.id !== id) };
    onChange(newLog);
    save(newLog);
  };

  const addLearning = () => {
    if (!newLearning.trim()) return;
    const newLog = { ...founderLog, learnings: [...founderLog.learnings, newLearning.trim()] };
    onChange(newLog);
    save(newLog);
    setNewLearning("");
  };

  const removeLearning = (i: number) => {
    const newLog = { ...founderLog, learnings: founderLog.learnings.filter((_, idx) => idx !== i) };
    onChange(newLog);
    save(newLog);
  };

  const addQuestion = () => {
    if (!newQuestion.trim()) return;
    const newLog = { ...founderLog, openQuestions: [...founderLog.openQuestions, newQuestion.trim()] };
    onChange(newLog);
    save(newLog);
    setNewQuestion("");
  };

  const removeQuestion = (i: number) => {
    const newLog = { ...founderLog, openQuestions: founderLog.openQuestions.filter((_, idx) => idx !== i) };
    onChange(newLog);
    save(newLog);
  };

  return (
    <div className="px-5 sm:px-8 py-6 sm:py-7 flex flex-col gap-7 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-4 h-4 text-text-faint" />
          <span className="font-mono uppercase text-[9px] tracking-[0.16em] text-text-faint">Founder&apos;s Log</span>
        </div>
        <h2 className="font-serif italic text-foreground text-[20px] leading-[1.2] mb-2">
          Your discoveries, in one place.
        </h2>
        <p className="text-text-dim text-[13px] leading-[1.6]">
          Log what you&apos;ve learned since the War Room. The agents read this when you regenerate — turning your real-world signal into sharper AI output.
        </p>
      </div>

      <div className="bg-[rgba(111,147,196,0.05)] border border-[rgba(111,147,196,0.18)] rounded-[9px] px-4 py-3">
        <p className="text-[12px] text-text-dim leading-[1.6]">
          <span className="text-agent-strategist font-medium">Second brain, active.</span>{" "}
          Everything logged here feeds back into Customer Connect, Executive Summary, Validation Roadmap, and Market Research — the next time you generate or regenerate.
        </p>
      </div>

      {/* Customer Conversations */}
      <div>
        <p className="eyebrow mb-3">Customer conversations</p>
        {founderLog.conversations.length > 0 && (
          <div className="flex flex-col gap-2 mb-3">
            {founderLog.conversations.map(conv => (
              <div key={conv.id} className="bg-surface-2 border border-border rounded-[9px] p-3 flex gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-[12.5px] font-medium leading-tight mb-1 truncate">{conv.who}</p>
                  <p className="text-text-muted text-[12.5px] leading-[1.5]">{conv.insight}</p>
                </div>
                <button
                  onClick={() => removeConversation(conv.id)}
                  className="shrink-0 text-text-faint hover:text-foreground transition-colors mt-0.5"
                  aria-label="Remove conversation"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 border border-border rounded-[9px] p-3 bg-surface-2">
          <Input
            placeholder="Who did you talk to? (e.g. Sarah, e-commerce founder)"
            value={convWho}
            onChange={e => setConvWho(e.target.value)}
            className="text-[12.5px] bg-background"
          />
          <Textarea
            placeholder="What did you learn from this conversation?"
            value={convInsight}
            onChange={e => setConvInsight(e.target.value)}
            rows={2}
            className="text-[12.5px] resize-none bg-background"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={addConversation}
            disabled={!convWho.trim() || !convInsight.trim() || saving}
            className="self-end rounded-[7px] text-[12px]"
          >
            Add conversation
          </Button>
        </div>
      </div>

      <Separator />

      {/* Key Learnings */}
      <div>
        <p className="eyebrow mb-3">Key learnings</p>
        <p className="text-text-faint text-[12px] mb-3 leading-[1.5]">
          Facts, surprises, or pivots you've discovered. One line each.
        </p>
        {founderLog.learnings.length > 0 && (
          <ul className="flex flex-col gap-1.5 mb-3">
            {founderLog.learnings.map((l, i) => (
              <li key={i} className="flex items-start gap-2.5 group">
                <span className="w-[5px] h-[5px] rounded-full bg-agent-operator shrink-0 mt-[7px]" />
                <span className="flex-1 text-text-muted text-[13px] leading-[1.5]">{l}</span>
                <button
                  onClick={() => removeLearning(i)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-text-faint hover:text-foreground shrink-0"
                  aria-label="Remove learning"
                >
                  <X className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input
            placeholder={`e.g. "Customers care about speed, not features"`}
            value={newLearning}
            onChange={e => setNewLearning(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addLearning()}
            className="text-[12.5px]"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={addLearning}
            disabled={!newLearning.trim() || saving}
            className="shrink-0 rounded-[7px]"
          >
            Add
          </Button>
        </div>
      </div>

      <Separator />

      {/* Open Questions */}
      <div>
        <p className="eyebrow mb-3">Open questions</p>
        <p className="text-text-faint text-[12px] mb-3 leading-[1.5]">
          Things you still need to figure out. The AI will weigh these when regenerating.
        </p>
        {founderLog.openQuestions.length > 0 && (
          <ul className="flex flex-col gap-1.5 mb-3">
            {founderLog.openQuestions.map((q, i) => (
              <li key={i} className="flex items-start gap-2.5 group">
                <span className="font-mono text-agent-skeptic text-[10px] shrink-0 mt-[2px] leading-[1.8]">?</span>
                <span className="flex-1 text-text-muted text-[13px] leading-[1.5]">{q}</span>
                <button
                  onClick={() => removeQuestion(i)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-text-faint hover:text-foreground shrink-0"
                  aria-label="Remove question"
                >
                  <X className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input
            placeholder={`e.g. "How do we handle enterprise billing?"`}
            value={newQuestion}
            onChange={e => setNewQuestion(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addQuestion()}
            className="text-[12.5px]"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={addQuestion}
            disabled={!newQuestion.trim() || saving}
            className="shrink-0 rounded-[7px]"
          >
            Add
          </Button>
        </div>
      </div>

      {saving && (
        <div className="flex items-center gap-2 text-text-faint pt-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span className="eyebrow-sm">Saving…</span>
        </div>
      )}
    </div>
  );
};

const ToolCard = ({
  icon, title, subtitle, description, accentClass,
  onGenerate, isPending, state, error,
  userContext, onContextChange,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  accentClass: string;
  onGenerate: () => void;
  isPending: boolean;
  state: "idle" | "done" | "error";
  error: string | null;
  userContext: string;
  onContextChange: (v: string) => void;
  children?: React.ReactNode;
}) => {
  const [contextOpen, setContextOpen] = useState(false);

  return (
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

      {/* Context input */}
      <div className="px-5 sm:px-8 py-3 border-b border-hairline">
        <button
          onClick={() => setContextOpen(o => !o)}
          className="flex items-center gap-1.5 text-text-faint hover:text-foreground transition-colors"
        >
          <ChevronDown className={cn("w-3 h-3 transition-transform duration-150", contextOpen && "-rotate-180")} />
          <span className="font-mono uppercase text-[9px] tracking-[0.12em]">
            Add context before generating
          </span>
          {userContext.trim() && (
            <span className="w-1.5 h-1.5 rounded-full bg-agent-strategist shrink-0" />
          )}
        </button>
        {contextOpen && (
          <Textarea
            value={userContext}
            onChange={e => onContextChange(e.target.value)}
            placeholder="What have you learned since the War Room? Any constraints or priorities the agent should know? This gets added to your Founder's Log context."
            rows={3}
            className="mt-2 text-[12.5px] resize-none"
          />
        )}
      </div>

      <div className="px-5 sm:px-8 py-4 sm:py-5 border-b border-hairline">
        {isPending ? (
          <div className="flex items-center gap-3">
            <Loader2 className={cn("w-4 h-4 animate-spin", accentClass)} />
            <span className="eyebrow text-muted-foreground">Reading your canvas…</span>
          </div>
        ) : state === "idle" || state === "error" ? (
          <Button
            onClick={onGenerate}
            className="gap-2 rounded-[8px] px-[18px] py-2 text-[13.5px]"
          >
            Generate
          </Button>
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

        {state === "error" && !isPending && error && (
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
};

const OutreachResults = ({ result }: { result: OutreachResult }) => {
  const emailCopy = useCopy();
  const linkedinCopy = useCopy();
  const emailText = `Subject: ${result.email.subject}\n\n${result.email.body}`;

  return (
    <div className="flex flex-col gap-6 px-5 sm:px-8 py-5 sm:py-6">
      <div>
        <ResultLabel>Targeting this assumption</ResultLabel>
        <p className="font-serif italic mt-2 text-foreground text-[13.5px] leading-[1.5]">
          &ldquo;{result.targetAssumption}&rdquo;
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <ResultLabel>Who to reach</ResultLabel>
          <p className="text-text-muted text-[13px] leading-[1.55] mt-[5px]">{result.targetProfile}</p>
        </div>
        <div className="flex-1">
          <ResultLabel>Why them</ResultLabel>
          <p className="text-text-muted text-[13px] leading-[1.55] mt-[5px]">{result.why}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <ResultLabel>Cold email</ResultLabel>
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
          <ResultLabel>LinkedIn DM</ResultLabel>
          <CopyButton text={result.linkedin} onClick={() => linkedinCopy.copy(result.linkedin)} copied={linkedinCopy.copied} label="Copy" />
        </div>
        <div className="bg-surface-2 border border-border rounded-[9px] p-4">
          <p className="text-foreground text-[12.5px] leading-[1.6] whitespace-pre-wrap">
            {result.linkedin}
          </p>
        </div>
      </div>

      <div className="bg-[rgba(111,147,196,0.06)] border border-[rgba(111,147,196,0.2)] rounded-[9px] py-[12px] px-[14px]">
        <ResultLabel>Before you send</ResultLabel>
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
        <ResultLabel>Key Risks</ResultLabel>
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
        <ResultLabel>Validated Signals</ResultLabel>
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
        <ResultLabel>Your Next 3 Steps</ResultLabel>
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
      <ResultLabel>Biggest risk to kill first</ResultLabel>
      <p className="font-serif italic mt-2 text-foreground text-[13.5px] leading-[1.5]">
        &ldquo;{result.biggestRisk}&rdquo;
      </p>
    </div>

    <div>
      <ResultLabel>Testing milestones</ResultLabel>
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
      <ResultLabel>Cheapest test this week</ResultLabel>
      <p className="text-foreground text-[13px] leading-[1.55] mt-[5px]">{result.cheapestTest}</p>
    </div>

    <div className="bg-[rgba(90,87,79,0.08)] border border-[rgba(90,87,79,0.3)] rounded-[9px] p-3">
      <ResultLabel>Honest caveat</ResultLabel>
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
      <ResultLabel>The space</ResultLabel>
      <p className="text-text-muted text-[13px] leading-[1.6] mt-[5px]">{result.marketSummary}</p>
    </div>

    <Divider />

    <div>
      <ResultLabel>Competitive landscape</ResultLabel>
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
      <ResultLabel>Timing</ResultLabel>
      <p className="text-text-muted text-[13px] leading-[1.6] mt-[5px]">{result.timingSignal}</p>
    </div>

    <div>
      <ResultLabel>Your differentiation hypothesis</ResultLabel>
      <p className="text-foreground text-[13px] leading-[1.55] mt-[5px]">{result.differentiationHypothesis}</p>
    </div>

    <div>
      <ResultLabel>Verify before trusting this</ResultLabel>
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

const ResultLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="eyebrow-sm">
    {children}
  </p>
);

const SummarySection = ({ label, body }: { label: string; body: string }) => (
  <div>
    <ResultLabel>{label}</ResultLabel>
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
