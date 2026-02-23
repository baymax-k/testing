# CodeEthnics Backend

Backend for the CodeEthnics student coding platform — authentication, role-based access control, and secure sessions powered by [Better Auth](https://www.better-auth.com/).

## Features

- **Email/Password Auth** — sign-up, sign-in, sign-out via Better Auth
- **Route Aliases** — clean `/auth/sign-up` and `/auth/sign-in` (original `/email` paths also work)
- **Single-Device Sessions** — new login invalidates all previous sessions
- **Role-Based Access** — `student`, `college_admin`, `product_admin`, `instructor_staff`
- **Rate Limiting** — 8 login attempts per minute per IP
- **7-Day Sessions** — auto-refreshed every 24 hours
- **Swagger UI** — interactive API docs at `/api-docs`
- **Test Frontend** — browser-based auth tester at `/test`
- **TypeScript** — end-to-end type safety with strict mode

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 18+ |
| Framework | Express 5 |
| Language | TypeScript (ESM, strict) |
| Database | PostgreSQL (Docker) |
| ORM | Prisma 6 |
| Auth | Better Auth |
| Package Manager | pnpm |

## Prerequisites

- Node.js 18+
- pnpm
- Docker (for PostgreSQL)

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start PostgreSQL

```bash
docker run --name postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=codeethnics \
  -p 5432:5432 -d postgres:15
```

### 3. Configure Environment

Create a `.env` file:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/codeethnics?schema=public"
BETTER_AUTH_SECRET="your-random-secret"
BETTER_AUTH_URL="http://localhost:5000"
PORT=5000
```

### 4. Run Migrations

```bash
npx prisma migrate dev
npx prisma generate
```

### 5. Start Development Server

```bash
pnpm run dev
```

| URL | Description |
|-----|-------------|
| http://localhost:5000 | API server |
| http://localhost:5000/api-docs | Swagger UI |
| http://localhost:5000/test | Test frontend dashboard |

## API Endpoints

### Authentication

| Method | Path | Description | Auth | Notes |
|--------|------|-------------|------|-------|
| `POST` | `/auth/sign-up` | Register (alias) | No | → rewrites to `/auth/sign-up/email` |
| `POST` | `/auth/sign-up/email` | Register (original) | No | Better Auth native path |
| `POST` | `/auth/sign-in` | Login (alias) | No | → rewrites to `/auth/sign-in/email` |
| `POST` | `/auth/sign-in/email` | Login (original) | No | Rate-limited: 8/min |
| `POST` | `/auth/sign-out` | Logout / destroy session | Yes | Immediate invalidation |
| `GET`  | `/auth/get-session` | Get current session & user | Yes | Returns user + session |

### Protected Routes (Examples)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/protected` | Any authenticated user | Session cookie |
| `GET` | `/admin` | `product_admin` role only | Session cookie + Role |

### Request Examples

**Register (using alias):**
```bash
curl -X POST http://localhost:5000/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123","name":"Jane Doe","role":"student"}'
```

**Login (using alias):**
```bash
curl -X POST http://localhost:5000/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123"}' \
  -c cookies.txt
```

**Get Session:**
```bash
curl http://localhost:5000/auth/get-session -b cookies.txt
```

**Sign Out:**
```bash
curl -X POST http://localhost:5000/auth/sign-out \
  -H "Content-Type: application/json" \
  -b cookies.txt
```

**Protected Route:**
```bash
curl http://localhost:5000/protected -b cookies.txt
```

## Roles

| Role | Description |
|------|-------------|
| `student` | Default role for new users |
| `college_admin` | College-level administrator |
| `product_admin` | Platform-wide administrator (full access) |
| `instructor_staff` | Instructor / staff member |

## Project Structure

```
src/
├── auth.ts              # Better Auth config (Prisma adapter, sessions, hooks)
├── app.ts               # Express app (CORS, rate limiter, routes, Swagger)
├── server.ts            # Server entry point
├── middleware/
│   └── auth.ts          # requireAuth & requireRole middleware
├── routes/              # (Future) modular route files
└── generated/prisma/    # Auto-generated Prisma client

prisma/
└── schema.prisma        # User, Session, Account, Verification + Role enum

public/
└── index.html           # Test frontend dashboard

local_files/
├── SystemPrompt         # AI agent context for this project
├── TODO                 # Development checklist
└── techstack.md         # Tech stack reference

docs/                    # (Future) additional documentation
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `5000` | Server port |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | — | Secret key for auth tokens |
| `BETTER_AUTH_URL` | Yes | `http://localhost:5000` | Base URL of this server |
| `FRONTEND_URL` | No | `http://localhost:3000` | Trusted frontend origin (CORS) |

## Security Features (Implemented)

| Feature | Status | Details |
|---------|--------|---------|
| Password hashing | ✅ | Handled by Better Auth (bcrypt) |
| HttpOnly cookies | ✅ | Session token not accessible via JS |
| Single-device sessions | ✅ | New login deletes all other sessions |
| Rate limiting | ✅ | 8 req/min on login endpoints |
| CORS | ✅ | Restricts origins, credentials enabled |
| Role-based access | ✅ | Middleware-level enforcement |
| Session expiry | ✅ | 7-day TTL with 24h rolling refresh |
| Immediate sign-out | ✅ | Session deleted from DB on logout |

## Roadmap

### 🔴 High Priority (Next Sprint)
- Email verification on registration (Nodemailer + Gmail)
- Forgot password / reset password flow
- Multi-role `requireRole` (accept array of roles)
- Input validation with Zod on custom routes
- Centralized error handler

### 🟡 Medium Priority
- Redis caching for sessions (production scale)
- Account lockout after N failed attempts
- Audit logging (auth events with IP/user-agent)
- API versioning (`/v1/` prefix)
- Admin user management endpoints

### 🟢 Future
- OAuth/Social login (Google, GitHub) via Better Auth plugins
- Two-factor authentication (TOTP)
- Vercel deployment with production env vars
- Production security hardening (helmet, HTTPS-only cookies)
- Coding platform core: problems, submissions, leaderboards, contests

## Build & Production

```bash
pnpm run build    # TypeScript → dist/
pnpm start        # Run compiled output
```

## Known Issues & Notes

- **Express v5**: wildcards like `/auth/*` don't work — use regex `/^\/auth\/.*/` instead.
- **Better Auth + `express.json()`**: body parser must come AFTER Better Auth handler.
- **Cookies in fetch**: always use `credentials: 'include'` on the client side.
- **Prisma schema changes**: run `npx prisma migrate dev && npx prisma generate` after edits.


