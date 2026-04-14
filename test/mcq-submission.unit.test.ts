import request from "supertest";
import express from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("../src/config/prisma.js", () => {
  return {
    prisma: {
      question: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      mCQPracticeSession: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    }
  };
});

// Import the controllers and Prisma mock after the mock declaration
import { prisma } from "../src/config/prisma.js";
import { submitMcqPractice, submitMcqPracticeSession } from "../src/modules/controllers/practice.controller.js";

// Setup express app to test the endpoint
const app = express();
app.use(express.json());

// Mock Auth logic
app.use((req, res, next) => {
  (req as any).user = { userId: "user-123" };
  next();
});

app.post("/api/v1/practice/mcq", submitMcqPractice);
app.post("/api/v1/practice/mcq/session", submitMcqPracticeSession);

describe("MCQ Submission Logic - Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Single MCQ Practice - submitMcqPractice", () => {
    it("returns 400 if validation fails", async () => {
      const res = await request(app)
        .post("/api/v1/practice/mcq")
        .send({ questionId: "q1" }); // missing selectedOption

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
    });

    it("returns 404 if question is not found or not mcq", async () => {
      (prisma.question.findUnique as any).mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/practice/mcq")
        .send({ questionId: "q1", selectedOption: 1 });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("MCQ question not found");
    });

    it("returns 400 if selectedOption is out of bounds", async () => {
      (prisma.question.findUnique as any).mockResolvedValue({
        type: "mcq",
        correctAnswer: 1,
        options: ["A", "B"], // Length 2
      });

      const res = await request(app)
        .post("/api/v1/practice/mcq")
        .send({ questionId: "q1", selectedOption: 5 }); // out of bounds

      expect(res.status).toBe(400);
      expect(res.body.details[0].message).toBe("selectedOption is out of range for this MCQ");
    });

    it("evaluates correctly if answer is correct", async () => {
      (prisma.question.findUnique as any).mockResolvedValue({
        type: "mcq",
        correctAnswer: 1,
        options: ["A", "B"],
      });

      const res = await request(app)
        .post("/api/v1/practice/mcq")
        .send({ questionId: "q1", selectedOption: 1 });

      expect(res.status).toBe(200);
      expect(res.body.isCorrect).toBe(true);
      expect(res.body.points).toBe(10);
      expect(res.body.correctAnswer).toBe(1);
    });

    it("evaluates correctly if answer is incorrect", async () => {
      (prisma.question.findUnique as any).mockResolvedValue({
        type: "mcq",
        correctAnswer: 1,
        options: ["A", "B"],
      });

      const res = await request(app)
        .post("/api/v1/practice/mcq")
        .send({ questionId: "q1", selectedOption: 0 });

      expect(res.status).toBe(200);
      expect(res.body.isCorrect).toBe(false);
      expect(res.body.points).toBe(0);
    });
  });

  describe("Batch Session MCQ Submit - submitMcqPracticeSession", () => {
    it("returns 404 if session not found", async () => {
      (prisma.mCQPracticeSession.findFirst as any).mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/practice/mcq/session")
        .send({ sessionId: "session-1", answers: [{ questionId: "q1", selectedOption: 1 }] });

      expect(res.status).toBe(404);
    });

    it("returns 400 if session is already submitted", async () => {
      (prisma.mCQPracticeSession.findFirst as any).mockResolvedValue({
        id: "session-1",
        status: "submitted",
        questionIds: ["q1"],
      });

      const res = await request(app)
        .post("/api/v1/practice/mcq/session")
        .send({ sessionId: "session-1", answers: [{ questionId: "q1", selectedOption: 1 }] });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("MCQ session already submitted");
    });

    it("returns 400 if user answers are incomplete", async () => {
      (prisma.mCQPracticeSession.findFirst as any).mockResolvedValue({
        id: "session-1",
        status: "in_progress",
        questionIds: ["q1", "q2"],
      });

      const res = await request(app)
        .post("/api/v1/practice/mcq/session")
        .send({ sessionId: "session-1", answers: [{ questionId: "q1", selectedOption: 1 }] });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("All questions must be answered");
    });

    it("evaluates a completely valid session correctly", async () => {
      (prisma.mCQPracticeSession.findFirst as any).mockResolvedValue({
        id: "session-1",
        status: "in_progress",
        questionIds: ["q1", "q2"],
      });

      (prisma.mCQPracticeSession.update as any).mockResolvedValue({
        id: "session-1",
        status: "submitted",
        topics: ["strings"],
        totalQuestions: 2,
        correctCount: 1,
        score: 10,
        submittedAt: new Date(),
      });

      (prisma.question.findMany as any).mockResolvedValue([
        { id: "q1", title: "Q1", options: ["A", "B", "C"], correctAnswer: 1 },
        { id: "q2", title: "Q2", options: ["X", "Y"], correctAnswer: 0 },
      ]);

      const res = await request(app)
        .post("/api/v1/practice/mcq/session")
        .send({
          sessionId: "session-1",
          answers: [
            { questionId: "q1", selectedOption: 1 }, // Correct!
            { questionId: "q2", selectedOption: 1 }, // Incorrect! Correct is 0
          ]
        });

      // Based on our fake $transaction, it returns the mocked object
      expect(res.status).toBe(200);
      expect(res.body.review).toHaveLength(2);

      const q1Review = res.body.review.find((r: any) => r.questionId === "q1");
      const q2Review = res.body.review.find((r: any) => r.questionId === "q2");

      expect(q1Review.isCorrect).toBe(true);
      expect(q1Review.points).toBe(10);
      expect(q2Review.isCorrect).toBe(false);
      expect(q2Review.points).toBe(0);

      expect(prisma.mCQPracticeSession.update).toHaveBeenCalledOnce();
    });
  });
});
