-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETE');

-- CreateEnum
CREATE TYPE "AgentRole" AS ENUM ('SKEPTIC', 'STRATEGIST', 'OPERATOR');

-- CreateEnum
CREATE TYPE "NodeStatus" AS ENUM ('VALIDATED', 'UNVALIDATED', 'NEEDS_INFO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "auth0Id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "picture" TEXT,
    "provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarRoomSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ideaSummary" TEXT NOT NULL,
    "questionnaireResponses" JSONB NOT NULL,
    "canvas" JSONB,
    "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarRoomSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebateMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "agent" "AgentRole" NOT NULL,
    "round" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebateMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssumptionNode" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "claim" TEXT NOT NULL,
    "status" "NodeStatus" NOT NULL,
    "explanation" TEXT NOT NULL,
    "agentSource" "AgentRole" NOT NULL,
    "remediation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssumptionNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_auth0Id_key" ON "User"("auth0Id");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DebateMessage_sessionId_agent_round_key" ON "DebateMessage"("sessionId", "agent", "round");

-- AddForeignKey
ALTER TABLE "WarRoomSession" ADD CONSTRAINT "WarRoomSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebateMessage" ADD CONSTRAINT "DebateMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WarRoomSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssumptionNode" ADD CONSTRAINT "AssumptionNode_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WarRoomSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
