// ─── OpenAPI / Swagger Specification ────────────────────────────────────────────
// Extracted from app.ts so it can evolve independently.
// Devs: add new paths here when creating endpoints in route modules.

import swaggerJsdoc from "swagger-jsdoc";

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CodeEthnics Backend API",
      version: "2.0.0",
      description:
        "Authentication API for the CodeEthnics student platform.\n\n" +
        "- Email/password sign-up (students only, role auto-set to 'student')\n" +
        "- Email verification (link on sign-up, OTP available)\n" +
        "- Password reset via 6-digit OTP (10 min, 10 attempts)\n" +
        "- Single-device session enforcement\n" +
        "- Role-based access control\n" +
        "- Admin endpoint to create staff/admin users",
    },
    servers: [
      {
        url: process.env.BETTER_AUTH_URL || "http://localhost:5000",
        description: "Development server",
      },
    ],

    // ── Reusable components ──────────────────────────────────────────────────
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
        Success: {
          type: "object",
          properties: {
            success: { type: "boolean" },
          },
        },
      },
    },

    // ── Paths ────────────────────────────────────────────────────────────────
    paths: {
      // ── Authentication ─────────────────────────────────────────────────────
      "/auth/sign-up": {
        post: {
          summary: "Register a new student",
          description:
            "Creates a new user with the 'student' role. A verification email is sent automatically. " +
            "The user must verify their email before they can sign in.",
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
                  },
                  required: ["email", "password", "name"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "User registered & verification email sent",
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
          summary: "Register a new student (original endpoint)",
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
                  },
                  required: ["email", "password", "name"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "User registered & verification email sent",
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
          description:
            "Alias for /auth/sign-in/email. Rate-limited to 8 req/min per IP. " +
            "Returns 403 if email is not verified.",
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
            "403": {
              description: "Email not verified",
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
          description: "Original Better Auth endpoint. Identical to /auth/sign-in.",
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
            "403": {
              description: "Email not verified",
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
              description: "Active session with user info (includes role)",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Session" } } },
            },
            "401": {
              description: "No valid session",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },

      // ── Email Verification ─────────────────────────────────────────────────
      "/auth/verify-email": {
        get: {
          summary: "Verify email via link token",
          description: "Called when the user clicks the verification link in their email.",
          tags: ["Email Verification"],
          security: [],
          parameters: [
            {
              name: "token",
              in: "query",
              required: true,
              schema: { type: "string" },
              description: "Verification token from the email link",
            },
          ],
          responses: {
            "200": { description: "Email verified successfully" },
            "400": { description: "Invalid or expired token" },
          },
        },
      },

      // ── Email OTP ──────────────────────────────────────────────────────────
      "/auth/email-otp/send-verification-otp": {
        post: {
          summary: "Send a 6-digit OTP",
          description:
            "Sends a 6-digit OTP to the given email. Use `type` to specify the purpose: " +
            "`email-verification`, `forget-password`, or `sign-in`. OTP is valid for 10 minutes, max 10 attempts.",
          tags: ["Email OTP"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    email: { type: "string", format: "email" },
                    type: {
                      type: "string",
                      enum: ["email-verification", "forget-password", "sign-in"],
                    },
                  },
                  required: ["email", "type"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "OTP sent",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Success" } } },
            },
            "400": {
              description: "Invalid request",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },

      "/auth/email-otp/verify-email": {
        post: {
          summary: "Verify email with OTP",
          description: "Verifies the user's email using the 6-digit OTP.",
          tags: ["Email OTP"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    email: { type: "string", format: "email" },
                    otp: { type: "string", minLength: 6, maxLength: 6 },
                  },
                  required: ["email", "otp"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Email verified",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Success" } } },
            },
            "400": {
              description: "Invalid OTP or expired",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "429": {
              description: "Too many attempts",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },

      // ── Password Reset ─────────────────────────────────────────────────────
      "/auth/email-otp/request-password-reset": {
        post: {
          summary: "Request password reset OTP",
          description: "Sends a 6-digit OTP for password reset. User must have a verified email.",
          tags: ["Password Reset"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    email: { type: "string", format: "email" },
                  },
                  required: ["email"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "OTP sent if the email exists and is verified",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Success" } } },
            },
          },
        },
      },

      "/auth/email-otp/reset-password": {
        post: {
          summary: "Reset password with OTP",
          description: "Resets the user's password using the 6-digit OTP received via email.",
          tags: ["Password Reset"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    email: { type: "string", format: "email" },
                    otp: { type: "string", minLength: 6, maxLength: 6 },
                    password: { type: "string", minLength: 8 },
                  },
                  required: ["email", "otp", "password"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Password reset successfully",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Success" } } },
            },
            "400": {
              description: "Invalid OTP, expired, or weak password",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "429": {
              description: "Too many attempts",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },

      // ── Admin ──────────────────────────────────────────────────────────────
      "/admin/create-user": {
        post: {
          summary: "Create a staff/admin user (product_admin only)",
          description:
            "Allows a product_admin to create users with any role (college_admin, product_admin, instructor_staff). " +
            "Students are created via the public sign-up endpoint.",
          tags: ["Admin"],
          security: [{ cookieAuth: [] }],
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
                      enum: ["college_admin", "product_admin", "instructor_staff"],
                    },
                  },
                  required: ["email", "password", "name", "role"],
                },
              },
            },
          },
          responses: {
            "201": {
              description: "User created",
              content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } },
            },
            "400": {
              description: "Validation error",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden – not a product_admin" },
            "409": {
              description: "User with this email already exists",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },

      "/admin/users": {
        get: {
          summary: "List all users (product_admin only)",
          tags: ["Admin"],
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "List of users",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden – not a product_admin" },
          },
        },
      },

      "/admin/dashboard": {
        get: {
          summary: "Admin dashboard – product_admin only",
          tags: ["Admin"],
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "Admin dashboard with panel sections",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      panel: { type: "string", example: "admin" },
                      message: { type: "string" },
                      dashboard: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          sections: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                name: { type: "string" },
                                status: { type: "string" },
                                endpoint: { type: "string" },
                              },
                            },
                          },
                        },
                      },
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

      // ── Student ────────────────────────────────────────────────────────────
      "/student/dashboard": {
        get: {
          summary: "Student dashboard – students only",
          tags: ["Student"],
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "Student dashboard with panel sections",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      panel: { type: "string", example: "student" },
                      message: { type: "string" },
                      dashboard: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          sections: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                name: { type: "string" },
                                status: { type: "string" },
                              },
                            },
                          },
                        },
                      },
                      user: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden – not a student" },
          },
        },
      },

      "/student/profile": {
        get: {
          summary: "Get student profile",
          tags: ["Student"],
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "Student profile",
              content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } },
            },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden – not a student" },
          },
        },
      },

      // ── Common ─────────────────────────────────────────────────────────────
      "/me": {
        get: {
          summary: "Get current user & role-based redirect URL",
          description:
            "Returns the authenticated user's info and the panel URL they should be " +
            "redirected to based on their role. The frontend should call this after " +
            "login/sign-up and navigate to `redirect`.",
          tags: ["Common"],
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "User info with redirect",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      user: { $ref: "#/components/schemas/User" },
                      redirect: {
                        type: "string",
                        example: "/student/dashboard",
                        description: "Panel URL based on user role",
                      },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
