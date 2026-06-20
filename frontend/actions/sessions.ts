"use server";

import {
  forwardToBackend,
  ensureUserSynced,
  BackendAuthError,
  BackendError,
} from "@/lib/backend";
import type { QA } from "@/lib/types";

class ActionAuthError extends Error {}
class ActionError extends Error {}

const handleBackendError = (err: unknown): never => {
  if (err instanceof BackendAuthError) throw new ActionAuthError("You must sign in first");
  if (err instanceof BackendError) throw new ActionError(err.message);
  throw new ActionError("Could not reach the backend");
};

export const listSessions = async () => {
  try {
    await ensureUserSynced();
    const res = await forwardToBackend("/v1/sessions");
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ActionError(data?.error ?? "Could not list sessions");
    return data as { id: string; ideaSummary: string; status: "IN_PROGRESS" | "COMPLETE"; createdAt: string; updatedAt: string }[];
  } catch (err) {
    if (err instanceof ActionAuthError || err instanceof ActionError) throw err;
    handleBackendError(err);
  }
};

export const createSession = async (ideaSummary: string, questionnaireResponses: QA[]) => {
  try {
    await ensureUserSynced();
    const res = await forwardToBackend("/v1/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ideaSummary, questionnaireResponses }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ActionError(data?.error ?? "Backend rejected the session");
    return data as { id: string };
  } catch (err) {
    if (err instanceof ActionAuthError || err instanceof ActionError) throw err;
    handleBackendError(err);
  }
};

export const getSession = async (id: string) => {
  try {
    await ensureUserSynced();
    const res = await forwardToBackend(`/v1/sessions/${id}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ActionError(data?.error ?? "Session not found");
    return data;
  } catch (err) {
    if (err instanceof ActionAuthError || err instanceof ActionError) throw err;
    handleBackendError(err);
  }
};

export const updateSession = async (id: string, body: Record<string, unknown>) => {
  try {
    await ensureUserSynced();
    const res = await forwardToBackend(`/v1/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ActionError(data?.error ?? "Backend rejected the update");
    return data;
  } catch (err) {
    if (err instanceof ActionAuthError || err instanceof ActionError) throw err;
    handleBackendError(err);
  }
};
