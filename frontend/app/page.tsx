import Link from "next/link";
import { LogIn, Plus, Swords, Target, Lightbulb } from "lucide-react";
import { auth0 } from "@/lib/auth0";
import { SessionList } from "@/components/home/session-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const pillars = [
  {
    icon: Swords,
    role: "CHALLENGES",
    label: "War Room",
    desc: "Three AI agents debate your idea across three structured rounds — surfacing assumptions you didn't know you were making.",
    cardClass: "bg-[rgba(194,105,42,0.06)] border-[rgba(194,105,42,0.28)]",
    accentClass: "text-[#c2692a]",
  },
  {
    icon: Target,
    role: "SURFACES",
    label: "Assumption Map",
    desc: "Every claim becomes a node — validated, unvalidated, or unknown. The map reads as a health snapshot before anyone clicks.",
    cardClass: "bg-[rgba(58,90,138,0.06)] border-[rgba(58,90,138,0.28)]",
    accentClass: "text-[#6f93c4]",
  },
  {
    icon: Lightbulb,
    role: "GROUNDS",
    label: "Launchpad",
    desc: "Turn your map into action. Customer outreach, executive summary, and AI-drafted messaging — all calibrated to your idea.",
    cardClass: "bg-[rgba(74,124,89,0.06)] border-[rgba(74,124,89,0.28)]",
    accentClass: "text-[#6fa37e]",
  },
];

const Home = async () => {
  const session = await auth0.getSession();

  if (session) {
    const firstName =
      ((session.user?.name as string | undefined) ?? "").split(" ")[0] || "there";

    return (
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8 sm:py-14">
        <div className="mb-10">
          <p className="eyebrow font-mono mb-3">Dashboard</p>
          <h1 className="font-serif italic text-[30px] leading-[1.1] text-foreground mb-2">
            Welcome back, {firstName}.
          </h1>
          <p className="text-[14px] text-text-dim leading-[1.6]">
            Pick up where you left off, or stress-test a new idea.
          </p>
        </div>

        <Button className="mb-12 text-[14px] rounded-[9px]" asChild>
          <Link href="/war-room">
            <Plus className="w-4 h-4" />
            New War Room session
          </Link>
        </Button>

        <div>
          <p className="eyebrow font-mono mb-4">Your Sessions</p>
          <SessionList />
        </div>

        <p className="eyebrow font-mono text-center mt-14 leading-relaxed text-[8.5px] text-[#3a3833]">
          Launchify surfaces information. The founder decides what to do with it.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-5 sm:px-8 py-10 sm:py-16 max-w-2xl mx-auto">
      <div className="font-mono uppercase mb-10 text-[9.5px] tracking-[0.18em] text-text-faint">
        AI Hackathon 2026 &mdash; Challenge Brief 3
      </div>

      <h1 className="text-center mb-6 leading-[1.08] tracking-[-0.01em]">
        <span className="font-serif italic block text-foreground text-[clamp(36px,5vw,52px)]">
          Stress-test your idea
        </span>
        <span className="font-sans font-light block text-text-faint text-[clamp(30px,4vw,44px)]">
          before the market does.
        </span>
      </h1>

      <p className="text-center leading-relaxed mb-10 max-w-md text-[15px] text-text-muted">
        Three AI agents debate your startup idea in real-time — surfacing hidden
        assumptions, market gaps, and execution risks. You decide what to do with it.
      </p>

      <Button size="lg" className="text-[14.5px] rounded-[9px]" asChild>
        <a href="/auth/login">
          <LogIn className="w-4 h-4" />
          Sign in to begin
        </a>
      </Button>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16 w-full">
        {pillars.map(({ icon: Icon, role, label, desc, cardClass, accentClass }) => (
          <Card
            key={label}
            className={cn("gap-3 rounded-[13px] py-[18px] px-5 shadow-none ring-0", cardClass)}
          >
            <div className={cn("font-mono uppercase text-[9px] tracking-[0.16em]", accentClass)}>
              {role}
            </div>
            <div className="flex items-center gap-2">
              <Icon className={cn("w-4 h-4 shrink-0", accentClass)} />
              <p className="font-serif font-semibold leading-tight text-[15px] text-foreground">
                {label}
              </p>
            </div>
            <p className="leading-relaxed text-[12.5px] text-text-dim">
              {desc}
            </p>
          </Card>
        ))}
      </div>

      <p className="eyebrow font-mono text-center mt-12 max-w-md leading-relaxed text-[8.5px] tracking-[0.1em]">
        Launchify surfaces information. The founder decides what to do with it.
        This analysis does not replace talking to real customers.
      </p>
    </div>
  );
};

export default Home;
