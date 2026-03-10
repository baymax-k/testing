// ─── OpenAPI / Swagger Specification ────────────────────────────────────────────
// Reflects the current JWT cookie-based auth, all route modules, and Prisma schema.

import swaggerJsdoc from "swagger-jsdoc";

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CodeEthnics Backend API",
      version: "4.0.0",
      description:
        "Backend API for the CodeEthnics institutional coding platform.\n\n" +
        "**Authentication** — JWT cookie-based (access_token + refresh_token), email/username sign-in, OTP verification, RBAC\n" +
        "**Problems** — Browse coding problems (JSON-defined) with sample test cases\n" +
        "**Practice** — Filter problems by difficulty/tag/type, submit MCQ answers\n" +
        "**Contests** — Join contests, submit DSA solutions, view leaderboards\n" +
        "**Code Execution** — Run code in a sandbox (playground) or submit against test cases via Judge0\n" +
        "**Submissions** — Track submission history and verdicts\n\n" +
        "Rate limits: 15 submissions/min, 15 sign-in attempts/min, 100 auth requests/15min per IP.",
    },
    servers: [
      {
        url: process.env.APP_URL || "http://localhost:5000",
        description: "Development server",
      },
    ],

    // ── Reusable components ──────────────────────────────────────────────────
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "access_token",
          description:
            "JWT access token cookie (httpOnly, 15-min TTL). Set automatically on sign-in, verify-email, and refresh.",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            email: { type: "string", format: "email" },
            username: { type: "string", example: "jane_doe" },
            name: { type: "string" },
            role: {
              type: "string",
              enum: ["student", "college_admin", "product_admin", "instructor_staff"],
            },
            emailVerified: { type: "boolean" },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            details: {
              type: "array",
              items: { type: "object" },
              description: "Zod validation issues (only on validation errors)",
            },
          },
        },
        Message: {
          type: "object",
          properties: {
            message: { type: "string" },
          },
        },
        ProblemSummary: {
          type: "object",
          properties: {
            id: { type: "string", example: "two-sum" },
            title: { type: "string", example: "Two Sum" },
            slug: { type: "string", example: "two-sum" },
            difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
            tags: { type: "array", items: { type: "string" }, example: ["arrays", "hash-map"] },
          },
        },
        ProblemDetail: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            slug: { type: "string" },
            difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
            tags: { type: "array", items: { type: "string" } },
            description: { type: "string" },
            constraints: { type: "string" },
            timeLimits: {
              type: "object",
              properties: {
                c: { type: "number" }, cpp: { type: "number" }, java: { type: "number" },
                javascript: { type: "number" }, python: { type: "number" },
                go: { type: "number" }, rust: { type: "number" },
              },
            },
            memoryLimit: { type: "number", example: 256 },
            sampleTestCases: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  input: { type: "string" },
                  output: { type: "string" },
                  explanation: { type: "string" },
                },
              },
            },
          },
        },
        RunResult: {
          type: "object",
          properties: {
            status: { type: "string", example: "Accepted" },
            stdout: { type: "string", example: "Hello, World!\n" },
            stderr: { type: "string" },
            compileOutput: { type: "string" },
            time: { type: "string", example: "0.012", nullable: true },
            memory: { type: "number", example: 3200, nullable: true },
          },
        },
        TestCaseDetail: {
          type: "object",
          properties: {
            index: { type: "integer", description: "1-indexed test case number" },
            visibility: { type: "string", enum: ["sample", "public", "hidden"] },
            passed: { type: "boolean" },
            status: { type: "string", example: "accepted" },
            input: { type: "string", description: "Only shown for sample/public test cases" },
            expectedOutput: { type: "string", description: "Only shown for sample/public test cases" },
            actualOutput: { type: "string", description: "Only shown for sample/public test cases on failure" },
            errorOutput: { type: "string", nullable: true, description: "Only shown for sample/public test cases" },
          },
        },
        SubmitResult: {
          type: "object",
          properties: {
            submissionId: { type: "string" },
            status: {
              type: "string",
              enum: ["processing", "accepted", "wrong_answer", "time_limit_exceeded", "memory_limit_exceeded", "runtime_error", "compilation_error", "internal_error"],
            },
            testCasesPassed: { type: "integer" },
            totalTestCases: { type: "integer" },
            failedAt: { type: "integer", nullable: true, description: "1-indexed test case that failed first" },
            runtime: { type: "string", nullable: true, example: "0.045" },
            memory: { type: "number", nullable: true, description: "Peak memory in KB" },
            errorOutput: { type: "string", nullable: true },
            testCaseResults: {
              type: "array",
              items: { $ref: "#/components/schemas/TestCaseDetail" },
              description: "Per-test-case results with visibility-controlled details",
            },
          },
        },
        SubmissionSummary: {
          type: "object",
          properties: {
            id: { type: "string" },
            problemId: { type: "string" },
            language: { type: "string" },
            status: { type: "string" },
            testCasesPassed: { type: "integer" },
            totalTestCases: { type: "integer" },
            runtime: { type: "string", nullable: true },
            memory: { type: "number", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Question: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: { type: "string", enum: ["mcq", "dsa"] },
            title: { type: "string" },
            description: { type: "string" },
            difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
            tags: { type: "array", items: { type: "string" } },
            company: { type: "string", nullable: true },
            options: { type: "array", items: { type: "string" }, description: "MCQ options (MCQ only)" },
            timeLimit: { type: "integer", description: "Seconds (DSA only)", nullable: true },
            memoryLimit: { type: "integer", description: "KB (DSA only)", nullable: true },
            sampleTestCases: { type: "array", items: { type: "object" }, description: "DSA only", nullable: true },
          },
        },
        Contest: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            type: { type: "string", enum: ["contest", "practice"] },
            startTime: { type: "string", format: "date-time", nullable: true },
            endTime: { type: "string", format: "date-time", nullable: true },
            duration: { type: "integer", description: "Duration in minutes", nullable: true },
          },
        },
      },
    },

    // ── Paths ────────────────────────────────────────────────────────────────
    paths: {
      // ── Authentication ─────────────────────────────────────────────────────
      "/api/v1/auth/sign-up": {
        post: {
          summary: "Register a new student",
          description:
            "Creates a new user with the 'student' role. A 6-digit OTP verification email is sent automatically. " +
            "The account is not usable until the email is verified via `POST /auth/verify-email`. " +
            "Rate limited to 15 req/min per IP.",
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
                    username: {
                      type: "string",
                      minLength: 3,
                      maxLength: 30,
                      pattern: "^[a-z0-9_]+$",
                      description: "Lowercase letters, numbers, and underscores only",
                    },
                    password: { type: "string", minLength: 8 },
                    name: { type: "string" },
                  },
                  required: ["email", "username", "password", "name"],
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Account created, verification OTP emailed",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Message" } } },
            },
            "400": {
              description: "Validation error / email or username already taken",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "429": { description: "Rate limited" },
          },
        },
      },

      "/api/v1/auth/sign-in": {
        post: {
          summary: "Sign in with email or username",
          description:
            "Verifies credentials and sets `access_token` (15-min) and `refresh_token` (7-day) httpOnly cookies. " +
            "The `identifier` field accepts either an email address or a username. " +
            "Returns 403 if email is not verified. Rate limited to 15 req/min per IP.",
          tags: ["Authentication"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    identifier: { type: "string", description: "Email address or username" },
                    password: { type: "string" },
                  },
                  required: ["identifier", "password"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Signed in — cookies set",
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
            "401": {
              description: "Invalid credentials",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "403": {
              description: "Email not verified",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string" },
                      code: { type: "string", example: "EMAIL_NOT_VERIFIED" },
                    },
                  },
                },
              },
            },
            "429": { description: "Rate limited (15 req/min)" },
          },
        },
      },

      "/api/v1/auth/sign-out": {
        post: {
          summary: "Sign out (revoke refresh token, clear cookies)",
          description: "Deletes the refresh token from the database and clears both auth cookies.",
          tags: ["Authentication"],
          security: [],
          responses: {
            "200": {
              description: "Signed out",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Message" } } },
            },
          },
        },
      },

      "/api/v1/auth/refresh": {
        post: {
          summary: "Refresh access token",
          description:
            "Reads the `refresh_token` cookie, validates it, deletes the old refresh token, " +
            "and issues a new access_token + refresh_token pair (token rotation). " +
            "Clears cookies if the refresh token is invalid or expired.",
          tags: ["Authentication"],
          security: [],
          responses: {
            "200": {
              description: "Tokens refreshed — new cookies set",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Message" } } },
            },
            "401": {
              description: "No refresh token, expired, or revoked",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },

      // ── Email Verification ─────────────────────────────────────────────────
      "/api/v1/auth/verify-email": {
        post: {
          summary: "Verify email with OTP",
          description:
            "Verifies the user's email using the 6-digit OTP sent on sign-up. " +
            "On success, marks email as verified and auto-signs the user in (sets auth cookies).",
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
                    otp: { type: "string", minLength: 6, maxLength: 6 },
                  },
                  required: ["email", "otp"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Email verified — auto signed in, cookies set",
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
            "400": {
              description: "Invalid/expired OTP or email already verified",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "404": {
              description: "User not found",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },

      "/api/v1/auth/send-otp": {
        post: {
          summary: "Resend email verification OTP",
          description:
            "Sends a new 6-digit OTP to the given email for verification. Previous OTPs are invalidated.",
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
                  },
                  required: ["email"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "OTP sent (or silent success if account doesn't exist)",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Message" } } },
            },
            "400": {
              description: "Email already verified",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },

      // ── Password Reset ─────────────────────────────────────────────────────
      "/api/v1/auth/forgot-password": {
        post: {
          summary: "Request password reset OTP",
          description:
            "Sends a 6-digit OTP for password reset. Always returns success to prevent email enumeration.",
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
                  },
                  required: ["email"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "OTP sent if the email exists",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Message" } } },
            },
          },
        },
      },

      "/api/v1/auth/reset-password": {
        post: {
          summary: "Reset password with OTP",
          description:
            "Resets the user's password using a valid OTP. All refresh tokens for the user are revoked, " +
            "forcing re-login on all devices.",
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
                    otp: { type: "string", minLength: 6, maxLength: 6 },
                    newPassword: { type: "string", minLength: 8 },
                  },
                  required: ["email", "otp", "newPassword"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Password reset — all sessions revoked",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Message" } } },
            },
            "400": {
              description: "Invalid/expired OTP",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "404": {
              description: "User not found",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },

      // ── Change Password (authenticated) ─────────────────────────────────────
      "/api/v1/auth/change-password": {
        post: {
          summary: "Change password (logged-in user)",
          description:
            "Changes the authenticated user's password. The current password must be provided. " +
            "All other refresh tokens are revoked (current session stays active).",
          tags: ["Authentication"],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    currentPassword: { type: "string" },
                    newPassword: { type: "string", minLength: 8 },
                  },
                  required: ["currentPassword", "newPassword"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Password changed, other sessions revoked",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Message" } } },
            },
            "400": {
              description: "Current password incorrect or new password same as current",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "401": { description: "Not authenticated" },
            "404": { description: "User not found" },
          },
        },
      },

      // ── Common ─────────────────────────────────────────────────────────────
      "/api/v1/": {
        get: {
          summary: "Health check",
          tags: ["Common"],
          security: [],
          responses: {
            "200": {
              description: "API is running",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "ok" },
                      message: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },

      "/api/v1/me": {
        get: {
          summary: "Get current user & role-based redirect URL",
          description:
            "Returns the authenticated user's info (from the JWT access_token) and the panel URL " +
            "they should be redirected to based on their role.",
          tags: ["Common"],
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "User info with redirect path",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          email: { type: "string" },
                          name: { type: "string" },
                          role: { type: "string" },
                          emailVerified: { type: "boolean" },
                        },
                      },
                      redirect: {
                        type: "string",
                        example: "/student/dashboard",
                      },
                    },
                  },
                },
              },
            },
            "401": { description: "Not authenticated" },
          },
        },
      },

      // ── Admin ──────────────────────────────────────────────────────────────
      "/api/v1/admin/dashboard": {
        get: {
          summary: "Admin dashboard",
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
            "401": { description: "Not authenticated" },
            "403": { description: "Forbidden — not a product_admin" },
          },
        },
      },

      "/api/v1/admin/create-user": {
        post: {
          summary: "Create a staff/admin user",
          description:
            "Allows product_admin or college_admin to create users with non-student roles.",
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
                    username: { type: "string" },
                    password: { type: "string", minLength: 8 },
                    name: { type: "string" },
                    role: {
                      type: "string",
                      enum: ["college_admin", "product_admin", "instructor_staff"],
                    },
                  },
                  required: ["email", "username", "password", "name", "role"],
                },
              },
            },
          },
          responses: {
            "201": {
              description: "User created",
              content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } },
            },
            "400": { description: "Validation error" },
            "401": { description: "Not authenticated" },
            "403": { description: "Forbidden — insufficient role" },
            "409": { description: "Email or username already exists" },
          },
        },
      },

      "/api/v1/admin/users": {
        get: {
          summary: "List all users (product_admin only)",
          tags: ["Admin"],
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "List of users",
              content: {
                "application/json": {
                  schema: { type: "array", items: { $ref: "#/components/schemas/User" } },
                },
              },
            },
            "401": { description: "Not authenticated" },
            "403": { description: "Forbidden — not a product_admin" },
          },
        },
      },

      // ── Student ────────────────────────────────────────────────────────────
      "/api/v1/student/dashboard": {
        get: {
          summary: "Student dashboard",
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
                      dashboard: { type: "object" },
                      user: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
            "401": { description: "Not authenticated" },
            "403": { description: "Forbidden — not a student" },
          },
        },
      },

      "/api/v1/student/profile": {
        get: {
          summary: "Get student profile",
          tags: ["Student"],
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "Student profile",
              content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } },
            },
            "401": { description: "Not authenticated" },
            "403": { description: "Forbidden — not a student" },
          },
        },
      },

      // ── Practice ───────────────────────────────────────────────────────────
      "/api/v1/student/practice": {
        get: {
          summary: "List practice problems",
          description: "Returns filterable practice problems. Supports difficulty, tag, and type filters.",
          tags: ["Practice"],
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: "difficulty", in: "query", schema: { type: "string", enum: ["easy", "medium", "hard"] } },
            { name: "tag", in: "query", schema: { type: "string" } },
            { name: "type", in: "query", schema: { type: "string", enum: ["mcq", "dsa"] } },
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          ],
          responses: {
            "200": {
              description: "List of practice problems",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      questions: { type: "array", items: { $ref: "#/components/schemas/Question" } },
                      total: { type: "integer" },
                    },
                  },
                },
              },
            },
            "401": { description: "Not authenticated" },
          },
        },
      },

      "/api/v1/student/practice/{id}": {
        get: {
          summary: "Get practice problem details",
          description: "Returns practice problem details. Hidden test cases and MCQ correct answers are excluded.",
          tags: ["Practice"],
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Practice problem details",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Question" } } },
            },
            "401": { description: "Not authenticated" },
            "404": { description: "Problem not found" },
          },
        },
      },

      "/api/v1/student/practice/mcq": {
        post: {
          summary: "Submit MCQ answer (instant feedback)",
          description: "Submit an MCQ answer for instant feedback. No database record is created.",
          tags: ["Practice"],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    questionId: { type: "string" },
                    selectedOption: { type: "integer", minimum: 0, maximum: 3 },
                  },
                  required: ["questionId", "selectedOption"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "MCQ result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      correct: { type: "boolean" },
                      correctAnswer: { type: "integer" },
                    },
                  },
                },
              },
            },
            "401": { description: "Not authenticated" },
            "404": { description: "Question not found" },
          },
        },
      },

      // ── Contests ───────────────────────────────────────────────────────────
      "/api/v1/student/contest": {
        get: {
          summary: "List contests",
          description: "Returns contests with pagination and optional status filter (upcoming, active, past).",
          tags: ["Contests"],
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: "status", in: "query", schema: { type: "string", enum: ["upcoming", "active", "past"] } },
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          ],
          responses: {
            "200": {
              description: "List of contests",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      contests: { type: "array", items: { $ref: "#/components/schemas/Contest" } },
                      total: { type: "integer" },
                    },
                  },
                },
              },
            },
            "401": { description: "Not authenticated" },
          },
        },
      },

      "/api/v1/student/contest/{id}": {
        get: {
          summary: "Get contest details",
          description: "Returns contest details including questions. User must have joined and contest must be active.",
          tags: ["Contests"],
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Contest details with questions" },
            "401": { description: "Not authenticated" },
            "403": { description: "Not joined or contest not active" },
            "404": { description: "Contest not found" },
          },
        },
      },

      "/api/v1/student/contest/join": {
        post: {
          summary: "Join a contest",
          tags: ["Contests"],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    contestId: { type: "string" },
                  },
                  required: ["contestId"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Joined contest" },
            "400": { description: "Already joined or contest not joinable" },
            "401": { description: "Not authenticated" },
            "404": { description: "Contest not found" },
          },
        },
      },

      "/api/v1/student/contest/submit-dsa": {
        post: {
          summary: "Submit DSA solution in contest",
          tags: ["Contests"],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    contestId: { type: "string" },
                    questionId: { type: "string" },
                    language: { type: "string", enum: ["c", "cpp", "java", "javascript", "python", "go", "rust"] },
                    sourceCode: { type: "string" },
                  },
                  required: ["contestId", "questionId", "language", "sourceCode"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Submission result",
              content: { "application/json": { schema: { $ref: "#/components/schemas/SubmitResult" } } },
            },
            "400": { description: "Validation error" },
            "401": { description: "Not authenticated" },
            "403": { description: "Not participating or contest ended" },
          },
        },
      },

      "/api/v1/student/contest/{id}/leaderboard": {
        get: {
          summary: "Get contest leaderboard",
          tags: ["Contests"],
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Leaderboard sorted by score",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        rank: { type: "integer" },
                        userId: { type: "string" },
                        userName: { type: "string" },
                        score: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
            "401": { description: "Not authenticated" },
            "404": { description: "Contest not found" },
          },
        },
      },

      // ── Problems ───────────────────────────────────────────────────────────
      "/api/v1/problems": {
        get: {
          summary: "List all problems",
          description: "Returns a list of all available coding problems (summary only, no test cases).",
          tags: ["Problems"],
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "List of problems",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ProblemSummary" },
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
      },

      "/api/v1/problems/{slug}": {
        get: {
          summary: "Get problem details",
          description: "Returns full problem details including description, constraints, and sample test cases. Hidden and public test cases are not exposed.",
          tags: ["Problems"],
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: "slug",
              in: "path",
              required: true,
              schema: { type: "string" },
              example: "two-sum",
            },
          ],
          responses: {
            "200": {
              description: "Problem details with sample test cases",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ProblemDetail" } } },
            },
            "401": { description: "Unauthorized" },
            "404": { description: "Problem not found" },
          },
        },
      },

      // ── Code Execution ─────────────────────────────────────────────────────
      "/api/v1/submissions/run": {
        post: {
          summary: "Run code (playground)",
          description:
            "Execute code with custom stdin in a sandbox. Returns stdout/stderr immediately. " +
            "No database record is created. Rate limited to 15 req/min.",
          tags: ["Code Execution"],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    language: {
                      type: "string",
                      enum: ["c", "cpp", "java", "javascript", "python", "go", "rust"],
                    },
                    sourceCode: { type: "string", maxLength: 100000 },
                    stdin: { type: "string", maxLength: 10000, description: "Optional input" },
                  },
                  required: ["language", "sourceCode"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Execution result",
              content: { "application/json": { schema: { $ref: "#/components/schemas/RunResult" } } },
            },
            "400": {
              description: "Validation error",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "401": { description: "Unauthorized" },
            "429": { description: "Rate limited (15 req/min)" },
          },
        },
      },

      "/api/v1/submissions": {
        post: {
          summary: "Submit code against a problem",
          description:
            "Submits code to be tested against all test cases (sample + public + hidden) for a problem. " +
            "Execution stops on first failure. Results include per-test-case details with visibility control:\n" +
            "- **sample/public**: shows input, expected output, your output, and errors\n" +
            "- **hidden**: only shows pass/fail status, no details\n\n" +
            "A submission record is saved. Rate limited to 15 req/min.",
          tags: ["Code Execution"],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    problemId: { type: "string", example: "two-sum", description: "Problem slug" },
                    language: {
                      type: "string",
                      enum: ["c", "cpp", "java", "javascript", "python", "go", "rust"],
                    },
                    sourceCode: { type: "string", maxLength: 100000 },
                  },
                  required: ["problemId", "language", "sourceCode"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Submission verdict with per-test-case results",
              content: { "application/json": { schema: { $ref: "#/components/schemas/SubmitResult" } } },
            },
            "400": {
              description: "Validation error or problem not found",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "401": { description: "Unauthorized" },
            "429": { description: "Rate limited (15 req/min)" },
          },
        },
        get: {
          summary: "List user's submissions",
          description: "Returns the authenticated user's submission history, optionally filtered by problem.",
          tags: ["Submissions"],
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: "problemId",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Filter by problem slug",
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", default: 20, minimum: 1, maximum: 100 },
            },
            {
              name: "offset",
              in: "query",
              required: false,
              schema: { type: "integer", default: 0, minimum: 0 },
            },
          ],
          responses: {
            "200": {
              description: "Paginated submission list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      submissions: {
                        type: "array",
                        items: { $ref: "#/components/schemas/SubmissionSummary" },
                      },
                      total: { type: "integer" },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
      },

      "/api/v1/submissions/{id}": {
        get: {
          summary: "Get submission by ID",
          description: "Returns a single submission's full details (must belong to the authenticated user).",
          tags: ["Submissions"],
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Submission details",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      problemId: { type: "string" },
                      language: { type: "string" },
                      sourceCode: { type: "string" },
                      status: { type: "string" },
                      testCasesPassed: { type: "integer" },
                      totalTestCases: { type: "integer" },
                      failedAt: { type: "integer", nullable: true },
                      runtime: { type: "string", nullable: true },
                      memory: { type: "number", nullable: true },
                      errorOutput: { type: "string", nullable: true },
                      createdAt: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
            "404": { description: "Submission not found" },
          },
        },
      },

      // ── Judge0 Health ──────────────────────────────────────────────────────
      "/api/v1/judge0/health": {
        get: {
          summary: "Judge0 health check",
          description: "Checks connectivity to the Judge0 code execution service.",
          tags: ["System"],
          security: [],
          responses: {
            "200": {
              description: "Judge0 is reachable",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "healthy" },
                      judge0: { type: "object", description: "Judge0 system info" },
                    },
                  },
                },
              },
            },
            "503": {
              description: "Judge0 is unreachable",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "unhealthy" },
                      message: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
