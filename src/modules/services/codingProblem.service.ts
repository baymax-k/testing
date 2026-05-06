// ─── Coding Problem Service ─────────────────────────────────────────────────────
// Service for retrieving coding problems for execution and summaries.

import { loadProblems, getProblems } from "../../data/problems/index.js";
import type { Problem, ProblemSummary } from "../../data/problems/types.js";

/**
 * Get a coding problem with all test cases for execution
 */
export async function getCodingProblemForExecution(problemId: string): Promise<Problem | null> {
  // For now, problems are stored as JSON files with slug as identifier
  // In the future, this will query Prisma with problemId
  const problems = loadProblems();
  const problem = problems.get(problemId);
  return problem || null;
}

/**
 * Get problem summaries by IDs
 */
export async function getCodingProblemSummariesByIds(problemIds: string[]): Promise<Record<string, ProblemSummary>> {
  const allProblems = getProblems();
  const result: Record<string, ProblemSummary> = {};

  for (const problemId of problemIds) {
    const problem = allProblems.find(p => p.id === problemId);
    if (problem) {
      result[problemId] = problem;
    }
  }

  return result;
}