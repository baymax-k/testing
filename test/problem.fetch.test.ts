import express from "express";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

// Mock Prisma before importing the controller
vi.mock("../src/config/prisma.js", () => {
  const mockPrisma = {
    question: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

import { prisma } from "../src/config/prisma.js";
import { listProblems, getProblem } from "../src/modules/controllers/problem.controller.js";

const app = express();
app.use(express.json());
app.get("/api/v1/problems", listProblems);
app.get("/api/v1/problems/:slug", getProblem);

describe("Problem fetch API (DB-backed)", () => {
  it("lists problems with pagination envelope", async () => {
    const mockProblems = [
      {
        id: "dsa-001",
        slug: "two-sum",
        title: "Two Sum",
        difficulty: "easy",
        tags: [{ name: "arrays" }, { name: "hash-map" }],
      },
      {
        id: "dsa-002",
        slug: "binary-search",
        title: "Binary Search",
        difficulty: "medium",
        tags: [{ name: "arrays" }, { name: "searching" }],
      },
    ];

    (prisma.question.findMany as any).mockResolvedValue(mockProblems);
    (prisma.question.count as any).mockResolvedValue(2);

    const res = await request(app).get("/api/v1/problems?page=1&limit=10");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.problems)).toBe(true);
    expect(typeof res.body?.pagination?.page).toBe("number");
    expect(typeof res.body?.pagination?.total).toBe("number");
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.total).toBe(2);
  });

  it("filters list by difficulty", async () => {
    const mockProblems = [
      {
        id: "dsa-001",
        slug: "two-sum",
        title: "Two Sum",
        difficulty: "easy",
        tags: [{ name: "arrays" }],
      },
    ];

    (prisma.question.findMany as any).mockResolvedValue(mockProblems);
    (prisma.question.count as any).mockResolvedValue(1);

    const res = await request(app).get("/api/v1/problems?difficulty=easy");

    expect(res.status).toBe(200);
    expect(res.body.problems.length).toBe(1);
    expect(res.body.problems.every((problem: { difficulty: string }) => problem.difficulty === "easy")).toBe(true);
  });

  it("filters list by tag", async () => {
    const mockProblems = [
      {
        id: "dsa-001",
        slug: "two-sum",
        title: "Two Sum",
        difficulty: "easy",
        tags: [{ name: "arrays" }],
      },
    ];

    (prisma.question.findMany as any).mockResolvedValue(mockProblems);
    (prisma.question.count as any).mockResolvedValue(1);

    const res = await request(app).get("/api/v1/problems?tag=arrays");

    expect(res.status).toBe(200);
    expect(res.body.problems.length).toBe(1);
    expect(
      res.body.problems.every((problem: { tags: string[] }) => Array.isArray(problem.tags) && problem.tags.includes("arrays"))
    ).toBe(true);
  });

  it("returns problem details by slug without hidden test cases", async () => {
    const mockProblem = {
      id: "dsa-001",
      slug: "two-sum",
      title: "Two Sum",
      difficulty: "easy",
      tags: [{ name: "arrays" }, { name: "hash-map" }],
      description: "Return two indices that add up to target.",
      constraints: "n >= 2",
      timeLimits: { default: 5 },
      memoryLimit: 256,
      sampleTestCases: [{ input: "4\\n2 7 11 15\\n9", output: "0 1" }],
      hiddenTestCases: [{ input: "private", output: "hidden" }],
      correctAnswer: null,
    };

    (prisma.question.findFirst as any).mockResolvedValue(mockProblem);

    const res = await request(app).get("/api/v1/problems/two-sum");

    expect(res.status).toBe(200);
    expect(res.body?.problem?.slug).toBe("dsa-001");
    expect(Array.isArray(res.body?.problem?.sampleTestCases)).toBe(true);
    expect(res.body?.problem?.hiddenTestCases).toBeUndefined();
    expect(res.body?.problem?.correctAnswer).toBeUndefined();
  });

  it("returns 404 for unknown problem slug", async () => {
    (prisma.question.findFirst as any).mockResolvedValue(null);

    const res = await request(app).get("/api/v1/problems/not-a-real-problem");

    expect(res.status).toBe(404);
    expect(typeof res.body?.error).toBe("string");
  });
});
