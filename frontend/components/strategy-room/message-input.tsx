"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const MessageInput = ({
  onSend,
  disabled,
}: {
  onSend: (content: string) => void;
  disabled: boolean;
}) => {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  return (
    <div className="shrink-0 border-t border-border px-4 py-3 bg-background">
      <div className="flex items-end gap-2 bg-surface-1 border border-border rounded-[11px] px-3 py-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Type your message…"
          rows={1}
          disabled={disabled}
          className={cn(
            "flex-1 resize-none bg-transparent text-[13.5px] text-foreground placeholder:text-text-faint outline-none leading-relaxed py-0.5 min-h-[24px] max-h-[180px]",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        />
        <Button
          size="icon-sm"
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="shrink-0 rounded-[7px]"
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
      <p className="eyebrow-sm text-text-faint mt-1.5 px-1">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
};
