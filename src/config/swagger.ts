// G��G��G�� OpenAPI / Swagger Specification G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
// Reflects the current JWT cookie-based auth, all route modules, and Prisma schema.

import swaggerJsdoc from "swagger-jsdoc";

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CodeEthnics Backend API",
      version: "4.1.0",
      description:
        "Complete Backend API for the CodeEthnics institutional coding and learning platform.\n\n" +
        "🎓 **Student Learning Platform Features:**\n" +
        "• **Authentication** — JWT cookie-based auth with email verification, password reset, RBAC\n" +
        "• **Problem Solving** — 847+ DSA problems with Judge0 execution, multi-language support\n" +
        "• **Arduino Programming** — Hardware-level compilation, simulation, HEX generation, real board deployment\n" +
        "• **MCQ Practice** — Topic-wise practice sessions, instant feedback, progress tracking\n" +
        "• **Contest System** — Real-time competitions with leaderboards, DSA+MCQ+Arduino problems\n" +
        "• **POTD System** — Daily challenges with streak tracking and community features\n" +
        "• **Student Dashboard** — Real-time analytics, recent activity, progress tracking, insights\n" +
        "• **Code Management** — Auto-save drafts, submission history, performance analysis\n\n" +
        "🛠️ **Technical Architecture:**\n" +
        "• **Database**: PostgreSQL with Prisma ORM for type-safe operations\n" +
        "• **Code Execution**: Judge0 API for secure sandboxed execution\n" +
        "• **Arduino Compilation**: Arduino-CLI with BullMQ queue system\n" +
        "• **File Storage**: ImageKit CDN for HEX files and media\n" +
        "• **Authentication**: JWT tokens with refresh mechanism\n" +
        "• **Rate Limiting**: 15 submissions/min, 100 requests/15min per IP\n\n" +
        "📊 **Production Ready**: Load tested, security hardened, comprehensive API documentation",
    },
    servers: [
      {
        url: process.env.APP_URL || "http://localhost:5000",
        description: "Development server",
      },
    ],
    tags: [
      {
        name: "Proctoring",
        description: "Student proctoring evidence upload and reviewer moderation endpoints.",
      },
      {
        name: "College Admin - Auth",
        description: "Authentication and session endpoints for college-admin portal access.",
      },
      {
        name: "College Admin - Tests",
        description: "Test lifecycle management, question management, and test operations.",
      },
      {
        name: "College Admin - Batches",
        description: "Batch creation, assignment, and batch-level management operations.",
      },
      {
        name: "College Admin - Departments",
        description: "Department creation and administration endpoints.",
      },
      {
        name: "College Admin - Students",
        description: "Student and user-management endpoints within the college-admin domain.",
      },
      {
        name: "College Admin - Reports",
        description: "Reporting endpoints across student, batch, test, and department views.",
      },
      {
        name: "College Admin - Performance",
        description: "Performance analytics, status, leaderboards, and skill insights.",
      },
      {
        name: "Arduino Platform",
        description: "Arduino code compilation, job management, and hardware problem solving.",
      },
      {
        name: "Arduino Problems",
        description: "Browse and manage Arduino coding problems and test cases.",
      },
      {
        name: "Arduino Jobs",
        description: "Submit, monitor, and manage Arduino compilation jobs.",
      },
      {
        name: "Arduino Admin",
        description: "Administrative endpoints for Arduino platform management.",
      },
    ],

    // G��G�� Reusable components G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
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
            actualOutput: { type: "string", description: "Only shown for sample/public test cases" },
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
        PreSubmitResult: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["processing", "accepted", "wrong_answer", "time_limit_exceeded", "memory_limit_exceeded", "runtime_error", "compilation_error", "internal_error"],
            },
            testCasesPassed: { type: "integer" },
            totalTestCases: { type: "integer", description: "Number of sample test cases executed" },
            failedAt: { type: "integer", nullable: true, description: "1-indexed sample test case that failed first" },
            runtime: { type: "string", nullable: true, example: "0.045" },
            memory: { type: "number", nullable: true, description: "Peak memory in KB" },
            errorOutput: { type: "string", nullable: true },
            testCaseResults: {
              type: "array",
              items: { $ref: "#/components/schemas/TestCaseDetail" },
              description: "Per-sample-test-case results",
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
            problem: {
              type: "object",
              nullable: true,
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                slug: { type: "string" },
                difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                tags: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
        StudentProfileResponse: {
          type: "object",
          properties: {
            profile: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                username: { type: "string" },
                email: { type: "string" },
                image: { type: "string", nullable: true },
                phone: { type: "string", nullable: true },
                role: { type: "string" },
                emailVerified: { type: "boolean" },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
              },
            },
            stats: {
              type: "object",
              properties: {
                problemsSolvedCount: { type: "integer" },
                difficultyBreakdown: {
                  type: "object",
                  properties: {
                    easy: { type: "integer" },
                    medium: { type: "integer" },
                    hard: { type: "integer" },
                  },
                },
                topicMastery: {
                  type: "object",
                  additionalProperties: { type: "integer" },
                  description: "Count of solved problems grouped by tag/topic",
                },
                mcqSessionsSolvedCount: { type: "integer" },
                totalSubmissions: { type: "integer" },
                acceptedSubmissions: { type: "integer" },
              },
            },
            streak: {
              type: "object",
              nullable: true,
              properties: {
                currentStreak: { type: "integer" },
                longestStreak: { type: "integer" },
                lastSolveDate: { type: "string", format: "date", nullable: true },
              },
            },
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
        QuestionSummary: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            statement: { type: "string" },
            options: { type: "array", items: { type: "string" } },
            topic: { type: "string", nullable: true },
            difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          },
        },
        RandomPracticeRequest: {
          type: "object",
          properties: {
            count: { type: "integer", default: 10, maximum: 25 },
            topics: { type: "array", items: { type: "string" } },
            difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
            seed: { type: "string" },
            excludeIds: { type: "array", items: { type: "string" } },
          },
          required: ["topics"],
        },
        RandomPracticeResponse: {
          type: "object",
          properties: {
            seed: { type: "string" },
            poolSize: { type: "integer" },
            reset: { type: "boolean" },
            questions: { type: "array", items: { $ref: "#/components/schemas/QuestionSummary" } },
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
        ProctoringUploadUrlResponse: {
          type: "object",
          properties: {
            uploadUrl: { type: "string", format: "uri" },
            objectKey: { type: "string" },
            expiresInSeconds: { type: "integer" },
            maxUploadBytes: { type: "integer" },
          },
        },
        ProctoringVideoStoredResponse: {
          type: "object",
          properties: {
            videoId: { type: "string" },
            status: { type: "string", enum: ["stored"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        ProctoringVideoListItem: {
          type: "object",
          properties: {
            videoId: { type: "string" },
            studentId: { type: "string" },
            testId: { type: "string" },
            attemptId: { type: "string" },
            violationType: {
              type: "string",
              enum: ["NO_FACE_DETECTED", "MULTIPLE_FACES", "OFF_SCREEN_GAZE", "TAB_SWITCH", "FULLSCREEN_EXIT", "OTHER"],
            },
            startedAt: { type: "string", format: "date-time" },
            endedAt: { type: "string", format: "date-time" },
            durationMs: { type: "integer" },
            reviewStatus: { type: "string", enum: ["pending", "confirmed", "dismissed", "needs_review"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        ProctoringVideoListResponse: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: { $ref: "#/components/schemas/ProctoringVideoListItem" },
            },
            pagination: {
              type: "object",
              properties: {
                page: { type: "integer" },
                limit: { type: "integer" },
                total: { type: "integer" },
                pages: { type: "integer" },
              },
            },
          },
        },
        ProctoringAccessUrlResponse: {
          type: "object",
          properties: {
            accessUrl: { type: "string", format: "uri" },
            expiresInSeconds: { type: "integer" },
          },
        },
        ProctoringReviewResponse: {
          type: "object",
          properties: {
            videoId: { type: "string" },
            reviewStatus: { type: "string", enum: ["pending", "confirmed", "dismissed", "needs_review"] },
            reviewedBy: { type: "string" },
            reviewedAt: { type: "string", format: "date-time" },
          },
        },
      },
    },

    // G��G�� Paths G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
    paths: {
      // G��G�� Authentication G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
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
              description: "Signed in G�� cookies set",
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

      "/api/v1/auth/sign-in/google": {
        post: {
          summary: "Sign in with Google ID token",
          description:
            "Verifies a Google ID token received from the frontend and signs the user in. " +
            "If no account exists for the token email, a new `student` account is created automatically. " +
            "Sets `access_token` and `refresh_token` httpOnly cookies on success.",
          tags: ["Authentication"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    idToken: {
                      type: "string",
                      description: "Google ID token from frontend Google Sign-In flow",
                    },
                  },
                  required: ["idToken"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Signed in with Google G�� cookies set",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: { type: "string", example: "Signed in with Google" },
                      user: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Validation error (missing/invalid idToken)",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "401": {
              description: "Google sign-in failed (invalid/expired token)",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "403": {
              description: "Google account email is not verified",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "429": { description: "Rate limited (15 req/min)" },
          },
        },
      },

      "/api/v1/auth/google-client-id": {
        get: {
          summary: "Get Google OAuth client ID",
          description: "Returns frontend-safe Google client id configured on server.",
          tags: ["Authentication"],
          security: [],
          responses: {
            "200": {
              description: "Google client id payload",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      clientId: { type: "string", nullable: true },
                    },
                  },
                },
              },
            },
          },
        },
      },

      "/api/v1/auth/status": {
        get: {
          summary: "Check authentication status",
          description: "Returns whether current request is authenticated and user details if logged in.",
          tags: ["Authentication"],
          security: [],
          responses: {
            "200": {
              description: "Authentication status",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      authenticated: { type: "boolean" },
                      user: {
                        type: "object",
                        nullable: true,
                        properties: {
                          id: { type: "string" },
                          email: { type: "string" },
                          role: { type: "string" },
                          name: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
            "500": { description: "Failed to check authentication status" },
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
              description: "Tokens refreshed G�� new cookies set",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Message" } } },
            },
            "401": {
              description: "No refresh token, expired, or revoked",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },

      // G��G�� Email Verification G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
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
              description: "Email verified G�� auto signed in, cookies set",
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

      // G��G�� Password Reset G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
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
              description: "Password reset G�� all sessions revoked",
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

      // G��G�� Change Password (authenticated) G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
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

      // G��G�� Common G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
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

      // G��G�� Admin G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
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
            "403": { description: "Forbidden G�� not a product_admin" },
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
            "403": { description: "Forbidden G�� insufficient role" },
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
            "403": { description: "Forbidden G�� not a product_admin" },
          },
        },
      },

      // G��G�� Student G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
      "/api/v1/student/dashboard": {
        get: {
          summary: "Student dashboard with real-time analytics",
          description: "Comprehensive dashboard showing student statistics, recent activity, contest notifications, and progress tracking.",
          tags: ["Student"],
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "Student dashboard with complete analytics data",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      data: {
                        type: "object",
                        properties: {
                          panel: { type: "string", example: "student" },
                          message: { type: "string", example: "Welcome back, John Doe!" },
                          stats: {
                            type: "object",
                            properties: {
                              totalProblems: { type: "integer", example: 847, description: "Total problems available on platform" },
                              solvedProblems: { type: "integer", example: 156, description: "Problems solved by student" },
                              totalSubmissions: { type: "integer", example: 324, description: "Total code submissions" },
                              acceptedSubmissions: { type: "integer", example: 245, description: "Successful submissions" },
                              acceptanceRate: { type: "integer", example: 78, description: "Success rate percentage" },
                              currentStreak: { type: "integer", example: 12, description: "Current POTD streak" },
                              longestStreak: { type: "integer", example: 28, description: "Longest POTD streak achieved" },
                              lastSolveDate: { type: "string", format: "date", nullable: true, description: "Last problem solve date" }
                            }
                          },
                          recentActivity: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                id: { type: "string" },
                                type: { type: "string", enum: ["dsa_solved", "arduino_solved", "mcq_practice", "contest_joined"] },
                                title: { type: "string", example: "Solved Two Sum Problem" },
                                description: { type: "string", example: "DSA problem solved successfully" },
                                timestamp: { type: "string", format: "date-time" },
                                points: { type: "integer", nullable: true },
                                difficulty: { type: "string", enum: ["easy", "medium", "hard"], nullable: true }
                              }
                            },
                            description: "Recent student activities (last 10)"
                          },
                          upcomingContests: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                id: { type: "string" },
                                title: { type: "string", example: "Weekly Contest #47" },
                                startTime: { type: "string", format: "date-time" },
                                duration: { type: "integer", example: 120, description: "Duration in minutes" },
                                type: { type: "string", example: "contest" },
                                participantCount: { type: "integer", example: 245 }
                              }
                            },
                            description: "Next 5 upcoming contests"
                          },
                          potdStreak: {
                            type: "object",
                            properties: {
                              current: { type: "integer", example: 12 },
                              longest: { type: "integer", example: 28 },
                              todaySolved: { type: "boolean", example: false }
                            }
                          },
                          progressToday: {
                            type: "object",
                            properties: {
                              problemsSolved: { type: "integer", example: 2 },
                              mcqSolved: { type: "integer", example: 15 },
                              practiceMinutes: { type: "integer", example: 0 }
                            }
                          },
                          weeklyProgress: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                date: { type: "string", format: "date" },
                                problems: { type: "integer" },
                                mcq: { type: "integer" }
                              }
                            },
                            description: "Last 7 days activity"
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            "401": { description: "Not authenticated" },
            "403": { description: "Forbidden — not a student" },
            "500": { description: "Failed to fetch dashboard data" }
          }
        }
      },

      "/api/v1/student/profile": {
        get: {
          summary: "Get student profile",
          tags: ["Student"],
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "Student profile with stats and streak",
              content: { "application/json": { schema: { $ref: "#/components/schemas/StudentProfileResponse" } } },
            },
            "401": { description: "Not authenticated" },
            "403": { description: "Forbidden G�� not a student" },
          },
        },
      },

      // G��G�� Practice G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
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
                      problems: { type: "array", items: { $ref: "#/components/schemas/Question" } },
                      pagination: {
                        type: "object",
                        properties: {
                          page: { type: "integer" },
                          limit: { type: "integer" },
                          total: { type: "integer" },
                          pages: { type: "integer" },
                        },
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

      "/api/v1/student/practice/mcq/topics": {
        get: {
          summary: "List MCQ practice topics",
          description: "Returns all available MCQ tag topics for topic-based session creation.",
          tags: ["Practice"],
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "MCQ topic list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      topics: {
                        type: "array",
                        items: { type: "string" },
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

      "/api/v1/student/practice/mcq/session": {
        post: {
          summary: "Create topic-based MCQ session (POST only)",
          description:
            "Creates and persists an MCQ practice session based on selected topics with 10-15 questions. " +
            "Use POST from Swagger Try it out — opening this URL in browser tab (GET) will not work.",
          tags: ["Practice"],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                example: {
                    topics: ["arrays", "sql"],
                    difficulty: "easy",
                  },
                  schema: {
                    type: "object",
                    properties: {
                      topics: {
                        type: "array",
                        minItems: 1,
                        items: { type: "string" },
                      },
                      difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                    },
                    required: ["topics"],
                  },
              },
            },
          },
          responses: {
            "200": {
              description: "Session created",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      session: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          topics: { type: "array", items: { type: "string" } },
                          requestedCount: { type: "integer" },
                          returnedCount: { type: "integer" },
                          status: { type: "string", enum: ["in_progress", "submitted"] },
                          createdAt: { type: "string", format: "date-time" },
                        },
                      },
                      questions: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Question" },
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation failed / insufficient questions" },
            "401": { description: "Not authenticated" },
            "404": { description: "No questions found" },
          },
        },
      },

      "/api/v1/student/practice/random": {
        post: {
          summary: "Generate random MCQ practice set",
          description: "Generates a non-persistent random MCQ set based on filters. This does not create a stored session.",
          tags: ["Practice"],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RandomPracticeRequest" },
                example: {
                  count: 5,
                  topics: ["arrays", "strings"],
                  difficulty: "easy",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Random MCQ set generated",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/RandomPracticeResponse" },
                },
              },
            },
            "400": { description: "Validation failed" },
            "401": { description: "Not authenticated" },
            "500": { description: "Failed to generate random MCQ set" },
          },
        },
      },

      "/api/v1/student/practice/mcq/session/submit": {
        post: {
          summary: "Submit full MCQ session (POST only)",
          description: "Submits all answers for a persisted MCQ session and calculates score on backend.",
          tags: ["Practice"],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                example: {
                  sessionId: "cmmxgd7ql000psb4z4ne8jnt3",
                  answers: [
                    { questionId: "mcq-practice-020", selectedOption: 0 },
                    { questionId: "mcq-practice-019", selectedOption: 0 },
                  ],
                },
                schema: {
                  type: "object",
                  properties: {
                    sessionId: { type: "string" },
                    answers: {
                      type: "array",
                      minItems: 1,
                      items: {
                        type: "object",
                        properties: {
                          questionId: { type: "string" },
                          selectedOption: { type: "integer", minimum: 0 },
                        },
                        required: ["questionId", "selectedOption"],
                      },
                    },
                  },
                  required: ["sessionId", "answers"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Session submitted with review",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      session: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          status: { type: "string", enum: ["submitted"] },
                          topics: { type: "array", items: { type: "string" } },
                          totalQuestions: { type: "integer" },
                          correctCount: { type: "integer" },
                          score: { type: "integer" },
                          submittedAt: { type: "string", format: "date-time" },
                        },
                      },
                      review: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            questionId: { type: "string" },
                            title: { type: "string" },
                            selectedOption: { type: "integer" },
                            selectedOptionText: { type: "string" },
                            correctAnswer: { type: "integer" },
                            correctOptionText: { type: "string" },
                            isCorrect: { type: "boolean" },
                            points: { type: "integer" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation failed / already submitted / incomplete payload" },
            "401": { description: "Not authenticated" },
            "404": { description: "Session not found" },
          },
        },
      },
      "/api/v1/student/practice/activity": {
        post: {
          summary: "Record practice activity",
          description: "Record a practice activity for the authenticated user. Use `type` to indicate action: `mcq`, `dsa`, `visit`, or `solve`.",
          tags: ["Practice"],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["type"],
                  properties: {
                    type: { type: "string", enum: ["mcq", "dsa", "visit", "solve"] },
                  },
                },
                example: { type: "mcq" },
              },
            },
          },
          responses: {
            "200": {
              description: "Activity recorded",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { activity: { $ref: "#/components/schemas/DailyPracticeActivity" } } },
                },
              },
            },
            "401": { description: "Not authenticated" },
            "400": { description: "Validation failed" },
          },
        },
        get: {
          summary: "Get today's activity or recent range",
          description: "Returns today's activity by default. Use `?days=N` to fetch the last N days (max 365).",
          tags: ["Practice"],
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: "days", in: "query", schema: { type: "integer", minimum: 1, maximum: 365 }, description: "Optional range length in days" },
          ],
          responses: {
            "200": {
              description: "Activity data",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { activity: { oneOf: [ { $ref: "#/components/schemas/DailyPracticeActivity" }, { type: "array", items: { $ref: "#/components/schemas/DailyPracticeActivity" } } ] } } },
                },
              },
            },
            "401": { description: "Not authenticated" },
          },
        },
      },

      "/api/v1/student/practice/mcq/history": {
        get: {
          summary: "Get MCQ practice history",
          description: "Returns paginated MCQ session history for the authenticated user.",
          tags: ["Practice"],
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 10, minimum: 1, maximum: 50 } },
          ],
          responses: {
            "200": {
              description: "MCQ session history",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      history: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            topics: { type: "array", items: { type: "string" } },
                            status: { type: "string", enum: ["in_progress", "submitted"] },
                            requestedCount: { type: "integer" },
                            totalQuestions: { type: "integer" },
                            answeredCount: { type: "integer" },
                            correctCount: { type: "integer" },
                            score: { type: "integer" },
                            submittedAt: { type: "string", format: "date-time", nullable: true },
                            createdAt: { type: "string", format: "date-time" },
                          },
                        },
                      },
                      pagination: {
                        type: "object",
                        properties: {
                          page: { type: "integer" },
                          limit: { type: "integer" },
                          total: { type: "integer" },
                          pages: { type: "integer" },
                        },
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

      "/api/v1/student/practice/mcq/history/{sessionId}": {
        get: {
          summary: "Get MCQ session history detail",
          description: "Returns per-question review for a specific MCQ session owned by the authenticated user.",
          tags: ["Practice"],
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "MCQ session detail" },
            "401": { description: "Not authenticated" },
            "404": { description: "Session not found" },
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
          description: "Submit an MCQ answer for instant feedback (single-question check).",
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
                        isCorrect: { type: "boolean" },
                      correctAnswer: { type: "integer" },
                        points: { type: "integer" },
                        explanation: { type: "string" },
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

      // G��G�� Contests G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
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

      "/api/v1/student/contest/{id}/mcq": {
        get: {
          summary: "Get contest MCQ/Arduino question set",
          description: "Returns contest question set for joined user, including current selected MCQ answers and remaining time.",
          tags: ["Contests"],
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Contest question payload",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      contest: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          title: { type: "string" },
                          startTime: { type: "string", format: "date-time", nullable: true },
                          endTime: { type: "string", format: "date-time", nullable: true },
                        },
                      },
                      questions: { type: "array", items: { type: "object" } },
                      participation: {
                        type: "object",
                        properties: {
                          startedAt: { type: "string", format: "date-time" },
                          submittedAt: { type: "string", format: "date-time", nullable: true },
                        },
                      },
                      timeLeftMs: { type: "number", nullable: true },
                    },
                  },
                },
              },
            },
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
                    problemId: { type: "string" },
                    language: { type: "string", enum: ["c", "cpp", "java", "javascript", "python", "go", "rust"] },
                    code: { type: "string" },
                  },
                  required: ["contestId", "problemId", "language", "code"],
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

      "/api/v1/student/contest/submit-mcq": {
        post: {
          summary: "Submit MCQ answers in contest",
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
                    answers: {
                      type: "object",
                      additionalProperties: { type: "integer", minimum: 0 },
                      description: "Map of questionId -> selectedOption",
                    },
                  },
                  required: ["contestId", "answers"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "MCQ submission result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: { type: "string" },
                      result: {
                        type: "object",
                        properties: {
                          participationId: { type: "string" },
                          attempted: { type: "integer" },
                          totalQuestions: { type: "integer" },
                          correct: { type: "integer" },
                          score: { type: "integer" },
                          maxScore: { type: "integer" },
                          submittedAt: { type: "string", format: "date-time" },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Not authenticated" },
            "403": { description: "Not participating or contest ended" },
            "404": { description: "Contest not found" },
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
                    type: "object",
                    properties: {
                      leaderboard: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            rank: { type: "integer" },
                            user: { type: "object" },
                            score: { type: "integer" },
                            startedAt: { type: "string", format: "date-time", nullable: true },
                          },
                        },
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

      // G��G�� Proctoring G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
      "/api/v1/proctoring/videos/upload-url": {
        post: {
          summary: "Create signed S3 upload URL for proctoring video segment",
          description:
            "Student-only endpoint. Validates test attempt ownership and returns a short-lived signed URL for direct S3 upload.",
          tags: ["Proctoring"],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    testId: { type: "string" },
                    attemptId: { type: "string" },
                    violationType: {
                      type: "string",
                      enum: ["NO_FACE_DETECTED", "MULTIPLE_FACES", "OFF_SCREEN_GAZE", "TAB_SWITCH", "FULLSCREEN_EXIT", "OTHER"],
                    },
                    mimeType: { type: "string", enum: ["video/webm", "video/mp4"] },
                    segmentStartMs: { type: "integer", minimum: 0 },
                    segmentEndMs: { type: "integer", minimum: 0 },
                    clientEventId: { type: "string", maxLength: 128 },
                  },
                  required: ["testId", "attemptId", "violationType", "mimeType"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Signed URL generated",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ProctoringUploadUrlResponse" } } },
            },
            "400": { description: "Validation error" },
            "401": { description: "Not authenticated" },
            "403": { description: "Forbidden (non-student role)" },
            "404": { description: "Attempt not found for this student" },
            "500": { description: "Server error" },
          },
        },
      },

      "/api/v1/proctoring/videos": {
        post: {
          summary: "Persist uploaded proctoring video metadata",
          description:
            "Student-only endpoint. Stores metadata after client uploads the video segment to S3.",
          tags: ["Proctoring"],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    testId: { type: "string" },
                    attemptId: { type: "string" },
                    objectKey: { type: "string" },
                    mimeType: { type: "string", enum: ["video/webm", "video/mp4"] },
                    violationType: {
                      type: "string",
                      enum: ["NO_FACE_DETECTED", "MULTIPLE_FACES", "OFF_SCREEN_GAZE", "TAB_SWITCH", "FULLSCREEN_EXIT", "OTHER"],
                    },
                    startedAt: { type: "string", format: "date-time" },
                    endedAt: { type: "string", format: "date-time" },
                    durationMs: { type: "integer", minimum: 0 },
                    meta: { type: "object", additionalProperties: true },
                    clientEventId: { type: "string", maxLength: 128 },
                  },
                  required: [
                    "testId",
                    "attemptId",
                    "objectKey",
                    "mimeType",
                    "violationType",
                    "startedAt",
                    "endedAt",
                  ],
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Metadata stored",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ProctoringVideoStoredResponse" } } },
            },
            "400": { description: "Validation error" },
            "401": { description: "Not authenticated" },
            "403": { description: "Forbidden (non-student role)" },
            "404": { description: "Attempt not found for this student" },
            "409": { description: "Duplicate clientEventId" },
            "422": { description: "Invalid object key prefix" },
          },
        },
      },

      "/api/v1/proctoring/tests/{testId}/videos": {
        get: {
          summary: "List proctoring videos for a test",
          description: "Reviewer/admin endpoint with filtering and pagination.",
          tags: ["Proctoring"],
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: "testId", in: "path", required: true, schema: { type: "string" } },
            { name: "attemptId", in: "query", schema: { type: "string" } },
            { name: "studentId", in: "query", schema: { type: "string" } },
            {
              name: "violationType",
              in: "query",
              schema: {
                type: "string",
                enum: ["NO_FACE_DETECTED", "MULTIPLE_FACES", "OFF_SCREEN_GAZE", "TAB_SWITCH", "FULLSCREEN_EXIT", "OTHER"],
              },
            },
            {
              name: "reviewStatus",
              in: "query",
              schema: { type: "string", enum: ["pending", "confirmed", "dismissed", "needs_review"] },
            },
            { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
          ],
          responses: {
            "200": {
              description: "Proctoring videos list",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ProctoringVideoListResponse" } } },
            },
            "400": { description: "Validation error" },
            "401": { description: "Not authenticated" },
            "403": { description: "Forbidden (insufficient role)" },
          },
        },
      },

      "/api/v1/proctoring/videos/{videoId}/access-url": {
        get: {
          summary: "Create signed read URL for a stored proctoring video",
          description: "Reviewer/admin endpoint to preview or download a proctoring video from S3.",
          tags: ["Proctoring"],
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: "videoId", in: "path", required: true, schema: { type: "string" } },
            {
              name: "disposition",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["inline", "attachment"], default: "inline" },
            },
          ],
          responses: {
            "200": {
              description: "Signed read URL generated",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ProctoringAccessUrlResponse" } } },
            },
            "400": { description: "Validation error" },
            "401": { description: "Not authenticated" },
            "403": { description: "Forbidden (insufficient role)" },
            "404": { description: "Video not found" },
          },
        },
      },

      "/api/v1/proctoring/videos/{videoId}/review": {
        patch: {
          summary: "Review and classify a proctoring violation",
          description: "Reviewer/admin endpoint to mark video evidence as confirmed/dismissed/needs review.",
          tags: ["Proctoring"],
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: "videoId", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    reviewStatus: { type: "string", enum: ["confirmed", "dismissed", "needs_review"] },
                    reviewNote: { type: "string", maxLength: 2000 },
                    severity: { type: "string", enum: ["low", "medium", "high"] },
                  },
                  required: ["reviewStatus"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Review saved",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ProctoringReviewResponse" } } },
            },
            "400": { description: "Validation error" },
            "401": { description: "Not authenticated" },
            "403": { description: "Forbidden (insufficient role)" },
            "404": { description: "Video not found" },
          },
        },
      },

      // G��G�� Problems G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
      "/api/v1/problems": {
        get: {
          summary: "List all problems",
          description: "Returns paginated coding problem summaries (no test cases). Supports difficulty/tag/search filters.",
          tags: ["Problems"],
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: "page",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, default: 1 },
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
            },
            {
              name: "difficulty",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["easy", "medium", "hard"] },
            },
            {
              name: "tag",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
            {
              name: "search",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Paginated list of problems",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      problems: {
                        type: "array",
                        items: { $ref: "#/components/schemas/ProblemSummary" },
                      },
                      pagination: {
                        type: "object",
                        properties: {
                          page: { type: "integer" },
                          limit: { type: "integer" },
                          total: { type: "integer" },
                          pages: { type: "integer" },
                        },
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
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      problem: { $ref: "#/components/schemas/ProblemDetail" },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
            "404": { description: "Problem not found" },
          },
        },
      },

      // G��G�� Code Execution G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
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

      "/api/v1/submissions/test": {
        post: {
          summary: "Pre-submit test (sample test cases only)",
          description:
            "Runs submitted code against sample test cases only (typically 2-4) for fast feedback before full submission. " +
            "No submission record is stored in the database.",
          tags: ["Code Execution"],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    problemId: { type: "string", example: "fizzbuzz", description: "Problem slug" },
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
              description: "Pre-submit sample test result",
              content: { "application/json": { schema: { $ref: "#/components/schemas/PreSubmitResult" } } },
            },
            "400": {
              description: "Validation error",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "401": { description: "Unauthorized" },
            "404": { description: "Problem not found" },
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
          description:
            "Returns the authenticated user's submission history with filtering and pagination. " +
            "Submissions include basic problem metadata when available.",
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
              name: "status",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: [
                  "processing",
                  "accepted",
                  "wrong_answer",
                  "time_limit_exceeded",
                  "memory_limit_exceeded",
                  "runtime_error",
                  "compilation_error",
                  "internal_error",
                ],
              },
              description: "Filter by submission status",
            },
            {
              name: "language",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Filter by language",
            },
            {
              name: "from",
              in: "query",
              required: false,
              schema: { type: "string", format: "date" },
              description: "Filter submissions created on/after this date (YYYY-MM-DD)",
            },
            {
              name: "to",
              in: "query",
              required: false,
              schema: { type: "string", format: "date" },
              description: "Filter submissions created on/before this date (YYYY-MM-DD)",
            },
            {
              name: "page",
              in: "query",
              required: false,
              schema: { type: "integer", default: 1, minimum: 1 },
              description: "Page number (1-indexed)",
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", default: 20, minimum: 1, maximum: 100 },
              description: "Items per page",
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
                      pagination: {
                        type: "object",
                        properties: {
                          page: { type: "integer" },
                          limit: { type: "integer" },
                          total: { type: "integer" },
                          pages: { type: "integer" },
                        },
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

      // G��G�� Judge0 Health G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
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

      // ── Problem of the Day (POTD) ─────────────────────────────────────────────
      "/api/v1/student/potd": {
        get: {
          summary: "Get today's Problem of the Day",
          description:
            "Returns the current day's challenge question, solve status, and the user's streak summary. " +
            "If no challenge has been scheduled for today, one is auto-selected from the MCQ question pool.",
          tags: ["POTD"],
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "Today's daily challenge",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/PotdResponse" },
                },
              },
            },
            "401": { description: "Not authenticated" },
            "404": { description: "No MCQ questions available in the database" },
          },
        },
      },

      "/api/v1/student/potd/solve": {
        post: {
          summary: "Submit POTD answer",
          description:
            "Submit an answer for the daily challenge. For MCQ provide `selectedOption`. For DSA provide `languageId` and `sourceCode`. " +
            "Once submitted, the answer is locked and cannot be changed. Streak is updated on successful solves.",
          tags: ["POTD"],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["dailyChallengeId"],
                  properties: {
                    dailyChallengeId: {
                      type: "string",
                      description: "ID of the DailyChallenge (from GET /potd)",
                    },
                    // MCQ
                    selectedOption: {
                      type: "integer",
                      minimum: 0,
                      description: "0-indexed option chosen by the student (MCQ)",
                    },
                    // DSA
                    languageId: { type: "integer", description: "Judge0 language id for code execution (DSA)" },
                    sourceCode: { type: "string", description: "Source code to run against the problem's test cases (DSA)" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Solve result with streak update",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      // Common
                      isCorrect: { type: "boolean" },
                      streak: { $ref: "#/components/schemas/UserStreak" },
                      // MCQ-specific
                      correctAnswer: { type: "integer", nullable: true },
                      selectedOption: { type: "integer", nullable: true },
                      // DSA-specific
                      languageId: { type: "integer", nullable: true },
                      testCaseResults: { type: "array", items: { $ref: "#/components/schemas/TestCaseDetail" }, nullable: true },
                      firstFailure: { type: "object", nullable: true },
                    },
                  },
                },
              },
            },
            "400": { description: "Already solved, invalid option, or validation error" },
            "401": { description: "Not authenticated" },
            "404": { description: "Daily challenge not found" },
          },
        },
      },

      "/api/v1/student/potd/streak": {
        get: {
          summary: "Get user's streak info",
          description: "Returns the current streak, longest streak, and last solve date.",
          tags: ["POTD"],
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "Streak data",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      streak: { $ref: "#/components/schemas/UserStreak" },
                    },
                  },
                },
              },
            },
            "401": { description: "Not authenticated" },
          },
        },
      },

      "/api/v1/student/potd/history": {
        get: {
          summary: "POTD history with solve status",
          description: "Paginated list of past daily challenges with whether the student solved them.",
          tags: ["POTD"],
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: "page",
              in: "query",
              schema: { type: "integer", default: 1 },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 10, maximum: 50 },
            },
          ],
          responses: {
            "200": {
              description: "Paginated POTD history",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      history: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            date: { type: "string", format: "date" },
                            question: {
                              type: "object",
                              properties: {
                                id: { type: "string" },
                                title: { type: "string" },
                                difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                                type: { type: "string", enum: ["mcq", "dsa"] },
                                tags: { type: "array", items: { type: "string" } },
                              },
                            },
                            solved: { type: "boolean" },
                            isCorrect: { type: "boolean", nullable: true },
                            solvedAt: { type: "string", format: "date-time", nullable: true },
                          },
                        },
                      },
                      pagination: {
                        type: "object",
                        properties: {
                          page: { type: "integer" },
                          limit: { type: "integer" },
                          total: { type: "integer" },
                          pages: { type: "integer" },
                        },
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

      // ── MCQ Stats & Session Resume ─────────────────────────────────────────────
      "/api/v1/student/practice/mcq/stats": {
        get: {
          summary: "Get MCQ practice statistics",
          description:
            "Returns overall accuracy, total sessions, total questions answered, and topic-wise performance breakdown.",
          tags: ["Practice"],
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "MCQ statistics",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      stats: { $ref: "#/components/schemas/McqStats" },
                    },
                  },
                },
              },
            },
            "401": { description: "Not authenticated" },
          },
        },
      },

      "/api/v1/student/practice/mcq/session/{sessionId}": {
        get: {
          summary: "Resume an MCQ session",
          description:
            "Fetches an in-progress or submitted MCQ session by ID with all questions and any already-saved answers.",
          tags: ["Practice"],
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: "sessionId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Session with questions and answered map",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      session: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          topics: { type: "array", items: { type: "string" } },
                          difficulty: { type: "string", nullable: true },
                          requestedCount: { type: "integer" },
                          totalQuestions: { type: "integer" },
                          status: { type: "string", enum: ["in_progress", "submitted"] },
                          createdAt: { type: "string", format: "date-time" },
                        },
                      },
                      questions: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Question" },
                      },
                      answeredQuestions: {
                        type: "object",
                        description: "Map of questionId → selectedOption for already-answered questions",
                        additionalProperties: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
            "401": { description: "Not authenticated" },
            "404": { description: "Session not found" },
          },
        },
      },

      "/api/college-admin/mentors/{mentorId}/students": {
        get: {
          summary: "List students assigned to a mentor",
          description:
            "Returns students whose batch is assigned to the specified mentor. Supports pagination and role-based scoping.",
          tags: ["College Admin - Students"],
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: "mentorId",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "Mentor user ID",
            },
            {
              name: "page",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1 },
              description: "Page number (default 1)",
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 100 },
              description: "Page size (default 20, max 100)",
            },
          ],
          responses: {
            "200": {
              description: "Students assigned to mentor",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      mentor: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          email: { type: "string", format: "email" },
                          role: { type: "string", example: "mentor" },
                          departmentId: { type: "string", nullable: true },
                        },
                      },
                      students: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            name: { type: "string" },
                            email: { type: "string", format: "email" },
                            phone: { type: "string", nullable: true },
                            batch: {
                              type: "object",
                              nullable: true,
                              properties: {
                                id: { type: "string" },
                                name: { type: "string" },
                                code: { type: "string" },
                                year: { type: "integer" },
                              },
                            },
                            department: {
                              type: "object",
                              nullable: true,
                              properties: {
                                id: { type: "string" },
                                name: { type: "string" },
                                code: { type: "string" },
                              },
                            },
                          },
                        },
                      },
                      pagination: {
                        type: "object",
                        properties: {
                          total: { type: "integer", example: 42 },
                          page: { type: "integer", example: 1 },
                          limit: { type: "integer", example: 20 },
                          totalPages: { type: "integer", example: 3 },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error or mentor missing department" },
            "401": { description: "Not authenticated" },
            "403": { description: "Forbidden" },
            "404": { description: "Mentor not found" },
          },
        },
      },

      "/api/college-admin/tests": {
        post: {
          summary: "Create a test (college admin portal)",
          description:
            "Creates a test with scheduling, attempt limits, and optional maximum marks. Role restrictions mirror the portal (super_admin, college_admin, principal, hod, dept_admin, mentor).",
          tags: ["College Admin - Tests"],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string", maxLength: 200 },
                    description: { type: "string", maxLength: 1000 },
                    instructions: { type: "string", maxLength: 2000 },
                    durationMinutes: { type: "integer", minimum: 1, maximum: 600, default: 60 },
                    maxAttempts: { type: "integer", minimum: 1, maximum: 10, default: 1 },
                    maximumMarks: { type: "integer", minimum: 0, description: "Cap/total marks for the test" },
                    passingMarks: { type: "integer", minimum: 0 },
                    scheduledStartTime: { type: "string", format: "date-time" },
                    scheduledEndTime: { type: "string", format: "date-time" },
                    departmentId: { type: "string" },
                    batchId: { type: "string" },
                  },
                  required: ["title"],
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Test created",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      message: { type: "string", example: "Test created successfully" },
                      test: { type: "object" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation or scheduling error" },
            "401": { description: "Not authenticated" },
            "403": { description: "Forbidden" },
          },
        },
      },

      // ═══ Arduino Platform API ═══════════════════════════════════════════════════
      "/api/v1/arduino/health": {
        get: {
          tags: ["Arduino Platform"],
          summary: "Arduino API health check",
          description: "Public health endpoint for Arduino subsystem monitoring.",
          security: [],
          responses: {
            "200": {
              description: "Arduino API is healthy",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      status: { type: "string", example: "healthy" },
                      service: { type: "string", example: "arduino-api" },
                      timestamp: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          },
        },
      },

      "/api/v1/arduino/boards": {
        get: {
          tags: ["Arduino Platform"],
          summary: "Get supported Arduino boards",
          description: "Returns supported boards and board metadata.",
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "Supported boards list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      data: {
                        type: "object",
                        properties: {
                          boards: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                id: { type: "string" },
                                name: { type: "string" },
                                fqbn: { type: "string" },
                                description: { type: "string" },
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
            "401": { description: "Authentication required" },
            "500": { description: "Failed to get boards" },
          },
        },
      },

      "/api/v1/arduino/problems": {
        get: {
          tags: ["Arduino Problems"],
          summary: "Get Arduino problems",
          description: "Retrieve a list of Arduino programming problems",
          parameters: [
            {
              name: "difficulty",
              in: "query",
              schema: { type: "string", enum: ["easy", "medium", "hard"] },
              description: "Filter by difficulty level"
            },
            {
              name: "limit",
              in: "query", 
              schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
              description: "Number of problems to return"
            },
            {
              name: "offset",
              in: "query",
              schema: { type: "integer", minimum: 0, default: 0 },
              description: "Number of problems to skip"
            }
          ],
          responses: {
            "200": {
              description: "List of Arduino problems",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      data: {
                        type: "object",
                        properties: {
                          problems: {
                            type: "array",
                            items: { $ref: "#/components/schemas/ArduinoProblem" }
                          },
                          pagination: {
                            type: "object",
                            properties: {
                              limit: { type: "integer" },
                              offset: { type: "integer" }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/v1/arduino/problems/{problemId}": {
        get: {
          tags: ["Arduino Problems"],
          summary: "Get Arduino problem details",
          description: "Retrieve detailed information about a specific Arduino problem",
          parameters: [
            {
              name: "problemId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "Problem UUID"
            }
          ],
          responses: {
            "200": {
              description: "Arduino problem details",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      data: {
                        allOf: [
                          { $ref: "#/components/schemas/ArduinoProblem" },
                          {
                            type: "object",
                            properties: {
                              testCases: {
                                type: "array",
                                items: { $ref: "#/components/schemas/ArduinoTestCase" }
                              }
                            }
                          }
                        ]
                      }
                    }
                  }
                }
              }
            },
            "404": { description: "Problem not found" }
          }
        }
      },
      "/api/v1/arduino/compile": {
        post: {
          tags: ["Arduino Jobs"],
          summary: "Submit Arduino code for compilation",
          description: "Submit Arduino sketch for compilation. Rate limited to 5 requests per minute per user.",
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CompileRequest" }
              }
            }
          },
          responses: {
            "202": {
              description: "Compilation job submitted successfully",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CompileResponse" }
                }
              },
              headers: {
                "X-RateLimit-Limit": { 
                  schema: { type: "string" },
                  description: "Requests allowed per window"
                },
                "X-RateLimit-Remaining": {
                  schema: { type: "string" },
                  description: "Requests remaining in current window"
                }
              }
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "404": { description: "Arduino problem not found" },
            "429": { description: "Rate limit exceeded" },
            "500": { description: "Compilation service error" }
          }
        }
      },
      "/api/v1/arduino/jobs/{submissionId}": {
        get: {
          tags: ["Arduino Jobs"],
          summary: "Get compilation job status",
          description: "Check the status and results of a compilation job",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: "submissionId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "Submission UUID"
            }
          ],
          responses: {
            "200": {
              description: "Job status retrieved successfully",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/JobStatusResponse" }
                }
              }
            },
            "401": { description: "Authentication required" },
            "404": { description: "Submission not found or not owned by user" }
          }
        },
        delete: {
          tags: ["Arduino Jobs"],
          summary: "Cancel compilation job",
          description: "Cancel a queued compilation job (only possible for queued jobs)",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: "submissionId", 
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "Submission UUID"
            }
          ],
          responses: {
            "200": {
              description: "Job cancelled successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      message: { type: "string", example: "Job cancelled successfully" }
                    }
                  }
                }
              }
            },
            "400": { description: "Job cannot be cancelled" },
            "401": { description: "Authentication required" },
            "404": { description: "Submission not found" }
          }
        }
      },
      "/api/v1/arduino/submissions": {
        get: {
          tags: ["Arduino Jobs"],
          summary: "Get user's Arduino submissions",
          description: "Retrieve submission history for the authenticated user",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: "problemId",
              in: "query",
              schema: { type: "string", format: "uuid" },
              description: "Filter by specific problem"
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
              description: "Number of submissions to return"
            },
            {
              name: "offset",
              in: "query", 
              schema: { type: "integer", minimum: 0, default: 0 },
              description: "Number of submissions to skip"
            }
          ],
          responses: {
            "200": {
              description: "User submissions retrieved successfully",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SubmissionsResponse" }
                }
              }
            },
            "401": { description: "Authentication required" }
          }
        }
      },
      "/api/v1/arduino/validate": {
        post: {
          tags: ["Arduino Jobs"],
          summary: "Validate a compiled Arduino submission",
          description: "Runs submission validation against configured Arduino test cases and updates status if solved.",
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    submissionId: { type: "string", format: "uuid" },
                  },
                  required: ["submissionId"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Validation result returned" },
            "400": { description: "Submission cannot be validated in current state" },
            "401": { description: "Authentication required" },
            "403": { description: "Submission not owned by user" },
            "404": { description: "Submission not found" },
            "500": { description: "Validation failed" },
          },
        },
      },
      "/api/v1/arduino/hardware/upload-guide": {
        get: {
          tags: ["Arduino Platform"],
          summary: "Get hardware upload instructions",
          description: "Returns detailed instructions for uploading generated HEX files to physical Arduino boards.",
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "Hardware upload guide",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      data: { type: "object" },
                    },
                  },
                },
              },
            },
            "401": { description: "Authentication required" },
          },
        },
      },
      "/api/v1/arduino/admin/queue/stats": {
        get: {
          tags: ["Arduino Admin"],
          summary: "Get compilation queue statistics",
          description: "Administrative endpoint to view queue health and statistics. Requires admin role.",
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "Queue statistics retrieved successfully",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/QueueStatsResponse" }
                }
              }
            },
            "401": { description: "Authentication required" },
            "403": { description: "Admin access required" }
          }
        }
      },
    },
  },
  apis: ["src/modules/routes/*.ts", "dist/modules/routes/*.js"],
};

// ── Response Examples Helper -------------------------------------------------
// Adds a concrete example body to every response so Swagger UI always shows a
// sample JSON payload. Examples are resolved from schema references where
// possible, otherwise sensible defaults are used.
const schemaExamples: Record<string, unknown> = {
  "#/components/schemas/Message": { message: "Request completed successfully" },
  "#/components/schemas/Error": {
    error: "Validation error",
    details: [{ path: ["email"], message: "Email is required" }],
  },
  "#/components/schemas/User": {
    id: "usr_123",
    email: "student@example.com",
    username: "student01",
    name: "Student One",
    role: "student",
    emailVerified: true,
  },
  "#/components/schemas/ProblemSummary": {
    id: "two-sum",
    title: "Two Sum",
    slug: "two-sum",
    difficulty: "easy",
    tags: ["arrays", "hash-map"],
  },
  "#/components/schemas/ProblemDetail": {
    id: "two-sum",
    title: "Two Sum",
    slug: "two-sum",
    difficulty: "easy",
    tags: ["arrays", "hash-map"],
    description: "Find two numbers that add up to target.",
    constraints: "1 <= nums.length <= 1e4",
    timeLimits: {
      javascript: 2,
      python: 2,
      java: 1,
    },
    memoryLimit: 256,
    sampleTestCases: [
      { input: "[2,7,11,15], target=9", output: "[0,1]", explanation: "2 + 7 = 9" },
    ],
  },
  "#/components/schemas/RunResult": {
    status: "Accepted",
    stdout: "Hello, World!\n",
    stderr: "",
    compileOutput: "",
    time: "0.012",
    memory: 3200,
  },
  "#/components/schemas/TestCaseDetail": {
    index: 1,
    visibility: "sample",
    passed: true,
    status: "accepted",
    input: "2 7 11 15\n9",
    expectedOutput: "0 1",
    actualOutput: "0 1",
    errorOutput: null,
  },
  "#/components/schemas/SubmitResult": {
    submissionId: "sub_123",
    status: "accepted",
    testCasesPassed: 4,
    totalTestCases: 4,
    failedAt: null,
    runtime: "0.045",
    memory: 2800,
    errorOutput: null,
    testCaseResults: [
      { index: 1, visibility: "sample", passed: true, status: "accepted" },
      { index: 2, visibility: "public", passed: true, status: "accepted" },
    ],
  },
  "#/components/schemas/PreSubmitResult": {
    status: "accepted",
    testCasesPassed: 2,
    totalTestCases: 2,
    failedAt: null,
    runtime: "0.030",
    memory: 2500,
    errorOutput: null,
    testCaseResults: [
      { index: 1, visibility: "sample", passed: true, status: "accepted" },
    ],
  },
  "#/components/schemas/SubmissionSummary": {
    id: "sub_123",
    problemId: "two-sum",
    language: "javascript",
    status: "accepted",
    testCasesPassed: 4,
    totalTestCases: 4,
    runtime: "0.045",
    memory: 2800,
    createdAt: "2026-03-19T10:00:00.000Z",
  },
  "#/components/schemas/Question": {
    id: "mcq-101",
    type: "mcq",
    title: "What is the output of console.log(typeof null)?",
    description: "Check JavaScript typeof behavior.",
    difficulty: "easy",
    tags: ["javascript", "basics"],
    company: null,
    options: ["object", "null", "undefined", "boolean"],
    timeLimit: null,
    memoryLimit: null,
    sampleTestCases: null,
  },
  "#/components/schemas/QuestionSummary": {
    id: "mcq-101",
    title: "What is the output of console.log(typeof null)?",
    statement: "Evaluate typeof null.",
    options: ["object", "null", "undefined", "boolean"],
    topic: "javascript",
    difficulty: "easy",
  },
  "#/components/schemas/RandomPracticeResponse": {
    seed: "abc123",
    poolSize: 120,
    reset: false,
    questions: [
      {
        id: "mcq-101",
        title: "What is the output of console.log(typeof null)?",
        statement: "Evaluate typeof null.",
        options: ["object", "null", "undefined", "boolean"],
        topic: "javascript",
        difficulty: "easy",
      },
    ],
  },
  "#/components/schemas/Contest": {
    id: "contest_1",
    title: "Weekly DSA Challenge",
    description: "Solve 5 medium problems in 90 minutes",
    type: "contest",
    startTime: "2026-03-19T09:00:00.000Z",
    endTime: "2026-03-19T10:30:00.000Z",
    duration: 90,
  },
  "#/components/schemas/DailyChallenge": {
    id: "potd_2026_03_19",
    date: "2026-03-19",
    question: {
      id: "mcq-101",
      type: "mcq",
      title: "What is the output of console.log(typeof null)?",
      description: "Check JavaScript typeof behavior.",
      difficulty: "easy",
      tags: ["javascript", "basics"],
      company: null,
      options: ["object", "null", "undefined", "boolean"],
      timeLimit: null,
      memoryLimit: null,
      sampleTestCases: null,
    },
  },
  "#/components/schemas/UserStreak": {
    currentStreak: 5,
    longestStreak: 14,
    lastSolveDate: "2026-03-19",
  },
  "#/components/schemas/PotdResponse": {
    challenge: {
      id: "potd_2026_03_19",
      date: "2026-03-19",
      question: {
        id: "mcq-101",
        title: "What is the output of console.log(typeof null)?",
        difficulty: "easy",
        type: "mcq",
        tags: ["javascript", "basics"],
        options: ["object", "null", "undefined", "boolean"],
      },
    },
    solved: true,
    solveResult: {
      isCorrect: true,
      selectedOption: 0,
      solvedAt: "2026-03-19T10:00:00.000Z",
    },
    streak: { currentStreak: 5, longestStreak: 14, lastSolveDate: "2026-03-19" },
  },
  "#/components/schemas/McqStats": {
    totalSessions: 12,
    totalQuestions: 180,
    totalCorrect: 142,
    totalScore: 1420,
    overallAccuracy: 78.9,
    topicBreakdown: [
      { topic: "arrays", total: 30, correct: 25, accuracy: 83.3 },
      { topic: "sql", total: 20, correct: 14, accuracy: 70 },
    ],
  },
  "#/components/schemas/DailyPracticeActivity": {
    id: "activity_1",
    userId: "usr_123",
    date: "2026-03-19",
    problemsSolved: 2,
    mcqSolved: 1,
    dsaSolved: 1,
    createdAt: "2026-03-19T10:00:00.000Z",
    updatedAt: "2026-03-19T10:00:00.000Z",
  },
};

const defaultResponseExamples: Record<string, unknown> = {
  "200": { message: "Request succeeded" },
  "201": { message: "Resource created" },
  "204": {},
  "400": { error: "Bad request" },
  "401": { error: "Unauthorized" },
  "403": { error: "Forbidden" },
  "404": { error: "Not found" },
  "409": { error: "Conflict" },
  "422": { error: "Unprocessable entity" },
  "429": { error: "Too many requests", retryAfterSeconds: 60 },
  "500": { error: "Internal server error" },
  "2xx": { message: "Request succeeded" },
  "4xx": { error: "Client error" },
  "5xx": { error: "Server error" },
};

type SchemaObject = { $ref?: string; type?: string; items?: SchemaObject; properties?: Record<string, SchemaObject & { example?: unknown }>; example?: unknown };

const getStatusFamily = (status: string): string | undefined => {
  const numeric = Number(status);
  if (Number.isFinite(numeric)) {
    return `${Math.floor(numeric / 100)}xx`;
  }
  return undefined;
};

const buildExampleFromSchema = (schema: SchemaObject | undefined): unknown => {
  if (!schema) return undefined;
  if (schema.example !== undefined) return schema.example;
  if (schema.$ref && schemaExamples[schema.$ref]) return schemaExamples[schema.$ref];

  if (schema.type === "array" && schema.items) {
    const itemExample = buildExampleFromSchema(schema.items);
    if (itemExample !== undefined) return [itemExample];
  }

  if (schema.type === "object" && schema.properties) {
    const example: Record<string, unknown> = {};
    Object.entries(schema.properties).forEach(([key, propertySchema]) => {
      const propertyExample = buildExampleFromSchema(propertySchema) ?? inferPrimitiveExample(propertySchema.type);
      example[key] = propertyExample;
    });
    return example;
  }

  return inferPrimitiveExample(schema.type);
};

const inferPrimitiveExample = (type?: string): unknown => {
  switch (type) {
    case "string":
      return "example";
    case "number":
    case "integer":
      return 1;
    case "boolean":
      return true;
    default:
      return "sample";
  }
};

const addResponseExamples = (paths: Record<string, unknown>): void => {
  const methods = ["get", "post", "put", "patch", "delete"];

  Object.values(paths).forEach((pathItem) => {
    if (!pathItem || typeof pathItem !== "object") return;

    methods.forEach((method) => {
      const operation = (pathItem as Record<string, unknown>)[method] as
        | { responses?: Record<string, { content?: Record<string, { schema?: SchemaObject; example?: unknown; examples?: unknown }> }> }
        | undefined;

      if (!operation?.responses) return;

      Object.entries(operation.responses).forEach(([status, response]) => {
        if (!response || typeof response !== "object") return;

        const responseObj = response as {
          content?: Record<string, { schema?: SchemaObject; example?: unknown; examples?: unknown }>;
        };

        if (!responseObj.content) {
          responseObj.content = { "application/json": {} };
        }

        const jsonContent =
          responseObj.content["application/json"] ?? (responseObj.content["application/json"] = {});

        if (jsonContent.example || jsonContent.examples) {
          return;
        }

        const schemaExample = buildExampleFromSchema(jsonContent.schema);
        const statusExample = defaultResponseExamples[status];
        const familyExample = getStatusFamily(status)
          ? defaultResponseExamples[getStatusFamily(status) as string]
          : undefined;

        jsonContent.example = schemaExample ?? statusExample ?? familyExample ?? { message: "Sample response" };
      });
    });
  });
};

addResponseExamples((swaggerOptions.definition?.paths ?? {}) as Record<string, unknown>);

// ── Supplementary Schemas ──────────────────────────────────────────────────────
// Injected after swaggerOptions so we can reference them cleanly.
const potdSchemas = {
  DailyChallenge: {
    type: "object",
    properties: {
      id: { type: "string" },
      date: { type: "string", format: "date", example: "2026-03-19" },
      question: { $ref: "#/components/schemas/Question" },
    },
  },
  UserStreak: {
    type: "object",
    properties: {
      currentStreak: { type: "integer", example: 5 },
      longestStreak: { type: "integer", example: 14 },
      lastSolveDate: { type: "string", format: "date", nullable: true, example: "2026-03-19" },
    },
  },
  PotdResponse: {
    type: "object",
    properties: {
      challenge: { $ref: "#/components/schemas/DailyChallenge" },
      solved: { type: "boolean" },
      solveResult: {
        nullable: true,
        type: "object",
        properties: {
          isCorrect: { type: "boolean" },
          selectedOption: { type: "integer" },
          solvedAt: { type: "string", format: "date-time" },
        },
      },
      streak: { $ref: "#/components/schemas/UserStreak" },
    },
  },
  McqStats: {
    type: "object",
    properties: {
      totalSessions: { type: "integer" },
      totalQuestions: { type: "integer" },
      totalCorrect: { type: "integer" },
      totalScore: { type: "integer" },
      overallAccuracy: { type: "number", description: "0–100 percentage", example: 73.5 },
      topicBreakdown: {
        type: "array",
        items: {
          type: "object",
          properties: {
            topic: { type: "string" },
            total: { type: "integer" },
            correct: { type: "integer" },
            accuracy: { type: "number" },
          },
        },
      },
    },
  },
  DailyPracticeActivity: {
    type: "object",
    properties: {
      id: { type: "string" },
      userId: { type: "string" },
      date: { type: "string", format: "date", example: "2026-03-19" },
      problemsSolved: { type: "integer", example: 2 },
      mcqSolved: { type: "integer", example: 1 },
      dsaSolved: { type: "integer", example: 1 },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
};

const arduinoSchemas = {
  ArduinoProblem: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid", example: "550e8400-e29b-41d4-a716-446655440000" },
      title: { type: "string", example: "LED Blink Pattern" },
      description: { type: "string", example: "Create a program that blinks an LED in a specific pattern" },
      difficulty: { type: "string", enum: ["easy", "medium", "hard"], example: "easy" },
      maxMemory: { type: "integer", example: 2048, description: "Maximum memory usage in bytes" },
      timeLimit: { type: "integer", example: 5000, description: "Time limit in milliseconds" },
      createdAt: { type: "string", format: "date-time" },
      _count: {
        type: "object",
        properties: {
          submissions: { type: "integer", example: 42 }
        }
      }
    }
  },
  ArduinoTestCase: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      input: { type: "string", example: "Button press simulation data" },
      expectedOutput: { type: "string", example: "LED pattern: HIGH-LOW-HIGH-LOW" },
      isHidden: { type: "boolean", example: false }
    }
  },
  ArduinoSubmission: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid", example: "123e4567-e89b-12d3-a456-426614174000" },
      userId: { type: "string", format: "uuid" },
      problemId: { type: "string", format: "uuid" },
      code: { type: "string", example: "void setup() { pinMode(13, OUTPUT); }" },
      boardType: { type: "string", enum: ["uno", "mega"], example: "uno" },
      status: { type: "string", enum: ["queued", "processing", "compiled", "failed"], example: "compiled" },
      hexCode: { type: "string", nullable: true, example: ":100000000C9434000C9446000C9446000C944600AA" },
      error: { type: "string", nullable: true, example: null },
      compileTimeMs: { type: "integer", nullable: true, example: 1250 },
      memoryUsage: { type: "string", nullable: true, example: "{\"program\": 924, \"data\": 9}" },
      createdAt: { type: "string", format: "date-time" },
      processedAt: { type: "string", format: "date-time", nullable: true },
      completedAt: { type: "string", format: "date-time", nullable: true }
    }
  },
  CompileRequest: {
    type: "object",
    required: ["problemId", "code"],
    properties: {
      problemId: { type: "string", format: "uuid", example: "550e8400-e29b-41d4-a716-446655440000" },
      code: { 
        type: "string", 
        maxLength: 50000,
        example: `void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}`
      },
      boardType: { type: "string", enum: ["uno", "mega"], default: "uno", example: "uno" }
    }
  },
  CompileResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      message: { type: "string", example: "Compilation job submitted successfully" },
      data: {
        type: "object",
        properties: {
          submissionId: { type: "string", format: "uuid", example: "123e4567-e89b-12d3-a456-426614174000" },
          status: { type: "string", example: "queued" }
        }
      }
    }
  },
  JobStatusResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      data: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          status: { type: "string", enum: ["queued", "processing", "compiled", "failed"] },
          progress: { type: "integer", minimum: 0, maximum: 100, example: 100 },
          createdAt: { type: "string", format: "date-time" },
          processedAt: { type: "string", format: "date-time", nullable: true },
          completedAt: { type: "string", format: "date-time", nullable: true },
          result: {
            type: "object",
            nullable: true,
            properties: {
              success: { type: "boolean" },
              hexCode: { type: "string", nullable: true },
              error: { type: "string", nullable: true },
              compileTime: { type: "integer", example: 1250 },
              memoryUsage: {
                type: "object",
                nullable: true,
                properties: {
                  program: { type: "integer", example: 924 },
                  data: { type: "integer", example: 9 }
                }
              }
            }
          }
        }
      }
    }
  },
  SubmissionsResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      data: {
        type: "object",
        properties: {
          submissions: {
            type: "array",
            items: { $ref: "#/components/schemas/ArduinoSubmission" }
          },
          pagination: {
            type: "object",
            properties: {
              limit: { type: "integer", example: 20 },
              offset: { type: "integer", example: 0 },
              total: { type: "integer", example: 5 }
            }
          }
        }
      }
    }
  },
  QueueStatsResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      data: {
        type: "object",
        properties: {
          queue: { type: "string", example: "arduino-compile" },
          stats: {
            type: "object",
            properties: {
              waiting: { type: "integer", example: 3 },
              active: { type: "integer", example: 2 },
              completed: { type: "integer", example: 150 },
              failed: { type: "integer", example: 5 },
              total: { type: "integer", example: 160 }
            }
          },
          timestamp: { type: "string", format: "date-time" }
        }
      }
    }
  },
  ArduinoError: {
    type: "object",
    properties: {
      success: { type: "boolean", example: false },
      error: { type: "string", example: "Rate limit exceeded" },
      message: { type: "string", example: "You can only compile 5 Arduino sketches per minute" },
      details: {
        type: "array",
        items: {
          type: "object",
          properties: {
            field: { type: "string" },
            message: { type: "string" }
          }
        }
      }
    }
  }
};

export const swaggerSpec = (() => {
  const spec = swaggerJsdoc(swaggerOptions) as {
    components?: { schemas?: Record<string, unknown> };
  };
  if (spec.components?.schemas) {
    Object.assign(spec.components.schemas, potdSchemas, arduinoSchemas);
  }
  return spec;
})();
