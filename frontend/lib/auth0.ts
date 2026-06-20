import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

// Server-side Auth0 client. Domain, client id/secret, AUTH0_SECRET and
// APP_BASE_URL are read from env automatically. We request an access token for
// the backend API (audience) plus the email/profile scopes the sync endpoint
// needs (backend/src/v1/auth/sync.ts 400s without an email claim).
export const auth0 = new Auth0Client({
  authorizationParameters: {
    scope: process.env.AUTH0_SCOPE ?? "openid profile email",
    audience: process.env.AUTH0_AUDIENCE,
  },

  // Strip the session cookie down to the bare minimum before it is encrypted
  // and written. Without this the cookie balloons with the full user profile
  // (identities, roles, permissions, raw_metadata, app_metadata…) plus the
  // idToken which can be several KB on its own. We never use the idToken
  // directly — only the accessToken via auth0.getAccessToken().
  beforeSessionSaved: async (session) => ({
    ...session,
    user: {
      sub: session.user.sub,
      email: session.user.email,
      name: session.user.name,
      picture: session.user.picture,
    },
    tokenSet: {
      ...session.tokenSet,
      idToken: undefined,
    },
  }),

  // Sync the user to our database immediately after every login so that
  // requireUser() on the backend never sees a missing User row — even before
  // the founder has created their first session.
  onCallback: async (error, ctx, session) => {
    const base = ctx.appBaseUrl ?? process.env.APP_BASE_URL ?? "http://localhost:3000";

    if (error) {
      return NextResponse.redirect(new URL("/", base));
    }

    if (session?.tokenSet.accessToken) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/auth/sync`, {
          method: "GET",
          headers: { Authorization: `Bearer ${session.tokenSet.accessToken}` },
          cache: "no-store",
        });
      } catch (err) {
        // Non-fatal — ensureUserSynced() in backend.ts will retry on first API call.
        console.error("[auth] login sync failed:", err);
      }
    }

    return NextResponse.redirect(new URL(ctx.returnTo ?? "/", base));
  },
});
