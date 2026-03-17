import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../src/app.js";
import {
  isJudge0Healthy,
  runSync,
  executeTestCases,
  LANGUAGE_IDS,
} from "../src/modules/services/judge0.service.js";
import { preSubmitCode } from "../src/modules/services/submission.service.js";

const runIntegration = process.env.RUN_JUDGE0_INTEGRATION === "true";
const describeJudge0 = runIntegration ? describe : describe.skip;

describeJudge0("Judge0 integration", () => {
  it("returns healthy from API route", async () => {
    const res = await request(app).get("/api/v1/judge0/health");

    expect(res.status).toBe(200);
    expect(res.body?.status).toBe("ok");
    expect(typeof res.body?.judge0?.version).toBe("string");
  });

  it("executes Python code through runSync", async () => {
    const healthy = await isJudge0Healthy();
    expect(healthy).toBe(true);

    const result = await runSync("print('hi')", LANGUAGE_IDS.python);

    expect(result.status).toBe("Accepted");
    expect(result.stdout).toBe("hi\n");
  }, 20000);

  it("executes test cases with pass/fail mapping", async () => {
    const sourceCode = [
      "a = int(input())",
      "b = int(input())",
      "print(a + b)",
    ].join("\n");

    const testCases = [
      { input: "1\n2", output: "3" },
      { input: "10\n5", output: "15" },
    ];

    const result = await executeTestCases(
      sourceCode,
      LANGUAGE_IDS.python,
      testCases,
      2,
      128
    );

    expect(result.allPassed).toBe(true);
    expect(result.firstFailure).toBeNull();
    expect(result.results).toHaveLength(2);
    expect(result.results.every((entry) => entry.passed)).toBe(true);
  }, 30000);

  it("runs pre-submit against sample test cases only", async () => {
    const sourceCode = [
      "n = int(input())",
      "for i in range(1, n + 1):",
      "    if i % 15 == 0:",
      "        print('FizzBuzz')",
      "    elif i % 3 == 0:",
      "        print('Fizz')",
      "    elif i % 5 == 0:",
      "        print('Buzz')",
      "    else:",
      "        print(i)",
    ].join("\n");

    const result = await preSubmitCode("fizzbuzz", "python", sourceCode);

    expect(result.status).toBe("accepted");
    expect(result.testCasesPassed).toBe(result.totalTestCases);
    expect(result.totalTestCases).toBeGreaterThan(0);
    expect(result.failedAt).toBeNull();
    expect(result.testCaseResults.every((entry) => entry.visibility === "sample")).toBe(true);
  }, 30000);

  it("returns all sample test results with output/status on failure", async () => {
    const wrongSourceCode = "print('wrong output')";

    const result = await preSubmitCode("fizzbuzz", "python", wrongSourceCode);

    expect(result.status).toBe("wrong_answer");
    expect(result.totalTestCases).toBe(2);
    expect(result.testCaseResults).toHaveLength(2);
    expect(result.testCaseResults.every((entry) => entry.visibility === "sample")).toBe(true);
    expect(result.testCaseResults.every((entry) => typeof entry.status === "string")).toBe(true);
    expect(result.testCaseResults.every((entry) => typeof entry.actualOutput === "string")).toBe(true);
  }, 30000);

  it("returns earliest failing index and ignores later test cases in submit mode", async () => {
    const sourceCode = [
      "a = int(input())",
      "print(a)",
    ].join("\n");

    const testCases = [
      { input: "1", output: "1" },
      { input: "2", output: "2" },
      { input: "3", output: "3" },
      { input: "4", output: "4" },
      { input: "5", output: "5" },
      { input: "6", output: "6" },
      { input: "7", output: "7" },
      { input: "8", output: "WRONG_EXPECTATION" },
      { input: "9", output: "ALSO_WRONG" },
      { input: "10", output: "10" },
    ];

    const result = await executeTestCases(
      sourceCode,
      LANGUAGE_IDS.python,
      testCases,
      2,
      128
    );

    expect(result.allPassed).toBe(false);
    expect(result.firstFailure?.index).toBe(7);
    expect(result.results).toHaveLength(8);
    expect(result.results.filter((entry) => entry.passed)).toHaveLength(7);
  }, 30000);
});
