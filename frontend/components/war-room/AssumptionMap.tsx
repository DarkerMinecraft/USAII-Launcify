"use client";

import { useState, useCallback, useMemo } from "react";
import { ReactFlow, Background, type Node, type NodeTypes } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X, CheckCircle, AlertCircle, HelpCircle, Info, Loader2 } from "lucide-react";
import Link from "next/link";
import type { AssumptionNode, AssumptionStatus, Canvas, QA } from "@/lib/types";

// ── Status config: uncertainty-first visual hierarchy ─────────────────────────
// UNVALIDATED = largest, highest contrast. VALIDATED = smallest, most muted.
const STATUS_CFG = {
  UNVALIDATED: {
    label: "Unvalidated",
    color: "#c2692a",
    bg: "rgba(194,105,42,0.14)",
    border: "rgba(194,105,42,0.55)",
    w: 224, h: 114,
    icon: AlertCircle,
    colX: 30,
  },
  NEEDS_INFO: {
    label: "Needs Info",
    color: "#9a958c",
    bg: "rgba(90,87,79,0.10)",
    border: "rgba(90,87,79,0.38)",
    w: 196, h: 98,
    icon: HelpCircle,
    colX: 294,
  },
  VALIDATED: {
    label: "Validated",
    color: "#6fa37e",
    bg: "rgba(74,124,89,0.09)",
    border: "rgba(111,163,126,0.35)",
    w: 170, h: 84,
    icon: CheckCircle,
    colX: 530,
  },
} as const;

const AGENT_COLOR: Record<string, string> = {
  SKEPTIC: "#c2692a",
  STRATEGIST: "#6f93c4",
  OPERATOR: "#6fa37e",
};
const AGENT_NAME: Record<string, string> = {
  SKEPTIC: "The Skeptic",
  STRATEGIST: "The Strategist",
  OPERATOR: "The Operator",
};

// ── Layout: cluster by status, stack vertically within each column ─────────────
function computeNodes(assumptions: AssumptionNode[]): Node[] {
  const counts: Record<AssumptionStatus, number> = {
    UNVALIDATED: 0, NEEDS_INFO: 0, VALIDATED: 0,
  };
  return assumptions.map((a) => {
    const cfg = STATUS_CFG[a.status];
    const row = counts[a.status]++;
    return {
      id: a.id,
      type: "assumption",
      position: { x: cfg.colX, y: 30 + row * (cfg.h + 22) },
      data: { assumption: a },
      draggable: false,
      selectable: true,
      style: { width: cfg.w },
    };
  });
}

// ── Custom React Flow node ─────────────────────────────────────────────────────
function AssumptionFlowNode({ data }: { data: Record<string, unknown> }) {
  const assumption = data.assumption as AssumptionNode;
  const cfg = STATUS_CFG[assumption.status];
  const Icon = cfg.icon;
  const reviewed = assumption.remediation !== null;

  return (
    <div
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: "11px",
        padding: "12px 14px",
        cursor: "pointer",
        opacity: reviewed ? 0.65 : 1,
        transition: "opacity 0.3s",
        width: "100%",
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Icon style={{ width: "10px", height: "10px", color: cfg.color, flexShrink: 0 }} />
        <span className="font-mono uppercase" style={{ fontSize: "8px", letterSpacing: "0.14em", color: cfg.color }}>
          {cfg.label}{reviewed ? " · reviewed" : ""}
        </span>
      </div>
      <p
        className="font-serif"
        style={{
          fontSize: "12px", color: "#ede9e0", lineHeight: 1.4, margin: 0,
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}
      >
        {assumption.claim}
      </p>
      <div className="font-mono uppercase mt-2" style={{ fontSize: "7.5px", letterSpacing: "0.12em", color: AGENT_COLOR[assumption.agentSource] ?? "#5a574f" }}>
        {AGENT_NAME[assumption.agentSource] ?? assumption.agentSource}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = { assumption: AssumptionFlowNode };

// ── Main component ─────────────────────────────────────────────────────────────
interface Props {
  sessionId: string;
  assumptions: AssumptionNode[];
  ideaSummary: string;
  questionnaire: QA[];
}

export function AssumptionMap({ sessionId, assumptions: initial, ideaSummary, questionnaire }: Props) {
  const [assumptions, setAssumptions] = useState(initial);
  const [selected, setSelected] = useState<AssumptionNode | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const nodes = useMemo(() => computeNodes(assumptions), [assumptions]);

  const counts = useMemo(() => ({
    unvalidated: assumptions.filter((a) => a.status === "UNVALIDATED").length,
    needsInfo: assumptions.filter((a) => a.status === "NEEDS_INFO").length,
    validated: assumptions.filter((a) => a.status === "VALIDATED").length,
  }), [assumptions]);

  const patchCanvas = useCallback(async (updated: AssumptionNode[]) => {
    setSaving(true);
    setSaveError(false);
    const canvas: Canvas = {
      ideaSummary,
      questionnaireResponses: questionnaire,
      assumptions: updated,
      lastUpdated: new Date().toISOString(),
    };
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvas }),
      });
      if (!res.ok) setSaveError(true);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }, [sessionId, ideaSummary, questionnaire]);

  const handleRemediate = useCallback((
    nodeId: string,
    action: "VALIDATE" | "MODIFY" | "REMOVE",
    payload: Record<string, string>,
  ) => {
    setAssumptions((prev) => {
      let updated: AssumptionNode[];
      if (action === "REMOVE") {
        updated = prev.filter((a) => a.id !== nodeId);
      } else if (action === "MODIFY") {
        updated = prev.map((a) =>
          a.id === nodeId
            ? { ...a, claim: payload.claim ?? a.claim, remediation: { action: "MODIFY", howTested: "", whatFound: payload.claim ?? "", resolvedAt: new Date().toISOString() } }
            : a
        );
      } else {
        updated = prev.map((a) =>
          a.id === nodeId
            ? { ...a, status: "VALIDATED" as AssumptionStatus, remediation: { action: "VALIDATE", howTested: payload.howTested ?? "", whatFound: payload.whatFound ?? "", resolvedAt: new Date().toISOString() } }
            : a
        );
      }
      void patchCanvas(updated);
      return updated;
    });
    setSelected(null);
  }, [patchCanvas]);

  // Keep selected node in sync with local state changes
  const selectedNode = selected ? (assumptions.find((a) => a.id === selected.id) ?? null) : null;

  return (
    <div className="flex flex-col" style={{ minHeight: "100vh", background: "var(--war-room-bg)" }}>

      {/* Disclaimer banner — always visible, required for Responsible AI scoring */}
      <div
        className="flex items-center gap-3 px-6 py-3 shrink-0"
        style={{ background: "rgba(194,105,42,0.07)", borderBottom: "1px solid rgba(194,105,42,0.22)" }}
      >
        <Info className="w-3.5 h-3.5 shrink-0" style={{ color: "#c2692a" }} />
        <p className="font-mono uppercase flex-1" style={{ fontSize: "9px", letterSpacing: "0.1em", color: "#9a958c" }}>
          This analysis is based entirely on what you told us — it does not replace talking to real customers.
          The AI does not decide whether your idea is worth pursuing.
        </p>
        {saving && <Loader2 className="w-3 h-3 animate-spin shrink-0" style={{ color: "#5a574f" }} />}
        {saveError && !saving && (
          <span className="font-mono uppercase shrink-0" style={{ fontSize: "8px", color: "#c2692a", letterSpacing: "0.1em" }}>
            Save failed
          </span>
        )}
      </div>

      {/* Header */}
      <div
        className="flex items-center justify-between px-8 py-5 shrink-0"
        style={{ borderBottom: "1px solid #2e2c28" }}
      >
        <div>
          <h1 className="font-serif italic" style={{ fontSize: "22px", color: "#ede9e0", lineHeight: 1.1 }}>
            Your Assumption Map
          </h1>
          <p className="font-mono uppercase mt-1" style={{ fontSize: "9px", letterSpacing: "0.14em", color: "#5a574f" }}>
            {assumptions.length} assumption{assumptions.length !== 1 ? "s" : ""} · click any node to review
          </p>
        </div>
        <div className="flex items-center gap-3">
          {counts.unvalidated > 0 && <StatusPill count={counts.unvalidated} status="UNVALIDATED" />}
          {counts.needsInfo > 0 && <StatusPill count={counts.needsInfo} status="NEEDS_INFO" />}
          {counts.validated > 0 && <StatusPill count={counts.validated} status="VALIDATED" />}
        </div>
      </div>

      {/* Main: flow canvas + slide-in side panel */}
      <div className="flex flex-1 overflow-hidden">

        {/* React Flow canvas */}
        <div className="flex-1" style={{ height: "calc(100vh - 184px)" }}>
          <ReactFlow
            nodes={nodes}
            edges={[]}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => {
              const a = assumptions.find((x) => x.id === node.id);
              if (a) setSelected(a);
            }}
            fitView
            fitViewOptions={{ padding: 0.28 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
            panOnDrag={true}
            zoomOnScroll={true}
            minZoom={0.4}
            maxZoom={1.6}
            style={{ background: "transparent" }}
          >
            <Background color="#252320" gap={28} size={1} />
          </ReactFlow>
        </div>

        {/* Side panel — slides in from right on node selection */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              key={selectedNode.id}
              initial={{ x: 340, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 340, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              style={{
                width: "340px",
                background: "#131210",
                borderLeft: "1px solid #2e2c28",
                display: "flex",
                flexDirection: "column",
                overflowY: "auto",
              }}
            >
              <NodePanel node={selectedNode} onClose={() => setSelected(null)} onRemediate={handleRemediate} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer CTA */}
      <div
        className="flex items-center justify-between px-8 py-4 shrink-0"
        style={{ borderTop: "1px solid #2e2c28" }}
      >
        <p className="font-serif italic" style={{ fontSize: "13px", color: "#7a7670", maxWidth: "30rem" }}>
          Review your assumptions, then take your first real step in the Launchpad.
        </p>
        <Link
          href={`/launchpad?sessionId=${sessionId}`}
          className="inline-flex items-center gap-2.5 font-semibold"
          style={{
            background: "#ede9e0", color: "#131210",
            borderRadius: "9px", padding: "10px 20px",
            fontSize: "14px", textDecoration: "none",
          }}
        >
          Open the Launchpad
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

// ── Status pill ────────────────────────────────────────────────────────────────
function StatusPill({ count, status }: { count: number; status: AssumptionStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <div
      className="flex items-center gap-1.5 font-mono uppercase"
      style={{
        padding: "4px 10px", borderRadius: "5px",
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        fontSize: "9px", letterSpacing: "0.12em", color: cfg.color,
      }}
    >
      {count} {cfg.label}
    </div>
  );
}

// ── Node detail side panel ─────────────────────────────────────────────────────
function NodePanel({
  node,
  onClose,
  onRemediate,
}: {
  node: AssumptionNode;
  onClose: () => void;
  onRemediate: (id: string, action: "VALIDATE" | "MODIFY" | "REMOVE", payload: Record<string, string>) => void;
}) {
  const [action, setAction] = useState<"VALIDATE" | "MODIFY" | "REMOVE" | null>(null);
  const [howTested, setHowTested] = useState("");
  const [whatFound, setWhatFound] = useState("");
  const [modifiedClaim, setModifiedClaim] = useState(node.claim);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const cfg = STATUS_CFG[node.status];
  const Icon = cfg.icon;

  const canSubmit =
    (action === "VALIDATE" && howTested.trim().length > 0 && whatFound.trim().length > 0) ||
    (action === "MODIFY" && modifiedClaim.trim().length > 0 && modifiedClaim !== node.claim) ||
    (action === "REMOVE" && confirmRemove);

  function submit() {
    if (!canSubmit || !action) return;
    if (action === "VALIDATE") onRemediate(node.id, "VALIDATE", { howTested, whatFound });
    else if (action === "MODIFY") onRemediate(node.id, "MODIFY", { claim: modifiedClaim });
    else onRemediate(node.id, "REMOVE", {});
  }

  return (
    <div className="flex flex-col h-full">

      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid #2e2c28" }}>
        <div className="flex items-center gap-2">
          <Icon style={{ width: "13px", height: "13px", color: cfg.color }} />
          <span className="font-mono uppercase" style={{ fontSize: "9px", letterSpacing: "0.12em", color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        <button onClick={onClose} style={{ color: "#5a574f", padding: "4px", lineHeight: 0 }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex flex-col gap-5 p-5 overflow-y-auto">

        {/* Claim */}
        <div>
          <Label>Assumption</Label>
          <p className="font-serif" style={{ fontSize: "15px", color: "#ede9e0", lineHeight: 1.5, marginTop: "6px" }}>
            {node.claim}
          </p>
        </div>

        {/* Agent source */}
        <span className="font-mono uppercase" style={{ fontSize: "8.5px", letterSpacing: "0.12em", color: AGENT_COLOR[node.agentSource] ?? "#5a574f" }}>
          Raised by {AGENT_NAME[node.agentSource] ?? node.agentSource}
        </span>

        {/* Explanation */}
        <div>
          <Label>Why this status</Label>
          <p style={{ fontSize: "13px", color: "#9a958c", lineHeight: 1.55, marginTop: "6px" }}>
            {node.explanation}
          </p>
        </div>

        {/* howToTest — the "first real step" for Direction B */}
        {node.howToTest && (
          <div style={{ background: "rgba(194,105,42,0.07)", border: "1px solid rgba(194,105,42,0.24)", borderRadius: "9px", padding: "12px 14px" }}>
            <p className="font-mono uppercase mb-2" style={{ fontSize: "8px", letterSpacing: "0.13em", color: "#c2692a" }}>
              How to test this
            </p>
            <p style={{ fontSize: "12.5px", color: "#ede9e0", lineHeight: 1.5 }}>
              {node.howToTest}
            </p>
          </div>
        )}

        {/* Per-node honesty microcopy — required for Responsible AI scoring */}
        <p
          className="font-serif italic"
          style={{ fontSize: "11.5px", color: "#5a574f", lineHeight: 1.5, borderTop: "1px solid #2e2c28", paddingTop: "14px" }}
        >
          This status was AI-inferred from only what you told us. Verify before trusting it.
        </p>

        {/* Already reviewed */}
        {node.remediation && (
          <div style={{ background: "rgba(74,124,89,0.08)", border: "1px solid rgba(111,163,126,0.25)", borderRadius: "9px", padding: "12px 14px" }}>
            <p className="font-mono uppercase" style={{ fontSize: "8px", letterSpacing: "0.12em", color: "#6fa37e" }}>
              You reviewed this assumption
            </p>
          </div>
        )}

        {/* Remediation form — the visible human-in-the-loop moment */}
        {!node.remediation && (
          <div style={{ borderTop: "1px solid #2e2c28", paddingTop: "14px" }}>
            <Label>What do you want to do?</Label>
            <div className="flex flex-col gap-2 mt-3">
              {(["VALIDATE", "MODIFY", "REMOVE"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAction(action === a ? null : a)}
                  className="text-left font-mono uppercase"
                  style={{
                    padding: "8px 12px", borderRadius: "7px",
                    fontSize: "9px", letterSpacing: "0.1em",
                    background: action === a ? "rgba(237,233,224,0.08)" : "transparent",
                    border: `1px solid ${action === a ? "#5a574f" : "#2e2c28"}`,
                    color: action === a ? "#ede9e0" : "#7a7670",
                    transition: "all 0.15s", cursor: "pointer",
                  }}
                >
                  {a === "VALIDATE" ? "Validate this" : a === "MODIFY" ? "Modify the claim" : "Remove this assumption"}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {action === "VALIDATE" && (
                <motion.div key="v" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-3 mt-4">
                  <FieldTextarea label="How did you test this?" value={howTested} onChange={setHowTested} placeholder="e.g. Interviewed 5 founders who faced this problem…" />
                  <FieldTextarea label="What did you find?" value={whatFound} onChange={setWhatFound} placeholder="e.g. All confirmed they spend 3+ hours a week on this…" />
                </motion.div>
              )}
              {action === "MODIFY" && (
                <motion.div key="m" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
                  <FieldTextarea label="Updated claim" value={modifiedClaim} onChange={setModifiedClaim} rows={3} />
                </motion.div>
              )}
              {action === "REMOVE" && (
                <motion.div key="r" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmRemove}
                      onChange={(e) => setConfirmRemove(e.target.checked)}
                      className="mt-0.5 shrink-0"
                    />
                    <span style={{ fontSize: "12px", color: "#9a958c", lineHeight: 1.5 }}>
                      This assumption will be excluded from your Launchpad brief.
                    </span>
                  </label>
                </motion.div>
              )}
            </AnimatePresence>

            {action && (
              <button
                onClick={submit}
                disabled={!canSubmit}
                className="w-full font-semibold mt-4"
                style={{
                  padding: "10px 16px", borderRadius: "8px", fontSize: "13px",
                  background: canSubmit ? "#ede9e0" : "#1a1916",
                  color: canSubmit ? "#131210" : "#5a574f",
                  border: `1px solid ${canSubmit ? "transparent" : "#2e2c28"}`,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  transition: "all 0.15s",
                }}
              >
                Confirm
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono uppercase" style={{ fontSize: "8.5px", letterSpacing: "0.12em", color: "#5a574f" }}>
      {children}
    </p>
  );
}

function FieldTextarea({ label, value, onChange, placeholder, rows = 2 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          background: "#15140f", border: "1px solid #38332b", borderRadius: "7px",
          padding: "8px 10px", color: "#ede9e0", fontSize: "12.5px",
          lineHeight: 1.5, resize: "vertical", outline: "none", width: "100%",
          fontFamily: "inherit",
        }}
        onFocus={(e) => { e.target.style.borderColor = "#5a574f"; }}
        onBlur={(e) => { e.target.style.borderColor = "#38332b"; }}
      />
    </div>
  );
}
