import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0";

const PROTECTED = [
  "/dashboard",
  "/war-room",
  "/launchpad",
  "/pitch-session",
  "/strategy-room",
];

export const proxy = async (request: NextRequest) => {
  const { pathname } = request.nextUrl;

  // Let auth0 handle its own routes first
  const authResponse = await auth0.middleware(request);
  if (pathname.startsWith("/auth/")) return authResponse;

  const session = await auth0.getSession(request);

  // Authenticated user on / → send them to the dashboard
  if (pathname === "/" && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Protected routes without a session → redirect to login
  if (!session && PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const returnTo = encodeURIComponent(pathname + (request.nextUrl.search || ""));
    return NextResponse.redirect(
      new URL(`/auth/login?returnTo=${returnTo}`, request.url),
    );
  }

  return authResponse;
};

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/war-room|api/launchpad|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
