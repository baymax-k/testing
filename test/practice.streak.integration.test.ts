import request from "supertest";
import express from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/config/prisma.js", () => {
  return {
    prisma: {
      dailyChallenge: {
        findUnique: vi.fn(),
      },
      question: {
        findUnique: vi.fn(),
      },
      dailyChallengeSolve: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      userStreak: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      }
    }
  }
});

import { prisma } from "../src/config/prisma.js";
import { solvePotd, getStreak } from "../src/modules/controllers/potd.controller.js";

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  (req as any).user = { userId: "user-123" };
  next();
});

app.post("/api/v1/potd/solve", solvePotd);
app.get("/api/v1/potd/streak", getStreak);

describe("Practice & Streak - Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates streak effectively using the API endpoint when POTD is solved correctly", async () => {
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);

    // Mock that we have a POTD
    (prisma.dailyChallenge.findUnique as any).mockResolvedValue({
      id: "challenge-1",
      date: today,
      questionId: "q-1",
      question: {
        id: "q-1",
        type: "mcq",
        correctAnswer: 1,
        options: ["A", "B"],
      }
    });

    // Mock question
    (prisma.question.findUnique as any).mockResolvedValue({
      id: "q-1",
      type: "mcq",
      correctAnswer: 1,
      options: ["A", "B"],
    });

    // Mock no prior solve
    (prisma.dailyChallengeSolve.findUnique as any).mockResolvedValue(null);
    
    // Mock user streak state (already verified logic in unit tests, just ensure it orchestrates)
    (prisma.userStreak.findUnique as any).mockResolvedValue(null);
    (prisma.userStreak.upsert as any).mockResolvedValue({
      currentStreak: 1,
      longestStreak: 1,
    });
    
    // Mock successful creation
    (prisma.dailyChallengeSolve.create as any).mockResolvedValue({});

    const res = await request(app)
      .post("/api/v1/potd/solve")
      .send({
        dailyChallengeId: "challenge-1",
        selectedOption: 1 // correct option
      });

    expect(res.status).toBe(200);
    expect(res.body.isCorrect).toBe(true);
    
    // Validates that upsert was correctly triggered from potd service inside orchestrator flow
    expect(prisma.userStreak.upsert).toHaveBeenCalled();
  });

  it("fails to update streak or submit when already solved", async () => {
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);

    // Mock we have a POTD
    (prisma.dailyChallenge.findUnique as any).mockResolvedValue({
      id: "challenge-2",
      date: today,
      questionId: "q-1",
      question: {
        id: "q-1",
        type: "mcq",
        correctAnswer: 1,
        options: ["A", "B"],
      }
    });

    // Mock that user HAS solved it already
    (prisma.dailyChallengeSolve.findUnique as any).mockResolvedValue({
      id: "solve-existing",
    });

    const res = await request(app)
      .post("/api/v1/potd/solve")
      .send({
        dailyChallengeId: "challenge-2",
        selectedOption: 1
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("You have already solved today's challenge");
    expect(prisma.userStreak.upsert).not.toHaveBeenCalled();
  });
  
  it("getStreak retrieves current streak status", async () => {
    // Make sure we have the exact right start of day so it doesn't look like a broken streak
    const d = new Date();
    const todayTarget = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

    (prisma.userStreak.findUnique as any).mockResolvedValue({
      userId: "user-123",
      currentStreak: 5,
      longestStreak: 10,
      lastSolveDate: todayTarget,
    });

    const res = await request(app)
        .get("/api/v1/potd/streak");
        
    expect(res.status).toBe(200);
    expect(res.body.streak.currentStreak).toBe(5);
    expect(res.body.streak.longestStreak).toBe(10);
  });
});
