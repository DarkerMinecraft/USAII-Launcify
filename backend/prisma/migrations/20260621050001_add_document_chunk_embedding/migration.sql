CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "DocumentChunk" ADD COLUMN embedding vector(768);
CREATE INDEX ON "DocumentChunk" USING hnsw (embedding vector_cosine_ops);
