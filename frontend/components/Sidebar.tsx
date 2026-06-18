"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Swords, Rocket, Mic, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const pillars = [
  {
    label: "War Room",
    href: "/war-room",
    icon: Swords,
    locked: false,
    description: "Challenge your idea",
    accentColor: "#c2692a",
  },
  {
    label: "Launchpad",
    href: "/launchpad",
    icon: Rocket,
    locked: true,
    description: "Connect & execute",
    accentColor: "#6fa37e",
  },
  {
    label: "Pitch Coach",
    href: "/pitch-coach",
    icon: Mic,
    locked: true,
    description: "Practice & perform",
    accentColor: "#6f93c4",
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col w-[232px] shrink-0 h-screen sticky top-0"
      style={{
        background: "#131210",
        borderRight: "1px solid #2e2c28",
      }}
    >
      {/* Logo */}
      <div
        className="px-5 py-6"
        style={{ borderBottom: "1px solid #1f1e1b" }}
      >
        <Link href="/" className="flex items-center gap-3 group">
          {/* White tile with dark serif "F" */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-serif font-bold text-base"
            style={{
              background: "#ede9e0",
              color: "#131210",
              boxShadow: "0 4px 12px -4px rgba(0,0,0,0.5)",
            }}
          >
            F
          </div>
          <div className="flex flex-col gap-0.5">
            <span
              className="font-serif font-semibold leading-none"
              style={{ color: "#ede9e0", fontSize: "15px" }}
            >
              FOUNDR
            </span>
            <span
              className="font-mono leading-none uppercase"
              style={{
                fontSize: "8.5px",
                letterSpacing: "0.16em",
                color: "#5a574f",
              }}
            >
              Co-Pilot
            </span>
          </div>
        </Link>
      </div>

      {/* Pillar navigation */}
      <nav className="flex flex-col gap-0.5 p-3 flex-1">
        {/* Mono section eyebrow */}
        <p
          className="font-mono uppercase px-3 pb-2 pt-1"
          style={{
            fontSize: "9px",
            letterSpacing: "0.16em",
            color: "#5a574f",
          }}
        >
          The Three Pillars
        </p>

        {pillars.map(({ label, href, icon: Icon, locked, description, accentColor }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group",
                isActive ? "" : locked ? "opacity-50" : ""
              )}
              style={
                isActive
                  ? {
                      background: "#1a1916",
                      border: "1px solid #2e2c28",
                      color: "#ede9e0",
                    }
                  : {
                      border: "1px solid transparent",
                      color: "#5a574f",
                    }
              }
              aria-disabled={locked}
              tabIndex={locked ? -1 : undefined}
            >
              {/* Status dot — glowing when active, ring when inactive */}
              {isActive ? (
                <div
                  className="shrink-0 rounded-full"
                  style={{
                    width: "7px",
                    height: "7px",
                    background: accentColor,
                    boxShadow: `0 0 8px ${accentColor}`,
                  }}
                />
              ) : (
                <div
                  className="shrink-0 rounded-full"
                  style={{
                    width: "7px",
                    height: "7px",
                    border: "1px solid #3a3833",
                  }}
                />
              )}

              <div className="flex-1 min-w-0">
                <div
                  className="leading-none flex items-center gap-1.5 font-medium"
                  style={{ fontSize: "13.5px", color: isActive ? "#ede9e0" : "#7a7670" }}
                >
                  {label}
                  {locked && <Lock className="w-2.5 h-2.5" style={{ color: "#5a574f" }} />}
                </div>
                <div
                  className="mt-0.5 truncate font-mono uppercase"
                  style={{
                    fontSize: "9px",
                    letterSpacing: "0.08em",
                    color: isActive ? accentColor : "#5a574f",
                  }}
                >
                  {description}
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Idea summary card — empty state in Phase 3 */}
      <div className="p-3" style={{ borderTop: "1px solid #1f1e1b" }}>
        <div
          className="rounded-[11px] p-3"
          style={{
            background: "#15140f",
            border: "1px solid #2e2c28",
          }}
        >
          <p
            className="font-mono uppercase mb-2"
            style={{
              fontSize: "9px",
              letterSpacing: "0.14em",
              color: "#5a574f",
            }}
          >
            Active Idea
          </p>
          <p
            className="font-serif italic leading-relaxed"
            style={{ fontSize: "12px", color: "#5a574f" }}
          >
            No session yet. Start the War Room to begin.
          </p>
        </div>
      </div>
    </aside>
  );
}
