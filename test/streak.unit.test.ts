import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getUserStreak } from "../src/modules/services/potd.service.js";
import { prisma } from "../src/config/prisma.js";

// We mock prisma entirely for this unit test
vi.mock("../src/config/prisma.js", () => ({
  prisma: {
    userStreak: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    }
  }
}));

describe("Streak Calculation Logic - Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function getDateOnly(d: Date): Date {
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }

  it("getUserStreak returns 0s when no streak exists", async () => {
    (prisma.userStreak.findUnique as any).mockResolvedValue(null);

    const result = await getUserStreak("user-1");

    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.lastSolveDate).toBe(null);
  });

  it("getUserStreak returns current streak when solved today", async () => {
    const today = new Date("2023-10-15T12:00:00Z");
    vi.setSystemTime(today);

    (prisma.userStreak.findUnique as any).mockResolvedValue({
      userId: "user-1",
      currentStreak: 5,
      longestStreak: 10,
      lastSolveDate: getDateOnly(today),
    });

    const result = await getUserStreak("user-1");
    expect(result.currentStreak).toBe(5);
  });

  it("getUserStreak returns current streak when solved yesterday", async () => {
    const today = new Date("2023-10-15T12:00:00Z");
    const yesterday = new Date("2023-10-14T12:00:00Z");
    vi.setSystemTime(today);

    (prisma.userStreak.findUnique as any).mockResolvedValue({
      userId: "user-1",
      currentStreak: 5,
      longestStreak: 10,
      lastSolveDate: getDateOnly(yesterday),
    });

    const result = await getUserStreak("user-1");
    expect(result.currentStreak).toBe(5);
  });

  it("getUserStreak returns currentStreak as 0 when streak is broken (solved day before yesterday)", async () => {
    const today = new Date("2023-10-15T12:00:00Z");
    const brokenDate = new Date("2023-10-13T12:00:00Z");
    vi.setSystemTime(today);

    (prisma.userStreak.findUnique as any).mockResolvedValue({
      userId: "user-1",
      currentStreak: 5, // DB says 5
      longestStreak: 10,
      lastSolveDate: getDateOnly(brokenDate), // But it was 2 days ago
    });

    const result = await getUserStreak("user-1");
    
    // Function should dynamically report 0 for broken streak before it is written in DB
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(10); // Longest streak is maintained
    expect(result.lastSolveDate?.getTime()).toBe(getDateOnly(brokenDate).getTime());
  });
});

import { updateStreak } from "../src/modules/services/potd.service.js";

describe("Streak Calculation - updateStreak", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function getDateOnly(d: Date): Date {
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }

  it("updateStreak creates a new streak of 1 if none exists", async () => {
    const today = new Date("2023-10-15T12:00:00Z");
    
    (prisma.userStreak.findUnique as any).mockResolvedValue(null);
    (prisma.userStreak.upsert as any).mockResolvedValue({
      userId: "user-1",
      currentStreak: 1,
      longestStreak: 1,
      lastSolveDate: getDateOnly(today),
    });

    const result = await updateStreak("user-1", today);

    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(prisma.userStreak.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { currentStreak: 1, longestStreak: 1, lastSolveDate: getDateOnly(today) }
    }));
  });

  it("updateStreak increments streak if solved yesterday", async () => {
    const today = new Date("2023-10-15T12:00:00Z");
    const yesterday = new Date("2023-10-14T12:00:00Z");

    (prisma.userStreak.findUnique as any).mockResolvedValue({
      userId: "user-1",
      currentStreak: 5,
      longestStreak: 5,
      lastSolveDate: getDateOnly(yesterday),
    });
    (prisma.userStreak.upsert as any).mockResolvedValue({
      currentStreak: 6,
      longestStreak: 6,
      lastSolveDate: getDateOnly(today),
    });

    const result = await updateStreak("user-1", today);

    expect(result.currentStreak).toBe(6);
    expect(result.longestStreak).toBe(6);
  });
});
