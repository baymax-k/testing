import swaggerJsdoc from "swagger-jsdoc";

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CodeEthnics Backend API",
      version: "4.0.0",
      description:
        "Backend API for the CodeEthnics institutional coding platform. " +
        "Auth uses JWT cookies and role-based access.",
    },
    servers: [
      {
        url: process.env.APP_URL || "http://localhost:5000",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "better-auth.session_token",
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Message: {
          type: "object",
          properties: {
            message: { type: "string" },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            details: { type: "array", items: { type: "object" } },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            email: { type: "string", format: "email" },
            username: { type: "string" },
            name: { type: "string" },
            role: { type: "string" },
            emailVerified: { type: "boolean" },
          },
        },
      },
    },
    tags: [
      { name: "Authentication", description: "Authentication and session APIs" },
      { name: "Problems", description: "Problem browsing and details" },
      { name: "Practice", description: "Practice and submissions" },
      { name: "Contests", description: "Contest lifecycle APIs" },
      { name: "Public APIs - Tests", description: "Public test listing and details" },
      { name: "College Admin - Auth", description: "College admin authentication" },
      { name: "College Admin - Tests", description: "College admin test management" },
      { name: "College Admin - Batches", description: "College admin batch management" },
      { name: "College Admin - Departments", description: "College admin department management" },
      { name: "College Admin - Students", description: "College admin student management" },
      { name: "College Admin - Reports", description: "College admin reporting" },
      { name: "College Admin - Performance", description: "College admin performance APIs" },
      { name: "Product Admin - Auth", description: "Product admin authentication" },
      { name: "Product Admin - Colleges", description: "Product admin college management" },
      { name: "Product Admin - RBAC", description: "Product admin role management" },
      { name: "Product Admin - Hackathons", description: "Product admin hackathon management" },
      { name: "Product Admin - Dashboard", description: "Product admin dashboard APIs" },
      { name: "Product Admin - Users", description: "Product admin user analytics APIs" },
    ],
    paths: {},
  },
  apis: ["src/modules/routes/*.ts", "dist/modules/routes/*.js"],
};

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
    sampleTestCases: [{ input: "[2,7,11,15], target=9", output: "[0,1]" }],
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
    input: String.raw`2 7 11 15\n9`,
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
  },
  "#/components/schemas/PreSubmitResult": {
    status: "accepted",
    testCasesPassed: 2,
    totalTestCases: 2,
    failedAt: null,
    runtime: "0.030",
    memory: 2500,
    errorOutput: null,
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
    difficulty: "easy",
    tags: ["javascript", "basics"],
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
  },
  "#/components/schemas/UserStreak": {
    currentStreak: 5,
    longestStreak: 14,
    lastSolveDate: "2026-03-19",
  },
  "#/components/schemas/PotdResponse": {
    solved: true,
    streak: { currentStreak: 5, longestStreak: 14, lastSolveDate: "2026-03-19" },
  },
  "#/components/schemas/McqStats": {
    totalSessions: 12,
    totalQuestions: 180,
    totalCorrect: 142,
    totalScore: 1420,
    overallAccuracy: 78.9,
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

type SchemaObject = {
  $ref?: string;
  type?: string;
  items?: SchemaObject;
  properties?: Record<string, SchemaObject & { example?: unknown }>;
  example?: unknown;
};

const getStatusFamily = (status: string): string | undefined => {
  const numeric = Number(status);
  if (Number.isFinite(numeric)) {
    return `${Math.floor(numeric / 100)}xx`;
  }
  return undefined;
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

const addResponseExamples = (paths: Record<string, unknown>): void => {
  const methods = ["get", "post", "put", "patch", "delete"];

  Object.values(paths).forEach((pathItem) => {
    if (!pathItem || typeof pathItem !== "object") return;

    methods.forEach((method) => {
      const operation = (pathItem as Record<string, unknown>)[method] as
        | {
            responses?: Record<
              string,
              { content?: Record<string, { schema?: SchemaObject; example?: unknown; examples?: unknown }> }
            >;
          }
        | undefined;

      if (!operation?.responses) return;

      Object.entries(operation.responses).forEach(([status, response]) => {
        if (!response || typeof response !== "object") return;

        const responseObj = response as {
          content?: Record<string, { schema?: SchemaObject; example?: unknown; examples?: unknown }>;
        };

        responseObj.content ??= { "application/json": {} };

        const jsonContent =
          responseObj.content["application/json"] ?? (responseObj.content["application/json"] = {});

        if (jsonContent.example || jsonContent.examples) return;

        const schemaExample = buildExampleFromSchema(jsonContent.schema);
        const statusExample = defaultResponseExamples[status];
        const familyKey = getStatusFamily(status);
        const familyExample = familyKey ? defaultResponseExamples[familyKey] : undefined;

        jsonContent.example = schemaExample ?? statusExample ?? familyExample ?? { message: "Sample response" };
      });
    });
  });
};

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
      overallAccuracy: { type: "number", description: "0-100 percentage", example: 73.5 },
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

export const swaggerSpec = (() => {
  const spec = swaggerJsdoc(swaggerOptions) as {
    paths?: Record<string, unknown>;
    components?: { schemas?: Record<string, unknown> };
  };

  if (spec.paths) {
    addResponseExamples(spec.paths);
  }

  spec.components ??= {};
  spec.components.schemas ??= {};

  Object.assign(spec.components.schemas, potdSchemas);
  return spec;
})();
