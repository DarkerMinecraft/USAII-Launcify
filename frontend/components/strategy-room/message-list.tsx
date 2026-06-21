"use client";

import { useEffect, useRef } from "react";
import { BrainCircuit, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdvisorMessage } from "@/lib/types";

export const MessageList = ({
  messages,
  sending,
}: {
  messages: AdvisorMessage[];
  sending: boolean;
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  if (messages.length === 0 && !sending) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <BrainCircuit className="w-8 h-8 text-text-faint mb-4" />
        <p className="font-serif italic text-[15px] text-text-faint leading-relaxed max-w-sm">
          Ask me anything about your idea. I&apos;ve read your War Room canvas and any documents you
          upload.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
      {messages.map((m) =>
        m.role === "ASSISTANT" ? (
          <div key={m.id} className="flex gap-3 max-w-[80%]">
            <div className="shrink-0 w-6 h-6 rounded-full bg-surface-3 border border-border flex items-center justify-center mt-0.5">
              <BrainCircuit className="w-3 h-3 text-text-faint" />
            </div>
            <div className="bg-surface-2 border border-border rounded-[11px] px-4 py-3 text-[13.5px] text-foreground leading-relaxed whitespace-pre-wrap">
              {m.content}
            </div>
          </div>
        ) : (
          <div key={m.id} className="flex justify-end">
            <div
              className={cn(
                "bg-surface-3 border border-border rounded-[11px] px-4 py-3",
                "text-[13.5px] text-foreground leading-relaxed max-w-[80%] whitespace-pre-wrap",
              )}
            >
              {m.content}
            </div>
          </div>
        ),
      )}
      {sending && (
        <div className="flex gap-3 max-w-[80%]">
          <div className="shrink-0 w-6 h-6 rounded-full bg-surface-3 border border-border flex items-center justify-center mt-0.5">
            <BrainCircuit className="w-3 h-3 text-text-faint" />
          </div>
          <div className="bg-surface-2 border border-border rounded-[11px] px-4 py-3">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-text-faint" />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
};
