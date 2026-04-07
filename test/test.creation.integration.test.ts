import request from "supertest";
import { describe, it, expect, vi, beforeAll } from "vitest";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

const now = new Date();
const startTime = new Date(now.getTime() + 60 * 60 * 1000);
const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);

const baseTest = {
  id: "test-1",
  title: "Midterm 1",
  description: "Core concepts",
  instructions: "Answer all questions",
  status: "scheduled",
  durationMinutes: 60,
  maxAttempts: 1,
  totalMarks: 0,
  passingMarks: 40,
  scheduledStartTime: startTime,
  scheduledEndTime: endTime,
  departmentId: null,
  batchId: null,
  createdById: "admin-1",
  createdBy: {
    id: "admin-1",
    name: "Admin User",
    email: "admin@example.com",
    role: "college_admin",
  },
  department: null,
  batch: null,
  questions: [],
};

const baseTestWithCounts = {
  ...baseTest,
  _count: { attempts: 0, questions: 0 },
};

vi.mock("../src/modules/services/testService.js", () => {
  return {
    TestService: {
      createTest: vi.fn(async () => baseTest),
      getTests: vi.fn(async () => ({
        tests: [baseTestWithCounts],
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      })),
      getTestById: vi.fn(async () => baseTestWithCounts),
      updateTest: vi.fn(async () => ({ ...baseTest, title: "Midterm Updated" })),
    },
  };
});

vi.mock("../src/middleware/auth.js", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    requireCollegeAdminAuth: (req: any, _res: any, next: any) => {
      req.user = {
        id: "admin-1",
        userId: "admin-1",
        email: "admin@example.com",
        name: "Admin User",
        role: "college_admin",
        emailVerified: true,
        departmentId: null,
      };
      next();
    },
    requireRole: (...roles: string[]) => {
      return (req: any, res: any, next: any) => {
        if (req.user && roles.includes(req.user.role)) {
          next();
          return;
        }
        res.status(403).json({ error: "Forbidden – insufficient permissions" });
      };
    },
  };
});

import app from "../src/app.js";
import { generateAccessToken } from "../src/modules/auth/auth.service.js";

describe("College Admin Test Creation Flow - Integration Tests", () => {
  let token: string;

  beforeAll(() => {
    token = generateAccessToken({
      userId: "admin-1",
      email: "admin@example.com",
      name: "Admin User",
      role: "college_admin",
      emailVerified: true,
    });
  });

  it("creates a test and returns the new record", async () => {
    const res = await request(app)
      .post("/api/college-admin/tests")
      .set("Cookie", [`access_token=${token}`])
      .send({
        title: "Midterm 1",
        description: "Core concepts",
        instructions: "Answer all questions",
        durationMinutes: 60,
        maxAttempts: 1,
        passingMarks: 40,
        scheduledStartTime: startTime.toISOString(),
        scheduledEndTime: endTime.toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("test");
    expect(res.body.test.title).toBe("Midterm 1");
  });

  it("lists tests with pagination", async () => {
    const res = await request(app)
      .get("/api/college-admin/tests")
      .set("Cookie", [`access_token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("tests");
    expect(res.body.tests.length).toBe(1);
    expect(res.body).toHaveProperty("pagination");
    expect(res.body.pagination.total).toBe(1);
  });

  it("fetches a test by id", async () => {
    const res = await request(app)
      .get("/api/college-admin/tests/test-1")
      .set("Cookie", [`access_token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("test");
    expect(res.body.test.id).toBe("test-1");
  });

  it("updates a test", async () => {
    const res = await request(app)
      .put("/api/college-admin/tests/test-1")
      .set("Cookie", [`access_token=${token}`])
      .send({ title: "Midterm Updated" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body.test.title).toBe("Midterm Updated");
  });
});
