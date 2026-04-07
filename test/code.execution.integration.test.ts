import request from "supertest";
import { describe, it, expect, vi } from "vitest";

const runResult = {
  status: "Accepted",
  stdout: "ok",
  stderr: "",
  compileOutput: "",
  time: "0.01",
  memory: 1024,
};

const preSubmitResult = {
  status: "accepted",
  testCasesPassed: 2,
  totalTestCases: 2,
  failedAt: null,
  runtime: "0.05",
  memory: 2048,
  errorOutput: null,
  testCaseResults: [
    {
      index: 1,
      visibility: "sample",
      passed: true,
      status: "accepted",
      input: "1 1",
      expectedOutput: "2",
      actualOutput: "2",
      errorOutput: null,
    },
    {
      index: 2,
      visibility: "sample",
      passed: true,
      status: "accepted",
      input: "2 2",
      expectedOutput: "4",
      actualOutput: "4",
      errorOutput: null,
    },
  ],
};

const submitResult = {
  submissionId: "sub-1",
  status: "accepted",
  testCasesPassed: 3,
  totalTestCases: 3,
  failedAt: null,
  runtime: "0.06",
  memory: 3072,
  errorOutput: null,
  testCaseResults: [],
};

const listResult = {
  submissions: [
    {
      id: "sub-1",
      problemId: "two-sum",
      language: "javascript",
      status: "accepted",
      testCasesPassed: 3,
      totalTestCases: 3,
      runtime: "0.06",
      memory: 3072,
      createdAt: new Date().toISOString(),
      problem: {
        id: "prob-1",
        title: "Two Sum",
        slug: "two-sum",
        difficulty: "easy",
        tags: ["arrays"],
      },
    },
  ],
  total: 1,
};

const submissionDetail = {
  id: "sub-1",
  problemId: "two-sum",
  language: "javascript",
  sourceCode: "console.log('ok')",
  status: "accepted",
  testCasesPassed: 3,
  totalTestCases: 3,
  failedAt: null,
  runtime: "0.06",
  memory: 3072,
  errorOutput: null,
  createdAt: new Date().toISOString(),
};

vi.mock("../src/middleware/auth.js", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    requireAuth: (req: any, _res: any, next: any) => {
      req.user = {
        id: "user-1",
        userId: "user-1",
        email: "student@example.com",
        name: "Student",
        role: "student",
        emailVerified: true,
      };
      next();
    },
  };
});

vi.mock("../src/modules/services/submission.service.js", () => {
  return {
    runCode: vi.fn(async () => runResult),
    preSubmitCode: vi.fn(async () => preSubmitResult),
    submitCode: vi.fn(async () => submitResult),
    getSubmissions: vi.fn(async () => listResult),
    getSubmissionById: vi.fn(async () => submissionDetail),
  };
});

import app from "../src/app.js";

describe("Code Execution Workflow - Integration Tests", () => {
  it("runs code in playground mode", async () => {
    const res = await request(app)
      .post("/api/v1/submissions/run")
      .send({
        language: "javascript",
        sourceCode: "console.log('ok')",
        stdin: "",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Accepted");
    expect(res.body.stdout).toBe("ok");
  });

  it("pre-submits code against sample test cases", async () => {
    const res = await request(app)
      .post("/api/v1/submissions/test")
      .send({
        problemId: "two-sum",
        language: "javascript",
        sourceCode: "console.log('ok')",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("accepted");
    expect(res.body.testCasesPassed).toBe(2);
  });

  it("submits code against hidden test cases", async () => {
    const res = await request(app)
      .post("/api/v1/submissions")
      .send({
        problemId: "two-sum",
        language: "javascript",
        sourceCode: "console.log('ok')",
      });

    expect(res.status).toBe(200);
    expect(res.body.submissionId).toBe("sub-1");
    expect(res.body.status).toBe("accepted");
  });

  it("lists submission history", async () => {
    const res = await request(app).get("/api/v1/submissions");

    expect(res.status).toBe(200);
    expect(res.body.submissions.length).toBe(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it("fetches submission detail", async () => {
    const res = await request(app).get("/api/v1/submissions/sub-1");

    expect(res.status).toBe(200);
    expect(res.body.submission.id).toBe("sub-1");
    expect(res.body.submission.status).toBe("accepted");
  });
});
