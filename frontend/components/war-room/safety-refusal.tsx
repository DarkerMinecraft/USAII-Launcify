"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SafetyBlockResult } from "@/lib/types";

const SafetyContent = ({
  block,
  note,
}: {
  block: SafetyBlockResult;
  note: string;
}) => (
  <>
    <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[rgba(194,105,42,0.45)] bg-[rgba(194,105,42,0.10)] text-agent-skeptic">
      <ShieldAlert className="h-5 w-5" aria-hidden="true" />
    </div>
    <p className="eyebrow mt-6 font-mono text-agent-skeptic">Content safety guardrail</p>
    <h2
      id="safety-refusal-title"
      className="mt-3 font-serif text-[26px] font-semibold italic leading-[1.1] text-foreground"
    >
      This idea can&apos;t enter the room.
    </h2>
    <p className="mt-4 text-[14px] leading-[1.65] text-text-soft">{block.reason}</p>
    <p className="mt-4 border-t border-hairline pt-4 font-mono text-[8.5px] uppercase leading-[1.6] tracking-[0.1em] text-text-faint">
      {note}
    </p>
  </>
);

export function SafetyBlockDialog({
  block,
  onDismiss,
}: {
  block: SafetyBlockResult;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(5,5,4,0.78)] px-5 py-10 backdrop-blur-sm"
    >
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="safety-refusal-title"
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.99 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className="w-full max-w-[480px] rounded-[14px] border border-border-strong bg-surface-2 p-6 shadow-[0_28px_80px_-30px_rgba(0,0,0,0.95)] sm:p-8"
      >
        <SafetyContent
          block={block}
          note="No questions were generated and no War Room session was created."
        />
        <Button
          autoFocus
          onClick={onDismiss}
          className="btn-primary mt-7 w-full justify-center sm:w-auto"
        >
          Submit a different idea
        </Button>
      </motion.div>
    </motion.div>
  );
}

export function SafetyBlockCard({ block }: { block: SafetyBlockResult }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-[520px] rounded-[14px] border border-border-strong bg-surface-2 p-7 shadow-[0_28px_80px_-30px_rgba(0,0,0,0.95)] sm:p-9">
        <SafetyContent
          block={block}
          note="The safety check stopped this session before any advisor response was generated."
        />
        <Button asChild className="btn-primary mt-7">
          <Link href="/war-room">Try a different idea</Link>
        </Button>
      </div>
    </div>
  );
}
