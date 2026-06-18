import { Rocket, Lock } from "lucide-react";

const sections = [
  { label: "Customer Connect", mono: "OUTREACH" },
  { label: "Agent Workspace", mono: "RESEARCH" },
  { label: "Resource Hub", mono: "EXPORT" },
];

export default function LaunchpadPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 py-16 text-center">
      {/* Icon tile */}
      <div
        className="flex items-center justify-center w-14 h-14 mb-6"
        style={{
          background: "rgba(74,124,89,0.08)",
          border: "1px solid rgba(111,163,126,0.3)",
          borderRadius: "14px",
        }}
      >
        <Rocket className="w-6 h-6" style={{ color: "#6fa37e" }} />
      </div>

      {/* Lock badge */}
      <div
        className="inline-flex items-center gap-1.5 mb-5 font-mono uppercase"
        style={{
          padding: "4px 10px",
          borderRadius: "5px",
          border: "1px solid rgba(111,163,126,0.25)",
          background: "rgba(74,124,89,0.06)",
          fontSize: "9px",
          letterSpacing: "0.12em",
          color: "#6fa37e",
        }}
      >
        <Lock className="w-2.5 h-2.5" />
        Available after the War Room
      </div>

      <h1
        className="font-serif font-semibold mb-3"
        style={{ fontSize: "28px", color: "#ede9e0", letterSpacing: "-0.005em" }}
      >
        Launchpad
      </h1>
      <p
        className="leading-relaxed max-w-md"
        style={{ fontSize: "15px", color: "#9a958c" }}
      >
        Where founders stop thinking and start doing. Customer outreach, market
        research, and AI-drafted messaging — all calibrated to your specific idea.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-10 max-w-lg w-full">
        {sections.map(({ label, mono }) => (
          <div
            key={label}
            className="rounded-[11px] opacity-40"
            style={{
              padding: "13px 15px",
              background: "#15140f",
              border: "1px solid #2e2c28",
            }}
          >
            <p
              className="font-mono uppercase mb-1"
              style={{ fontSize: "8.5px", letterSpacing: "0.14em", color: "#5a574f" }}
            >
              {mono}
            </p>
            <p className="font-medium" style={{ fontSize: "13px", color: "#ede9e0" }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      <p
        className="font-mono uppercase mt-8 max-w-sm leading-relaxed"
        style={{ fontSize: "8.5px", letterSpacing: "0.1em", color: "#5a574f" }}
      >
        Complete the War Room to unlock your personalized Launchpad.
      </p>
    </div>
  );
}
