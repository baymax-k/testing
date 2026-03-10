// ─── OpenAPI / Swagger Specification ────────────────────────────────────────────
// Extracted from app.ts so it can evolve independently.
// Devs: add new paths here when creating endpoints in route modules.

import swaggerJsdoc from "swagger-jsdoc";

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CodeEthnics Backend API",
      version: "3.0.0",
      description:
        "Backend API for the CodeEthnics student coding platform.\n\n" +
        "**Authentication** — Email/password, OTP verification, role-based access\n" +
        "**Problems** — Browse coding problems with sample test cases\n" +
        "**Code Execution** — Run code in a sandbox (playground) or submit against test cases\n" +
        "**Submissions** — Track submission history and verdicts\n\n" +
        "Rate limits: 15 submissions/min per user, 8 auth requests/min per IP.",
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
            // token may be null when signup requires email verification; clients should
            // call /get-session after OTP verification to obtain a real token.
            token: { type: "string", nullable: true },
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
            "Because the account requires email verification (`requireEmailVerification: true`), the returned `token` field will be `null` until the user completes OTP verification. " +
            "Clients should call `GET /api/v1/auth/get-session` after verification to retrieve a valid session token.",
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
              description: "User registered & verification email sent. `token` may be null until email is verified.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Session" } } },
            },
            "422": {
              description: "Validation error / user already exists",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },

      "/api/v1/auth/sign-in": {
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

      "/api/v1/auth/sign-out": {
        post: {
          summary: "Logout (invalidate session)",
          tags: ["Authentication"],
          responses: {
            "200": { description: "Session destroyed" },
          },
        },
      },

      "/api/v1/auth/get-session": {
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

      // ── Email OTP ──────────────────────────────────────────────────────────
      "/api/v1/auth/email-otp/send-verification-otp": {
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

      "/api/v1/auth/email-otp/verify-email": {
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

      // ── Change Password (logged-in user) ────────────────────────────────────
      "/api/v1/auth/change-password": {
        post: {
          summary: "Change password (logged-in user)",
          description:
            "Allows a logged-in user to change their password by providing their current password " +
            "and a new password. Handled natively by Better Auth. " +
            "Set `revokeOtherSessions` to true to invalidate all other active sessions.",
          tags: ["Authentication"],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    currentPassword: { type: "string", description: "The user's current password" },
                    newPassword: { type: "string", minLength: 8, description: "The new password (min 8 chars)" },
                    revokeOtherSessions: {
                      type: "boolean",
                      description: "If true, all other active sessions are invalidated",
                      default: false,
                    },
                  },
                  required: ["currentPassword", "newPassword"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Password changed successfully",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Success" } } },
            },
            "400": {
              description: "Invalid current password or weak new password",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "401": {
              description: "Not authenticated",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },

      // ── Password Reset ─────────────────────────────────────────────────────
      "/api/v1/auth/email-otp/request-password-reset": {
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

      "/api/v1/auth/email-otp/reset-password": {
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

      "/api/v1/auth/email-otp/check-verification-otp": {
        post: {
          summary: "Verify an OTP code (optional pre-check)",
          description:
            "Validates the OTP before resetting the password. Use this to show the user " +
            "an error early if the code is wrong, before they type a new password.",
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
                    type: { type: "string", enum: ["forget-password"] },
                  },
                  required: ["email", "otp", "type"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "OTP is valid",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Success" } } },
            },
            "400": {
              description: "Invalid or expired OTP",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },

      // ── Admin ──────────────────────────────────────────────────────────────
      "/api/v1/admin/create-user": {
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

      "/api/v1/admin/dashboard": {
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
      "/api/v1/student/dashboard": {
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
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden – not a student" },
          },
        },
      },

      // ── Common ─────────────────────────────────────────────────────────────
      "/api/v1/me": {
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
