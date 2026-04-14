import express, { type RequestHandler } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const VALID_PROBLEM_ID = "c123456789012345678901234";
const VALID_SUBMISSION_ID = "c999999999999999999999999";

const {
  mockPrisma,
  mockSubmitCompileJob,
  mockSimulate,
} = vi.hoisted(() => ({
  mockPrisma: {
    arduinoProblem: {
      findUnique: vi.fn(),
    },
    contestParticipation: {
      findUnique: vi.fn(),
    },
    arduinoSubmission: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  mockSubmitCompileJob: vi.fn(),
  mockSimulate: vi.fn(),
}));

vi.mock("../src/config/prisma.js", () => ({
  prisma: mockPrisma,
}));

vi.mock("../src/services/arduino-job.service.js", () => ({
  arduinoJobService: {
    submitCompileJob: mockSubmitCompileJob,
  },
}));

vi.mock("../src/services/arduino-compiler.service.js", () => ({
  arduinoCompilerService: {
    simulate: mockSimulate,
    getBoards: vi.fn(),
  },
}));

vi.mock("../src/middleware/rate-limiter.js", () => ({
  arduinoCompileRateLimit: {
    middleware: () => ((_req: any, _res: any, next: any) => next()) as RequestHandler,
  },
  generalArduinoRateLimit: {
    middleware: () => ((_req: any, _res: any, next: any) => next()) as RequestHandler,
  },
}));

vi.mock("../src/middleware/auth.js", () => ({
  requireAuth: ((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    (req as any).user = {
      id: "user-1",
      userId: "user-1",
      role: "student",
    };

    next();
  }) as RequestHandler,
}));

import arduinoRoutes from "../src/modules/arduino/routes/arduino.routes.js";

const app = express();
app.use(express.json());
app.use("/api/v1/arduino", arduinoRoutes);

describe("Arduino compile/validate endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma.arduinoProblem.findUnique.mockResolvedValue({
      id: VALID_PROBLEM_ID,
    });

    mockSubmitCompileJob.mockResolvedValue(VALID_SUBMISSION_ID);
  });

  describe("POST /api/v1/arduino/compile", () => {
    it("returns 401 when auth header is missing", async () => {
      const response = await request(app).post("/api/v1/arduino/compile").send({
        problemId: VALID_PROBLEM_ID,
        code: "void setup(){} void loop(){}",
        boardType: "uno",
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("returns 400 for invalid payload", async () => {
      const response = await request(app)
        .post("/api/v1/arduino/compile")
        .set("Authorization", "Bearer token")
        .send({
          problemId: "bad-id",
          code: "",
          boardType: "nano",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Validation failed");
    });

    it("queues compile job and returns 202", async () => {
      const response = await request(app)
        .post("/api/v1/arduino/compile")
        .set("Authorization", "Bearer token")
        .send({
          problemId: VALID_PROBLEM_ID,
          code: "void setup(){} void loop(){}",
          boardType: "uno",
        });

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.data.submissionId).toBe(VALID_SUBMISSION_ID);
      expect(response.body.data.status).toBe("processing");
      expect(mockSubmitCompileJob).toHaveBeenCalledWith(
        "user-1",
        VALID_PROBLEM_ID,
        "void setup(){} void loop(){}",
        "uno",
        undefined
      );
    });

    it("returns 404 when Arduino problem is missing", async () => {
      mockPrisma.arduinoProblem.findUnique.mockResolvedValueOnce(null);

      const response = await request(app)
        .post("/api/v1/arduino/compile")
        .set("Authorization", "Bearer token")
        .send({
          problemId: VALID_PROBLEM_ID,
          code: "void setup(){} void loop(){}",
          boardType: "uno",
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Arduino problem not found");
    });
  });

  describe("POST /api/v1/arduino/validate", () => {
    it("returns 404 when submission is not found", async () => {
      mockPrisma.arduinoSubmission.findUnique.mockResolvedValueOnce(null);

      const response = await request(app)
        .post("/api/v1/arduino/validate")
        .set("Authorization", "Bearer token")
        .send({ submissionId: VALID_SUBMISSION_ID });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Submission not found");
    });

    it("returns 400 when submission is not compiled/accepted", async () => {
      mockPrisma.arduinoSubmission.findUnique.mockResolvedValueOnce({
        id: VALID_SUBMISSION_ID,
        userId: "user-1",
        status: "processing",
        hexFile: null,
        problem: { testCases: [] },
      });

      const response = await request(app)
        .post("/api/v1/arduino/validate")
        .set("Authorization", "Bearer token")
        .send({ submissionId: VALID_SUBMISSION_ID });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Can only validate successfully compiled submissions");
    });

    it("validates accepted submission and returns test summary", async () => {
      mockPrisma.arduinoSubmission.findUnique.mockResolvedValueOnce({
        id: VALID_SUBMISSION_ID,
        userId: "user-1",
        status: "accepted",
        hexFile: "abc123",
        problem: {
          testCases: [
            {
              id: "tc1",
              label: "LED toggles",
              type: "toggle_count",
              pin: null,
              expectedState: null,
              atMs: null,
              toleranceMs: 100,
              minToggles: 2,
              withinMs: 1000,
              expectedOutput: null,
              order: 1,
              isHidden: false,
            },
          ],
        },
      });

      mockSimulate.mockResolvedValueOnce({
        success: true,
        allTestsPassed: true,
        simulationTimeMs: 120,
        output: "OK",
        results: [
          {
            testCaseId: "tc1",
            passed: true,
            actualValue: 2,
            expectedValue: 2,
            error: null,
          },
        ],
      });

      mockPrisma.arduinoSubmission.update.mockResolvedValueOnce({ id: VALID_SUBMISSION_ID });

      const response = await request(app)
        .post("/api/v1/arduino/validate")
        .set("Authorization", "Bearer token")
        .send({ submissionId: VALID_SUBMISSION_ID });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.allTestsPassed).toBe(true);
      expect(response.body.data.passedCount).toBe(1);
      expect(response.body.data.totalCount).toBe(1);

      expect(mockPrisma.arduinoSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: VALID_SUBMISSION_ID },
          data: expect.objectContaining({
            status: "accepted",
            testCasesPassed: 1,
            totalTestCases: 1,
          }),
        })
      );
    });
  });
});
