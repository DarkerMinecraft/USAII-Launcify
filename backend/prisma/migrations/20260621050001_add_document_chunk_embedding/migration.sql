CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "DocumentChunk" ADD COLUMN embedding vector(768);
CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_hnsw_idx" ON "DocumentChunk" USING hnsw (embedding vector_cosine_ops);
