"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Loader2, AlertTriangle, CheckCircle, Clock,
  Trash2, Target, X, BrainCircuit,
} from "lucide-react";
import { listSessions, deleteSession } from "@/actions/sessions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Session {
  id: string;
  ideaSummary: string;
  status: "IN_PROGRESS" | "COMPLETE";
  createdAt: string;
  updatedAt: string;
}

const STATUS_CFG = {
  COMPLETE: {
    label: "Complete",
    Icon: CheckCircle,
    badgeClass: "bg-[rgba(74,124,89,0.09)] border-[rgba(111,163,126,0.3)] text-agent-operator",
  },
  IN_PROGRESS: {
    label: "In Progress",
    Icon: Clock,
    badgeClass: "bg-[rgba(194,105,42,0.09)] border-[rgba(194,105,42,0.3)] text-agent-skeptic",
  },
} as const;

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const truncate = (s: string, n: number): string =>
  s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;

export const SessionList = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    listSessions()
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load sessions"))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(id);
    setConfirmDelete(null);
    try {
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // surface nothing — the card stays; user can retry
    } finally {
      setDeleting(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-10">
        <Loader2 className="h-4 w-4 animate-spin text-agent-skeptic" />
        <p className="eyebrow">
          Loading sessions…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 py-10">
        <AlertTriangle className="h-4 w-4 text-agent-skeptic" />
        <p className="text-[13px] text-text-muted">{error}</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="py-10">
        <p className="font-serif italic text-[15px] text-text-faint mb-[6px]">
          No sessions yet.
        </p>
        <p className="text-[13px] text-text-faint">
          Start your first War Room session to build your assumption map.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {sessions.map((s, i) => {
          const cfg = STATUS_CFG[s.status];
          const { Icon } = cfg;
          const isDeleting = deleting === s.id;
          const isConfirming = confirmDelete === s.id;

          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: isDeleting ? 0.4 : 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: "hidden" }}
              transition={{ duration: 0.22, delay: i * 0.04 }}
              className="relative"
            >
              <Card
                className={cn(
                  "bg-surface-1 rounded-[11px] shadow-none ring-0 overflow-hidden transition-colors duration-[150ms] gap-0 py-0",
                  isConfirming ? "border-[rgba(194,105,42,0.45)]" : "border-border"
                )}
              >
                {/* Main row */}
                <div className="flex items-center gap-4 px-4 py-3.5">
                  <Link
                    href={`/war-room/session/${s.id}`}
                    className="flex-1 min-w-0 no-underline"
                  >
                    <p className="font-serif italic text-[14px] text-foreground leading-[1.35]">
                      {truncate(s.ideaSummary, 90)}
                    </p>
                    <p className="eyebrow-sm mt-1">
                      {formatDate(s.createdAt)}
                    </p>
                  </Link>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("inline-flex items-center gap-1.5 font-mono uppercase text-[8px] tracking-[0.1em] py-[3px] px-2 rounded-[4px] border", cfg.badgeClass)}>
                      <Icon className="w-[9px] h-[9px]" />
                      {cfg.label}
                    </span>

                    {s.status === "COMPLETE" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Open Launchpad"
                            className="text-agent-operator bg-[rgba(74,124,89,0.1)] border border-[rgba(111,163,126,0.25)] hover:bg-[rgba(74,124,89,0.2)] hover:border-[rgba(111,163,126,0.5)]"
                            asChild
                          >
                            <Link href={`/launchpad?sessionId=${s.id}`}>
                              <Target className="w-[11px] h-[11px]" aria-hidden="true" />
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Open Launchpad</TooltipContent>
                      </Tooltip>
                    )}

                    {s.status === "COMPLETE" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Open Strategy Room"
                            className="text-agent-strategist bg-[rgba(111,147,193,0.1)] border border-[rgba(111,147,193,0.25)] hover:bg-[rgba(111,147,193,0.2)] hover:border-[rgba(111,147,193,0.5)]"
                            asChild
                          >
                            <Link href={`/strategy-room?sessionId=${s.id}`}>
                              <BrainCircuit className="w-[11px] h-[11px]" aria-hidden="true" />
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Open Strategy Room</TooltipContent>
                      </Tooltip>
                    )}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="Continue session" className="text-text-faint" asChild>
                          <Link href={`/war-room/session/${s.id}`}>
                            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Continue session</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => setConfirmDelete(isConfirming ? null : s.id)}
                          disabled={isDeleting}
                          aria-label={isConfirming ? "Cancel delete" : "Delete session"}
                          variant="ghost"
                          size="icon-sm"
                          className={cn(
                            "transition-all",
                            isConfirming
                              ? "text-agent-skeptic bg-[rgba(194,105,42,0.12)] border border-[rgba(194,105,42,0.4)]"
                              : "text-text-faint"
                          )}
                        >
                          {isDeleting
                            ? <Loader2 className="w-[11px] h-[11px] animate-spin" aria-hidden="true" />
                            : isConfirming
                              ? <X className="w-[11px] h-[11px]" aria-hidden="true" />
                              : <Trash2 className="w-[11px] h-[11px]" aria-hidden="true" />
                          }
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{isConfirming ? "Cancel" : "Delete session"}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* Confirm delete strip */}
                <AnimatePresence>
                  {isConfirming && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="border-t border-agent-skeptic/25 overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <p className="eyebrow-sm text-text-muted">
                          Delete this session? This cannot be undone.
                        </p>
                        <Button
                          onClick={() => void handleDelete(s.id)}
                          variant="ghost"
                          size="xs"
                          className="font-mono uppercase text-[8.5px] tracking-[0.1em] text-agent-skeptic shrink-0"
                        >
                          Confirm delete
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
