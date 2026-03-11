// ─── Judge0 Service ─────────────────────────────────────────────────────────────
// Handles all communication with the Judge0 code execution engine.
// Single execution (run) and batched execution (submit) with early exit.

import type { SubmissionStatus } from "@prisma/client";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface Judge0Submission {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
  cpu_time_limit?: number;
  memory_limit?: number; // in KB
}

export interface Judge0Result {
  token: string;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: {
    id: number;
    description: string;
  };
  time: string | null;
  memory: number | null; // in KB
}

export interface RunResult {
  status: string;
  stdout: string;
  stderr: string;
  compileOutput: string;
  time: string | null;
  memory: number | null;
}

export interface TestCaseResult {
  index: number; // 0-indexed
  passed: boolean;
  status: SubmissionStatus;
  stdout: string;
  expectedOutput: string;
  time: string | null;
  memory: number | null;
  errorOutput: string | null;
}

// ─── Language IDs (Judge0 CE) ───────────────────────────────────────────────────

export const LANGUAGE_IDS: Record<string, number> = {
  c: 50,
  cpp: 54,
  java: 62,
  javascript: 63,
  python: 71,
  go: 60,
  rust: 73,
};

export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_IDS);

// ─── Judge0 Status → SubmissionStatus Mapping ───────────────────────────────────
// Judge0 status IDs: https://github.com/judge0/judge0/blob/master/docs/api/statuses.md

const JUDGE0_STATUS_MAP: Record<number, SubmissionStatus> = {
  1: "processing", // In Queue
  2: "processing", // Processing
  3: "accepted", // Accepted
  4: "wrong_answer", // Wrong Answer
  5: "time_limit_exceeded", // Time Limit Exceeded
  6: "compilation_error", // Compilation Error
  7: "runtime_error", // Runtime Error (SIGSEGV)
  8: "runtime_error", // Runtime Error (SIGXFSZ)
  9: "runtime_error", // Runtime Error (SIGFPE)
  10: "runtime_error", // Runtime Error (SIGABRT)
  11: "runtime_error", // Runtime Error (NZEC)
  12: "runtime_error", // Runtime Error (Other)
  13: "internal_error", // Internal Error
  14: "internal_error", // Exec Format Error
};

// ─── Configuration ──────────────────────────────────────────────────────────────

const JUDGE0_URL = process.env.JUDGE0_URL || "http://localhost:2358";
const JUDGE0_AUTH_TOKEN = process.env.JUDGE0_AUTH_TOKEN || "";

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (JUDGE0_AUTH_TOKEN) {
    headers["X-Auth-Token"] = JUDGE0_AUTH_TOKEN;
  }
  return headers;
}

// ─── Helper Functions ───────────────────────────────────────────────────────────

export function encodeBase64(str: string): string {
  return Buffer.from(str, "utf-8").toString("base64");
}

export function decodeBase64(str: string | null): string {
  if (!str) return "";
  return Buffer.from(str, "base64").toString("utf-8");
}

export function mapJudge0Status(statusId: number): SubmissionStatus {
  return JUDGE0_STATUS_MAP[statusId] || "internal_error";
}

/**
 * Calculate optimal batch size based on total test cases
 */
export function calculateBatchSize(totalTestCases: number): number {
  if (totalTestCases <= 5) return totalTestCases;
  if (totalTestCases <= 15) return 5;
  if (totalTestCases <= 50) return 10;
  return 25;
}

// ─── Health Check ───────────────────────────────────────────────────────────────

export async function isJudge0Healthy(): Promise<boolean> {
  try {
    const response = await fetch(`${JUDGE0_URL}/about`, {
      method: "GET",
      headers: getHeaders(),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getJudge0Info(): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${JUDGE0_URL}/about`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// ─── Single Execution (Run Mode) ────────────────────────────────────────────────

/**
 * Execute code synchronously with custom stdin (playground mode).
 * Uses ?wait=true for immediate results.
 */
export async function runSync(
  sourceCode: string,
  languageId: number,
  stdin?: string,
  cpuTimeLimit?: number,
  memoryLimit?: number
): Promise<RunResult> {
  const payload: Judge0Submission = {
    source_code: encodeBase64(sourceCode),
    language_id: languageId,
    stdin: stdin ? encodeBase64(stdin) : undefined,
    cpu_time_limit: cpuTimeLimit,
    memory_limit: memoryLimit ? memoryLimit * 1024 : undefined, // Convert MB to KB
  };

  const response = await fetch(
    `${JUDGE0_URL}/submissions?base64_encoded=true&wait=true`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Judge0 error: ${response.status} - ${errorText}`);
  }

  const result: Judge0Result = await response.json();

  return {
    status: result.status.description,
    stdout: decodeBase64(result.stdout),
    stderr: decodeBase64(result.stderr),
    compileOutput: decodeBase64(result.compile_output),
    time: result.time,
    memory: result.memory,
  };
}

// ─── Batch Submission (Submit Mode) ──────────────────────────────────────────────

/**
 * Submit a batch of test cases to Judge0.
 * Returns tokens for polling results.
 */
async function submitBatch(
  submissions: Judge0Submission[]
): Promise<string[]> {
  const response = await fetch(
    `${JUDGE0_URL}/submissions/batch?base64_encoded=true`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ submissions }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Judge0 batch submit error: ${response.status} - ${errorText}`);
  }

  const results: { token: string }[] = await response.json();
  return results.map((r) => r.token);
}

/**
 * Poll for batch results until all are complete.
 * Returns results in the same order as tokens.
 */
async function getBatchResults(tokens: string[]): Promise<Judge0Result[]> {
  const tokenString = tokens.join(",");
  const maxAttempts = 60; // 60 * 500ms = 30 seconds max wait
  const pollInterval = 500;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(
      `${JUDGE0_URL}/submissions/batch?tokens=${tokenString}&base64_encoded=true&fields=token,stdout,stderr,compile_output,message,status,time,memory`,
      {
        method: "GET",
        headers: getHeaders(),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Judge0 batch get error: ${response.status} - ${errorText}`);
    }

    const results: { submissions: Judge0Result[] } = await response.json();

    // Check if all submissions are done (status.id > 2 means not queued/processing)
    const allDone = results.submissions.every((r) => r.status.id > 2);

    if (allDone) {
      return results.submissions;
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error("Judge0 batch timeout: results not ready after 30 seconds");
}

/**
 * Execute test cases against code with early exit on failure.
 * Returns results for each test case executed.
 */
export async function executeTestCases(
  sourceCode: string,
  languageId: number,
  testCases: { input: string; output: string }[],
  cpuTimeLimit?: number,
  memoryLimit?: number
): Promise<{
  results: TestCaseResult[];
  allPassed: boolean;
  firstFailure: TestCaseResult | null;
}> {
  const batchSize = calculateBatchSize(testCases.length);
  const allResults: TestCaseResult[] = [];

  for (let i = 0; i < testCases.length; i += batchSize) {
    const batch = testCases.slice(i, i + batchSize);

    // Prepare submissions for this batch (base64 encoded for Judge0 API)
    const submissions: Judge0Submission[] = batch.map((tc) => ({
      source_code: encodeBase64(sourceCode),
      language_id: languageId,
      stdin: encodeBase64(tc.input),
      expected_output: encodeBase64(tc.output),
      cpu_time_limit: cpuTimeLimit,
      memory_limit: memoryLimit ? memoryLimit * 1024 : undefined,
    }));

    // Submit batch and get tokens
    const tokens = await submitBatch(submissions);

    // Poll for results
    const results = await getBatchResults(tokens);

    // Process results and check for failures
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const testCaseIndex = i + j;
      const expectedOutput = batch[j].output;

      const stdout = decodeBase64(result.stdout);
      const status = mapJudge0Status(result.status.id);

      // Normalize outputs for comparison (trim whitespace)
      const passed =
        status === "accepted" &&
        stdout.trim() === expectedOutput.trim();

      const testCaseResult: TestCaseResult = {
        index: testCaseIndex,
        passed,
        status: passed ? "accepted" : status === "accepted" ? "wrong_answer" : status,
        stdout,
        expectedOutput,
        time: result.time,
        memory: result.memory,
        errorOutput:
          decodeBase64(result.stderr) ||
          decodeBase64(result.compile_output) ||
          result.message ||
          null,
      };

      allResults.push(testCaseResult);

      // Early exit on first failure
      if (!passed) {
        return {
          results: allResults,
          allPassed: false,
          firstFailure: testCaseResult,
        };
      }
    }
  }

  return {
    results: allResults,
    allPassed: true,
    firstFailure: null,
  };
}
