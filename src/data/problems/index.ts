// ─── Problem Loader ─────────────────────────────────────────────────────────────
// Reads problem JSON files from disk. Will be swapped for Prisma queries later.

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Problem, ProblemSummary, ProblemDetail } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache problems in memory (loaded once at startup)
let problemsCache: Map<string, Problem> | null = null;

export function loadProblems(): Map<string, Problem> {
  if (problemsCache) return problemsCache;

  problemsCache = new Map();
  const files = readdirSync(__dirname).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const content = readFileSync(join(__dirname, file), "utf-8");
    const problem: Problem = JSON.parse(content);
    problemsCache.set(problem.slug, problem);
  }

  console.log(`[problems] Loaded ${problemsCache.size} problems from JSON files`);
  return problemsCache;
}

/**
 * Get all problems (summary only — no test cases)
 */
export function getProblems(): ProblemSummary[] {
  const problems = loadProblems();
  return Array.from(problems.values()).map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    difficulty: p.difficulty,
    tags: p.tags,
  }));
}

/**
 * Get a single problem by slug (with sample test cases, no hidden)
 */
export function getProblemBySlug(slug: string): ProblemDetail | null {
  const problems = loadProblems();
  const problem = problems.get(slug);
  if (!problem) return null;

  return {
    id: problem.id,
    title: problem.title,
    slug: problem.slug,
    difficulty: problem.difficulty,
    tags: problem.tags,
    description: problem.description,
    constraints: problem.constraints,
    timeLimits: problem.timeLimits,
    memoryLimit: problem.memoryLimit,
    sampleTestCases: problem.sampleTestCases,
  };
}

/**
 * Get full problem including hidden test cases (internal use only)
 */
export function getProblemWithTestCases(slug: string): Problem | null {
  const problems = loadProblems();
  return problems.get(slug) || null;
}

/**
 * Force reload problems from disk (useful for testing)
 */
export function reloadProblems(): void {
  problemsCache = null;
  loadProblems();
}
