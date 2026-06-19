import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { AgentRole, NodeStatus, SessionStatus } from "../src/generated/prisma/client";

/**
 * Vigorous DB / query test for the War Room schema (Phase 5 verification).
 * Exercises every query pattern the sessions + sync routes use, against the
 * live DATABASE_URL (local Docker). Self-cleaning: all rows are namespaced with
 * a unique tag and removed in `finally`.
 *
 * Run from backend/:  npx tsx scripts/test-db.ts
 */

const TAG = `test_${Date.now()}`;
const auth0Id = `auth0|${TAG}`;
const otherAuth0Id = `auth0|${TAG}_other`;
const email = `${TAG}@example.test`;
const otherEmail = `${TAG}_other@example.test`;

let pass = 0;
let fail = 0;

function ok(label: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    fail++;
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// Order-independent deep equality. Postgres jsonb does not preserve object key
// order, so the canvas must be compared semantically, not byte-for-byte.
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const ak = Object.keys(ao);
    const bk = Object.keys(bo);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => deepEqual(ao[k], bo[k]));
  }
  return false;
}

async function expectReject(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    ok(label, false, "expected the query to be rejected, but it succeeded");
  } catch {
    ok(label, true);
  }
}

async function main() {
  console.log(`\nWar Room DB test — tag ${TAG}\n`);

  // ── 1. User upsert (mirrors GET /v1/auth/sync) ──────────────────────────────
  console.log("1. User upsert");
  await prisma.user.upsert({
    where: { auth0Id },
    update: { email, name: "First Name", picture: null },
    create: { auth0Id, email, name: "First Name", provider: "auth0" },
  });
  const upserted = await prisma.user.upsert({
    where: { auth0Id },
    update: { email, name: "Updated Name" },
    create: { auth0Id, email, name: "Updated Name", provider: "auth0" },
  });
  const userCount = await prisma.user.count({ where: { auth0Id } });
  ok("upsert creates then updates a single row", userCount === 1, `count=${userCount}`);
  ok("upsert applied the update", upserted.name === "Updated Name", `name=${upserted.name}`);
  const user = upserted;

  const otherUser = await prisma.user.create({
    data: { auth0Id: otherAuth0Id, email: otherEmail, provider: "auth0" },
  });

  // ── 2. Session create (mirrors POST /v1/sessions) ───────────────────────────
  console.log("2. Session create");
  const questionnaireResponses = [
    { question: "Who has this problem?", answer: "Freight brokers." },
    { question: "How do they solve it today?", answer: "Manual email." },
  ];
  const created = await prisma.warRoomSession.create({
    data: { userId: user.id, ideaSummary: "AI comms for brokers", questionnaireResponses },
    select: { id: true, ideaSummary: true, status: true, createdAt: true },
  });
  ok("session created with an id", Boolean(created.id));
  ok("status defaults to IN_PROGRESS", created.status === SessionStatus.IN_PROGRESS, created.status);
  const sessionId = created.id;

  // ── 3. Ownership read (mirrors GET/PATCH findFirst guard) ───────────────────
  console.log("3. Ownership-scoped read");
  const owned = await prisma.warRoomSession.findFirst({ where: { id: sessionId, userId: user.id } });
  ok("owner can read the session", owned !== null);
  const leaked = await prisma.warRoomSession.findFirst({
    where: { id: sessionId, userId: otherUser.id },
  });
  ok("non-owner read returns null (no 403/404 leak)", leaked === null);

  // ── 4. Canvas JSON round-trip (mirrors PATCH canvas write) ──────────────────
  console.log("4. Canvas JSON round-trip");
  const canvas = {
    ideaSummary: "AI comms for brokers",
    questionnaireResponses,
    assumptions: [
      {
        id: "node_001",
        claim: "Brokers will pay for drafted emails",
        status: "UNVALIDATED",
        agentSource: "STRATEGIST",
        explanation: "Stated, no evidence yet.",
        howToTest: "Interview 10 brokers about willingness to pay.",
        remediation: null,
      },
      {
        id: "node_002",
        claim: "Founder validated the pain via interviews",
        status: "VALIDATED",
        agentSource: "SKEPTIC",
        explanation: "Founder ran 12 calls.",
        remediation: {
          action: "VALIDATE",
          howTested: "12 discovery calls",
          whatFound: "All 12 confirmed the pain",
          resolvedAt: new Date().toISOString(),
        },
      },
    ],
    lastUpdated: new Date().toISOString(),
  };
  await prisma.warRoomSession.update({ where: { id: sessionId }, data: { canvas } });
  const readBack = await prisma.warRoomSession.findUnique({ where: { id: sessionId } });
  ok(
    "canvas JSON (incl. nested remediation) round-trips intact (jsonb, order-independent)",
    deepEqual(readBack?.canvas, canvas)
  );

  // ── 5. Message idempotency (skipDuplicates + @@unique) ──────────────────────
  console.log("5. DebateMessage idempotency");
  const msg = { sessionId, agent: AgentRole.SKEPTIC, round: 1, content: "Opening statement." };
  await prisma.debateMessage.createMany({ data: [msg], skipDuplicates: true });
  await prisma.debateMessage.createMany({ data: [msg], skipDuplicates: true });
  const msgCount = await prisma.debateMessage.count({
    where: { sessionId, agent: AgentRole.SKEPTIC, round: 1 },
  });
  ok("duplicate (sessionId,agent,round) inserts collapse to one row", msgCount === 1, `count=${msgCount}`);

  // ── 6. Assumption delete-then-recreate idempotency ──────────────────────────
  console.log("6. AssumptionNode delete-then-recreate idempotency");
  const nodes = [
    { sessionId, claim: "Claim A", status: NodeStatus.UNVALIDATED, explanation: "x", agentSource: AgentRole.SKEPTIC },
    { sessionId, claim: "Claim B", status: NodeStatus.NEEDS_INFO, explanation: "y", agentSource: AgentRole.OPERATOR },
  ];
  for (let i = 0; i < 2; i++) {
    await prisma.$transaction(async (tx) => {
      await tx.assumptionNode.deleteMany({ where: { sessionId } });
      await tx.assumptionNode.createMany({ data: nodes });
    });
  }
  const nodeCount = await prisma.assumptionNode.count({ where: { sessionId } });
  ok("rerunning delete+create yields the same node set (no doubling)", nodeCount === 2, `count=${nodeCount}`);

  // ── 7. Enum + uniqueness constraint enforcement ─────────────────────────────
  console.log("7. Constraint enforcement");
  await expectReject("invalid NodeStatus is rejected", () =>
    prisma.assumptionNode.create({
      data: {
        sessionId,
        claim: "bad",
        explanation: "bad",
        agentSource: AgentRole.SKEPTIC,
        // deliberately invalid enum value
        status: "BOGUS" as unknown as NodeStatus,
      },
    })
  );
  await expectReject("duplicate auth0Id is rejected", () =>
    prisma.user.create({ data: { auth0Id, email: `dup_${email}`, provider: "auth0" } })
  );
  await expectReject("duplicate email is rejected", () =>
    prisma.user.create({ data: { auth0Id: `auth0|dup_${TAG}`, email, provider: "auth0" } })
  );

  // ── 8. Relation integrity on parent delete ──────────────────────────────────
  console.log("8. Relation integrity (delete session with children)");
  let cascaded = false;
  let restricted = false;
  try {
    await prisma.warRoomSession.delete({ where: { id: sessionId } });
    const orphanMsgs = await prisma.debateMessage.count({ where: { sessionId } });
    const orphanNodes = await prisma.assumptionNode.count({ where: { sessionId } });
    cascaded = orphanMsgs === 0 && orphanNodes === 0;
    ok("delete cascaded — no orphan children left", cascaded, `msgs=${orphanMsgs} nodes=${orphanNodes}`);
  } catch {
    restricted = true;
    ok("delete blocked by FK (Restrict) — children protected, no orphans possible", true);
  }
  console.log(
    `  → configured behavior: ${cascaded ? "CASCADE" : restricted ? "RESTRICT" : "unknown"}`
  );

  console.log(`\n${fail === 0 ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"} — ${pass} passed, ${fail} failed\n`);
}

async function cleanup() {
  // Order matters under RESTRICT: children before parents.
  try {
    const sessions = await prisma.warRoomSession.findMany({
      where: { user: { auth0Id: { in: [auth0Id, otherAuth0Id] } } },
      select: { id: true },
    });
    const ids = sessions.map((s) => s.id);
    if (ids.length) {
      await prisma.debateMessage.deleteMany({ where: { sessionId: { in: ids } } });
      await prisma.assumptionNode.deleteMany({ where: { sessionId: { in: ids } } });
      await prisma.warRoomSession.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.user.deleteMany({ where: { auth0Id: { in: [auth0Id, otherAuth0Id] } } });
  } catch (e) {
    console.error("cleanup error:", e);
  }
}

main()
  .catch((e) => {
    fail++;
    console.error("\x1b[31mUnexpected error:\x1b[0m", e);
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    process.exit(fail === 0 ? 0 : 1);
  });
