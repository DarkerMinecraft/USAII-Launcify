"use client";

import Link from "next/link";
import { BrainCircuit } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Session {
  id: string;
  ideaSummary: string;
  status: "IN_PROGRESS" | "COMPLETE";
  createdAt: string;
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export const SessionPicker = ({ sessions }: { sessions: Session[] }) => {
  if (sessions.length === 0) {
    return (
      <div className="py-12 text-center">
        <BrainCircuit className="w-8 h-8 text-text-faint mx-auto mb-4" />
        <p className="font-serif italic text-[16px] text-text-faint mb-2">No sessions yet.</p>
        <p className="text-[13px] text-text-faint mb-6">
          Complete a War Room session to open the Strategy Room.
        </p>
        <Button asChild>
          <Link href="/war-room">Go to War Room</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {sessions.map((s) => (
        <Card
          key={s.id}
          className="bg-surface-1 rounded-[11px] shadow-none ring-0 border-border gap-0 py-0 overflow-hidden"
        >
          <div className="flex items-center gap-4 px-4 py-3.5">
            <div className="flex-1 min-w-0">
              <p className="font-serif italic text-[14px] text-foreground leading-[1.35]">
                {truncate(s.ideaSummary, 90)}
              </p>
              <p className="eyebrow-sm mt-1">{formatDate(s.createdAt)}</p>
            </div>
            <Button size="sm" className="shrink-0 gap-1.5 rounded-[8px]" asChild>
              <Link href={`/strategy-room?sessionId=${s.id}`}>
                <BrainCircuit className="w-3.5 h-3.5" />
                Open
              </Link>
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};
