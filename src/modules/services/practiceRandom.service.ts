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
  chooseAllInTopics?: boolean;
}

type CandidateQuestion = {
  id: string;
  tags: Array<{ name: string }>;
};

function normalizeTopics(topics: string[] | undefined): string[] {
  return Array.from(new Set((topics ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean)));
}

function buildTopicBuckets(candidates: CandidateQuestion[], topics: string[]): Map<string, string[]> {
  const topicSet = new Set(topics);
  const buckets = new Map<string, string[]>();

  for (const topic of topics) {
    buckets.set(topic, []);
  }

  for (const candidate of candidates) {
    const candidateTopics = new Set(
      (candidate.tags ?? [])
        .map((tag) => (typeof tag?.name === "string" ? tag.name.trim().toLowerCase() : ""))
        .filter((name) => name.length > 0 && topicSet.has(name))
    );

    for (const topic of candidateTopics) {
      buckets.get(topic)?.push(candidate.id);
    }
  }

  return buckets;
}

function pickBalancedIds(
  candidates: CandidateQuestion[],
  topics: string[],
  requestedCount: number,
  seed: string
): string[] {
  if (requestedCount <= 0 || candidates.length === 0) {
    return [];
  }

  if (topics.length <= 1) {
    return seededShuffle(candidates.map((c) => c.id), seed).slice(0, requestedCount);
  }

  const buckets = buildTopicBuckets(candidates, topics);
  const activeTopics = topics.filter((topic) => (buckets.get(topic)?.length ?? 0) > 0);

  if (activeTopics.length === 0) {
    return seededShuffle(candidates.map((c) => c.id), seed).slice(0, requestedCount);
  }

  const selected = new Set<string>();
  const topicOrder = seededShuffle(activeTopics, `${seed}:topic-order`);
  const basePerTopic = Math.floor(requestedCount / activeTopics.length);

  // Phase 1: Equal baseline picks per topic
  for (const topic of topicOrder) {
    const topicIds = seededShuffle(buckets.get(topic) ?? [], `${seed}:${topic}:baseline`);
    for (const id of topicIds) {
      if (selected.size >= requestedCount) break;
      if (selected.has(id)) continue;
      selected.add(id);
      if (
        basePerTopic > 0 &&
        Array.from(selected).filter((selectedId) => (buckets.get(topic) ?? []).includes(selectedId)).length >=
          basePerTopic
      ) {
        break;
      }
    }
  }

  // Phase 2: Round-robin fill for remaining slots
  if (selected.size < requestedCount) {
    const bucketQueues = new Map<string, string[]>();
    for (const topic of topicOrder) {
      const queue = seededShuffle(buckets.get(topic) ?? [], `${seed}:${topic}:remainder`).filter(
        (id) => !selected.has(id)
      );
      bucketQueues.set(topic, queue);
    }

    let madeProgress = true;
    while (selected.size < requestedCount && madeProgress) {
      madeProgress = false;
      for (const topic of topicOrder) {
        if (selected.size >= requestedCount) break;
        const queue = bucketQueues.get(topic) ?? [];
        while (queue.length > 0) {
          const id = queue.shift()!;
          if (selected.has(id)) continue;
          selected.add(id);
          madeProgress = true;
          break;
        }
      }
    }
  }

  // Phase 3: Any leftover from global pool (still deterministic)
  if (selected.size < requestedCount) {
    const global = seededShuffle(candidates.map((c) => c.id), `${seed}:global`).filter((id) => !selected.has(id));
    for (const id of global) {
      if (selected.size >= requestedCount) break;
      selected.add(id);
    }
  }

  return Array.from(selected).slice(0, requestedCount);
}

export async function generateRandomMcqSet(userId: string, opts: RandomOptions) {
  const topics = normalizeTopics(opts.topics);
  const chooseAllInTopics = Boolean(opts.chooseAllInTopics);
  const requestedCount = chooseAllInTopics ? Number.MAX_SAFE_INTEGER : Math.min(opts.count ?? 10, 100);

  // Build where clause for candidate pool
  const where: any = { type: "mcq" };
  if (opts.difficulty) where.difficulty = opts.difficulty;
  if (topics.length) where.tags = { some: { name: { in: topics } } };

  // Fetch full candidate ids + tags (pool before exclusions)
  const fullCandidates = await prisma.question.findMany({
    where,
    select: {
      id: true,
      tags: { select: { name: true } },
    },
  });
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
  let candidatePool = fullCandidates.filter((candidate) => !solvedIds.has(candidate.id) && !explicitExcludes.has(candidate.id));

  let reset = false;
  // If pool is smaller than requested, allow refill from full pool and mark reset
  if (!chooseAllInTopics && candidatePool.length < requestedCount) {
    reset = true;
    // refill by allowing repeats from full pool (drop exclusions)
    candidatePool = fullCandidates.slice();
  }

  const seed = opts.seed ?? `${userId}:${Date.now()}`;
  const selectedIds = chooseAllInTopics
    ? seededShuffle(candidatePool.map((candidate) => candidate.id), seed)
    : pickBalancedIds(candidatePool, topics, requestedCount, seed);

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
      filters: { topics, difficulty: opts.difficulty ?? null, chooseAllInTopics },
      questionIds: selectedIds,
      count: selectedIds.length,
      expiresAt,
    },
  });

  return {
    questions: ordered,
    seed,
    poolSize: candidatePool.length,
    reset,
  };
}
