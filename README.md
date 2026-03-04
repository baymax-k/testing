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

- **Social Logins:** Implement Google/GitHub OAuth integrations to improve sign-up conversion.
- **Two-Factor Authentication (2FA):** Enforce TOTP for `college_admin` and `product_admin` roles.
- **Strict Password Policy:** Apply regex validation to ensure all passwords contain special characters, numbers, and uppercase letters.
- **Alternative Verification:** Re-evaluate if email verification should switch from OTP codes back to Magic Links depending on user feedback.
