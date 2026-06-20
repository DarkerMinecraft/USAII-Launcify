import { NextRequest, NextResponse } from "next/server";
import {
  forwardToBackend,
  ensureUserSynced,
  BackendAuthError,
  BackendError,
} from "@/lib/backend";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/sessions/[id] — BFF proxy to Express GET /v1/sessions/:id
export const GET = async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;

  try {
    await ensureUserSynced();
    const res = await forwardToBackend(`/v1/sessions/${id}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error ?? "Session not found" },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof BackendAuthError) {
      return NextResponse.json({ error: "You must sign in first" }, { status: 401 });
    }
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Could not reach the backend" }, { status: 502 });
  }
}

// PATCH /api/sessions/[id] — BFF proxy to Express PATCH /v1/sessions/:id
export const PATCH = async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }

  try {
    await ensureUserSynced();
    const res = await forwardToBackend(`/v1/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error ?? "Backend rejected the update" },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof BackendAuthError) {
      return NextResponse.json({ error: "You must sign in first" }, { status: 401 });
    }
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Could not reach the backend" }, { status: 502 });
  }
}
