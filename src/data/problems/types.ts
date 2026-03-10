// ─── Problem & Test Case Types ──────────────────────────────────────────────────
// These types mirror the JSON structure and will match the future Prisma model.

export type Difficulty = "easy" | "medium" | "hard";

export type TestCaseVisibility = "sample" | "public" | "hidden";

export interface SampleTestCase {
  input: string;
  output: string;
  explanation?: string;
}

export interface PublicTestCase {
  input: string;
  output: string;
}

export interface HiddenTestCase {
  input: string;
  output: string;
}

export interface TimeLimits {
  c?: number;
  cpp?: number;
  rust?: number;
  go?: number;
  java?: number;
  javascript?: number;
  python?: number;
}

export interface Problem {
  id: string;
  title: string;
  slug: string;
  difficulty: Difficulty;
  tags: string[];
  description: string;
  constraints: string;
  timeLimits: TimeLimits;
  memoryLimit: number;
  sampleTestCases: SampleTestCase[];
  publicTestCases: PublicTestCase[];
  hiddenTestCases: HiddenTestCase[];
}

// Public-facing problem (no hidden test cases)
export interface ProblemSummary {
  id: string;
  title: string;
  slug: string;
  difficulty: Difficulty;
  tags: string[];
}

export interface ProblemDetail {
  id: string;
  title: string;
  slug: string;
  difficulty: Difficulty;
  tags: string[];
  description: string;
  constraints: string;
  timeLimits: TimeLimits;
  memoryLimit: number;
  sampleTestCases: SampleTestCase[];
  // publicTestCases and hiddenTestCases intentionally omitted
}
