// ─── Submission Service ─────────────────────────────────────────────────────────
// Business logic for running and submitting code.

import { prisma } from "../../config/prisma.js";
import type { SubmissionStatus } from "@prisma/client";
import {
  getCodingProblemForExecution,
  getCodingProblemSummariesByIds,
} from "./codingProblem.service";
import {
  runSync,
  executeTestCases,
  LANGUAGE_IDS,
  type RunResult,
  type TestCaseResult,
} from "./judge0.service.js";

type TestCaseVisibility = "sample" | "public" | "hidden";

// ─── Types ──────────────────────────────────────────────────────────────────────

/** Per-test-case result returned to the user (visibility-controlled) */
export interface TestCaseDetail {
  index: number;         // 1-indexed
  visibility: TestCaseVisibility;
  passed: boolean;
  status: string;
  // Only shown for sample/public test cases:
  input?: string;
  expectedOutput?: string;
  actualOutput?: string;
  errorOutput?: string | null;
}

export interface SubmitResult {
  submissionId: string;
  status: SubmissionStatus;
  testCasesPassed: number;
  totalTestCases: number;
  failedAt: number | null;
  runtime: string | null;
  memory: number | null;
  errorOutput?: string | null;
  testCaseResults: TestCaseDetail[];
}

export interface PreSubmitResult {
  status: SubmissionStatus;
  testCasesPassed: number;
  totalTestCases: number;
  failedAt: number | null;
  runtime: string | null;
  memory: number | null;
  errorOutput?: string | null;
  testCaseResults: TestCaseDetail[];
}

// ─── Run Code (Playground) ──────────────────────────────────────────────────────

/**
 * Run code with custom stdin — no database save.
 */
export async function runCode(
  language: string,
  sourceCode: string,
  stdin?: string
): Promise<RunResult> {
  const languageId = LANGUAGE_IDS[language];
  if (!languageId) {
    throw new Error(`Unsupported language: ${language}`);
  }

  return await runSync(sourceCode, languageId, stdin);
}

// ─── Pre-Submit Test (Sample Cases Only) ───────────────────────────────────────

/**
 * Test code against sample test cases only.
 * No database record is created.
 */
export async function preSubmitCode(
  problemId: string,
  language: string,
  sourceCode: string
): Promise<PreSubmitResult> {
  const languageId = LANGUAGE_IDS[language];
  if (!languageId) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const problem = await getCodingProblemForExecution(problemId);
  if (!problem) {
    throw new Error(`Problem not found: ${problemId}`);
  }

  const sampleTestCases = problem.sampleTestCases.map((tc) => ({
    input: tc.input,
    output: tc.output,
  }));

  if (sampleTestCases.length === 0) {
    throw new Error(`No sample test cases configured for problem: ${problemId}`);
  }

  const timeLimit =
    problem.timeLimits[language as keyof typeof problem.timeLimits] ||
    problem.timeLimits.default ||
    5;

  const { results, allPassed, firstFailure } = await executeTestCases(
    sourceCode,
    languageId,
    sampleTestCases,
    timeLimit,
    problem.memoryLimit,
    { stopOnFirstFailure: false }
  );

  const testCasesPassed = results.filter((r) => r.passed).length;
  const maxTime = Math.max(...results.map((r) => parseFloat(r.time || "0")));
  const maxMemory = Math.max(...results.map((r) => r.memory || 0));

  const status: SubmissionStatus = allPassed
    ? "accepted"
    : firstFailure?.status || "wrong_answer";

  const failedAt = firstFailure ? firstFailure.index + 1 : null;

  const testCaseResults: TestCaseDetail[] = results.map((r) => {
    const sample = sampleTestCases[r.index];
    return {
      index: r.index + 1,
      visibility: "sample",
      passed: r.passed,
      status: r.status,
      input: sample.input,
      expectedOutput: sample.output,
      actualOutput: r.stdout,
      errorOutput: r.errorOutput,
    };
  });

  return {
    status,
    testCasesPassed,
    totalTestCases: sampleTestCases.length,
    failedAt,
    runtime: maxTime.toFixed(3),
    memory: maxMemory,
    errorOutput: firstFailure?.errorOutput,
    testCaseResults,
  };
}

// ─── Submit Code (Against Problem) ──────────────────────────────────────────────

/**
 * Submit code against a problem's hidden test cases.
 * Creates a submission record and updates it with the verdict.
 */
export async function submitCode(
  userId: string,
  problemId: string,
  language: string,
  sourceCode: string
): Promise<SubmitResult> {
  const languageId = LANGUAGE_IDS[language];
  if (!languageId) {
    throw new Error(`Unsupported language: ${language}`);
  }

  // Load problem with hidden test cases
  const problem = await getCodingProblemForExecution(problemId);
  if (!problem) {
    throw new Error(`Problem not found: ${problemId}`);
  }

  // Build tagged test case list: sample → public → hidden
  const taggedTestCases: { input: string; output: string; visibility: TestCaseVisibility }[] = [
    ...problem.sampleTestCases.map((tc) => ({ input: tc.input, output: tc.output, visibility: "sample" as const })),
    ...(problem.publicTestCases || []).map((tc) => ({ input: tc.input, output: tc.output, visibility: "public" as const })),
    ...problem.hiddenTestCases.map((tc) => ({ input: tc.input, output: tc.output, visibility: "hidden" as const })),
  ];
  const totalTestCases = taggedTestCases.length;

  // Get time limit for this language
  const timeLimit =
    problem.timeLimits[language as keyof typeof problem.timeLimits] ||
    problem.timeLimits.default ||
    5;

  // Create submission record (status: processing)
  const submission = await prisma.submission.create({
    data: {
      userId,
      problemId,
      language,
      languageId,
      sourceCode,
      status: "processing",
      totalTestCases,
    },
  });

  try {
    // Execute all test cases with early exit
    const { results, allPassed, firstFailure } = await executeTestCases(
      sourceCode,
      languageId,
      taggedTestCases.map((tc) => ({ input: tc.input, output: tc.output })),
      timeLimit,
      problem.memoryLimit
    );

    // Calculate stats
    const testCasesPassed = results.filter((r) => r.passed).length;
    const maxTime = Math.max(...results.map((r) => parseFloat(r.time || "0")));
    const maxMemory = Math.max(...results.map((r) => r.memory || 0));

    const status: SubmissionStatus = allPassed
      ? "accepted"
      : firstFailure?.status || "wrong_answer";

    const failedAt = firstFailure ? firstFailure.index + 1 : null; // 1-indexed

    // Build visibility-controlled test case results
    const testCaseResults: TestCaseDetail[] = results.map((r) => {
      const tagged = taggedTestCases[r.index];
      const detail: TestCaseDetail = {
        index: r.index + 1, // 1-indexed for user
        visibility: tagged.visibility,
        passed: r.passed,
        status: r.status,
      };

      // Show input/output details for sample and public test cases
      if (tagged.visibility === "sample" || tagged.visibility === "public") {
        detail.input = tagged.input;
        detail.expectedOutput = tagged.output;
        detail.actualOutput = r.stdout;
        detail.errorOutput = r.errorOutput;
      }
      // Hidden test cases: only show status, no details

      return detail;
    });

    // Update submission record
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status,
        testCasesPassed,
        failedAt,
        runtime: maxTime.toFixed(3),
        memory: maxMemory,
        errorOutput: firstFailure?.errorOutput,
      },
    });

    return {
      submissionId: submission.id,
      status,
      testCasesPassed,
      totalTestCases,
      failedAt,
      runtime: maxTime.toFixed(3),
      memory: maxMemory,
      errorOutput: firstFailure?.errorOutput,
      testCaseResults,
    };
  } catch (error) {
    // Update submission with internal error
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: "internal_error",
        errorOutput: error instanceof Error ? error.message : String(error),
      },
    });

    return {
      submissionId: submission.id,
      status: "internal_error",
      testCasesPassed: 0,
      totalTestCases,
      failedAt: null,
      runtime: null,
      memory: null,
      errorOutput: error instanceof Error ? error.message : String(error),
      testCaseResults: [],
    };
  }
}

// ─── Get Submissions ────────────────────────────────────────────────────────────

/**
 * Get user's submission history, optionally filtered by problem.
 */
export async function getSubmissions(
  userId: string,
  options: {
    problemId?: string;
    status?: SubmissionStatus;
    language?: string;
    from?: Date;
    to?: Date;
    limit: number;
    offset: number;
  }
) {
  const where: {
    userId: string;
    problemId?: string;
    status?: SubmissionStatus;
    language?: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = { userId };

  if (options.problemId) {
    where.problemId = options.problemId;
  }

  if (options.status) {
    where.status = options.status;
  }

  if (options.language) {
    where.language = options.language;
  }

  if (options.from || options.to) {
    where.createdAt = {};
    if (options.from) {
      where.createdAt.gte = options.from;
    }
    if (options.to) {
      where.createdAt.lte = options.to;
    }
  }

  const [submissions, total] = await Promise.all([
    prisma.submission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options.limit,
      skip: options.offset,
      select: {
        id: true,
        problemId: true,
        language: true,
        status: true,
        testCasesPassed: true,
        totalTestCases: true,
        runtime: true,
        memory: true,
        createdAt: true,
      },
    }),
    prisma.submission.count({ where }),
  ]);

  const problemMap = await getCodingProblemSummariesByIds(submissions.map((submission) => submission.problemId));
  const enriched = submissions.map((submission) => {
    const problem = problemMap?.[submission.problemId] || null;
    return {
      ...submission,
      problem: problem
        ? {
            id: problem.id,
            title: problem.title,
            slug: problem.slug,
            difficulty: problem.difficulty,
            tags: problem.tags,
          }
        : null,
    };
  });

  return { submissions: enriched, total };
}

/**
 * Get a single submission by ID (must belong to user).
 */
export async function getSubmissionById(submissionId: string, userId: string) {
  return await prisma.submission.findFirst({
    where: { id: submissionId, userId },
    select: {
      id: true,
      problemId: true,
      language: true,
      sourceCode: true,
      status: true,
      testCasesPassed: true,
      totalTestCases: true,
      failedAt: true,
      runtime: true,
      memory: true,
      errorOutput: true,
      createdAt: true,
    },
  });
}
