#!/bin/sh
# ─── Production Startup Script ────────────────────────────────────────────────
# Runs database migrations then starts the server.
# DATABASE_URL is passed explicitly via --url to avoid prisma.config.ts
# needing to resolve it at config-load time.

set -e

echo "🔄 Running database migrations..."
node_modules/.bin/prisma migrate deploy \
  --schema src/modules/prisma/schema.prisma

echo "✅ Migrations complete"
echo "🚀 Starting server..."

exec node dist/src/server.js
