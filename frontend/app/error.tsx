"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const ErrorPage = ({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) => {
  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-5 px-8 text-center">
      <AlertTriangle className="h-6 w-6 text-agent-skeptic" />
      <p className="font-serif italic text-[22px] text-foreground">Something went wrong.</p>
      <p className="text-[14px] text-text-muted max-w-sm leading-relaxed">
        An unexpected error occurred. Try refreshing the page or heading back home.
      </p>
      <Button onClick={reset} className="mt-2">Try again</Button>
    </div>
  );
};

export default ErrorPage;
