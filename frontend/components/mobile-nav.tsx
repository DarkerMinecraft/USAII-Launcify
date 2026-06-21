"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Swords, Rocket, Mic, BrainCircuit, LogIn, LogOut } from "lucide-react";
import { useUser } from "@auth0/nextjs-auth0";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const pillars = [
  {
    label: "War Room",
    href: "/war-room",
    icon: Swords,
    activeBarClass: "bg-agent-skeptic",
    activeTextClass: "text-agent-skeptic",
  },
  {
    label: "Launchpad",
    href: "/launchpad",
    icon: Rocket,
    activeBarClass: "bg-agent-operator",
    activeTextClass: "text-agent-operator",
  },
  {
    label: "Pitch",
    href: "/pitch-session",
    icon: Mic,
    activeBarClass: "bg-agent-strategist",
    activeTextClass: "text-agent-strategist",
  },
  {
    label: "Strategy",
    href: "/strategy-room",
    icon: BrainCircuit,
    activeBarClass: "bg-agent-strategist",
    activeTextClass: "text-agent-strategist",
  },
];

export const MobileHeader = () => {
  const { user } = useUser();

  return (
    <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-[52px] shrink-0 bg-surface-1 border-b border-hairline">
      <Link href="/dashboard" className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 font-serif font-bold text-sm bg-primary text-primary-foreground shadow-[0_2px_8px_-2px_rgba(0,0,0,0.5)]">
          L
        </div>
        <span className="font-serif font-semibold text-[14px] leading-none text-foreground">
          Launchify
        </span>
      </Link>

      {user ? (
        <Button variant="ghost" size="sm" className="text-[11.5px] text-text-dim bg-surface-3 border border-border h-auto py-1.5 rounded-lg" asChild>
          <a href="/auth/logout" aria-label="Sign out">
            <LogOut className="w-3 h-3" aria-hidden="true" />
            Sign out
          </a>
        </Button>
      ) : (
        <Button size="sm" className="text-[11.5px] bg-surface-3 border border-border h-auto py-1.5 rounded-lg" asChild>
          <a href="/auth/login">
            <LogIn className="w-3 h-3" aria-hidden="true" />
            Sign in
          </a>
        </Button>
      )}
    </header>
  );
};

export const MobileBottomNav = () => {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch bg-surface-1 border-t border-hairline pb-[env(safe-area-inset-bottom)]">
      {pillars.map(({ label, href, icon: Icon, activeBarClass, activeTextClass }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className="relative flex flex-1 flex-col items-center justify-center gap-[5px] py-2.5 transition-colors"
          >
            {isActive && (
              <span className={cn("absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-b-full", activeBarClass)} />
            )}
            <Icon
              className={cn("w-[19px] h-[19px]", isActive ? activeTextClass : "text-text-faint")}
              aria-hidden="true"
            />
            <span className={cn("font-mono uppercase leading-none text-[8px] tracking-[0.1em]", isActive ? activeTextClass : "text-text-faint")}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};
