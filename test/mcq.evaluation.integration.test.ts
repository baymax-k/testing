import request from "supertest";
import { describe, it, expect, vi, beforeAll } from "vitest";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

const sessionRecord = {
  id: "session-1",
  userId: "user-1",
  topics: ["arrays"],
  difficulty: "easy",
  requestedCount: 2,
  totalQuestions: 2,
  questionIds: ["q1", "q2"],
  status: "active",
  createdAt: new Date(),
  correctCount: 0,
  score: 0,
  submittedAt: null as Date | null,
};

const createQuestions = [
  {
    id: "q1",
    title: "Question 1",
    description: "Arrays 1",
    difficulty: "easy",
    options: ["A", "B", "C"],
    correctAnswer: 1,
    type: "mcq",
    tags: [{ name: "arrays" }],
  },
  {
    id: "q2",
    title: "Question 2",
    description: "Arrays 2",
    difficulty: "easy",
    options: ["X", "Y", "Z"],
    correctAnswer: 2,
    type: "mcq",
    tags: [{ name: "arrays" }],
  },
];

const submitQuestions = [
  {
    id: "q1",
    title: "Question 1",
    options: ["A", "B", "C"],
    correctAnswer: 1,
  },
  {
    id: "q2",
    title: "Question 2",
    options: ["X", "Y", "Z"],
    correctAnswer: 2,
  },
];

vi.mock("../src/config/prisma.js", () => {
  return {
    prisma: {
      question: {
        findMany: vi.fn(async (args) => {
          if (args?.where?.id?.in) {
            return submitQuestions;
          }
          return createQuestions;
        }),
        findUnique: vi.fn(async () => ({
          correctAnswer: 1,
          type: "mcq",
          options: ["A", "B", "C"],
        })),
      },
      mcqPracticeSession: {
        create: vi.fn(async () => sessionRecord),
        findFirst: vi.fn(async () => sessionRecord),
        update: vi.fn(async () => ({
          ...sessionRecord,
          status: "submitted",
          correctCount: 1,
          score: 10,
          submittedAt: new Date(),
        })),
      },
      mcqPracticeAnswer: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        createMany: vi.fn(async () => ({ count: 2 })),
      },
      $transaction: vi.fn(async (fn) => {
        const tx = {
          mcqPracticeAnswer: {
            deleteMany: vi.fn(async () => ({ count: 0 })),
            createMany: vi.fn(async () => ({ count: 2 })),
          },
          mcqPracticeSession: {
            update: vi.fn(async () => ({
              ...sessionRecord,
              status: "submitted",
              correctCount: 1,
              score: 10,
              submittedAt: new Date(),
            })),
          },
        };
        return fn(tx);
      }),
    },
  };
});

import app from "../src/app.js";
import { generateAccessToken } from "../src/modules/auth/auth.service.js";

describe("MCQ Evaluation Flow - Integration Tests", () => {
  let token: string;

  beforeAll(() => {
    token = generateAccessToken({
      userId: "user-1",
      email: "student@example.com",
      name: "Student",
      role: "student",
      emailVerified: true,
    });
  });

  it("creates a MCQ practice session and returns questions", async () => {
    const res = await request(app)
      .post("/api/v1/student/practice/mcq/session")
      .set("Cookie", [`access_token=${token}`])
      .send({ topics: ["arrays"], difficulty: "easy" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("session");
    expect(res.body.session.id).toBe("session-1");
    expect(res.body).toHaveProperty("questions");
    expect(res.body.questions.length).toBe(2);
  });

  it("submits a MCQ session and returns review", async () => {
    const res = await request(app)
      .post("/api/v1/student/practice/mcq/session/submit")
      .set("Cookie", [`access_token=${token}`])
      .send({
        sessionId: "session-1",
        answers: [
          { questionId: "q1", selectedOption: 1 },
          { questionId: "q2", selectedOption: 0 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("session");
    expect(res.body.session.status).toBe("submitted");
    expect(res.body.session.score).toBe(10);
    expect(res.body).toHaveProperty("review");
    expect(res.body.review.length).toBe(2);
  });

  it("evaluates single MCQ submissions", async () => {
    const res = await request(app)
      .post("/api/v1/student/practice/mcq")
      .set("Cookie", [`access_token=${token}`])
      .send({ questionId: "q1", selectedOption: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("isCorrect", true);
    expect(res.body).toHaveProperty("points", 10);
  });
});
