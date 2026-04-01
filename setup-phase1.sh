#!/bin/bash
# Arduino Platform - Phase 1 Setup Script
# Run this after Docker is installed and services are started

set -e  # Exit on error

echo "🚀 Arduino Platform - Phase 1 Setup"
echo "===================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is running"

# Start services
echo ""
echo "📦 Starting PostgreSQL and Redis..."
docker-compose up -d postgres redis

# Wait for PostgreSQL to be ready
echo ""
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5
until docker exec $(docker ps -qf "name=postgres") pg_isready -U postgres > /dev/null 2>&1; do
    echo "  Waiting for PostgreSQL..."
    sleep 2
done
echo "✅ PostgreSQL is ready"

# Test Redis connection
echo ""
echo "⏳ Testing Redis connection..."
if docker exec $(docker ps -qf "name=redis") redis-cli -a fzwZc4n7YuewJeWrRr7FvSt84VbWTECx ping > /dev/null 2>&1; then
    echo "✅ Redis is ready"
else
    echo "❌ Redis connection failed"
    exit 1
fi

# Install dependencies if needed
echo ""
echo "📦 Installing Node dependencies..."
pnpm install

# Apply stashed changes (if any)
echo ""
echo "📝 Checking for stashed changes..."
if git stash list | grep -q "Arduino Phase 1"; then
    echo "  Found stashed Arduino changes, applying..."
    git stash pop
    echo "✅ Stashed changes applied"
else
    echo "  No Arduino stash found"
fi

# Run Prisma migration
echo ""
echo "🗃️  Running Prisma migrations..."
pnpm exec prisma migrate dev --name add_arduino_support --create-only
pnpm exec prisma migrate deploy
pnpm exec prisma generate

echo ""
echo "✅ Phase 1 Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "  1. Test Redis connection: node -e \"require('./src/config/redis.js').isRedisHealthy().then(console.log)\""
echo "  2. Test BullMQ queue: node -e \"require('./src/config/bullmq.js').getCompileQueue().add('test', {})\""
echo "  3. Start building Phase 2 (Compiler Service)"
echo ""
echo "🔗 Useful Commands:"
echo "  docker-compose logs -f redis     # View Redis logs"
echo "  docker-compose logs -f postgres  # View PostgreSQL logs"
echo "  docker ps                        # Check running containers"
echo "  pnpm run dev                     # Start development server"
