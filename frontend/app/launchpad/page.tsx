import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Launchpad",
  description: "Turn your War Room insights into action. Generate customer outreach, an executive summary, validation roadmap, and market research tailored to your idea.",
  robots: { index: false, follow: false },
};
import { Loader2 } from "lucide-react";
import { LaunchpadClient } from "@/components/launchpad/launchpad-client";

const LaunchpadPage = () => (
  <Suspense
    fallback={
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="h-5 w-5 animate-spin text-agent-skeptic" />
        <p className="font-mono uppercase text-[9px] tracking-[0.16em] text-text-faint">
          Loading…
        </p>
      </div>
    }
  >
    <LaunchpadClient />
  </Suspense>
);
export default LaunchpadPage;
