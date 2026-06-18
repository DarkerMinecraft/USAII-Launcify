import { Mic, Lock } from "lucide-react";

export default function PitchCoachPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 py-16 text-center">
      {/* Icon tile */}
      <div
        className="flex items-center justify-center w-14 h-14 mb-6"
        style={{
          background: "rgba(58,90,138,0.08)",
          border: "1px solid rgba(111,147,196,0.3)",
          borderRadius: "14px",
        }}
      >
        <Mic className="w-6 h-6" style={{ color: "#6f93c4" }} />
      </div>

      {/* Lock badge */}
      <div
        className="inline-flex items-center gap-1.5 mb-5 font-mono uppercase"
        style={{
          padding: "4px 10px",
          borderRadius: "5px",
          border: "1px solid rgba(111,147,196,0.25)",
          background: "rgba(58,90,138,0.06)",
          fontSize: "9px",
          letterSpacing: "0.12em",
          color: "#6f93c4",
        }}
      >
        <Lock className="w-2.5 h-2.5" />
        UI shell only — post-hackathon
      </div>

      <h1
        className="font-serif font-semibold mb-3"
        style={{ fontSize: "28px", color: "#ede9e0", letterSpacing: "-0.005em" }}
      >
        Pitch Coach
      </h1>
      <p
        className="leading-relaxed max-w-md"
        style={{ fontSize: "15px", color: "#9a958c" }}
      >
        Practice your investor pitch and get structured feedback on pacing,
        clarity, and filler words. Powered by Gemini multimodal.
      </p>

      {/* Skeleton placeholder */}
      <div
        className="mt-10 max-w-sm w-full opacity-30 rounded-[13px]"
        style={{
          padding: "18px 20px",
          background: "#15140f",
          border: "1px solid #2e2c28",
        }}
      >
        <div
          className="w-full h-1.5 rounded-full mb-3"
          style={{ background: "#2e2c28" }}
        />
        <div
          className="w-3/4 h-1.5 rounded-full mb-3"
          style={{ background: "#2e2c28" }}
        />
        <div
          className="w-1/2 h-1.5 rounded-full"
          style={{ background: "#2e2c28" }}
        />
      </div>

      <p
        className="font-mono uppercase mt-8 max-w-sm leading-relaxed"
        style={{ fontSize: "8.5px", letterSpacing: "0.1em", color: "#5a574f" }}
      >
        Will analyze verbal pitches and flag when your delivery contradicts
        unvalidated assumptions from the War Room.
      </p>
    </div>
  );
}
