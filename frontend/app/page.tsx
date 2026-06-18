import Link from "next/link";
import { ArrowRight, Swords, Target, Lightbulb } from "lucide-react";

const agents = [
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

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 py-16 max-w-2xl mx-auto">
      {/* Mono eyebrow */}
      <div
        className="font-mono uppercase mb-10"
        style={{
          fontSize: "9.5px",
          letterSpacing: "0.18em",
          color: "#5a574f",
        }}
      >
        AI Hackathon 2026 &mdash; Challenge Brief 3
      </div>

      {/* Headline — Spectral italic for the main phrase */}
      <h1
        className="text-center mb-6"
        style={{ lineHeight: "1.08", letterSpacing: "-0.01em" }}
      >
        <span
          className="font-serif italic block"
          style={{ fontSize: "clamp(36px, 5vw, 52px)", color: "#ede9e0" }}
        >
          Stress-test your idea
        </span>
        <span
          className="font-sans font-light block"
          style={{ fontSize: "clamp(30px, 4vw, 44px)", color: "#5a574f" }}
        >
          before the market does.
        </span>
      </h1>

      {/* Sub-description */}
      <p
        className="text-center leading-relaxed mb-10 max-w-md"
        style={{ fontSize: "15px", color: "#9a958c" }}
      >
        Three AI agents debate your startup idea in real-time — surfacing hidden
        assumptions, market gaps, and execution risks. You decide what to do
        with it.
      </p>

      {/* Primary CTA */}
      <Link
        href="/war-room"
        className="inline-flex items-center gap-2.5 font-semibold group transition-colors"
        style={{
          background: "#ede9e0",
          color: "#131210",
          borderRadius: "9px",
          padding: "12px 22px",
          fontSize: "14.5px",
        }}
      >
        <Swords className="w-4 h-4" />
        Enter the War Room
        <ArrowRight
          className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
        />
      </Link>

      {/* Agent feature trio */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16 w-full">
        {agents.map(({ icon: Icon, role, label, desc, accentBase, accentText }) => (
          <div
            key={label}
            className="flex flex-col gap-3 rounded-[13px] transition-all"
            style={{
              padding: "18px 20px",
              background: `rgba(${hexToRgb(accentBase)}, 0.06)`,
              border: `1px solid rgba(${hexToRgb(accentBase)}, 0.28)`,
            }}
          >
            {/* Mono role verb */}
            <div
              className="font-mono uppercase"
              style={{
                fontSize: "9px",
                letterSpacing: "0.16em",
                color: accentText,
              }}
            >
              {role}
            </div>

            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 shrink-0" style={{ color: accentText }} />
              <p
                className="font-serif font-semibold leading-tight"
                style={{ fontSize: "15px", color: "#ede9e0" }}
              >
                {label}
              </p>
            </div>

            <p
              className="leading-relaxed"
              style={{ fontSize: "12.5px", color: "#7a7670" }}
            >
              {desc}
            </p>
          </div>
        ))}
      </div>

      {/* Responsible AI footnote */}
      <p
        className="font-mono text-center mt-12 max-w-md leading-relaxed uppercase"
        style={{
          fontSize: "8.5px",
          letterSpacing: "0.1em",
          color: "#5a574f",
        }}
      >
        FOUNDR surfaces information. The founder decides what to do with it.
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
