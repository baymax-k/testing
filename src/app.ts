import express, { type Request, type Response, type Application } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { requireAuth, requireRole } from "./middleware/auth.js";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

// ─── Swagger / OpenAPI spec ────────────────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CodeEthnics Backend API",
      version: "1.0.0",
      description:
        "Authentication API for the CodeEthnics student platform. Uses Better Auth with email/password, JWT sessions, single-device enforcement, and role-based access control.",
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "better-auth.session_token",
          description: "Session cookie set automatically on sign-in / sign-up.",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            email: { type: "string", format: "email" },
            name: { type: "string" },
            role: {
              type: "string",
              enum: ["student", "college_admin", "product_admin", "instructor_staff"],
            },
            emailVerified: { type: "boolean" },
            image: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Session: {
          type: "object",
          properties: {
            token: { type: "string" },
            user: { $ref: "#/components/schemas/User" },
            session: {
              type: "object",
              properties: {
                id: { type: "string" },
                userId: { type: "string" },
                expiresAt: { type: "string", format: "date-time" },
                ipAddress: { type: "string" },
                userAgent: { type: "string" },
              },
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            code: { type: "string" },
            message: { type: "string" },
          },
        },
      },
    },
    paths: {
      "/auth/sign-up": {
        post: {
          summary: "Register a new user (alias)",
          description: "Alias for /auth/sign-up/email — both paths work identically. Creates a new user with email/password credentials and returns a session.",
          tags: ["Authentication"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string", minLength: 8 },
                    name: { type: "string" },
                    role: {
                      type: "string",
                      enum: ["student", "college_admin", "product_admin", "instructor_staff"],
                      default: "student",
                    },
                  },
                  required: ["email", "password", "name"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "User registered & session created",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Session" } } },
            },
            "422": {
              description: "Validation error / user already exists",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },
      "/auth/sign-up/email": {
        post: {
          summary: "Register a new user (original)",
          description: "Original Better Auth endpoint. Identical to /auth/sign-up.",
          tags: ["Authentication"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string", minLength: 8 },
                    name: { type: "string" },
                    role: {
                      type: "string",
                      enum: ["student", "college_admin", "product_admin", "instructor_staff"],
                      default: "student",
                    },
                  },
                  required: ["email", "password", "name"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "User registered & session created",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Session" } } },
            },
            "422": {
              description: "Validation error / user already exists",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },
      "/auth/sign-in": {
        post: {
          summary: "Login with email & password (alias)",
          description: "Alias for /auth/sign-in/email — both paths work identically. Rate-limited to 8 requests per minute per IP.",
          tags: ["Authentication"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string" },
                  },
                  required: ["email", "password"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Logged in – session cookie set",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Session" } } },
            },
            "401": {
              description: "Invalid credentials",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "429": {
              description: "Rate-limited (8 req/min)",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },
      "/auth/sign-in/email": {
        post: {
          summary: "Login with email & password (original)",
          description: "Original Better Auth endpoint. Identical to /auth/sign-in. Rate-limited to 8 requests per minute per IP.",
          tags: ["Authentication"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string" },
                  },
                  required: ["email", "password"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Logged in – session cookie set",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Session" } } },
            },
            "401": {
              description: "Invalid credentials",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "429": {
              description: "Rate-limited (8 req/min)",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },
      "/auth/sign-out": {
        post: {
          summary: "Logout (invalidate session)",
          tags: ["Authentication"],
          responses: {
            "200": { description: "Session destroyed" },
          },
        },
      },
      "/auth/get-session": {
        get: {
          summary: "Get current session",
          tags: ["Authentication"],
          responses: {
            "200": {
              description: "Active session",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Session" } } },
            },
            "401": {
              description: "No valid session",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },
      "/protected": {
        get: {
          summary: "Protected route – any authenticated user",
          tags: ["Example"],
          responses: {
            "200": {
              description: "Access granted",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: { type: "string" },
                      user: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/admin": {
        get: {
          summary: "Admin-only route",
          tags: ["Example"],
          responses: {
            "200": {
              description: "Admin access granted",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: { type: "string" },
                      user: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden – not an admin" },
          },
        },
      },
    },
  },
  apis: [],
};

const specs = swaggerJsdoc(swaggerOptions);

// ─── Express application ────────────────────────────────────────────────────────
const app: Application = express();

app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "http://localhost:5000",
      "null", // allow file:// origins (local HTML test page)
    ],
    credentials: true,
  })
);

// Rate-limit login endpoint (8 requests / minute)
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  message: { error: "Too many login attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/auth/sign-in", loginLimiter);

// ─── Mount Better Auth ──────────────────────────────────────────────────────────
// Express v5 + Better Auth: use a regex so the full path (/auth/...) is preserved
// and Better Auth's basePath: "/auth" sees the correct URL.
// IMPORTANT: must come BEFORE express.json()
const betterAuthHandler = toNodeHandler(auth);

// Short aliases: /auth/sign-up → /auth/sign-up/email, /auth/sign-in → /auth/sign-in/email
// These rewrite req.url so Better Auth sees the correct internal path.
app.post("/auth/sign-up", (req: Request, res: Response) => {
  req.url = "/auth/sign-up/email";
  return betterAuthHandler(req, res);
});
app.post("/auth/sign-in", (req: Request, res: Response) => {
  req.url = "/auth/sign-in/email";
  return betterAuthHandler(req, res);
});

// Catch-all for remaining Better Auth routes (sign-out, get-session, etc.)
app.all(/^\/auth\/.*/, (req: Request, res: Response) => {
  return betterAuthHandler(req, res);
});

// Body parser – placed AFTER Better Auth handler
app.use(express.json());

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

// Serve test frontend at /test
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/test", express.static(path.join(__dirname, "..", "public")));

// ─── Routes ─────────────────────────────────────────────────────────────────────
app.get("/", (_req: Request, res: Response) => {
  res.json({ status: "ok", message: "CodeEthnics API is running" });
});

// Protected route – any authenticated user
app.get("/protected", requireAuth, (req: Request, res: Response) => {
  res.json({ message: "You have access to this protected route", user: (req as any).user });
});

// Admin-only route
app.get("/admin", requireAuth, requireRole("product_admin"), (req: Request, res: Response) => {
  res.json({ message: "Admin access granted", user: (req as any).user });
});

export default app;