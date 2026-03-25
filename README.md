# CodeEthnics Backend

Backend for the CodeEthnics student coding platform — authentication, role-based access control, and secure sessions powered by [Better Auth](https://www.better-auth.com/).

## Prerequisites

- Node.js 18+
- pnpm
- Docker (for PostgreSQL)

---

## Getting Started

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start PostgreSQL via Docker
```bash
docker run --name postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=codeethnics \
  -p 5432:5432 -d postgres:15
```
*(If the container is already created, start it with `docker start postgres`)*

### 3. Configure Environment Variables
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/codeethnics?schema=public"
BETTER_AUTH_SECRET="your-random-secret"
BETTER_AUTH_URL="http://localhost:5000"
PORT=5000

# Email Configuration for OTPs (Example using Mailtrap)
EMAIL_HOST="sandbox.smtp.mailtrap.io"
EMAIL_PORT="2525"
EMAIL_USER="your-mailtrap-user"
EMAIL_PASS="your-mailtrap-pass"

# Google Auth (frontend sends ID token to backend)
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
```

### 4. Setup Database Schema
Push the latest schema to the database and generate the Prisma client:
```bash
npx prisma migrate dev
npx prisma generate
```

### 5. Start Development Server
```bash
pnpm run dev
```

---

## Important URLs

| Service | URL |
|---------|-------------|
| **API Server** | `http://localhost:5000/api/v1` |
| **API Documentation** | `http://localhost:5000/api-docs` |
| **Test Frontend Mockup** | `http://localhost:5000/test/login.html` |

---

## Future Updates

- **Social Logins:** Google sign-in is available via `POST /api/v1/auth/sign-in/google` (ID token flow). GitHub OAuth integration is pending.
- **Two-Factor Authentication (2FA):** Enforce TOTP for `college_admin` and `product_admin` roles.
- **Strict Password Policy:** Apply regex validation to ensure all passwords contain special characters, numbers, and uppercase letters.
- **Alternative Verification:** Re-evaluate if email verification should switch from OTP codes back to Magic Links depending on user feedback.

## Docker Compose (Local Stack)


This repository includes a `docker-compose.yml` that starts the database and Judge0 services for local testing. The compose stack intentionally does NOT start the backend API server — run the backend locally with `pnpm run dev` so you can iterate on code without rebuilding containers. The compose file includes:

- **postgres**: The primary application PostgreSQL database used by Prisma. By default it maps container port `5432` to the host (`0.0.0.0:5432`).
- **db**: A second Postgres instance used by Judge0 (Judge0 requires its own DB in this setup).
- **server**: The Judge0 HTTP server (code execution API).
- **workers**: Judge0 worker processes that execute submitted jobs.
- **redis**: Redis used by Judge0 for job queuing and workers.

Volumes are created for the Postgres data directories so data is persisted across restarts (`postgres_data` and `data`).

How to run the full stack:

```bash
pnpm run stack:up    # docker compose up -d
pnpm run stack:logs  # follow combined logs
pnpm run stack:down  # docker compose down -v
```

What the `docker compose up` output means and common error shown in your logs:

- The output lists images pulled, networks and volumes created, and container start status.
- If you see an error like:

  ```
  Bind for 0.0.0.0:5432 failed: port is already allocated
  ```

  it means some other process on your host already uses port `5432` (often a local Postgres service). Fixes:

  - Stop the host Postgres service (systemd) or any container using that port, e.g.:

    ```bash
    sudo systemctl stop postgresql
    # or stop an existing container
    docker stop postgres || true
    docker rm postgres || true
    ```

  - Find what is using the port:

    ```bash
    sudo lsof -iTCP -sTCP:LISTEN -P -n | grep 5432
    # or
    ss -ltnp | grep 5432
    ```

  - Alternatively, change the host port mapping in `docker-compose.yml` (e.g. map `5433:5432`) if you cannot stop the local service.

After the stack is up, you still need to apply Prisma migrations (the backend expects the DB schema to exist). Typical post-start steps:

```bash
# generate client and apply migrations to the app DB
pnpm prisma generate --schema src/modules/prisma/schema.prisma
pnpm prisma migrate deploy --schema src/modules/prisma/schema.prisma

# optional: seed example data
pnpm ts-node --transpile-only scripts/seed.ts
```

Notes and checklist (did we forget anything?):

- Ensure environment variables in `.env` (database URL, Better Auth secrets, Judge0 credentials) are set before starting. `judge0.conf` also contains placeholders that must be filled for production.
- The Compose file maps host ports — if your machine already runs services on those ports, change the host-side ports or stop the local service.
- Healthchecks are included for key services, but you may still need to wait a minute for DBs and Judge0 workers to be fully ready.
- After migrations run, restart the backend if it started before migrations applied so Prisma Client picks up any generated client changes.

If you want, I can also:

- Add explicit port variables to `docker-compose.yml` so host ports are configurable via `.env`.
- Add a short script that waits for Postgres before starting the backend (useful to avoid race conditions).
