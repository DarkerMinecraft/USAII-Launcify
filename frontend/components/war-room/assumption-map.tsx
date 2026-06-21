"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ReactFlow, Background, Handle, Position, type Node, type Edge, type NodeTypes } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X, CheckCircle, AlertCircle, HelpCircle, Info, Loader2 } from "lucide-react";
import Link from "next/link";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label as ShadcnLabel } from "@/components/ui/label";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { AssumptionNode, AssumptionStatus, Canvas, QA } from "@/lib/types";
import { updateSession } from "@/actions/sessions";
import { reviewAssumption } from "@/actions/war-room";

const STATUS_CFG = {
  UNVALIDATED: {
    label: "Unvalidated",
    color: "#c2692a",
    bg: "rgba(194,105,42,0.14)",
    border: "rgba(194,105,42,0.55)",
    w: 224, h: 114,
    icon: AlertCircle,
    colX: 30,
    bgClass: "bg-[rgba(194,105,42,0.14)] border-[rgba(194,105,42,0.55)]",
    iconClass: "text-[#c2692a]",
    labelClass: "text-[#c2692a]",
  },
  NEEDS_INFO: {
    label: "Needs Info",
    color: "#9a958c",
    bg: "rgba(90,87,79,0.10)",
    border: "rgba(90,87,79,0.38)",
    w: 196, h: 98,
    icon: HelpCircle,
    colX: 294,
    bgClass: "bg-[rgba(90,87,79,0.10)] border-[rgba(90,87,79,0.38)]",
    iconClass: "text-[#9a958c]",
    labelClass: "text-[#9a958c]",
  },
  VALIDATED: {
    label: "Validated",
    color: "#6fa37e",
    bg: "rgba(74,124,89,0.09)",
    border: "rgba(111,163,126,0.35)",
    w: 170, h: 84,
    icon: CheckCircle,
    colX: 530,
    bgClass: "bg-[rgba(74,124,89,0.09)] border-[rgba(111,163,126,0.35)]",
    iconClass: "text-agent-operator",
    labelClass: "text-agent-operator",
  },
} as const;

const AGENT_COLOR: Record<string, string> = {
  SKEPTIC: "#c2692a",
  STRATEGIST: "#6f93c4",
  OPERATOR: "#6fa37e",
};
const AGENT_CLASS: Record<string, string> = {
  SKEPTIC: "text-agent-skeptic",
  STRATEGIST: "text-agent-strategist",
  OPERATOR: "text-agent-operator",
};
const AGENT_NAME: Record<string, string> = {
  SKEPTIC: "The Skeptic",
  STRATEGIST: "The Strategist",
  OPERATOR: "The Operator",
};

// Structural (base) accent per agent — used for the constellation links between
// same-agent nodes. The brighter text tints live in AGENT_COLOR above.
const AGENT_BASE: Record<string, string> = {
  SKEPTIC: "#c2692a",
  STRATEGIST: "#3a5a8a",
  OPERATOR: "#4a7c59",
};

// Each agent owns an evenly-spaced sector around the central idea, mirroring the
// arena's spatial identity: Skeptic on top, Strategist lower-left, Operator lower-right.
const SECTOR_ANGLE: Record<string, number> = {
  SKEPTIC: -90,    // top
  STRATEGIST: 150, // lower-left
  OPERATOR: 30,    // lower-right
};
const AGENT_ORDER = ["SKEPTIC", "STRATEGIST", "OPERATOR"] as const;

const IDEA_W = 260;
const IDEA_H = 120;
const SECTOR_ARC = 100;  // max angular spread (deg) of one agent cluster
const BASE_RADIUS = 360; // distance (px) from idea center to the first ring
const RING_GAP = 150;    // radial distance between rings when a sector overflows
const NODE_GAP = 46;     // min clearance between node bounding boxes (px)
const IDEAL_STEP = 40;   // comfortable angular spacing (deg) for small clusters

const deg = (d: number) => (d * Math.PI) / 180;

// Invisible, non-interactive anchor so every edge meets at a node's visual center.
const HIDDEN_HANDLE: React.CSSProperties = {
  left: "50%",
  top: "50%",
  transform: "translate(-50%, -50%)",
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  opacity: 0,
  border: "none",
  background: "transparent",
  pointerEvents: "none",
};

// Lay the assumptions out as a web: a central "idea" hub, every assumption on a
// spoke off it, and same-agent assumptions chained into a constellation. Nodes are
// placed radially per agent sector with a greedy no-overlap guarantee — a full arc
// spills onto an outer ring rather than crowding.
const computeGraph = (
  assumptions: AssumptionNode[],
  ideaSummary: string,
): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [
    {
      id: "idea",
      type: "idea",
      position: { x: -IDEA_W / 2, y: -IDEA_H / 2 },
      data: { ideaSummary },
      draggable: false,
      selectable: false,
      style: { width: IDEA_W },
    },
  ];
  const edges: Edge[] = [];

  const maxDim = assumptions.reduce((m, a) => {
    const cfg = STATUS_CFG[a.status];
    return Math.max(m, cfg.w, cfg.h);
  }, 0) || 224;

  for (const agent of AGENT_ORDER) {
    const group = assumptions.filter((a) => a.agentSource === agent);
    if (group.length === 0) continue;

    const center = SECTOR_ANGLE[agent];
    let remaining = group.slice();
    let ring = 0;

    while (remaining.length > 0) {
      const radius = BASE_RADIUS + ring * RING_GAP;
      const minStep = ((maxDim + NODE_GAP) / radius) * (180 / Math.PI);
      const capacity = Math.max(1, Math.floor(SECTOR_ARC / minStep) + 1);
      const ringNodes = remaining.slice(0, capacity);
      remaining = remaining.slice(capacity);

      const n = ringNodes.length;
      const arc = n === 1 ? 0 : Math.min(SECTOR_ARC, (n - 1) * Math.max(minStep, IDEAL_STEP));

      ringNodes.forEach((a, k) => {
        const t = n === 1 ? 0 : k / (n - 1) - 0.5; // -0.5 .. 0.5
        const angle = center + t * arc;
        const stagger = n > 1 ? (k % 2 === 0 ? -12 : 12) : 0;
        const r = radius + stagger;
        const cfg = STATUS_CFG[a.status];
        const cx = r * Math.cos(deg(angle));
        const cy = r * Math.sin(deg(angle));
        nodes.push({
          id: a.id,
          type: "assumption",
          position: { x: cx - cfg.w / 2, y: cy - cfg.h / 2 },
          data: { assumption: a },
          draggable: false,
          selectable: true,
          style: { width: cfg.w },
        });
        edges.push({ id: `spoke-${a.id}`, source: "idea", target: a.id });
      });

      ring++;
    }

    // Constellation: chain the agent's nodes in order so the cluster reads as one web.
    for (let i = 0; i < group.length - 1; i++) {
      edges.push({
        id: `link-${group[i].id}-${group[i + 1].id}`,
        source: group[i].id,
        target: group[i + 1].id,
        type: "straight",
        style: { stroke: AGENT_BASE[agent], strokeWidth: 1, strokeDasharray: "3 4", opacity: 0.4 },
      });
    }
  }

  return { nodes, edges };
};

const AssumptionFlowNode = ({ data }: { data: Record<string, unknown> }) => {
  const assumption = data.assumption as AssumptionNode;
  const cfg = STATUS_CFG[assumption.status];
  const Icon = cfg.icon;
  const reviewed = assumption.remediation !== null;
  // Uncertainty-first: only resolved (validated) nodes recede; everything still
  // open stays at full prominence even after the founder has acted on it.
  const settled = assumption.status === "VALIDATED";

  return (
    <div
      style={{
        background: `linear-gradient(${cfg.bg}, ${cfg.bg}), #15140f`,
        border: `1px ${assumption.status === "NEEDS_INFO" ? "dashed" : "solid"} ${cfg.border}`,
        borderRadius: "11px",
        padding: "12px 14px",
        cursor: "pointer",
        opacity: settled ? 0.72 : 1,
        transition: "opacity 0.3s",
        width: "100%",
      }}
    >
      <Handle type="target" position={Position.Top} style={HIDDEN_HANDLE} />
      <Handle type="source" position={Position.Bottom} style={HIDDEN_HANDLE} />
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={cn("w-[10px] h-[10px] shrink-0", cfg.iconClass)} />
        <span className={cn("font-mono uppercase text-[8px] tracking-[0.14em]", cfg.labelClass)}>
          {cfg.label}{reviewed ? " · reviewed" : ""}
        </span>
      </div>
      <p className="font-serif text-foreground text-[12px] leading-[1.4] m-0 line-clamp-3">
        {assumption.claim}
      </p>
      <div className={cn("font-mono uppercase mt-2 text-[7.5px] tracking-[0.12em]", AGENT_CLASS[assumption.agentSource] ?? "text-text-faint")}>
        {AGENT_NAME[assumption.agentSource] ?? assumption.agentSource}
      </div>
    </div>
  );
};

const IdeaNode = ({ data }: { data: Record<string, unknown> }) => {
  const ideaSummary = (data.ideaSummary as string) ?? "";
  return (
    <div
      style={{
        width: "100%",
        background: "#211d18",
        border: "1px solid #4a443a",
        borderRadius: "13px",
        padding: "16px 18px",
        boxShadow: "0 0 50px -10px rgba(168,152,127,0.25)",
      }}
    >
      <Handle type="target" position={Position.Top} style={HIDDEN_HANDLE} />
      <Handle type="source" position={Position.Bottom} style={HIDDEN_HANDLE} />
      <div className="font-mono uppercase mb-2" style={{ fontSize: "8px", letterSpacing: "0.18em", color: "#a8987f" }}>
        The Idea
      </div>
      <p
        className="font-serif italic text-foreground"
        style={{
          fontSize: "14px",
          lineHeight: 1.45,
          margin: 0,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {ideaSummary}
      </p>
    </div>
  );
};

const nodeTypes: NodeTypes = { assumption: AssumptionFlowNode, idea: IdeaNode };

interface Props {
  sessionId: string;
  assumptions: AssumptionNode[];
  ideaSummary: string;
  questionnaire: QA[];
}

export const AssumptionMap = ({ sessionId, assumptions: initial, ideaSummary, questionnaire }: Props) => {
  const [assumptions, setAssumptions] = useState(initial);
  const [selected, setSelected] = useState<AssumptionNode | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const { nodes, edges } = useMemo(() => computeGraph(assumptions, ideaSummary), [assumptions, ideaSummary]);

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
      await updateSession(sessionId, { canvas, assumptions: updated });
    } catch {
      setSaveError(true);
      toast.error("Could not save — changes may be lost.");
    } finally {
      setSaving(false);
    }
  }, [sessionId, ideaSummary, questionnaire]);

  const handleRemove = useCallback((nodeId: string) => {
    setAssumptions((prev) => {
      const updated = prev.filter((a) => a.id !== nodeId);
      void patchCanvas(updated);
      return updated;
    });
    setSelected(null);
  }, [patchCanvas]);

  // Founder adds evidence or rewrites the claim → the AI re-reviews that one node
  // and returns a fresh status. The node changes because the founder acted (HITL);
  // the panel stays open so the re-classification is visible.
  const handleReview = useCallback(async (
    nodeId: string,
    kind: "EVIDENCE" | "MODIFY",
    payload: { howTested?: string; whatFound?: string; note?: string; claim?: string },
  ): Promise<boolean> => {
    const node = assumptions.find((a) => a.id === nodeId);
    if (!node) return false;

    const newClaim = kind === "MODIFY" ? payload.claim?.trim() : undefined;
    const founderInput = kind === "EVIDENCE"
      ? `What I did or now know:\n${payload.howTested ?? ""}\n\nWhat that told me:\n${payload.whatFound ?? ""}`
      : (payload.note ?? "");

    try {
      const result = await reviewAssumption({
        ideaSummary,
        questionnaireResponses: questionnaire,
        claim: newClaim ?? node.claim,
        agentSource: node.agentSource,
        explanation: node.explanation,
        founderInput,
        kind,
      });
      setAssumptions((prev) => {
        const updated = prev.map((a) =>
          a.id === nodeId
            ? {
                ...a,
                claim: newClaim ?? a.claim,
                status: result.status,
                explanation: result.explanation,
                howToTest: result.howToTest,
                remediation: {
                  action: (kind === "MODIFY" ? "MODIFY" : "VALIDATE") as "MODIFY" | "VALIDATE",
                  howTested: payload.howTested ?? "",
                  whatFound: kind === "MODIFY" ? (payload.note ?? "") : (payload.whatFound ?? ""),
                  resolvedAt: new Date().toISOString(),
                },
              }
            : a
        );
        void patchCanvas(updated);
        return updated;
      });
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Re-review failed — please try again.");
      return false;
    }
  }, [assumptions, ideaSummary, questionnaire, patchCanvas]);

  const selectedNode = selected ? (assumptions.find((a) => a.id === selected.id) ?? null) : null;

  return (
    <div className="flex flex-col min-h-screen bg-war-room-bg">

      <div className="flex items-center gap-3 px-6 py-3 shrink-0 bg-[rgba(194,105,42,0.07)] border-b border-[rgba(194,105,42,0.22)]">
        <Info className="w-3.5 h-3.5 shrink-0 text-agent-skeptic" />
        <p className="font-mono uppercase flex-1 text-text-muted text-[9px] tracking-[0.1em]">
          This analysis is based entirely on what you told us — it does not replace talking to real customers.
          The AI does not decide whether your idea is worth pursuing.
        </p>
        {saving && <Loader2 className="w-3 h-3 animate-spin shrink-0 text-text-faint" />}
        {saveError && !saving && (
          <span className="font-mono uppercase shrink-0 text-agent-skeptic text-[8px] tracking-[0.1em]">
            Save failed
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-5 sm:px-8 py-4 sm:py-5 gap-3 shrink-0 border-b border-border">
        <div>
          <h1 className="font-serif italic text-foreground text-[22px] leading-[1.1]">
            Your Assumption Map
          </h1>
          <p className="font-mono uppercase mt-1 text-text-faint text-[9px] tracking-[0.14em]">
            {assumptions.length} assumption{assumptions.length !== 1 ? "s" : ""} · tap any node to review
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          {counts.unvalidated > 0 && <StatusPill count={counts.unvalidated} status="UNVALIDATED" />}
          {counts.needsInfo > 0 && <StatusPill count={counts.needsInfo} status="NEEDS_INFO" />}
          {counts.validated > 0 && <StatusPill count={counts.validated} status="VALIDATED" />}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 h-[calc(100dvh-200px)]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={{ type: "straight", style: { stroke: "#4a443a", strokeWidth: 1.25, opacity: 0.7 } }}
            onNodeClick={(_, node) => {
              if (node.type === "idea") return;
              const a = assumptions.find((x) => x.id === node.id);
              if (a) setSelected(a);
            }}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
            panOnDrag={true}
            zoomOnScroll={true}
            minZoom={0.4}
            maxZoom={1.6}
            className="bg-transparent"
          >
            <Background color="#252320" gap={28} size={1} />
          </ReactFlow>
        </div>

        {/* Desktop side panel */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              key={selectedNode.id}
              initial={{ x: 340, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 340, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="hidden md:flex w-[340px] bg-surface-1 border-l border-border flex-col overflow-y-auto"
            >
              <NodePanel node={selectedNode} onClose={() => setSelected(null)} onReview={handleReview} onRemove={handleRemove} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile bottom sheet */}
      <AnimatePresence>
        {selectedNode && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 z-40 bg-black/50"
              onClick={() => setSelected(null)}
            />
            <motion.div
              key={`sheet-${selectedNode.id}`}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-50 max-h-[78dvh] bg-surface-1 border-t border-border rounded-t-[20px] flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]"
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-9 h-1 rounded-full bg-[#3a3833]" />
              </div>
              <div className="flex-1 overflow-y-auto">
                <NodePanel node={selectedNode} onClose={() => setSelected(null)} onRemediate={handleRemediate} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 sm:px-8 py-4 shrink-0 border-t border-border">
        <p className="font-serif italic text-text-dim text-[13px] max-w-[30rem]">
          Review your assumptions, then take your first real step in the Launchpad.
        </p>
        <Button asChild className="gap-2.5 rounded-[9px] px-5 py-2.5 text-[14px] font-semibold shrink-0">
          <Link href={`/launchpad?sessionId=${sessionId}`}>
            Open the Launchpad
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
};

const StatusPill = ({ count, status }: { count: number; status: AssumptionStatus }) => {
  const cfg = STATUS_CFG[status];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 font-mono uppercase py-1 px-2.5 rounded-[5px] text-[9px] tracking-[0.12em] border",
      cfg.bgClass, cfg.labelClass
    )}>
      {count} {cfg.label}
    </span>
  );
};

const NodePanel = ({
  node,
  onClose,
  onReview,
  onRemove,
}: {
  node: AssumptionNode;
  onClose: () => void;
  onReview: (
    id: string,
    kind: "EVIDENCE" | "MODIFY",
    payload: { howTested?: string; whatFound?: string; note?: string; claim?: string },
  ) => Promise<boolean>;
  onRemove: (id: string) => void;
}) => {
  const [action, setAction] = useState<"VALIDATE" | "MODIFY" | "REMOVE" | null>(null);
  const [howTested, setHowTested] = useState("");
  const [whatFound, setWhatFound] = useState("");
  const [modifiedClaim, setModifiedClaim] = useState(node.claim);
  const [note, setNote] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Keep the modify field in sync if the claim changes after a re-review.
  useEffect(() => { setModifiedClaim(node.claim); }, [node.claim]);

  const cfg = STATUS_CFG[node.status];
  const Icon = cfg.icon;

  const canSubmit =
    (action === "VALIDATE" && howTested.trim().length > 0 && whatFound.trim().length > 0) ||
    (action === "MODIFY" && modifiedClaim.trim().length > 0 && modifiedClaim !== node.claim) ||
    (action === "REMOVE" && confirmRemove);

  const resetForm = () => {
    setAction(null);
    setHowTested("");
    setWhatFound("");
    setNote("");
    setConfirmRemove(false);
  };

  const submit = async () => {
    if (!canSubmit || !action || submitting) return;
    if (action === "REMOVE") { onRemove(node.id); return; }
    setSubmitting(true);
    const ok = action === "MODIFY"
      ? await onReview(node.id, "MODIFY", { claim: modifiedClaim, note })
      : await onReview(node.id, "EVIDENCE", { howTested, whatFound });
    setSubmitting(false);
    if (ok) resetForm();
  };

  const validateLabel =
    node.status === "NEEDS_INFO" ? "Add the missing info"
    : node.status === "VALIDATED" ? "Add more evidence"
    : "Add evidence";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-[13px] h-[13px]", cfg.iconClass)} />
          <span className={cn(
            "inline-flex items-center font-mono uppercase text-[9px] tracking-[0.12em] py-0.5 px-2 rounded-[4px] border",
            cfg.bgClass, cfg.labelClass
          )}>
            {cfg.label}
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onClose} variant="ghost" size="icon-sm" className="text-text-faint">
              <X className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Close</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-col gap-5 p-5 overflow-y-auto">
        <div>
          <SectionLabel>Assumption</SectionLabel>
          <p className="font-serif text-foreground text-[15px] leading-[1.5] mt-[6px]">
            {node.claim}
          </p>
        </div>

        <span className={cn("font-mono uppercase text-[8.5px] tracking-[0.12em]", AGENT_CLASS[node.agentSource] ?? "text-text-faint")}>
          Raised by {AGENT_NAME[node.agentSource] ?? node.agentSource}
        </span>

        <div>
          <SectionLabel>Why this status</SectionLabel>
          <p className="text-text-muted text-[13px] leading-[1.55] mt-[6px]">
            {node.explanation}
          </p>
        </div>

        {node.howToTest && (
          <div className="bg-[rgba(194,105,42,0.07)] border border-[rgba(194,105,42,0.24)] rounded-[9px] py-[12px] px-[14px]">
            <p className="font-mono uppercase mb-2 text-agent-skeptic text-[8px] tracking-[0.13em]">
              How to test this
            </p>
            <p className="text-foreground text-[12.5px] leading-[1.5]">
              {node.howToTest}
            </p>
          </div>
        )}

        <p className="font-serif italic text-text-faint border-t border-border text-[11.5px] leading-[1.5] pt-[14px]">
          This status was AI-inferred from only what you told us. Verify before trusting it.
        </p>

        {node.remediation && (
          <div className="bg-[rgba(74,124,89,0.08)] border border-[rgba(111,163,126,0.25)] rounded-[9px] p-[12px_14px]">
            <p className="font-mono uppercase text-agent-operator" style={{ fontSize: "8px", letterSpacing: "0.12em" }}>
              You acted · AI re-reviewed → {cfg.label}
            </p>
            <p className="text-text-muted" style={{ fontSize: "11.5px", lineHeight: 1.5, marginTop: "6px" }}>
              This status changed because you added information — not on its own. Verify before trusting it; you can refine it again below or remove it.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-5">
          <Separator className="bg-border" />
          <div>
            <SectionLabel>{node.remediation ? "Refine this further" : "What do you want to do?"}</SectionLabel>
            <div className="flex flex-col gap-2 mt-3">
              {(["VALIDATE", "MODIFY", "REMOVE"] as const).map((a) => (
                <Button
                  key={a}
                  onClick={() => setAction(action === a ? null : a)}
                  variant={action === a ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "w-full justify-start font-mono uppercase text-[9px] tracking-[0.1em] rounded-[7px] h-auto py-2 px-3",
                    action === a ? "text-foreground" : "text-text-dim"
                  )}
                >
                  {a === "VALIDATE" ? validateLabel : a === "MODIFY" ? "Modify the claim" : "Remove this assumption"}
                </Button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {action === "VALIDATE" && (
                <motion.div key="v" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-3 mt-4">
                  <p className="text-text-faint" style={{ fontSize: "11px", lineHeight: 1.5 }}>
                    Tell the AI what you’ve learned and it will re-review this assumption — it may come back validated, unvalidated, or still needing info.
                  </p>
                  <FieldTextarea label="What did you do or learn?" value={howTested} onChange={setHowTested} placeholder="e.g. Interviewed 5 founders who have this problem…" />
                  <FieldTextarea label="What did that tell you?" value={whatFound} onChange={setWhatFound} placeholder="e.g. All 5 confirmed they spend 3+ hours a week on this…" />
                </motion.div>
              )}
              {action === "MODIFY" && (
                <motion.div key="m" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-3 mt-4">
                  <FieldTextarea label="Updated claim" value={modifiedClaim} onChange={setModifiedClaim} rows={3} />
                  <FieldTextarea label="Why change it? (optional)" value={note} onChange={setNote} placeholder="e.g. The real user is the ops manager, not the driver" />
                  <p className="text-text-faint" style={{ fontSize: "11px", lineHeight: 1.5 }}>
                    The AI will re-review the rewritten claim and set its status.
                  </p>
                </motion.div>
              )}
              {action === "REMOVE" && (
                <motion.div key="r" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id="confirm-remove"
                      checked={confirmRemove}
                      onCheckedChange={(c) => setConfirmRemove(c === true)}
                      className="mt-0.5 shrink-0 border-[#5a574f] data-checked:bg-[#c2692a] data-checked:border-[#c2692a]"
                    />
                    <label
                      htmlFor="confirm-remove"
                      className="cursor-pointer text-text-muted"
                      style={{ fontSize: "12px", lineHeight: 1.5 }}
                    >
                      This assumption will be excluded from your Launchpad brief.
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {action && (
              <Button
                onClick={() => void submit()}
                disabled={!canSubmit || submitting}
                className="w-full mt-4 gap-2"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {action === "REMOVE" ? "Confirm removal" : submitting ? "Re-reviewing…" : "Submit for re-review"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="eyebrow-sm">{children}</p>
);

const FieldTextarea = ({ label, value, onChange, placeholder, rows = 2 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) => (
  <div className="flex flex-col gap-1.5">
    <ShadcnLabel className="eyebrow-sm">{label}</ShadcnLabel>
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="bg-surface-2 border border-border-strong rounded-[7px] px-[10px] py-2 text-foreground text-[12.5px] leading-relaxed resize-y placeholder:text-text-faint focus-visible:border-text-faint focus-visible:ring-1 focus-visible:ring-text-faint/20 min-h-0"
    />
  </div>
);

// Keep AGENT_COLOR for any external references that may still need it
export { AGENT_COLOR };
