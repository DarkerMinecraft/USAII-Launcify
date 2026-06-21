"use client";

import { useState, useEffect, useTransition } from "react";
import { useUser } from "@auth0/nextjs-auth0";
import { toast } from "sonner";
import { Mail, KeyRound, ShieldCheck, LogOut, Globe } from "lucide-react";
import { updateProfile, sendPasswordReset, getProfile } from "@/actions/profile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export const UserSettingsDialog = ({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (name: string) => void;
}) => {
  const { user } = useUser();
  const [tab, setTab] = useState("profile");

  useEffect(() => {
    if (open) setTab("profile");
  }, [open]);

  const sub = (user?.sub as string | undefined) ?? "";
  const isPasswordAccount = sub.startsWith("auth0|");
  const provider = sub.startsWith("google-oauth2|")
    ? "Google"
    : sub.startsWith("github|")
    ? "GitHub"
    : sub.startsWith("auth0|")
    ? "Email & Password"
    : "SSO";

  const initials = (() => {
    const n = (user?.name as string | undefined) ?? "";
    const e = (user?.email as string | undefined) ?? "?";
    const base = (!n || n === e || n.includes("@")) ? e : n;
    return base
      .split(/[\s@._-]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="font-serif italic text-[18px]">Account</DialogTitle>
          <DialogDescription className="sr-only">Manage your profile and security settings</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          {user?.picture ? (
            <img
              src={user.picture}
              alt={user.name ?? "Avatar"}
              width={40}
              height={40}
              className="rounded-full w-10 h-10 object-cover border border-border shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-surface-2 border border-border flex items-center justify-center font-mono text-sm text-text-muted select-none shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate leading-tight">
              {user?.name && user.name !== user?.email ? user.name : (user?.email ?? "—")}
            </p>
            <p className="font-mono uppercase text-[8px] tracking-[0.1em] text-text-faint mt-0.5">
              {provider}
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="flex flex-col">
          <div className="px-5 pt-4">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="profile" className="mt-0">
            <ProfileTab user={user} onSaved={onSaved} onClose={() => onOpenChange(false)} />
          </TabsContent>

          <TabsContent value="security" className="mt-0">
            <SecurityTab isPasswordAccount={isPasswordAccount} provider={provider} email={user?.email ?? ""} />
          </TabsContent>
        </Tabs>

        <div className="px-5 py-3 border-t border-border">
          <Button variant="ghost" size="sm" className="text-[12px] text-text-muted gap-1.5 px-0 h-auto" asChild>
            <a href="/auth/logout">
              <LogOut className="w-3 h-3" />
              Sign out
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ProfileTab = ({
  user,
  onSaved,
  onClose,
}: {
  user: ReturnType<typeof useUser>["user"];
  onSaved?: (name: string) => void;
  onClose: () => void;
}) => {
  const [name, setName] = useState("");
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    getProfile()
      .then(p => {
        const fallback = (() => {
          const n = user?.name ?? "";
          const e = user?.email ?? "";
          return (!n || n === e || n.includes("@")) ? "" : n;
        })();
        setName(p?.name || fallback);
      })
      .catch(() => setName(user?.name ?? ""));
  }, [user?.name, user?.email]);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    startSaving(async () => {
      try {
        await updateProfile(trimmed);
        toast.success("Profile updated");
        onSaved?.(trimmed);
        onClose();
      } catch {
        toast.error("Could not save — try again");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-name" className="eyebrow">Display name</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          onKeyDown={(e) => e.key === "Enter" && !saving && save()}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-email" className="eyebrow">Email</Label>
        <Input
          id="profile-email"
          value={user?.email ?? ""}
          readOnly
          className="cursor-default text-text-dim"
          tabIndex={-1}
        />
        <p className="font-mono uppercase text-[8.5px] tracking-[0.1em] text-text-faint">
          Managed by Auth0 · cannot be changed here
        </p>
      </div>

      <div className="flex justify-end pt-1">
        <Button
          onClick={save}
          disabled={saving || !name.trim()}
          size="sm"
          className="rounded-[8px]"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
};

const SecurityTab = ({
  isPasswordAccount,
  provider,
  email,
}: {
  isPasswordAccount: boolean;
  provider: string;
  email: string;
}) => {
  const [resetting, startReset] = useTransition();
  const [resetSent, setResetSent] = useState(false);

  const sendReset = () => {
    startReset(async () => {
      try {
        await sendPasswordReset();
        setResetSent(true);
        toast.success("Password reset email sent");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not send reset email");
      }
    });
  };

  return (
    <div className="flex flex-col gap-0 px-5 py-4">
      <div className="flex flex-col gap-3">
        <div>
          <p className="eyebrow mb-1">Sign-in method</p>
          <div className="flex items-center gap-2 py-2 px-3 rounded-[8px] bg-surface-2 border border-border">
            {provider === "Google" ? (
              <Globe className="w-3.5 h-3.5 text-text-faint shrink-0" />
            ) : (
              <Mail className="w-3.5 h-3.5 text-text-faint shrink-0" />
            )}
            <span className="font-mono uppercase text-[9px] tracking-[0.1em] text-text-muted">
              {provider}
            </span>
            <span className="text-text-faint text-[11px] ml-auto truncate max-w-[140px]">{email}</span>
          </div>
        </div>

        <Separator />

        {isPasswordAccount ? (
          <div className="flex flex-col gap-2">
            <p className="eyebrow mb-0.5">Password</p>
            <p className="text-text-dim text-[12px] leading-[1.55]">
              {resetSent
                ? `Reset link sent to ${email}. Check your inbox.`
                : "We'll email you a link to set a new password. You won't be signed out."}
            </p>
            <Button
              onClick={sendReset}
              disabled={resetting || resetSent}
              variant="secondary"
              size="sm"
              className="gap-2 rounded-[8px] w-fit mt-1"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {resetting ? "Sending…" : resetSent ? "Email sent" : "Send reset email"}
            </Button>
          </div>
        ) : (
          <div className="flex items-start gap-3 py-2 px-3 rounded-[8px] bg-surface-2 border border-border">
            <ShieldCheck className="w-4 h-4 text-agent-operator shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] text-foreground leading-tight font-medium">
                Secured by {provider}
              </p>
              <p className="text-text-faint text-[11px] leading-[1.5] mt-0.5">
                Your password is managed by {provider}. To change it, visit your {provider} account settings.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
