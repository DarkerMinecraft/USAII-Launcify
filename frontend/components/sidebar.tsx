"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Swords, Rocket, Mic, Lock, LogIn, LogOut } from "lucide-react";
import { useUser } from "@auth0/nextjs-auth0";
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
    locked: false,
    description: "Connect & execute",
    accentColor: "#6fa37e",
  },
  {
    label: "Pitch Session",
    href: "/pitch-session",
    icon: Mic,
    locked: false,
    description: "Practice & perform",
    accentColor: "#6f93c4",
  },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const { user, isLoading } = useUser();

  return (
    <aside
      className="flex flex-col w-[232px] shrink-0 h-screen sticky top-0 bg-surface-1 border-r border-border"
    >
      {/* Logo */}
      <div className="px-5 py-6 border-b border-hairline">
        <Link href="/" className="flex items-center gap-3 group">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-serif font-bold text-base bg-primary text-primary-foreground"
            style={{ boxShadow: "0 4px 12px -4px rgba(0,0,0,0.5)" }}
          >
            L
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-serif font-semibold leading-none text-foreground text-[15px]">
              Launchify
            </span>
            <span className="eyebrow-sm leading-none">
              Co-Pilot
            </span>
          </div>
        </Link>
      </div>

      {/* Pillar navigation */}
      <nav className="flex flex-col gap-0.5 p-3 flex-1">
        <p className="eyebrow px-3 pb-2 pt-1">
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
                isActive
                  ? "bg-surface-3 border border-border text-foreground"
                  : cn("border border-transparent text-text-faint", locked ? "opacity-50" : "")
              )}
              aria-disabled={locked}
              tabIndex={locked ? -1 : undefined}
            >
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
                  className={cn(
                    "leading-none flex items-center gap-1.5 font-medium text-[13.5px]",
                    isActive ? "text-foreground" : "text-text-dim"
                  )}
                >
                  {label}
                  {locked && <Lock className="w-2.5 h-2.5 text-text-faint" aria-label="Locked" />}
                </div>
                <div
                  className="mt-0.5 truncate font-mono uppercase text-[9px] text-text-faint"
                  style={{
                    letterSpacing: "0.08em",
                    color: isActive ? accentColor : undefined,
                  }}
                >
                  {description}
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Auth affordance */}
      <div className="p-3 border-t border-hairline">
        {isLoading ? (
          <div className="eyebrow px-1 py-2">
            …
          </div>
        ) : user ? (
          <div className="flex items-center gap-2.5">
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium leading-tight text-[12.5px] text-foreground">
                {user.name ?? user.email ?? "Signed in"}
              </p>
              <p className="eyebrow-sm truncate mt-0.5">
                Signed in
              </p>
            </div>
            <a
              href="/auth/logout"
              aria-label="Sign out"
              className="shrink-0 flex items-center justify-center rounded-lg transition-colors w-[30px] h-[30px] bg-surface-3 border border-border text-text-muted"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          </div>
        ) : (
          <a
            href="/auth/login"
            className="flex items-center justify-center gap-2 rounded-lg transition-colors py-[9px] px-3 bg-surface-3 border border-border text-foreground text-[12.5px] font-semibold"
          >
            <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
            Sign in
          </a>
        )}
      </div>

      {/* Idea summary card */}
      <div className="p-3 border-t border-hairline">
        <div className="card rounded-[11px] p-3 bg-surface-2 border border-border">
          <p className="eyebrow mb-2">
            Active Idea
          </p>
          <p className="font-serif italic leading-relaxed text-[12px] text-text-faint">
            No session yet. Start the War Room to begin.
          </p>
        </div>
      </div>
    </aside>
  );
};
