import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../src/app.js";
import {
  isJudge0Healthy,
  runSync,
  executeTestCases,
  LANGUAGE_IDS,
} from "../src/modules/services/judge0.service.js";

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
});
