import type { Metadata } from "next";
import { Swords, LogIn } from "lucide-react";
import { auth0 } from "@/lib/auth0";
import { Questionnaire } from "@/components/war-room/questionnaire";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "War Room",
  description: "Stress-test your startup idea against three AI advisors in a structured debate. Surface hidden assumptions before you ship.",
  robots: { index: true, follow: true },
};

const WarRoomPage = async () => {
  const session = await auth0.getSession();

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-8 py-16 text-center">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl mb-6 bg-[rgba(194,105,42,0.10)] border border-[rgba(194,105,42,0.30)]">
          <Swords className="w-6 h-6 text-agent-skeptic" />
        </div>

        <h1 className="font-serif italic mb-3 text-[30px] text-foreground">
          Enter the War Room
        </h1>
        <p className="leading-relaxed mb-8 text-[15px] text-text-muted max-w-[26rem]">
          Sign in to stress-test your idea against three AI advisors and save your
          assumption map.
        </p>

        <Button size="lg" className="text-[14.5px] rounded-[9px]" asChild>
          <a href="/auth/login">
            <LogIn className="w-4 h-4" />
            Sign in to continue
          </a>
        </Button>
      </div>
    );
  }

  return <Questionnaire />;
};
export default WarRoomPage;
