import Link from "next/link";
import { ArrowRight, Swords, Target, Lightbulb, Mic } from "lucide-react";

const features = [
  {
    icon: Swords,
    role: "CHALLENGES",
    label: "War Room",
    desc: "Three AI agents debate your idea across three structured rounds — surfacing assumptions you didn't know you were making.",
    accentBase: "#c2692a",
    accentText: "#c2692a",
  },
  {
    icon: Target,
    role: "SURFACES",
    label: "Assumption Map",
    desc: "Every claim becomes a node — validated, unvalidated, or unknown. The map reads as a health snapshot before anyone clicks.",
    accentBase: "#3a5a8a",
    accentText: "#6f93c4",
  },
  {
    icon: Lightbulb,
    role: "GROUNDS",
    label: "Launchpad",
    desc: "Turn your map into action. Customer outreach, market research, and AI-drafted messaging — all calibrated to your idea.",
    accentBase: "#4a7c59",
    accentText: "#6fa37e",
  },
];

const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : "255, 255, 255";
};

const Home = async () => {
  const session = await auth0.getSession();

  if (session) {
    const firstName =
      ((session.user?.name as string | undefined) ?? "").split(" ")[0] || "there";

    return (
      <div className="max-w-2xl mx-auto px-8 py-14">
        <div className="mb-10">
          <p className="eyebrow font-mono mb-3">Dashboard</p>
          <h1
            className="font-serif italic text-[30px] leading-[1.1] text-foreground"
            style={{ marginBottom: "8px" }}
          >
            Welcome back, {firstName}.
          </h1>
          <p className="text-[14px] text-text-dim" style={{ lineHeight: 1.6 }}>
            Pick up where you left off, or stress-test a new idea.
          </p>
        </div>

        <Link
          href="/war-room"
          className="inline-flex items-center gap-2.5 font-semibold mb-12 bg-primary text-primary-foreground rounded-[9px] py-[11px] px-5 text-[14px] no-underline"
        >
          <Plus className="w-4 h-4" />
          New War Room session
        </Link>

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
    <div className="flex flex-col items-center justify-center min-h-screen px-8 py-16 max-w-2xl mx-auto">
      <div className="font-mono uppercase mb-10 text-[9.5px] tracking-[0.18em] text-text-faint">
        AI Hackathon 2026 &mdash; Challenge Brief 3
      </div>

      <h1
        className="text-center mb-6"
        style={{ lineHeight: "1.08", letterSpacing: "-0.01em" }}
      >
        <span
          className="font-serif italic block text-foreground"
          style={{ fontSize: "clamp(36px, 5vw, 52px)" }}
        >
          Stress-test your idea
        </span>
        <span
          className="font-sans font-light block text-text-faint"
          style={{ fontSize: "clamp(30px, 4vw, 44px)" }}
        >
          before the market does.
        </span>
      </h1>

      <p className="text-center leading-relaxed mb-10 max-w-md text-[15px] text-text-muted">
        Three AI agents debate your startup idea in real-time — surfacing hidden
        assumptions, market gaps, and execution risks. You decide what to do
        with it.
      </p>

      <a
        href="/auth/login"
        className="inline-flex items-center gap-2.5 font-semibold bg-primary text-primary-foreground rounded-[9px] py-3 px-[22px] text-[14.5px] no-underline"
      >
        <Swords className="w-4 h-4" />
        Enter the War Room
        <ArrowRight
          className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
        />
      </Link>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-16 w-full">
        {features.map(({ icon: Icon, role, label, desc, accentBase, accentText }) => (
          <div
            key={label}
            className="flex flex-col gap-3 rounded-[13px]"
            style={{
              padding: "18px 20px",
              background: `rgba(${hexToRgb(accentBase)}, 0.06)`,
              border: `1px solid rgba(${hexToRgb(accentBase)}, 0.28)`,
            }}
          >
            <div
              className="font-mono uppercase text-[9px] tracking-[0.16em]"
              style={{ color: accentText }}
            >
              {role}
            </div>
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 shrink-0" style={{ color: accentText }} />
              <p className="font-serif font-semibold leading-tight text-[15px] text-foreground">
                {label}
              </p>
            </div>
            <p className="leading-relaxed text-[12.5px] text-text-dim">
              {desc}
            </p>
          </div>
        ))}
      </div>

      <p className="eyebrow font-mono text-center mt-12 max-w-md leading-relaxed text-[8.5px] tracking-[0.1em]">
        Launchify surfaces information. The founder decides what to do with it.
        This analysis does not replace talking to real customers.
      </p>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : "255, 255, 255";
}
