import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrainCircuit } from "lucide-react";
import { listSessions } from "@/actions/sessions";
import { getAdvisorData } from "@/actions/advisor";
import { SessionPicker } from "@/components/strategy-room/session-picker";
import { AdvisorClient } from "./advisor-client";

export const metadata: Metadata = {
  title: "Strategy Room",
  robots: { index: false, follow: false },
};

const StrategyRoomPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string }>;
}) => {
  const { sessionId } = await searchParams;

  if (!sessionId) {
    let sessions: Awaited<ReturnType<typeof listSessions>> = [];
    try {
      sessions = (await listSessions()) ?? [];
    } catch {
      sessions = [];
    }

    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <BrainCircuit className="w-5 h-5 text-text-faint" />
          <h1 className="font-serif italic text-[22px] text-foreground">Strategy Room</h1>
        </div>
        <p className="text-[14px] text-text-muted mb-6">
          Choose a War Room session to open its advisor chat.
        </p>
        <SessionPicker sessions={sessions} />
      </main>
    );
  }

  let advisorData;
  let session;
  try {
    const [ad, s] = await Promise.all([
      getAdvisorData(sessionId),
      import("@/actions/sessions").then((m) => m.getSession(sessionId)),
    ]);
    advisorData = ad;
    session = s;
  } catch {
    redirect("/strategy-room");
  }

  if (!session) redirect("/strategy-room");

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      <AdvisorClient
        sessionId={sessionId}
        ideaSummary={session.ideaSummary}
        initialMessages={advisorData!.messages}
        initialDocuments={advisorData!.documents}
      />
    </div>
  );
};
export default StrategyRoomPage;
