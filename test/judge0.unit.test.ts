import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeTestCases, runSync, mapJudge0Status, LANGUAGE_IDS } from "../src/modules/services/judge0.service.js";

describe("Judge0 Compilation Service - Unit Tests", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("maps Judge0 status IDs correctly", () => {
    expect(mapJudge0Status(3)).toBe("accepted");
    expect(mapJudge0Status(4)).toBe("wrong_answer");
    expect(mapJudge0Status(5)).toBe("time_limit_exceeded");
    expect(mapJudge0Status(6)).toBe("compilation_error");
    expect(mapJudge0Status(11)).toBe("runtime_error");
    expect(mapJudge0Status(999)).toBe("internal_error");
  });

  it("runSync correctly submits code and processes output", async () => {
    const mockReponse = {
      status: { id: 3, description: "Accepted" },
      stdout: Buffer.from("hello world").toString("base64"),
      stderr: null,
      compile_output: null,
      time: "0.01",
      memory: 2048,
      token: "mock-token",
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockReponse,
    });

    const result = await runSync(
      "console.log('hello world');",
      63,
      ""
    );

    expect(result.status).toBe("Accepted");
    expect(result.stdout).toBe("hello world");
    expect(result.stderr).toBe("");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("executeTestCases runs single test cases through synchronous API", async () => {
    // We mock two fetches: one for submitBatch, one for getBatchResults
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ token: "token-1" }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          submissions: [
            {
              status: { id: 3, description: "Accepted" },
              stdout: Buffer.from("output").toString("base64"),
              time: "0.015",
              memory: 1024,
            },
          ],
        }),
      });

    const result = await executeTestCases(
      "console.log('output');",
      63, // Correct language id
      [
        { input: "1", output: "output" },
      ],
      2, 128
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0].passed).toBe(true);
    expect(result.results[0].stdout).toBe("output");
    expect(result.results[0].time).toBe("0.015");
  });

  it("executeTestCases handles failing code", async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ token: "token-1" }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          submissions: [
             {
               status: { id: 4, description: "Wrong Answer" },
               stdout: Buffer.from("wrong").toString("base64"),
               time: "0.015",
               memory: 1024,
             }
          ]
        }),
      });

    const result = await executeTestCases(
      "console.log('wrong');",
      63,
      [
        { input: "1", output: "output" },
      ],
      2, 128
    );

    expect(result.results[0].passed).toBe(false);
    expect(result.results[0].status).toBe("wrong_answer");
  });
});
