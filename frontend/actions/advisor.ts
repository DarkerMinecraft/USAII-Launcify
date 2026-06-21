"use server";

import { GeminiError, callGeminiChat, embedText } from "@/lib/gemini";
import { buildAdvisorSystemPrompt } from "@/prompts/advisor";
import { forwardToBackend, ensureUserSynced, BackendAuthError, BackendError } from "@/lib/backend";
import type { SessionData, AdvisorData } from "@/lib/types";

class ActionAuthError extends Error {}
class ActionError extends Error {}

const handleBackendError = (err: unknown): never => {
  if (err instanceof BackendAuthError) throw new ActionAuthError("You must sign in first");
  if (err instanceof BackendError) throw new ActionError(err.message);
  throw new ActionError("Could not reach the backend");
};

export const getAdvisorData = async (sessionId: string): Promise<AdvisorData> => {
  try {
    await ensureUserSynced();
    return await forwardToBackend<AdvisorData>(`/v1/sessions/${sessionId}/advisor`);
  } catch (err) {
    if (err instanceof ActionAuthError || err instanceof ActionError) throw err;
    return handleBackendError(err);
  }
};

export const sendAdvisorMessage = async (
  sessionId: string,
  content: string,
): Promise<{ content: string }> => {
  try {
    await ensureUserSynced();

    const [advisorData, session] = await Promise.all([
      forwardToBackend<AdvisorData>(`/v1/sessions/${sessionId}/advisor`),
      forwardToBackend<SessionData>(`/v1/sessions/${sessionId}`),
    ]);

    // Embed user message and search for relevant document chunks
    let docChunks: string[] = [];
    if (advisorData.documents.length > 0) {
      try {
        const embedding = await embedText(content);
        const searchResult = await forwardToBackend<{ chunks: { content: string }[] }>(
          `/v1/sessions/${sessionId}/advisor/search`,
          { method: "POST", data: { embedding } },
        );
        docChunks = searchResult.chunks.map((c) => c.content);
      } catch {
        // RAG failure is non-fatal — proceed without doc context
      }
    }

    const history = advisorData.messages.map((m) => ({
      role: m.role === "USER" ? ("user" as const) : ("model" as const),
      text: m.content,
    }));

    const systemPrompt = buildAdvisorSystemPrompt(session, docChunks);
    const reply = await callGeminiChat(systemPrompt, history, content);

    await forwardToBackend(`/v1/sessions/${sessionId}/advisor/messages`, {
      method: "POST",
      data: [
        { role: "USER", content },
        { role: "ASSISTANT", content: reply },
      ],
    });

    return { content: reply };
  } catch (err) {
    if (err instanceof ActionAuthError || err instanceof ActionError) throw err;
    if (err instanceof GeminiError) throw new ActionError("AI advisor is temporarily unavailable");
    return handleBackendError(err);
  }
};

// Embeds chunk texts and stores them in the backend — called after document upload.
// Failures are non-fatal: un-embedded chunks are excluded by the search query (WHERE embedding IS NOT NULL).
export const embedDocumentChunks = async (
  sessionId: string,
  documentId: string,
  chunks: string[],
): Promise<void> => {
  if (chunks.length === 0) return;
  try {
    await ensureUserSynced();
    // Embed in batches of 10 to avoid rate limits
    const embeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += 10) {
      const batch = chunks.slice(i, i + 10);
      const batchEmbeddings = await Promise.all(batch.map((c) => embedText(c)));
      embeddings.push(...batchEmbeddings);
    }
    await forwardToBackend(`/v1/sessions/${sessionId}/advisor/documents/${documentId}/embeddings`, {
      method: "POST",
      data: { embeddings },
    });
  } catch {
    // Non-fatal — chunks stored but not yet searchable
  }
};
