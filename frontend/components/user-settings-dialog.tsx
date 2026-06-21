"use client";

import { useState, useEffect } from "react";
import { useUser } from "@auth0/nextjs-auth0";
import { toast } from "sonner";
import { updateProfile } from "@/actions/profile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const UserSettingsDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { user } = useUser();
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setName(user?.name ?? "");
  }, [open, user?.name]);

  const initials = (user?.name ?? user?.email ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await updateProfile(trimmed);
      toast.success("Profile updated");
      onOpenChange(false);
    } catch {
      toast.error("Could not save — try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif italic text-[18px]">Profile</DialogTitle>
        </DialogHeader>

        <div className="flex justify-center py-1">
          {user?.picture ? (
            <img
              src={user.picture}
              alt={user.name ?? "Avatar"}
              width={64}
              height={64}
              className="rounded-full w-16 h-16 object-cover border border-border"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-surface-2 border border-border flex items-center justify-center font-mono text-lg text-text-muted select-none">
              {initials}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-name" className="eyebrow">Name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              onKeyDown={(e) => e.key === "Enter" && !saving && void save()}
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
              Managed by Auth0
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" className="mr-auto text-[12.5px] text-text-muted h-auto px-0" asChild>
            <a href="/auth/logout">Sign out</a>
          </Button>
          <Button
            onClick={() => void save()}
            disabled={saving || !name.trim()}
            className="rounded-[8px]"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
