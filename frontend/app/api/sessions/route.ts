import { NextRequest, NextResponse } from "next/server";
import {
  forwardToBackend,
  ensureUserSynced,
  BackendAuthError,
  BackendError,
} from "@/lib/backend";

export const GET = async () => {
  try {
    await ensureUserSynced();
    const res = await forwardToBackend("/v1/sessions");
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json({ error: data?.error ?? "Could not list sessions" }, { status: res.status });
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
};

export const POST = async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const { ideaSummary, questionnaireResponses } = (body ?? {}) as {
    ideaSummary?: string;
    questionnaireResponses?: unknown;
  };

  if (typeof ideaSummary !== "string" || !ideaSummary.trim()) {
    return NextResponse.json({ error: "ideaSummary is required" }, { status: 400 });
  }
  if (!Array.isArray(questionnaireResponses)) {
    return NextResponse.json({ error: "questionnaireResponses must be an array" }, { status: 400 });
  }

  try {
    await ensureUserSynced();

    const res = await forwardToBackend("/v1/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ideaSummary, questionnaireResponses }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error ?? "Backend rejected the session" },
        { status: res.status }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    if (err instanceof BackendAuthError) {
      return NextResponse.json({ error: "You must sign in first" }, { status: 401 });
    }
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Could not reach the backend" }, { status: 502 });
  }
};
