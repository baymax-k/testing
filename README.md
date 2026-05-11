# CodeEthnics Backend

Production backend for **CodeEthnics** — a college-focused coding education platform combining DSA practice, MCQ tests, Arduino programming, contests, and institutional analytics.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | Express.js + TypeScript (strict) |
| Database | PostgreSQL via Prisma ORM |
| Cache / Queue | Redis (Upstash) + BullMQ |
| Auth | Better Auth + JWT |
| Code Execution | Judge0 via RapidAPI |
| Arduino Compiler | Arduino CLI (microservice) |
| File Storage | ImageKit CDN |
| Docs | Swagger / OpenAPI 3.0 |

---

## Services

The backend is split into three deployable services:

| Service | Description | Port |
|---|---|---|
| `backend` | Main Express API | 5000 |
| `arduino-compiler` | Arduino CLI compilation microservice | 8080 |
| `arduino-worker` | BullMQ worker — processes compile jobs | — |

External services (not self-hosted):
- **PostgreSQL** — AWS RDS
- **Redis** — Upstash
- **Judge0** — RapidAPI

---

## Local Development

### Prerequisites
- Node.js 20 LTS
- pnpm (`npm install -g pnpm`)
- Docker (for local infrastructure)

### 1. Install dependencies
```bash
pnpm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your local values
```

### 3. Start local infrastructure (PostgreSQL + Redis + Judge0)
```bash
pnpm run stack:up
```

### 4. Run database migrations
```bash
pnpm exec prisma migrate deploy --schema src/modules/prisma/schema.prisma
```

### 5. Seed sample data
```bash
pnpm run seed
```

### 6. Start all three services (separate terminals)
```bash
# Terminal 1 — Main API
pnpm run dev

# Terminal 2 — Arduino compiler microservice
pnpm run arduino:compiler

# Terminal 3 — Background worker
pnpm run worker:dev
```

### Verify
- API: http://localhost:5000/api/v1/health
- Swagger: http://localhost:5000/api-docs
- Arduino compiler: http://localhost:8080/health
- Test pages: http://localhost:5000/test/

---

## Railway Deployment

Three Railway services, one project. Deploy in this order:

### Step 1 — arduino-compiler

1. Create a new Railway service from this repo
2. Set **Root Directory** to `arduino-compiler/`
3. Railway will use `arduino-compiler/railway.json` → `Dockerfile.railway`
4. Set environment variables:
   ```
   NODE_ENV=production
   PORT=8080
   ARDUINO_CLI_PATH=/usr/local/bin/arduino-cli
   ```
5. Deploy and copy the generated Railway URL (e.g. `https://arduino-compiler-xxx.railway.app`)

### Step 2 — backend

1. Create a new Railway service from this repo
2. Leave Root Directory as `/` (repo root)
3. Railway will use `railway.json` → `Dockerfile.railway`
4. Set environment variables (see full list below)
5. Set `ARDUINO_COMPILER_URL` and `ARDUINO_SERVICE_URL` to the URL from Step 1
6. Deploy

### Step 3 — arduino-worker

1. Create a new Railway service from this repo
2. Leave Root Directory as `/`
3. In Railway service settings, override the config file to `railway.worker.json`
   - Or set **Build Command** and **Start Command** manually:
     - Dockerfile: `Dockerfile.worker.railway`
     - Start: `node dist/src/workers/arduino-worker.js`
4. Set environment variables (subset — see below)
5. Deploy

---

## Environment Variables

### backend service

**Required — server will not start without these:**
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require
REDIS_URL=rediss://default:token@host.upstash.io:6379
JWT_SECRET=<min 32 chars>
JWT_REFRESH_SECRET=<min 32 chars>
BETTER_AUTH_SECRET=<min 32 chars>
FRONTEND_URL=https://your-frontend.com
CORS_ORIGINS=https://your-frontend.com
JUDGE0_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=<your RapidAPI key>
ARDUINO_COMPILER_URL=https://your-arduino-compiler.railway.app
ARDUINO_SERVICE_URL=https://your-arduino-compiler.railway.app
```

**Optional:**
```env
PORT=5000
APP_URL=https://your-backend.railway.app
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USER=no-reply@codeethnics.com
EMAIL_PASS=your-smtp-password
EMAIL_FROM=CodeEthnics <no-reply@codeethnics.com>
GOOGLE_CLIENT_ID=<Google OAuth client ID>
CDN_API_KEY=<ImageKit API key>
CDN_API_SECRET=<ImageKit secret>
CDN_ENDPOINT=https://ik.imagekit.io/your-id
AWS_REGION=ap-south-1
AWS_S3_BUCKET_PROCTORING=your-bucket
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

### arduino-compiler service
```env
NODE_ENV=production
PORT=8080
ARDUINO_CLI_PATH=/usr/local/bin/arduino-cli
```

### arduino-worker service
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require
REDIS_URL=rediss://default:token@host.upstash.io:6379
ARDUINO_SERVICE_URL=https://your-arduino-compiler.railway.app
ARDUINO_COMPILER_URL=https://your-arduino-compiler.railway.app
ARDUINO_WORKER_CONCURRENCY=5
CDN_API_KEY=<ImageKit API key>
CDN_API_SECRET=<ImageKit secret>
CDN_ENDPOINT=https://ik.imagekit.io/your-id
```

### After deploying — run migrations
In Railway, create a one-off job on the backend service:
```bash
pnpm exec prisma migrate deploy --schema src/modules/prisma/schema.prisma
```

---

## Project Structure

```
CodeEthnics-Backend/
├── src/
│   ├── modules/
│   │   ├── arduino/          # Arduino routes, controllers, validators
│   │   ├── auth/             # Auth routes, controller, service
│   │   ├── controllers/      # Student, contest, POTD, practice, etc.
│   │   ├── prisma/           # Schema + migrations
│   │   ├── product-admin/    # Product admin portal
│   │   ├── routes/           # Route definitions
│   │   ├── services/         # Business logic services
│   │   └── validators/       # Input validators
│   ├── config/               # Redis, Prisma, CORS, Swagger, env
│   ├── middleware/           # Auth, RBAC, rate limiter, avatar upload
│   ├── services/             # Arduino compiler + job services, CDN
│   ├── utils/                # Startup validator, graceful shutdown
│   ├── workers/              # arduino-worker.ts (BullMQ)
│   ├── app.ts                # Express app setup
│   └── server.ts             # Entry point
├── arduino-compiler/         # Standalone Arduino CLI microservice
│   ├── src/server.ts
│   ├── Dockerfile
│   ├── Dockerfile.railway
│   └── railway.json
├── public/                   # Static test pages (dev only)
├── docs/                     # Deployment guides
├── Dockerfile                # Generic production build
├── Dockerfile.railway        # Railway-optimised backend build
├── Dockerfile.worker         # Generic worker build
├── Dockerfile.worker.railway # Railway-optimised worker build
├── railway.json              # Railway config — backend
├── railway.worker.json       # Railway config — worker
├── docker-compose.yml        # Local dev infrastructure
├── docker-compose.prod.yml   # Self-hosted production (non-Railway)
└── prisma.config.ts          # Prisma schema path config
```

---

## API Overview

### Health
```
GET  /api/v1/health              # Service health
GET  /api/v1/                    # API status
```

### Auth
```
POST /api/v1/auth/sign-up
POST /api/v1/auth/sign-in
POST /api/v1/auth/sign-out
POST /api/v1/auth/refresh
POST /api/v1/auth/request-otp
POST /api/v1/auth/verify-otp
```

### Arduino
```
GET  /api/v1/arduino/health
GET  /api/v1/arduino/boards
GET  /api/v1/arduino/problems
GET  /api/v1/arduino/problems/:id
POST /api/v1/arduino/compile        # Returns 202 + submissionId
GET  /api/v1/arduino/jobs/:id       # Poll compilation status
POST /api/v1/arduino/validate       # Run test cases
GET  /api/v1/arduino/submissions
```

### Problems & Submissions
```
GET  /api/v1/problems
GET  /api/v1/problems/:id
POST /api/v1/submissions
GET  /api/v1/submissions
```

### Student
```
GET  /api/v1/me
GET  /api/v1/student/dashboard
GET  /api/v1/student/potd
POST /api/v1/student/potd/solve
GET  /api/v1/student/potd/streak
GET  /api/v1/student/practice/random
POST /api/v1/student/practice/session/submit
GET  /api/v1/student/contest
POST /api/v1/student/contest/:id/join
```

### Judge0
```
GET  /api/v1/judge0/about
POST /api/v1/judge0/execute
```

Full interactive docs available at `/api-docs` in development.

---

## Scripts

```bash
# Development
pnpm run dev              # API server with hot reload
pnpm run arduino:compiler # Arduino compiler service
pnpm run worker:dev       # Background worker

# Build
pnpm run build            # Compile TypeScript

# Database
pnpm exec prisma studio   # Database GUI
pnpm run seed             # Seed test data
pnpm exec prisma migrate deploy --schema src/modules/prisma/schema.prisma

# Docker (local dev)
pnpm run stack:up         # Start PostgreSQL + Redis + Judge0
pnpm run stack:down       # Stop services
pnpm run stack:logs       # View logs

# Tests
pnpm run test             # All tests
pnpm run test:arduino     # Arduino tests
pnpm run test:coverage    # Coverage report
```

---

## Arduino Platform

The Arduino feature compiles real `.ino` sketches using Arduino CLI and validates them against test cases using static code analysis.

**Compilation flow:**
1. Student submits code via `POST /api/v1/arduino/compile`
2. Job is queued in Redis via BullMQ
3. `arduino-worker` picks up the job and calls `arduino-compiler`
4. `arduino-compiler` runs `arduino-cli compile` → produces `.hex`
5. Result is stored in `ArduinoSubmission` table
6. Student polls `GET /api/v1/arduino/jobs/:id` for status
7. Student calls `POST /api/v1/arduino/validate` to run test cases

**Test case types:** `pin_state`, `serial_output`, `toggle_count`, `timing`

**Supported boards:** Arduino Uno (`arduino:avr:uno`), Arduino Mega (`arduino:avr:mega`)

---

## Security

- Helmet.js security headers
- CORS with explicit origin allowlist (required in production)
- Rate limiting via `express-rate-limit`
- JWT access + refresh token rotation
- Role-based access control (RBAC) — 8 roles
- Prisma parameterised queries (no SQL injection)
- bcrypt password hashing
- Input validation via `express-validator`
