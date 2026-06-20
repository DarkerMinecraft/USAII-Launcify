"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Copy, Check, Loader2, AlertCircle,
  Users, FileText, AlertTriangle, Swords,
} from "lucide-react";
import type { Canvas } from "@/lib/types";
import { generateOutreach, generateSummary } from "@/actions/launchpad";

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

const eyebrow: React.CSSProperties = {
  fontSize: "9px",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "#5a574f",
};

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

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/sessions/${sessionId}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.error ?? "Could not load session");
        if (data?.canvas && typeof data.canvas.ideaSummary === "string") {
          setCanvas(data.canvas as Canvas);
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
          <Swords className="h-6 w-6" style={{ color: "#5a574f" }} />
          <p className="font-serif italic" style={{ fontSize: "22px", color: "#ede9e0" }}>
            Complete the War Room first.
          </p>
          <p style={{ fontSize: "14px", color: "#9a958c", maxWidth: "26rem", lineHeight: 1.6 }}>
            The Launchpad reads your Assumption Map. Start a War Room session to build one.
          </p>
          <Link
            href="/war-room"
            className="inline-flex items-center gap-2 font-semibold"
            style={{ background: "#ede9e0", color: "#131210", borderRadius: "9px", padding: "10px 20px", fontSize: "14px", textDecoration: "none", marginTop: "8px" }}
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
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#c2692a" }} />
          <p className="font-mono" style={eyebrow}>Loading your canvas…</p>
        </div>
      </PageShell>
    );
  }

  if (loadState === "error" || !canvas) {
    return (
      <PageShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-32 text-center">
          <AlertTriangle className="h-6 w-6" style={{ color: "#c2692a" }} />
          <p className="font-serif italic" style={{ fontSize: "20px", color: "#ede9e0" }}>
            Could not load session.
          </p>
          <p style={{ fontSize: "14px", color: "#9a958c" }}>{loadError}</p>
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
            className="inline-flex items-center gap-2 font-mono"
            style={{ ...eyebrow, color: "#7a7670", textDecoration: "none" }}
          >
            <ArrowLeft className="w-3 h-3" />
            Back to War Room
          </Link>
        </div>
      )}

      <div className="px-10 pt-7 pb-6" style={{ borderBottom: "1px solid #2e2c28" }}>
        <h1 className="font-serif italic" style={{ fontSize: "30px", color: "#ede9e0", lineHeight: 1.1 }}>
          Launchpad
        </h1>
        <p className="font-mono mt-1.5" style={{ ...eyebrow }}>
          Stop thinking. Start doing.
        </p>

        <div
          className="flex items-start gap-4 mt-5 p-4 rounded-[11px]"
          style={{ background: "#15140f", border: "1px solid #2e2c28" }}
        >
          <div className="flex-1 min-w-0">
            <p className="font-mono" style={{ ...eyebrow, marginBottom: "5px" }}>Active Idea</p>
            <p className="font-serif italic" style={{ fontSize: "15px", color: "#ede9e0", lineHeight: 1.45 }}>
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-px flex-1" style={{ background: "#2e2c28" }}>
        <CustomerConnectCard canvas={canvas} />
        <ExecutiveSummaryCard canvas={canvas} />
      </div>
    </PageShell>
  );
};

const CustomerConnectCard = ({ canvas }: { canvas: Canvas }) => {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<OutreachResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setState("loading");
    setError(null);
    try {
      const data = await generateOutreach(canvas);
      setResult(data as unknown as OutreachResult);
      setState("done");
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

const ExecutiveSummaryCard = ({ canvas }: { canvas: Canvas }) => {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setState("loading");
    setError(null);
    try {
      const data = await generateSummary(canvas);
      setResult(data as unknown as SummaryResult);
      setState("done");
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
  <div className="flex flex-col" style={{ background: "#0f0e0c", minHeight: "520px" }}>
    <div className="px-8 pt-8 pb-6" style={{ borderBottom: "1px solid #2e2c28" }}>
      <div className="flex items-center gap-2.5 mb-4">
        {icon}
        <span className="font-mono uppercase" style={{ fontSize: "9px", letterSpacing: "0.16em", color: accentColor }}>
          {title}
        </span>
      </div>
      <h2 className="font-serif italic" style={{ fontSize: "20px", color: "#ede9e0", lineHeight: 1.2, marginBottom: "10px" }}>
        {subtitle}
      </h2>
      <p style={{ fontSize: "13px", color: "#7a7670", lineHeight: 1.6 }}>{description}</p>
    </div>

    <div className="px-8 py-5" style={{ borderBottom: "1px solid #1f1e1b" }}>
      {state === "idle" || state === "error" ? (
        <button
          onClick={onGenerate}
          className="inline-flex items-center gap-2 font-semibold transition-colors"
          style={{ background: "#ede9e0", color: "#131210", borderRadius: "8px", padding: "9px 18px", fontSize: "13.5px", cursor: "pointer" }}
        >
          Generate
        </button>
      ) : state === "loading" ? (
        <div className="flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: accentColor }} />
          <span className="font-mono" style={{ ...eyebrow, color: "#7a7670" }}>Reading your canvas…</span>
        </div>
      ) : (
        <button
          onClick={onGenerate}
          className="inline-flex items-center gap-2 font-mono transition-colors"
          style={{ ...eyebrow, color: "#5a574f", cursor: "pointer", background: "none", border: "none", padding: 0 }}
        >
          Regenerate
        </button>
      )}

      {state === "error" && error && (
        <div className="flex items-center gap-2 mt-3">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" style={{ color: "#c2692a" }} />
          <p style={{ fontSize: "12.5px", color: "#9a958c" }}>{error}</p>
        </div>
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
        <p className="font-serif italic mt-2" style={{ fontSize: "13.5px", color: "#ede9e0", lineHeight: 1.5 }}>
          &ldquo;{result.targetAssumption}&rdquo;
        </p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <Label>Who to reach</Label>
          <p style={{ fontSize: "13px", color: "#9a958c", lineHeight: 1.55, marginTop: "5px" }}>{result.targetProfile}</p>
        </div>
        <div className="flex-1">
          <Label>Why them</Label>
          <p style={{ fontSize: "13px", color: "#9a958c", lineHeight: 1.55, marginTop: "5px" }}>{result.why}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Cold email</Label>
          <CopyButton copied={emailCopy.copied} onClick={() => emailCopy.copy(emailText)} />
        </div>
        <div style={{ background: "#15140f", border: "1px solid #2e2c28", borderRadius: "9px", padding: "14px 16px" }}>
          <p style={{ fontSize: "11px", color: "#6fa37e", fontFamily: "var(--font-mono)", letterSpacing: "0.06em", marginBottom: "8px" }}>
            Subject: {result.email.subject}
          </p>
          <p style={{ fontSize: "12.5px", color: "#ede9e0", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {result.email.body}
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>LinkedIn DM</Label>
          <CopyButton copied={linkedinCopy.copied} onClick={() => linkedinCopy.copy(result.linkedin)} />
        </div>
        <div style={{ background: "#15140f", border: "1px solid #2e2c28", borderRadius: "9px", padding: "14px 16px" }}>
          <p style={{ fontSize: "12.5px", color: "#ede9e0", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {result.linkedin}
          </p>
        </div>
      </div>

      <div style={{ background: "rgba(111,147,196,0.06)", border: "1px solid rgba(111,147,196,0.2)", borderRadius: "9px", padding: "12px 14px" }}>
        <Label>Before you send</Label>
        <p style={{ fontSize: "12.5px", color: "#9a958c", lineHeight: 1.55, marginTop: "6px" }}>{result.personalizationTips}</p>
      </div>

      <p className="font-serif italic" style={{ fontSize: "11.5px", color: "#5a574f", lineHeight: 1.5 }}>
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
        <p className="font-serif italic" style={{ fontSize: "13.5px", color: "#ede9e0" }}>{result.headline}</p>
        <CopyButton copied={fullCopy.copied} onClick={() => fullCopy.copy(fullText)} label="Copy brief" />
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
              <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#c2692a", flexShrink: 0, marginTop: "7px" }} />
              <span style={{ fontSize: "13px", color: "#9a958c", lineHeight: 1.55 }}>{risk}</span>
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
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#6fa37e", flexShrink: 0, marginTop: "7px" }} />
                <span style={{ fontSize: "13px", color: "#9a958c", lineHeight: 1.55 }}>{signal}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: "12.5px", color: "#5a574f", fontStyle: "italic", marginTop: "6px" }}>
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
              <span className="font-mono shrink-0" style={{ fontSize: "10px", color: "#c2692a", marginTop: "2px", letterSpacing: "0.06em" }}>
                {i + 1}.
              </span>
              <span style={{ fontSize: "13px", color: "#ede9e0", lineHeight: 1.55 }}>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="font-serif italic" style={{ fontSize: "11.5px", color: "#5a574f", lineHeight: 1.5, borderTop: "1px solid #2e2c28", paddingTop: "14px" }}>
        This brief reflects only what you told the system. It is information for your decision-making — not an endorsement of the idea.
      </p>
    </div>
  );
};

const PageShell = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-screen flex-col" style={{ background: "var(--war-room-bg)" }}>
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
  <p className="font-mono uppercase" style={{ fontSize: "8.5px", letterSpacing: "0.12em", color: "#5a574f" }}>
    {children}
  </p>
);

const SummarySection = ({ label, body }: { label: string; body: string }) => (
  <div>
    <Label>{label}</Label>
    <p style={{ fontSize: "13px", color: "#9a958c", lineHeight: 1.6, marginTop: "5px" }}>{body}</p>
  </div>
);

const Divider = () => <div style={{ height: "1px", background: "#2e2c28", margin: "2px 0" }} />;

const CopyButton = ({ copied, onClick, label = "Copy" }: { copied: boolean; onClick: () => void; label?: string }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1.5 font-mono uppercase transition-colors"
    style={{
      fontSize: "8px", letterSpacing: "0.12em",
      color: copied ? "#6fa37e" : "#5a574f",
      background: "none", border: "none", cursor: "pointer", padding: 0,
    }}
  >
    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    {copied ? "Copied" : label}
  </button>
);
