import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { LaunchpadClient } from "@/components/launchpad/LaunchpadClient";

export default function LaunchpadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-4">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#c2692a" }} />
          <p className="font-mono uppercase" style={{ fontSize: "9px", letterSpacing: "0.16em", color: "#5a574f" }}>
            Loading…
          </p>
        </div>
      }
    >
      <LaunchpadClient />
    </Suspense>
  );
}
