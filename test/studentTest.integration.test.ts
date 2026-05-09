/**
 * Student Test API - Integration Test
 * Tests the endpoints for viewing, getting details, and submitting tests
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import type { User, Test, Question } from "@prisma/client";

let studentUser: User;
let testRecord: Test;
let questions: Question[];
let authToken: string;

describe("Student Test API", () => {
  beforeAll(async () => {
    // Create a test batch and student for testing
    const batch = await prisma.batch.create({
      data: {
        name: "Test Batch - 2025",
        department: { connect: { id: "test-dept-id" } }, // Assume this exists
      },
    });

    studentUser = await prisma.user.create({
      data: {
        email: `student-test-${Date.now()}@test.com`,
        username: `student-test-${Date.now()}`,
        name: "Test Student",
        passwordHash: "hashed-password",
        role: "student",
        batchId: batch.id,
      },
    });

    // Create a test assigned to this student's batch
    testRecord = await prisma.test.create({
      data: {
        title: "DSA Fundamentals Test",
        description: "Test your DSA knowledge",
        status: "active",
        durationMinutes: 120,
        maxAttempts: 2,
        totalMarks: 100,
        batchId: batch.id,
        createdById: studentUser.id,
      },
    });

    // Create questions for the test
    questions = await Promise.all([
      prisma.question.create({
        data: {
          type: "multiple_choice",
          title: "What is the time complexity of binary search?",
          description: "Select the correct answer",
          difficulty: "easy",
          marks: 10,
          orderIndex: 1,
          testId: testRecord.id,
          options: JSON.stringify(["O(n)", "O(log n)", "O(n²)", "O(2^n)"]),
          correctAnswer: 1,
          createdBy: studentUser.id,
        },
      }),
      prisma.question.create({
        data: {
          type: "multiple_choice",
          title: "What is a hash table?",
          description: "Choose the correct definition",
          difficulty: "medium",
          marks: 15,
          orderIndex: 2,
          testId: testRecord.id,
          options: JSON.stringify([
            "A data structure for sorting",
            "A data structure for fast lookup using hash functions",
            "A type of tree",
            "A sorting algorithm",
          ]),
          correctAnswer: 1,
          createdBy: studentUser.id,
        },
      }),
    ]);

    // For testing, we'll use the user ID directly as token
    // In real scenarios, this would be a proper JWT
    authToken = studentUser.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.testAttempt.deleteMany({
      where: { testId: testRecord.id },
    });
    await prisma.question.deleteMany({
      where: { testId: testRecord.id },
    });
    await prisma.test.delete({
      where: { id: testRecord.id },
    });
    await prisma.user.delete({
      where: { id: studentUser.id },
    });
  });

  describe("GET /api/v1/student/tests", () => {
    it("should list all assigned tests with pagination", async () => {
      const response = await request(app)
        .get("/api/v1/student/tests?limit=10&offset=0")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data.tests");
      expect(response.body).toHaveProperty("data.pagination");
      expect(Array.isArray(response.body.data.tests)).toBe(true);
    });

    it("should filter tests by difficulty", async () => {
      const response = await request(app)
        .get("/api/v1/student/tests?difficulty=easy")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.tests).toBeDefined();
    });

    it("should reject request without authentication", async () => {
      const response = await request(app).get("/api/v1/student/tests");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/v1/student/tests/:id", () => {
    it("should return test details with questions", async () => {
      const response = await request(app)
        .get(`/api/v1/student/tests/${testRecord.id}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.test).toBeDefined();
      expect(response.body.data.test.id).toBe(testRecord.id);
      expect(response.body.data.test.questions).toBeDefined();
      expect(Array.isArray(response.body.data.test.questions)).toBe(true);
    });

    it("should not include correctAnswer in student view", async () => {
      const response = await request(app)
        .get(`/api/v1/student/tests/${testRecord.id}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // Verify correctAnswer is not exposed to student
      response.body.data.test.questions.forEach((q: any) => {
        expect(q).not.toHaveProperty("correctAnswer");
      });
    });

    it("should return 404 for non-existent test", async () => {
      const response = await request(app)
        .get("/api/v1/student/tests/invalid-id")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe("POST /api/v1/student/tests/:id/submit", () => {
    it("should accept test submission with answers", async () => {
      const response = await request(app)
        .post(`/api/v1/student/tests/${testRecord.id}/submit`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          answers: [
            { questionId: questions[0].id, selectedAnswer: 1 }, // Correct answer
            { questionId: questions[1].id, selectedAnswer: 0 }, // Incorrect answer
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.submission).toBeDefined();
      expect(response.body.data.submission).toHaveProperty("score");
      expect(response.body.data.submission).toHaveProperty("maxScore");
      expect(response.body.data.submission).toHaveProperty("correctCount");
    });

    it("should calculate score correctly", async () => {
      const response = await request(app)
        .post(`/api/v1/student/tests/${testRecord.id}/submit`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          answers: [
            { questionId: questions[0].id, selectedAnswer: 1 }, // Correct: 10 marks
            { questionId: questions[1].id, selectedAnswer: 1 }, // Correct: 15 marks
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.submission.score).toBe(25); // 10 + 15
      expect(response.body.data.submission.correctCount).toBe(2);
      expect(response.body.data.submission.percentage).toBe(25); // (25/100)*100
    });

    it("should reject submission with invalid data", async () => {
      const response = await request(app)
        .post(`/api/v1/student/tests/${testRecord.id}/submit`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          answers: [], // Empty answers
        });

      expect(response.status).toBe(400);
    });

    it("should respect maximum attempts limit", async () => {
      // Submit first attempt
      await request(app)
        .post(`/api/v1/student/tests/${testRecord.id}/submit`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          answers: [
            { questionId: questions[0].id, selectedAnswer: 0 },
            { questionId: questions[1].id, selectedAnswer: 0 },
          ],
        });

      // Submit second attempt
      await request(app)
        .post(`/api/v1/student/tests/${testRecord.id}/submit`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          answers: [
            { questionId: questions[0].id, selectedAnswer: 1 },
            { questionId: questions[1].id, selectedAnswer: 1 },
          ],
        });

      // Third attempt should fail (maxAttempts = 2)
      const response = await request(app)
        .post(`/api/v1/student/tests/${testRecord.id}/submit`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          answers: [
            { questionId: questions[0].id, selectedAnswer: 1 },
            { questionId: questions[1].id, selectedAnswer: 1 },
          ],
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/Maximum attempts/);
    });
  });
});
