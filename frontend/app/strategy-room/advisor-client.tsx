"use client";

import { useState, useCallback } from "react";
import { BrainCircuit, FileText } from "lucide-react";
import { toast } from "sonner";
import { sendAdvisorMessage } from "@/actions/advisor";
import { MessageList } from "@/components/strategy-room/message-list";
import { MessageInput } from "@/components/strategy-room/message-input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AdvisorMessage, AdvisorDocument } from "@/lib/types";

interface Props {
  sessionId: string;
  ideaSummary: string;
  initialMessages: AdvisorMessage[];
  initialDocuments: AdvisorDocument[];
}

const DocsPlaceholder = () => (
  <div className="flex flex-col items-center justify-center h-full px-6 py-8 text-center">
    <FileText className="w-7 h-7 text-text-faint mb-3" />
    <p className="text-[13px] text-text-faint leading-relaxed">Documents will appear here</p>
  </div>
);

export const AdvisorClient = ({ sessionId, ideaSummary, initialMessages }: Props) => {
  const [messages, setMessages] = useState<AdvisorMessage[]>(initialMessages);
  const [sending, setSending] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);

  const handleSend = useCallback(
    async (content: string) => {
      const optimistic: AdvisorMessage = {
        id: crypto.randomUUID(),
        role: "USER",
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setSending(true);

      try {
        const { content: reply } = await sendAdvisorMessage(sessionId, content);
        const assistant: AdvisorMessage = {
          id: crypto.randomUUID(),
          role: "ASSISTANT",
          content: reply,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistant]);
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        toast.error("Could not reach the advisor — try again");
      } finally {
        setSending(false);
      }
    },
    [sessionId],
  );

  const truncated =
    ideaSummary.length > 80 ? `${ideaSummary.slice(0, 79).trimEnd()}…` : ideaSummary;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
        <BrainCircuit className="w-4 h-4 text-text-faint shrink-0" />
        <span className="font-mono uppercase text-[10px] tracking-[0.12em] text-text-dim shrink-0">
          Strategy Room
        </span>
        <span className="text-text-faint mx-0.5">·</span>
        <p className="font-serif italic text-[12.5px] text-text-muted truncate flex-1">
          {truncated}
        </p>
        {/* Mobile docs button — hidden on desktop */}
        <Button
          size="xs"
          variant="outline"
          className="md:hidden shrink-0 gap-1.5 rounded-[7px] text-[11px]"
          onClick={() => setDocsOpen(true)}
        >
          <FileText className="w-3 h-3" />
          Docs
        </Button>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Chat column */}
        <div className="flex flex-col flex-1 min-w-0">
          <MessageList messages={messages} sending={sending} />
          <MessageInput onSend={handleSend} disabled={sending} />
        </div>

        {/* Desktop docs aside — hidden on mobile */}
        <aside className="hidden md:flex flex-col w-[260px] shrink-0 border-l border-border bg-surface-1">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
            <FileText className="w-3.5 h-3.5 text-text-faint" />
            <span className="eyebrow-sm text-text-faint">Documents</span>
          </div>
          <DocsPlaceholder />
        </aside>
      </div>

      {/* Mobile Sheet for docs */}
      <Sheet open={docsOpen} onOpenChange={setDocsOpen}>
        <SheetContent side="right" className="w-[280px] p-0 flex flex-col">
          <SheetHeader className="border-b border-border pb-3">
            <SheetTitle className="flex items-center gap-2 text-[13px]">
              <FileText className="w-3.5 h-3.5 text-text-faint" />
              Documents
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1">
            <DocsPlaceholder />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
