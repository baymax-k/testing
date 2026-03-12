import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { listProblems, getProblem } from "../src/modules/controllers/problem.controller.js";

const app = express();
app.use(express.json());
app.get("/api/v1/problems", listProblems);
app.get("/api/v1/problems/:slug", getProblem);

describe("Problem fetch API", () => {
  it("lists problems with pagination envelope", async () => {
    const res = await request(app).get("/api/v1/problems?page=1&limit=10");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.problems)).toBe(true);
    expect(typeof res.body?.pagination?.page).toBe("number");
    expect(typeof res.body?.pagination?.total).toBe("number");
    expect(res.body.pagination.page).toBe(1);
  });

  it("filters list by difficulty", async () => {
    const res = await request(app).get("/api/v1/problems?difficulty=easy");

    expect(res.status).toBe(200);
    expect(res.body.problems.length).toBeGreaterThan(0);
    expect(res.body.problems.every((problem: { difficulty: string }) => problem.difficulty === "easy")).toBe(true);
  });

  it("filters list by tag", async () => {
    const res = await request(app).get("/api/v1/problems?tag=arrays");

    expect(res.status).toBe(200);
    expect(res.body.problems.length).toBeGreaterThan(0);
    expect(
      res.body.problems.every(
        (problem: { tags: string[] }) => Array.isArray(problem.tags) && problem.tags.includes("arrays")
      )
    ).toBe(true);
  });

  it("returns problem details by slug without hidden/public test cases", async () => {
    const res = await request(app).get("/api/v1/problems/two-sum");

    expect(res.status).toBe(200);
    expect(res.body?.problem?.slug).toBe("two-sum");
    expect(Array.isArray(res.body?.problem?.sampleTestCases)).toBe(true);
    expect(res.body?.problem?.hiddenTestCases).toBeUndefined();
    expect(res.body?.problem?.publicTestCases).toBeUndefined();
  });

  it("returns 404 for unknown problem slug", async () => {
    const res = await request(app).get("/api/v1/problems/not-a-real-problem");

    expect(res.status).toBe(404);
    expect(typeof res.body?.error).toBe("string");
  });
});
