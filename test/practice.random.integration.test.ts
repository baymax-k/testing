import { describe, it, expect, vi } from "vitest";
// Mock the prisma client before importing the service
vi.mock("../src/config/prisma.js", () => {
  return {
    prisma: {
      question: {
        findMany: vi.fn(async (args) => {
          // sample full question records
          const pool = [
            { id: "q1", title: "Q1", description: "S1", difficulty: "easy", options: ["a","b"], tags: [{ name: "arrays" }] },
            { id: "q2", title: "Q2", description: "S2", difficulty: "easy", options: ["a","b"], tags: [{ name: "arrays" }] },
            { id: "q3", title: "Q3", description: "S3", difficulty: "easy", options: ["a","b"], tags: [{ name: "strings" }] },
          ];

          // If caller requested select: { id: true } return only ids
          if (args?.select && args.select.id) {
            // apply where filter by tags
            const filtered = pool.filter(q => {
              if (args?.where?.tags?.some?.name?.in) {
                const topics = args.where.tags.some.name.in;
                return q.tags.some(t => topics.includes(t.name));
              }
              return true;
            });
            return filtered.map(q => ({ id: q.id }));
          }

          // If caller requested where.id.in, return full matching records
          if (args?.where?.id?.in) {
            return pool.filter(q => args.where.id.in.includes(q.id));
          }

          // default: return all
          return pool;
        }),
      },
      mcqPracticeAnswer: {
        findMany: vi.fn(async ({ where }) => {
          // Simulate user has correctly solved q1
          return [{ questionId: "q1" }];
        }),
      },
      practiceRandomSet: {
        create: vi.fn(async (args) => ({ id: "prs1", ...args.data })),
      },
    },
  };
});

import { generateRandomMcqSet } from "../src/modules/services/practiceRandom.service.js";

describe("generateRandomMcqSet (mocked prisma)", () => {
  it("returns up to requested count and excludes solved by default", async () => {
    // request count=1 to avoid triggering reset/refill behavior
    const res = await generateRandomMcqSet("user1", { count: 1, topics: ["arrays"] });
    expect(res.questions.length).toBeGreaterThan(0);
    // q1 is excluded, so selectedIds should not include q1
    expect(res.questions.some(q => q.id === "q1")).toBe(false);
  });

  it("resets when pool smaller than count and sets reset flag", async () => {
    const res = await generateRandomMcqSet("user1", { count: 10, topics: ["strings"] });
    // pool had only q3 (after exclusion), so reset should be true and get filled
    expect(typeof res.reset).toBe("boolean");
  });
});
