import request from "supertest";
import express from "express";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Prisma
vi.mock("../src/config/prisma.js", () => {
  return {
    prisma: {
      practiceActivity: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      }
    }
  }
});

import { prisma } from "../src/config/prisma.js";
import { postPracticeActivity, getPracticeActivityHandler } from "../src/modules/controllers/practiceActivity.controller.js";

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  (req as any).user = { userId: "user-123" };
  next();
});

app.post("/api/v1/practice/activity", postPracticeActivity);
app.get("/api/v1/practice/activity", getPracticeActivityHandler);

describe("Track Daily Practice Activity - Config Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a new activity row if none exists today", async () => {
    vi.setSystemTime(new Date("2023-11-20T12:00:00Z"));
    
    (prisma.practiceActivity.findUnique as any).mockResolvedValue(null);
    (prisma.practiceActivity.create as any).mockResolvedValue({
      id: "act-1",
      userId: "user-123",
      mcqSolved: 1,
      date: new Date("2023-11-20T00:00:00Z"),
    });

    const res = await request(app).post("/api/v1/practice/activity").send({ type: "mcq" });

    expect(res.status).toBe(200);
    expect(res.body.activity.mcqSolved).toBe(1);
    expect(prisma.practiceActivity.create).toHaveBeenCalled();
  });

  it("updates existing activity row if one exists", async () => {
    vi.setSystemTime(new Date("2023-11-20T12:00:00Z"));

    (prisma.practiceActivity.findUnique as any).mockResolvedValue({
      id: "act-old",
      userId: "user-123",
      dsaSolved: 5,
      date: new Date("2023-11-20T00:00:00Z"),
    });

    (prisma.practiceActivity.update as any).mockResolvedValue({
      id: "act-old",
      userId: "user-123",
      dsaSolved: 6,
    });

    const res = await request(app).post("/api/v1/practice/activity").send({ type: "dsa" });

    expect(res.status).toBe(200);
    expect(prisma.practiceActivity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { dsaSolved: { increment: 1 } }
      })
    );
  });

  it("fetching range gets multiple days of activity", async () => {
    (prisma.practiceActivity.findMany as any).mockResolvedValue([
      { date: new Date("2023-11-19T00:00:00Z"), dsaSolved: 1 },
      { date: new Date("2023-11-20T00:00:00Z"), dsaSolved: 2 },
    ]);

    const res = await request(app).get("/api/v1/practice/activity?days=7");

    expect(res.status).toBe(200);
    expect(res.body.activity).toHaveLength(2);
    expect(prisma.practiceActivity.findMany).toHaveBeenCalled();
  });

  it("fetching current day activity specifically", async () => {
    (prisma.practiceActivity.findUnique as any).mockResolvedValue({
      mcqSolved: 5,
      dsaSolved: 2,
    });

    const res = await request(app).get("/api/v1/practice/activity");

    expect(res.status).toBe(200);
    expect(res.body.activity.mcqSolved).toBe(5);
    expect(prisma.practiceActivity.findUnique).toHaveBeenCalled();
  });
});