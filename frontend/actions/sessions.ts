"use server";

import {
  forwardToBackend,
  ensureUserSynced,
  BackendAuthError,
  BackendError,
} from "@/lib/backend";
import type { QA, SessionData } from "@/lib/types";

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
    return await forwardToBackend<
      { id: string; ideaSummary: string; status: "IN_PROGRESS" | "COMPLETE"; createdAt: string; updatedAt: string }[]
    >("/v1/sessions");
  } catch (err) {
    if (err instanceof ActionAuthError || err instanceof ActionError) throw err;
    handleBackendError(err);
  }
};

export const createSession = async (ideaSummary: string, questionnaireResponses: QA[]) => {
  try {
    await ensureUserSynced();
    return await forwardToBackend<{ id: string }>("/v1/sessions", {
      method: "POST",
      data: { ideaSummary, questionnaireResponses },
    });
  } catch (err) {
    if (err instanceof ActionAuthError || err instanceof ActionError) throw err;
    handleBackendError(err);
  }
};

export const getSession = async (id: string) => {
  try {
    await ensureUserSynced();
    return await forwardToBackend<SessionData>(`/v1/sessions/${id}`);
  } catch (err) {
    if (err instanceof ActionAuthError || err instanceof ActionError) throw err;
    handleBackendError(err);
  }
};

export const updateSession = async (id: string, body: Record<string, unknown>) => {
  try {
    await ensureUserSynced();
    return await forwardToBackend(`/v1/sessions/${id}`, {
      method: "PATCH",
      data: body,
    });
  } catch (err) {
    if (err instanceof ActionAuthError || err instanceof ActionError) throw err;
    handleBackendError(err);
  }
};

export const deleteSession = async (id: string) => {
  try {
    await ensureUserSynced();
    await forwardToBackend(`/v1/sessions/${id}`, { method: "DELETE" });
  } catch (err) {
    if (err instanceof ActionAuthError || err instanceof ActionError) throw err;
    handleBackendError(err);
  }
};

export const saveLaunchpadResult = async (
  id: string,
  field: "outreachDraft" | "executiveSummary" | "validationRoadmap" | "marketResearch",
  data: Record<string, unknown>,
) => {
  try {
    await ensureUserSynced();
    await forwardToBackend(`/v1/sessions/${id}`, {
      method: "PATCH",
      data: { [field]: data },
    });
  } catch (err) {
    if (err instanceof ActionAuthError || err instanceof ActionError) throw err;
    handleBackendError(err);
  }
};

export const updateAssumption = async (
  sessionId: string,
  nodeId: string,
  update: { status?: string; claim?: string; howToTest?: string; remediation?: object | null },
) => {
  try {
    await ensureUserSynced();
    return await forwardToBackend(`/v1/sessions/${sessionId}/assumptions/${nodeId}`, {
      method: "PATCH",
      data: update,
    });
  } catch (err) {
    if (err instanceof ActionAuthError || err instanceof ActionError) throw err;
    handleBackendError(err);
  }
};
