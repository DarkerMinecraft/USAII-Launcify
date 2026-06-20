#!/bin/bash

echo "Starting FOUNDR stack..."
echo ""

# 1. Ensure Docker daemon is running
if ! docker info > /dev/null 2>&1; then
  echo "✗ Docker daemon is not running."
  echo "  Start Docker Desktop, then re-run this script."
  exit 1
fi

# 2. Start the Postgres container (foundr-db). Create it if it doesn't exist.
if docker ps --format '{{.Names}}' | grep -q '^foundr-db$'; then
  echo "✓ PostgreSQL (foundr-db) already running"
elif docker ps -a --format '{{.Names}}' | grep -q '^foundr-db$'; then
  echo "Starting existing PostgreSQL container (foundr-db)..."
  docker start foundr-db
else
  echo "Creating PostgreSQL container (foundr-db)..."
  docker run -d --name foundr-db \
    -e POSTGRES_USER=foundr \
    -e POSTGRES_PASSWORD=foundr \
    -e POSTGRES_DB=foundr \
    -p 5432:5432 \
    postgres:16-alpine
fi

# Give Postgres a moment to accept connections
echo "Waiting for PostgreSQL to be ready..."
until docker exec foundr-db pg_isready -U foundr > /dev/null 2>&1; do
  sleep 1
done
echo "✓ PostgreSQL ready on localhost:5432"
echo ""

# 3. Start backend (Express on :3001)
echo "Starting backend (Express on :3001)..."
(cd backend && npm run dev) &
BACKEND_PID=$!

# 4. Start frontend (Next.js on :3000)
echo "Starting frontend (Next.js on :3000)..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "✓ Stack running:"
echo "  - PostgreSQL: localhost:5432"
echo "  - Backend:    localhost:3001"
echo "  - Frontend:   localhost:3000"
echo ""
echo "Press Ctrl+C to stop the backend and frontend (Postgres keeps running)."

# Stop background node processes on Ctrl+C
trap 'echo ""; echo "Stopping backend and frontend..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null' INT

wait $BACKEND_PID $FRONTEND_PID
