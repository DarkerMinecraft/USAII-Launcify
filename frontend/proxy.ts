import type { NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0";

// Next.js 16 renamed the `middleware` file convention to `proxy` (`middleware`
// is deprecated and warns on build). The exported function must be named
// `proxy` (or be the default export) for Next to pick it up.
//
// This mounts the SDK auth routes (/auth/login, /auth/logout, /auth/callback,
// /auth/profile) and keeps the session rolling. For non-auth routes it just
// refreshes the session cookie and passes through. `auth0.middleware` is the
// SDK method name (unchanged by Next's rename).
export const proxy = async (request: NextRequest) => auth0.middleware(request);

export const config = {
  matcher: [
    // Run on everything except Next internals, static assets, and the public
    // LLM routes (/api/war-room/* are unauthenticated by design).
    "/((?!_next/static|_next/image|favicon.ico|api/war-room|api/launchpad|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
