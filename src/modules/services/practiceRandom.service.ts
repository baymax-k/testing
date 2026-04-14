import { prisma } from "../../config/prisma.js";

// Seed helpers (Mulberry32)
export function stringToSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(arr: T[], seedStr?: string): T[] {
  const out = arr.slice();
  const rand = seedStr ? mulberry32(stringToSeed(seedStr)) : Math.random;
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface RandomOptions {
  count?: number;
  topics?: string[];
  difficulty?: "easy" | "medium" | "hard" | undefined;
  excludeIds?: string[];
  seed?: string;
}

export async function generateRandomMcqSet(userId: string, opts: RandomOptions) {
  const count = Math.min(opts.count ?? 10, 25);
  const topics = (opts.topics ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean);

  // Build where clause for candidate pool
  const where: any = { type: "mcq" };
  if (opts.difficulty) where.difficulty = opts.difficulty;
  if (topics.length) where.tags = { some: { name: { in: topics } } };

  // Fetch full candidate ids (pool before exclusions)
  const fullCandidates = await prisma.question.findMany({ where, select: { id: true } });
  const fullIds = fullCandidates.map((r) => r.id);

  // Exclude previously solved MCQs for this user.
  // Use current Prisma model first, and keep a legacy fallback for test/migration compatibility.
  const solvedIds = new Set<string>();
  try {
    const prismaAny = prisma as any;
    if (prismaAny.mCQSessionAnswer?.findMany) {
      const solvedRows = await prismaAny.mCQSessionAnswer.findMany({
        where: {
          isCorrect: true,
          session: { userId },
        },
        select: { questionId: true },
        distinct: ["questionId"],
      });

      for (const row of solvedRows as Array<{ questionId?: string }>) {
        if (row?.questionId) solvedIds.add(row.questionId);
      }
    } else if (prismaAny.mcqPracticeAnswer?.findMany) {
      const solvedRows = await prismaAny.mcqPracticeAnswer.findMany({
        where: { userId, isCorrect: true },
        select: { questionId: true },
      });

      for (const row of solvedRows as Array<{ questionId?: string }>) {
        if (row?.questionId) solvedIds.add(row.questionId);
      }
    }
  } catch {
    // If solved-history lookup fails, continue with explicit excludes only.
  }

  const explicitExcludes = new Set((opts.excludeIds ?? []).filter(Boolean));

  // Apply exclusions
  let candidateIds = fullIds.filter((id) => !solvedIds.has(id) && !explicitExcludes.has(id));

  let reset = false;
  // If pool is smaller than requested, allow refill from full pool and mark reset
  if (candidateIds.length < count) {
    reset = true;
    // refill by allowing repeats from full pool (drop exclusions)
    candidateIds = fullIds.slice();
  }

  const seed = opts.seed ?? `${userId}:${Date.now()}`;
  const shuffled = seededShuffle(candidateIds, seed);
  const selectedIds = shuffled.slice(0, Math.min(count, shuffled.length));

  // Fetch question summaries
  const questions = await prisma.question.findMany({
    where: { id: { in: selectedIds } },
    include: { tags: { select: { name: true } } },
  });

  // Preserve order of selectedIds
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const ordered = selectedIds.map((id) => questionMap.get(id)!).filter(Boolean).map((q) => ({
    id: q.id,
    title: q.title,
    statement: q.description,
    options: Array.isArray(q.options) ? q.options : [],
    topic: q.tags.length ? q.tags[0].name : null,
    difficulty: q.difficulty,
  }));

  // Persist the generated set for auditing (expires in 24h)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.practiceRandomSet.create({
    data: {
      userId,
      seed,
      filters: { topics, difficulty: opts.difficulty ?? null },
      questionIds: selectedIds,
      count: selectedIds.length,
      expiresAt,
    },
  });

  return {
    questions: ordered,
    seed,
    poolSize: candidateIds.length,
    reset,
  };
}
