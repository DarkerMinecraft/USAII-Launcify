import { auth0 } from "@/lib/auth0";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export class BackendAuthError extends Error {}
export class BackendError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Forwards a request to the Express backend with the founder's Auth0 access
 * token attached. Used by the BFF route handlers so the browser never holds the
 * token. Throws BackendAuthError if the user is not logged in.
 *
 * Call from a Route Handler (cookies are writable there, so a refreshed token
 * is persisted) — not from a Server Component.
 */
export const forwardToBackend = async (
  path: string,
  init?: RequestInit,
): Promise<Response> => {
  if (!BACKEND_URL) {
    throw new BackendError("NEXT_PUBLIC_BACKEND_URL is not configured", 500);
  }

  let token: string | undefined;
  try {
    ({ token } = await auth0.getAccessToken());
  } catch (err) {
    console.error("[backend] getAccessToken() threw:", err);
    throw new BackendAuthError("Not authenticated");
  }

  if (!token) {
    console.error(
      "[backend] getAccessToken() returned no token — check AUTH0_AUDIENCE in frontend .env.local",
    );
    throw new BackendAuthError("Not authenticated");
  }

  console.log("Fetching backend" + `${BACKEND_URL}${path}`);
  return fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
};

/**
 * Idempotently upserts the local User row via GET /v1/auth/sync. requireUser on
 * the backend returns 404 until this has run, so every authenticated write calls
 * this first — making the flow resilient regardless of login-callback timing.
 * The sync endpoint needs an `email` claim on the access token (Auth0 Action).
 */
export const ensureUserSynced = async (): Promise<void> => {
  const res = await forwardToBackend("/v1/auth/sync", { method: "GET" });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new BackendError(
      `Account sync failed (${res.status}). ${detail}`.trim(),
      res.status,
    );
  }
};
