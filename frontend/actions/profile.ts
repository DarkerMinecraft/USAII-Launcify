"use server";

import { auth0 } from "@/lib/auth0";
import { forwardToBackend, ensureUserSynced, BackendAuthError, BackendError } from "@/lib/backend";

class ActionAuthError extends Error {}
class ActionError extends Error {}

const handleBackendError = (err: unknown): never => {
  if (err instanceof BackendAuthError) throw new ActionAuthError("You must sign in first");
  if (err instanceof BackendError) throw new ActionError(err.message);
  throw new ActionError("Could not reach the backend");
};

type DbProfile = { id: string; name: string | null; email: string; picture: string | null };

export const getProfile = async (): Promise<DbProfile | null> => {
  try {
    await ensureUserSynced();
    return await forwardToBackend<DbProfile>("/v1/users/me");
  } catch {
    return null;
  }
};

export const updateProfile = async (name: string): Promise<DbProfile | undefined> => {
  try {
    await ensureUserSynced();
    return await forwardToBackend<DbProfile>(
      "/v1/users/me",
      { method: "PATCH", data: { name } },
    );
  } catch (err) {
    if (err instanceof ActionAuthError || err instanceof ActionError) throw err;
    handleBackendError(err);
  }
};

export const sendPasswordReset = async (): Promise<{ ok: boolean; message: string }> => {
  const session = await auth0.getSession();
  if (!session?.user?.email) throw new Error("Not authenticated");

  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  if (!domain || !clientId) throw new Error("Auth0 is not configured");

  const res = await fetch(`https://${domain}/dbconnections/change_password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      email: session.user.email,
      connection: "Username-Password-Authentication",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Could not send password reset email");
  }

  return { ok: true, message: await res.text() };
};

export const getIdentityProvider = async (): Promise<string> => {
  const session = await auth0.getSession();
  const sub = (session?.user?.sub as string | undefined) ?? "";
  if (sub.startsWith("google-oauth2|")) return "google";
  if (sub.startsWith("github|")) return "github";
  if (sub.startsWith("auth0|")) return "password";
  return "unknown";
};
