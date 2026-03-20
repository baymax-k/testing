import request from "supertest";
import { describe, it, expect, vi, beforeAll } from "vitest";

// Ensure JWT secret is present for token generation in tests
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

// Mock Prisma to control DB interactions for the endpoint
vi.mock("../src/config/prisma.js", () => {
  return {
    prisma: {
      question: {
        findMany: vi.fn(async (args) => {
          // If select.id requested, return ids matching topics
          const pool = [
            { id: "q1", title: "Q1", description: "S1", difficulty: "easy", options: ["a","b"], tags: [{ name: "arrays" }] },
            { id: "q2", title: "Q2", description: "S2", difficulty: "easy", options: ["a","b"], tags: [{ name: "arrays" }] },
            { id: "q3", title: "Q3", description: "S3", difficulty: "easy", options: ["a","b"], tags: [{ name: "strings" }] },
          ];

          if (args?.select && args.select.id) {
            const filtered = pool.filter(q => {
              if (args?.where?.tags?.some?.name?.in) {
                const topics = args.where.tags.some.name.in;
                return q.tags.some(t => topics.includes(t.name));
              }
              return true;
            });
            return filtered.map(q => ({ id: q.id }));
          }

          if (args?.where?.id?.in) {
            return pool.filter(q => args.where.id.in.includes(q.id));
          }

          return pool;
        }),
      },
      mcqPracticeAnswer: {
        findMany: vi.fn(async ({ where }) => {
          // simulate user has solved q1
          return [{ questionId: "q1" }];
        }),
      },
      practiceRandomSet: {
        create: vi.fn(async (args) => ({ id: "prs1", ...args.data })),
      },
    },
  };
});

import app from "../src/app.js";
import { generateAccessToken } from "../src/modules/auth/auth.service.js";

describe("POST /api/v1/student/practice/random (endpoint)", () => {
  let token: string;

  beforeAll(async () => {
    token = generateAccessToken({
      userId: "user1",
      email: "test@example.com",
      name: "Test User",
      role: "student",
      emailVerified: true,
    });
  });

  it("returns randomized questions for authenticated student", async () => {
    const res = await request(app)
      .post("/api/v1/student/practice/random")
      .set("Cookie", [`access_token=${token}`])
      .send({ topics: ["arrays"], count: 2 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("questions");
    expect(Array.isArray(res.body.questions)).toBe(true);
    expect(res.body.questions.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty("seed");
  });
});
