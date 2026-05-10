#!/bin/sh
# ─── Production Startup Script ────────────────────────────────────────────────
# Runs database migrations then starts the server.
# Used by Dockerfile.railway — runs on every deploy.
# prisma migrate deploy is idempotent: skips already-applied migrations.
# Schema path passed directly to avoid prisma.config.ts reading DATABASE_URL
# before the process environment is fully initialised.

set -e

echo "🔄 Running database migrations..."
node_modules/.bin/prisma migrate deploy \
  --schema src/modules/prisma/schema.prisma

echo "✅ Migrations complete"
echo "🚀 Starting server..."

exec node dist/src/server.js
