"use server";

import { forwardToBackend, ensureUserSynced, BackendAuthError, BackendError } from "@/lib/backend";

class ActionAuthError extends Error {}
class ActionError extends Error {}

const handleBackendError = (err: unknown): never => {
  if (err instanceof BackendAuthError) throw new ActionAuthError("You must sign in first");
  if (err instanceof BackendError) throw new ActionError(err.message);
  throw new ActionError("Could not reach the backend");
};

export const updateProfile = async (name: string) => {
  try {
    await ensureUserSynced();
    return await forwardToBackend<{ id: string; name: string | null; email: string; picture: string | null }>(
      "/v1/users/me",
      { method: "PATCH", data: { name } },
    );
  } catch (err) {
    if (err instanceof ActionAuthError || err instanceof ActionError) throw err;
    handleBackendError(err);
  }
};
