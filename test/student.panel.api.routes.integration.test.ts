import express, { type RequestHandler } from "express";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

vi.mock("../src/middleware/auth.js", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;

  const requireAuth: RequestHandler = (req, _res, next) => {
    (req as any).user = {
      id: "student-1",
      userId: "student-1",
      email: "student@example.com",
      name: "Student One",
      role: "student",
      emailVerified: true,
    };
    next();
  };

  const requireRole = (..._roles: string[]): RequestHandler => {
    return (_req, _res, next) => next();
  };

  return {
    ...actual,
    requireAuth,
    requireRole,
  };
});

vi.mock("../src/config/rateLimiter.js", () => {
  const pass: RequestHandler = (_req, _res, next) => next();
  return {
    submissionLimiter: pass,
  };
});

vi.mock("../src/modules/controllers/student.controller.js", () => ({
  getStudentProfileHandler: vi.fn((_req: any, res: any) => {
    res.status(200).json({ endpoint: "student-profile" });
  }),
}));

vi.mock("../src/modules/controllers/student-dashboard.controller.js", () => ({
  getStudentDashboardHandler: vi.fn((req: any, res: any) => {
    res.status(200).json({
      panel: "student",
      user: {
        role: req.user?.role ?? "student",
      },
    });
  }),
}));

vi.mock("../src/modules/controllers/practice.controller.js", () => ({
  listPracticeProblems: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "practice-list" })),
  getPracticeProblem: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "practice-detail" })),
  listMcqTopics: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "practice-mcq-topics" })),
  createMcqPracticeSession: vi.fn((_req: any, res: any) => res.status(201).json({ endpoint: "practice-mcq-session-create" })),
  submitMcqPractice: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "practice-mcq-submit" })),
  submitMcqPracticeSession: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "practice-mcq-session-submit" })),
  getMcqPracticeHistory: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "practice-mcq-history" })),
  getMcqPracticeHistoryDetail: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "practice-mcq-history-detail" })),
  getMcqStats: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "practice-mcq-stats" })),
  getMcqSessionById: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "practice-mcq-session-get" })),
  createRandomPractice: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "practice-random" })),
}));

vi.mock("../src/modules/controllers/practiceActivity.controller.js", () => ({
  postPracticeActivity: vi.fn((_req: any, res: any) => res.status(201).json({ endpoint: "practice-activity-post" })),
  getPracticeActivityHandler: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "practice-activity-get" })),
}));

vi.mock("../src/modules/controllers/contest.controller.js", () => ({
  listContests: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "contest-list" })),
  getContest: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "contest-detail" })),
  joinContest: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "contest-join" })),
  submitContestDsa: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "contest-submit-dsa" })),
  getContestMcqQuestions: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "contest-mcq-get" })),
  submitContestMcq: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "contest-submit-mcq" })),
  getContestLeaderboard: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "contest-leaderboard" })),
}));

vi.mock("../src/modules/controllers/potd.controller.js", () => ({
  getTodaysPotd: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "potd-today" })),
  solvePotd: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "potd-solve" })),
  getStreak: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "potd-streak" })),
  getPotdHistoryHandler: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "potd-history" })),
}));

vi.mock("../src/modules/controllers/problem.controller.js", () => ({
  listProblems: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "problem-list" })),
  getProblem: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "problem-detail" })),
}));

vi.mock("../src/modules/controllers/submission.controller.js", () => ({
  runCodeHandler: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "submission-run" })),
  preSubmitCodeHandler: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "submission-test" })),
  submitCodeHandler: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "submission-submit" })),
  listSubmissionsHandler: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "submission-list" })),
  getSubmissionHandler: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "submission-get" })),
  judge0HealthHandler: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "judge0-health" })),
}));

vi.mock("../src/modules/controllers/proctoring.controller.js", () => ({
  createVideoUploadUrlHandler: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "proctoring-upload-url" })),
  createProctoringVideoRecordHandler: vi.fn((_req: any, res: any) =>
    res.status(201).json({ endpoint: "proctoring-video-create" })
  ),
  listTestProctoringVideosHandler: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "proctoring-list" })),
  getProctoringVideoAccessUrlHandler: vi.fn((_req: any, res: any) =>
    res.status(200).json({ endpoint: "proctoring-access-url" })
  ),
  reviewProctoringVideoHandler: vi.fn((_req: any, res: any) => res.status(200).json({ endpoint: "proctoring-review" })),
}));

import studentRoutes from "../src/modules/routes/student.js";
import practiceRoutes from "../src/modules/routes/student/practice.js";
import contestRoutes from "../src/modules/routes/student/contest.js";
import potdRoutes from "../src/modules/routes/student/potd.js";
import problemRoutes from "../src/modules/routes/problem.js";
import submissionRoutes from "../src/modules/routes/submission.js";
import proctoringRoutes from "../src/modules/routes/proctoring.js";

const app = express();
app.use(express.json());
app.use("/api/v1/student", studentRoutes);
app.use("/api/v1/student/practice", practiceRoutes);
app.use("/api/v1/student/contest", contestRoutes);
app.use("/api/v1/student/potd", potdRoutes);
app.use("/api/v1/problems", problemRoutes);
app.use("/api/v1/submissions", submissionRoutes);
app.use("/api/v1/proctoring", proctoringRoutes);

type HttpMethod = "get" | "post" | "patch";

type EndpointCase = {
  method: HttpMethod;
  url: string;
  status: number;
  endpoint?: string;
  body?: Record<string, unknown>;
};

const endpointCases: EndpointCase[] = [
  { method: "get", url: "/api/v1/student/profile", status: 200, endpoint: "student-profile" },

  { method: "get", url: "/api/v1/student/practice", status: 200, endpoint: "practice-list" },
  { method: "get", url: "/api/v1/student/practice/mcq/topics", status: 200, endpoint: "practice-mcq-topics" },
  { method: "get", url: "/api/v1/student/practice/mcq/stats", status: 200, endpoint: "practice-mcq-stats" },
  {
    method: "post",
    url: "/api/v1/student/practice/mcq/session",
    status: 201,
    endpoint: "practice-mcq-session-create",
    body: { topics: ["arrays"] },
  },
  {
    method: "post",
    url: "/api/v1/student/practice/random",
    status: 200,
    endpoint: "practice-random",
    body: { topics: ["arrays"], count: 5 },
  },
  {
    method: "get",
    url: "/api/v1/student/practice/mcq/session/session-1",
    status: 200,
    endpoint: "practice-mcq-session-get",
  },
  {
    method: "post",
    url: "/api/v1/student/practice/mcq/session/submit",
    status: 200,
    endpoint: "practice-mcq-session-submit",
    body: { sessionId: "session-1", answers: [] },
  },
  { method: "get", url: "/api/v1/student/practice/mcq/history", status: 200, endpoint: "practice-mcq-history" },
  {
    method: "get",
    url: "/api/v1/student/practice/mcq/history/session-1",
    status: 200,
    endpoint: "practice-mcq-history-detail",
  },
  {
    method: "post",
    url: "/api/v1/student/practice/mcq",
    status: 200,
    endpoint: "practice-mcq-submit",
    body: { questionId: "q1", selectedOption: 1 },
  },
  {
    method: "post",
    url: "/api/v1/student/practice/activity",
    status: 201,
    endpoint: "practice-activity-post",
    body: { activityType: "visit" },
  },
  { method: "get", url: "/api/v1/student/practice/activity?days=7", status: 200, endpoint: "practice-activity-get" },
  { method: "get", url: "/api/v1/student/practice/problem-1", status: 200, endpoint: "practice-detail" },

  { method: "get", url: "/api/v1/student/contest", status: 200, endpoint: "contest-list" },
  { method: "get", url: "/api/v1/student/contest/contest-1", status: 200, endpoint: "contest-detail" },
  { method: "get", url: "/api/v1/student/contest/contest-1/mcq", status: 200, endpoint: "contest-mcq-get" },
  {
    method: "post",
    url: "/api/v1/student/contest/join",
    status: 200,
    endpoint: "contest-join",
    body: { contestId: "contest-1" },
  },
  {
    method: "post",
    url: "/api/v1/student/contest/submit-dsa",
    status: 200,
    endpoint: "contest-submit-dsa",
    body: { contestId: "contest-1", questionId: "q1", language: "javascript", sourceCode: "console.log(1)" },
  },
  {
    method: "post",
    url: "/api/v1/student/contest/submit-mcq",
    status: 200,
    endpoint: "contest-submit-mcq",
    body: { contestId: "contest-1", answers: [] },
  },
  { method: "get", url: "/api/v1/student/contest/contest-1/leaderboard", status: 200, endpoint: "contest-leaderboard" },

  { method: "get", url: "/api/v1/student/potd", status: 200, endpoint: "potd-today" },
  { method: "post", url: "/api/v1/student/potd/solve", status: 200, endpoint: "potd-solve", body: { answer: "42" } },
  { method: "get", url: "/api/v1/student/potd/streak", status: 200, endpoint: "potd-streak" },
  { method: "get", url: "/api/v1/student/potd/history", status: 200, endpoint: "potd-history" },

  { method: "get", url: "/api/v1/problems", status: 200, endpoint: "problem-list" },
  { method: "get", url: "/api/v1/problems/two-sum", status: 200, endpoint: "problem-detail" },

  {
    method: "post",
    url: "/api/v1/submissions/run",
    status: 200,
    endpoint: "submission-run",
    body: { language: "javascript", sourceCode: "console.log(1)", stdin: "" },
  },
  {
    method: "post",
    url: "/api/v1/submissions/test",
    status: 200,
    endpoint: "submission-test",
    body: { problemId: "two-sum", language: "javascript", sourceCode: "console.log(1)" },
  },
  {
    method: "post",
    url: "/api/v1/submissions",
    status: 200,
    endpoint: "submission-submit",
    body: { problemId: "two-sum", language: "javascript", sourceCode: "console.log(1)" },
  },
  { method: "get", url: "/api/v1/submissions", status: 200, endpoint: "submission-list" },
  { method: "get", url: "/api/v1/submissions/sub-1", status: 200, endpoint: "submission-get" },

  {
    method: "post",
    url: "/api/v1/proctoring/videos/upload-url",
    status: 200,
    endpoint: "proctoring-upload-url",
    body: { testId: "t1", attemptId: "a1", violationType: "TAB_SWITCH", mimeType: "video/mp4" },
  },
  {
    method: "post",
    url: "/api/v1/proctoring/videos",
    status: 201,
    endpoint: "proctoring-video-create",
    body: {
      testId: "t1",
      attemptId: "a1",
      objectKey: "proctoring/t1/a1/student-1/x.mp4",
      mimeType: "video/mp4",
      violationType: "TAB_SWITCH",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
    },
  },
];

describe("Student panel API routes", () => {
  it("serves student dashboard", async () => {
    const res = await request(app).get("/api/v1/student/dashboard");

    expect(res.status).toBe(200);
    expect(res.body?.panel).toBe("student");
    expect(res.body?.user?.role).toBe("student");
  });

  for (const testCase of endpointCases) {
    it(`${testCase.method.toUpperCase()} ${testCase.url}`, async () => {
      let req = request(app)[testCase.method](testCase.url);
      if (testCase.body) {
        req = req.send(testCase.body);
      }

      const res = await req;
      expect(res.status).toBe(testCase.status);
      if (testCase.endpoint) {
        expect(res.body?.endpoint).toBe(testCase.endpoint);
      }
    });
  }
});
