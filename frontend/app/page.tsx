import Link from "next/link";
import { Plus, Swords, Target, Lightbulb, ArrowRight } from "lucide-react";
import { auth0 } from "@/lib/auth0";
import { getProfile } from "@/actions/profile";
import { LandingPage } from "@/components/landing/landing-page";
import { SessionList } from "@/components/home/session-list";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const pillars = [
  {
    icon: Swords,
    label: "War Room",
    desc: "Three AI advisors debate your idea across three rounds — surfacing assumptions you didn't know you were making.",
    href: "/war-room",
    accentClass: "text-agent-skeptic",
    bgClass: "bg-[rgba(194,105,42,0.06)] border-[rgba(194,105,42,0.22)]",
    dotClass: "bg-agent-skeptic shadow-[0_0_8px_var(--agent-skeptic)]",
  },
  {
    icon: Target,
    label: "Launchpad",
    desc: "Turn your assumption map into action. Outreach drafts, executive summary, validation roadmap — all calibrated to your idea.",
    href: "/launchpad",
    accentClass: "text-agent-operator",
    bgClass: "bg-[rgba(74,124,89,0.06)] border-[rgba(74,124,89,0.22)]",
    dotClass: "bg-agent-operator shadow-[0_0_8px_var(--agent-operator)]",
  },
  {
    icon: Lightbulb,
    label: "Strategy Room",
    desc: "An AI advisor that knows your full canvas. Ask anything about your idea, market, or next move.",
    href: "/strategy-room",
    accentClass: "text-agent-strategist",
    bgClass: "bg-[rgba(58,90,138,0.06)] border-[rgba(58,90,138,0.22)]",
    dotClass: "bg-agent-strategist shadow-[0_0_8px_var(--agent-strategist)]",
  },
];

const Home = async () => {
  const session = await auth0.getSession();

  if (!session) {
    return <LandingPage />;
  }

  const dbProfile = await getProfile();
  const email = (session.user?.email as string | undefined) ?? "";
  const resolvedName = dbProfile?.name || (() => {
    const rawName = (session.user?.name as string | undefined) ?? "";
    const nameIsEmail = rawName === email || rawName.includes("@");
    return nameIsEmail ? "" : rawName;
  })();
  const firstName = resolvedName
    ? resolvedName.split(" ")[0]
    : (email.split("@")[0]?.split(/[._-]/)[0] || "there");

  return (
    <div className="min-h-screen bg-background">
      {/* Hero / greeting */}
      <div className="border-b border-border px-5 sm:px-10 py-8 sm:py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          <p className="eyebrow font-mono mb-3">Dashboard</p>
          <h1 className="font-serif italic text-[28px] sm:text-[36px] leading-[1.1] text-foreground mb-3">
            Welcome back, {firstName}.
          </h1>
          <p className="text-[14px] text-text-dim leading-[1.6] mb-6 sm:mb-8 max-w-[26rem]">
            Pick up where you left off, or stress-test a new idea.
          </p>
          <Button className="gap-2 rounded-[9px] text-[14px] w-full sm:w-auto" asChild>
            <Link href="/war-room">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New War Room session
            </Link>
          </Button>
        </div>
      </div>

      <div className="px-5 sm:px-10 py-7 sm:py-10 max-w-3xl mx-auto">
        {/* Pillars */}
        <div className="mb-10 sm:mb-12">
          <p className="eyebrow mb-4">Pillars</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {pillars.map(({ icon: Icon, label, desc, href, accentClass, bgClass, dotClass }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group flex flex-col gap-3 p-4 rounded-[11px] border transition-colors duration-150 no-underline",
                  bgClass
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className={cn("w-[7px] h-[7px] rounded-full shrink-0", dotClass)} />
                  <span className={cn("font-mono uppercase text-[9px] tracking-[0.14em]", accentClass)}>
                    {label}
                  </span>
                  <ArrowRight className="w-3 h-3 text-text-faint ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-text-dim text-[12.5px] leading-[1.55]">{desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Session list */}
        <div>
          <p className="eyebrow mb-4">Your Sessions</p>
          <SessionList />
        </div>

        <p className="eyebrow mt-10 sm:mt-14 text-center text-[8.5px] text-[#3a3833] leading-relaxed">
          Launchify surfaces information. The founder decides what to do with it.
        </p>
      </div>
    </div>
  );
};

export default Home;
