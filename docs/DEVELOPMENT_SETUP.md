# 🚀 CodeEthics Development Setup Guide

This guide will help you set up the complete development environment for the CodeEthics platform with all dependencies running in Docker containers.

## 📋 Prerequisites

- **Node.js 20 LTS** or later
- **Docker** and **Docker Compose**
- **pnpm** package manager
- **Git**

### Install pnpm
```bash
corepack enable
corepack prepare pnpm@latest --activate
```

### Install Docker
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) for Windows/Mac
- Docker Engine for Linux: `curl -fsSL https://get.docker.com | sh`

## 🛠️ Initial Setup

### 1. Clone and Install Dependencies
```bash
git clone <repository-url>
cd CodeEthnics-Backend
pnpm install
```

### 2. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Generate JWT secrets
openssl rand -base64 32  # Use for JWT_SECRET
openssl rand -base64 32  # Use for JWT_REFRESH_SECRET

# Update .env file with your secrets
```

### 3. Start All Dependencies
```bash
# Start all Docker services (PostgreSQL, Redis, Judge0, Arduino compiler, etc.)
pnpm run stack:up

# Wait for services to be ready (about 30 seconds)
sleep 30

# Run database migrations
pnpm prisma migrate deploy

# Generate Prisma client
pnpm prisma generate

# Optional: Seed database with sample data
pnpm run seed
```

### 4. Start Development Server
```bash
# Start the main API server (runs locally, not in Docker)
pnpm run dev

# In another terminal, start Arduino worker process
pnpm run worker:dev
```

## 🐳 Docker Services Overview

The Docker Compose setup includes all necessary services except the main Node.js server:

### Core Services
- **PostgreSQL** (port 5432) - Main application database
- **Redis** (port 6379) - Caching, rate limiting, job queues
- **Judge0 Server** (port 2358) - Code execution for DSA problems
- **Judge0 Workers** - Background workers for code execution
- **Arduino Compiler** (port 3001) - Arduino code compilation service
- **Arduino Workers** - Background workers for Arduino compilation

### Supporting Services
- **Nginx** (port 80) - Reverse proxy for development (optional)
- **Judge0 Database** - Separate PostgreSQL instance for Judge0
- **Judge0 Redis** - Separate Redis instance for Judge0

## 🔧 Development Workflow

### Starting the Full Stack
```bash
# Start all dependencies
pnpm run stack:setup  # Combines stack:up + migrations + seeding

# Start development server
pnpm run dev
```

### Viewing Logs
```bash
# View all service logs
pnpm run stack:logs

# View specific service logs
docker compose logs -f postgres
docker compose logs -f redis
docker compose logs -f arduino-compiler
```

### Stopping Services
```bash
# Stop all services and remove volumes
pnpm run stack:down

# Stop services but keep data
docker compose stop
```

## 🧪 Testing

### Arduino Testing Suite
```bash
# Run all Arduino tests
pnpm run test:arduino:all

# Or run specific test types
pnpm run test:arduino:unit        # Unit tests
pnpm run test:arduino:integration # Integration tests
pnpm run test:arduino:load        # Load tests

# Automated test runner with environment setup
./test-arduino.sh all
```

### Other Tests
```bash
# Run all tests
pnpm run test:full

# Judge0 integration tests
pnpm run test:judge0

# Smoke tests
pnpm run smoke:arduino

# Coverage report
pnpm run test:coverage
```

## 📊 Available Endpoints

### Health Checks
- http://localhost:5000/api/v1/arduino/health - Arduino system health
- http://localhost:3001/health - Arduino compiler health  
- http://localhost:2358/config - Judge0 health

### API Documentation
- http://localhost:5000/api-docs - Swagger UI for all APIs

### Test Frontend
- http://localhost:5000/test - Simple test interface

## 🔍 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Check what's using the port
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :2358  # Judge0

# Kill processes if needed
sudo kill -9 <PID>
```

#### Docker Services Won't Start
```bash
# Check Docker daemon
docker info

# Clean up Docker resources
docker system prune -f
docker volume prune -f

# Restart Docker services
pnpm run stack:down
pnpm run stack:up
```

#### Database Connection Issues
```bash
# Check PostgreSQL is running
docker compose ps postgres

# Check connection
docker compose exec postgres psql -U postgres -d codeethnics -c "SELECT 1;"

# Reset database
pnpm run stack:down
docker volume rm codeethics_postgres_data
pnpm run stack:setup
```

#### Arduino Compilation Issues
```bash
# Check Arduino compiler service
curl http://localhost:3001/health

# Check Arduino CLI installation in container
docker compose exec arduino-compiler arduino-cli core list

# Restart Arduino services
docker compose restart arduino-compiler arduino-worker
```

### Service Status Check
```bash
# Check all services
docker compose ps

# Check specific service health
docker compose exec postgres pg_isready -U postgres
docker compose exec redis redis-cli ping
curl -f http://localhost:2358/config
curl -f http://localhost:3001/health
```

## 📈 Performance Monitoring

### Resource Usage
```bash
# Monitor Docker resource usage
docker stats

# Check service logs for performance
docker compose logs --tail=100 -f arduino-compiler
docker compose logs --tail=100 -f judge0-server
```

### Queue Monitoring
Access the application APIs to monitor job queues:
- Arduino compilation queue stats via API
- Judge0 submission queue via dashboard

## 🔄 Database Management

### Migrations
```bash
# Create new migration
pnpm prisma migrate dev --name description

# Apply migrations
pnpm prisma migrate deploy

# Reset database (development only)
pnpm prisma migrate reset
```

### Database Tools
```bash
# Prisma Studio (GUI)
pnpm prisma studio  # Opens at http://localhost:5555

# Direct PostgreSQL access
docker compose exec postgres psql -U postgres -d codeethnics

# Backup database
docker compose exec postgres pg_dump -U postgres codeethnics > backup.sql
```

## 🚀 Production Considerations

This Docker setup is optimized for development. For production:

1. Use proper secrets management
2. Configure resource limits
3. Set up proper logging aggregation
4. Use managed database services
5. Configure SSL/TLS termination
6. Set up monitoring and alerting
7. Use production-grade Redis cluster
8. Configure CDN for static assets

## 📝 Additional Notes

- The main Node.js server runs locally for hot reloading during development
- All other services run in Docker for consistency and isolation
- Database migrations run automatically during setup
- Arduino CLI and libraries are pre-installed in the Arduino compiler container
- Judge0 runs in a sandboxed environment for security

For questions or issues, check the logs first:
```bash
pnpm run stack:logs
```