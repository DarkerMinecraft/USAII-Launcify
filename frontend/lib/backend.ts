import axios, { isAxiosError, type AxiosRequestConfig } from "axios";
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

const client = axios.create({ baseURL: BACKEND_URL });

/**
 * Forwards a request to the Express backend with the founder's Auth0 access
 * token attached. Returns the parsed response body directly. Throws
 * BackendAuthError if unauthenticated, BackendError for any HTTP error.
 *
 * Call from Server Actions or Route Handlers — never from client components.
 */
export const forwardToBackend = async <T = unknown>(
  path: string,
  config?: AxiosRequestConfig,
): Promise<T> => {
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

  try {
    const res = await client.request<T>({
      url: path,
      ...config,
      headers: {
        ...config?.headers,
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  } catch (err) {
    if (isAxiosError(err)) {
      const status = err.response?.status ?? 500;
      if (status === 401 || status === 403) {
        throw new BackendAuthError("Not authenticated");
      }
      const message =
        (err.response?.data as { error?: string } | undefined)?.error ??
        err.message ??
        "Backend error";
      throw new BackendError(message, status);
    }
    throw err;
  }
};

/**
 * Idempotently upserts the local User row via GET /v1/auth/sync. requireUser on
 * the backend returns 404 until this has run, so every authenticated write calls
 * this first — making the flow resilient regardless of login-callback timing.
 */
export const ensureUserSynced = async (): Promise<void> => {
  await forwardToBackend("/v1/auth/sync");
};
