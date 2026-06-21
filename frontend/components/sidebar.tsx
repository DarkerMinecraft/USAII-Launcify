"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Swords, Rocket, Mic, BrainCircuit, Lock, LogIn, Settings } from "lucide-react";
import { useUser } from "@auth0/nextjs-auth0";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserSettingsDialog } from "@/components/user-settings-dialog";
import { getProfile } from "@/actions/profile";

const pillars = [
  {
    label: "War Room",
    href: "/war-room",
    icon: Swords,
    locked: false,
    description: "Challenge your idea",
    dotActiveClass: "bg-agent-skeptic shadow-[0_0_8px_var(--agent-skeptic)]",
    descActiveClass: "text-agent-skeptic",
  },
  {
    label: "Launchpad",
    href: "/launchpad",
    icon: Rocket,
    locked: false,
    description: "Connect & execute",
    dotActiveClass: "bg-agent-operator shadow-[0_0_8px_var(--agent-operator)]",
    descActiveClass: "text-agent-operator",
  },
  {
    label: "Pitch Session",
    href: "/pitch-session",
    icon: Mic,
    locked: false,
    description: "Practice & perform",
    dotActiveClass: "bg-agent-strategist shadow-[0_0_8px_var(--agent-strategist)]",
    descActiveClass: "text-agent-strategist",
  },
  {
    label: "Strategy Room",
    href: "/strategy-room",
    icon: BrainCircuit,
    locked: false,
    description: "Advise & explore",
    dotActiveClass: "bg-agent-strategist shadow-[0_0_8px_var(--agent-strategist)]",
    descActiveClass: "text-agent-strategist",
  },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const { user, isLoading } = useUser();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savedName, setSavedName] = useState<string | undefined>(undefined);
  const [dbName, setDbName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (user) {
      getProfile().then(p => { if (p?.name) setDbName(p.name); }).catch(() => {});
    }
  }, [user]);

  const resolvedName = (() => {
    if (savedName) return savedName;
    if (dbName) return dbName;
    const n = user?.name ?? "";
    const e = user?.email ?? "";
    if (!n || n === e || n.includes("@")) {
      return e.split("@")[0]?.split(/[._-]/)[0] || "You";
    }
    return n;
  })();

  return (
    <aside className="hidden md:flex flex-col w-[232px] shrink-0 h-screen sticky top-0 bg-surface-1 border-r border-border">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-hairline">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-serif font-bold text-base bg-primary text-primary-foreground shadow-[0_4px_12px_-4px_rgba(0,0,0,0.5)]">
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
          Pillars
        </p>

        {pillars.map(({ label, href, icon: Icon, locked, description, dotActiveClass, descActiveClass }) => {
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
                <div className={cn("shrink-0 rounded-full w-[7px] h-[7px]", dotActiveClass)} />
              ) : (
                <div className="shrink-0 rounded-full w-[7px] h-[7px] border border-[#3a3833]" />
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
                <div className={cn(
                  "mt-0.5 truncate font-mono uppercase text-[9px] tracking-[0.08em]",
                  isActive ? descActiveClass : "text-text-faint"
                )}>
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
          <>
            <UserSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onSaved={setSavedName} />
            <Button
              variant="ghost"
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2.5 w-full justify-start rounded-lg px-1 py-1.5 h-auto"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium leading-tight text-[12.5px] text-foreground">
                  {resolvedName}
                </p>
                <p className="eyebrow-sm truncate mt-0.5">
                  Signed in
                </p>
              </div>
              <Settings className="w-3.5 h-3.5 text-text-faint shrink-0" aria-hidden="true" />
            </Button>
          </>
        ) : (
          <Button className="w-full text-[12.5px]" asChild>
            <a href="/auth/login">
              <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
              Sign in
            </a>
          </Button>
        )}
      </div>

      {/* Idea summary card */}
      <div className="p-3 border-t border-hairline">
        <Card className="rounded-[11px] p-3 bg-surface-2 border-border shadow-none ring-0 gap-0">
          <p className="eyebrow mb-2">
            Active Idea
          </p>
          <p className="font-serif italic leading-relaxed text-[12px] text-text-faint">
            No session yet. Start the War Room to begin.
          </p>
        </Card>
      </div>
    </aside>
  );
};
