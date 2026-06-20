"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, AlertTriangle, CheckCircle, Clock } from "lucide-react";

interface Session {
  id: string;
  ideaSummary: string;
  status: "IN_PROGRESS" | "COMPLETE";
  createdAt: string;
}

const STATUS_CFG = {
  COMPLETE: {
    label: "Complete",
    color: "#6fa37e",
    bg: "rgba(74,124,89,0.09)",
    border: "rgba(111,163,126,0.3)",
    Icon: CheckCircle,
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "#c2692a",
    bg: "rgba(194,105,42,0.09)",
    border: "rgba(194,105,42,0.3)",
    Icon: Clock,
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

  useEffect(() => {
    fetch("/api/sessions")
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.error ?? "Could not load sessions");
        setSessions(Array.isArray(data) ? data : []);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load sessions"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-10">
        <Loader2 className="h-4 w-4 animate-spin" style={{ color: "#c2692a" }} />
        <p className="font-mono uppercase" style={{ fontSize: "9px", letterSpacing: "0.16em", color: "#5a574f" }}>
          Loading sessions…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 py-10">
        <AlertTriangle className="h-4 w-4" style={{ color: "#c2692a" }} />
        <p style={{ fontSize: "13px", color: "#9a958c" }}>{error}</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="py-10">
        <p className="font-serif italic" style={{ fontSize: "15px", color: "#5a574f", marginBottom: "6px" }}>
          No sessions yet.
        </p>
        <p style={{ fontSize: "13px", color: "#5a574f" }}>
          Start your first War Room session to build your assumption map.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {sessions.map((s, i) => {
        const cfg = STATUS_CFG[s.status];
        const { Icon } = cfg;
        return (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.05 }}
          >
            <Link
              href={`/war-room/session/${s.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "14px 18px",
                background: "#131210",
                border: "1px solid #2e2c28",
                borderRadius: "11px",
                textDecoration: "none",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "#38332b"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "#2e2c28"; }}
            >
              <div className="flex-1 min-w-0">
                <p className="font-serif italic" style={{ fontSize: "14px", color: "#ede9e0", lineHeight: 1.35 }}>
                  {truncate(s.ideaSummary, 90)}
                </p>
                <p className="font-mono uppercase mt-1" style={{ fontSize: "8.5px", letterSpacing: "0.1em", color: "#5a574f" }}>
                  {formatDate(s.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div
                  className="flex items-center gap-1.5 font-mono uppercase"
                  style={{
                    padding: "3px 8px", borderRadius: "4px",
                    background: cfg.bg, border: `1px solid ${cfg.border}`,
                    fontSize: "8px", letterSpacing: "0.1em", color: cfg.color,
                  }}
                >
                  <Icon style={{ width: "9px", height: "9px" }} />
                  {cfg.label}
                </div>
                <ArrowRight className="w-3.5 h-3.5" style={{ color: "#5a574f" }} />
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
};
