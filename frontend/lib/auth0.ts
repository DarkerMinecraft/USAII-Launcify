import { Auth0Client } from "@auth0/nextjs-auth0/server";

// Server-side Auth0 client. Domain, client id/secret, AUTH0_SECRET and
// APP_BASE_URL are read from env automatically. We request an access token for
// the backend API (audience) plus the email/profile scopes the sync endpoint
// needs (backend/src/v1/auth/sync.ts 400s without an email claim).
export const auth0 = new Auth0Client({
  authorizationParameters: {
    scope: process.env.AUTH0_SCOPE ?? "openid profile email",
    audience: process.env.AUTH0_AUDIENCE,
  },
});
