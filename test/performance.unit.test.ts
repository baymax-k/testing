import { describe, it, expect, beforeEach } from "vitest";
import { ReportService } from "../src/modules/services/reportService.js";

describe("Performance Calculation Logic - Unit Tests", () => {
  let reportService: ReportService;
  
  beforeEach(() => {
    reportService = new ReportService();
  });

  it("calculates performance metrics correctly for mixed results", () => {
    const allTests = [
      { id: "t1", totalMarks: 100, passingMarks: 40 },
      { id: "t2", totalMarks: 100, passingMarks: 40 },
      { id: "t3", totalMarks: 100, passingMarks: 40 },
      { id: "t4", totalMarks: 100, passingMarks: 40 },
      { id: "t5", totalMarks: 100, passingMarks: 40 },
    ];

    const attempts = [
      { score: 95, maxScore: 100, test: { passingMarks: 40 } }, // 95%, Excellent, pass
      { score: 80, maxScore: 100, test: { passingMarks: 40 } }, // 80%, Good, pass
      { score: 65, maxScore: 100, test: { passingMarks: 40 } }, // 65%, Average, pass
      { score: 30, maxScore: 100, test: { passingMarks: 40 } }, // 30%, Below Average, fail
    ];

    // Workaround for testing private method
    const calculatePerformanceMetrics = reportService["calculatePerformanceMetrics"].bind(reportService);
    
    const metrics = calculatePerformanceMetrics(attempts, allTests);

    expect(metrics.totalTests).toBe(5);
    expect(metrics.attempted).toBe(4);
    expect(metrics.passed).toBe(3); // 95, 80, 65
    expect(metrics.failed).toBe(1); // 30

    // Average of 95, 80, 65, 30 = 270 / 4 = 67.5
    expect(metrics.averageScore).toBe(67.5);
    expect(metrics.highestScore).toBe(95);
    expect(metrics.lowestScore).toBe(30);
    expect(metrics.passPercentage).toBe(75); // 3 out of 4 passed = 75%

    expect(metrics.scoreDistribution.excellent).toBe(1); // 95 (90-100)
    expect(metrics.scoreDistribution.good).toBe(1); // 80 (75-89)
    expect(metrics.scoreDistribution.average).toBe(1); // 65 (60-74)
    expect(metrics.scoreDistribution.below_average).toBe(1); // 30 (< 60)
    expect(metrics.scoreDistribution.notAttempted).toBe(1); // 5 total - 4 attempted
  });

  it("handles edge case of no attempts", () => {
    const allTests = [
      { id: "t1", totalMarks: 100, passingMarks: 40 },
      { id: "t2", totalMarks: 100, passingMarks: 40 },
    ];
    const attempts: any[] = [];

    const calculatePerformanceMetrics = reportService["calculatePerformanceMetrics"].bind(reportService);
    const metrics = calculatePerformanceMetrics(attempts, allTests);

    expect(metrics.totalTests).toBe(2);
    expect(metrics.attempted).toBe(0);
    expect(metrics.passed).toBe(0);
    expect(metrics.failed).toBe(0);
    expect(metrics.averageScore).toBe(0);
    expect(metrics.passPercentage).toBe(0);
    expect(metrics.scoreDistribution.notAttempted).toBe(2);
  });

  it("handles decimal scores gracefully", () => {
    const allTests = [{ id: "t1", totalMarks: 50, passingMarks: 20 }];
    const attempts = [
      { score: 38, maxScore: 50, test: { passingMarks: 40 } }, // 76% (Good), not passed based on new condition check? Wait, if 50 max score, passing is 40. 38 < 40 so fail.
    ];

    const calculatePerformanceMetrics = reportService["calculatePerformanceMetrics"].bind(reportService);
    const metrics = calculatePerformanceMetrics(attempts, allTests);

    expect(metrics.highestScore).toBe(76); // (38/50) * 100
    expect(metrics.averageScore).toBe(76);
    expect(metrics.passed).toBe(0);
    expect(metrics.failed).toBe(1);
    expect(metrics.scoreDistribution.good).toBe(1); // 76% is in Good range
  });
});
