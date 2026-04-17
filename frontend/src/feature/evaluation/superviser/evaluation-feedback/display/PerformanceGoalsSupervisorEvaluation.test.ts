import { describe, expect, it } from "vitest";

import {
  calculateSupervisorOverallRating,
  type PerformanceGoalSupervisorData,
} from "./PerformanceGoalsSupervisorEvaluation";

function buildGoal(
  overrides: Partial<PerformanceGoalSupervisorData>
): PerformanceGoalSupervisorData {
  return {
    id: "goal-1",
    goalId: "goal-1",
    selfAssessmentId: "assessment-1",
    feedbackId: "feedback-1",
    feedbackStatus: "draft",
    type: "quantitative",
    weight: 100,
    specificGoal: "Goal",
    achievementCriteria: "",
    methods: "",
    supervisorRatingCode: undefined,
    supervisorRating: undefined,
    supervisorComment: "",
    ...overrides,
  };
}

describe("calculateSupervisorOverallRating (MBO formula, spec 4-2/4-3/4-4)", () => {
  it("returns SS for 定量 SS @ 80 + 定性 A @ 20 (92 pts ≥ 86)", () => {
    // Regression test for reported bug: 西松大輝 case
    const result = calculateSupervisorOverallRating([
      buildGoal({ id: "g1", type: "quantitative", weight: 80, supervisorRatingCode: "SS" }),
      buildGoal({ id: "g2", type: "qualitative", weight: 20, supervisorRatingCode: "A" }),
    ]);

    expect(result).toBe("SS");
  });

  it("returns SS when all goals are SS (100 pts)", () => {
    const result = calculateSupervisorOverallRating([
      buildGoal({ id: "g1", weight: 70, supervisorRatingCode: "SS" }),
      buildGoal({ id: "g2", weight: 30, supervisorRatingCode: "SS" }),
    ]);

    expect(result).toBe("SS");
  });

  it("returns D when all goals are D (0 pts)", () => {
    const result = calculateSupervisorOverallRating([
      buildGoal({ id: "g1", weight: 80, supervisorRatingCode: "D" }),
      buildGoal({ id: "g2", weight: 20, supervisorRatingCode: "D" }),
    ]);

    expect(result).toBe("D");
  });

  it("returns S for SS @ 80 + C @ 20 (84 pts, just below SS threshold of 86)", () => {
    const result = calculateSupervisorOverallRating([
      buildGoal({ id: "g1", weight: 80, supervisorRatingCode: "SS" }),
      buildGoal({ id: "g2", weight: 20, supervisorRatingCode: "C" }),
    ]);

    expect(result).toBe("S");
  });

  it("returns A for all-A goals (60 pts, ≥56 but <64)", () => {
    const result = calculateSupervisorOverallRating([
      buildGoal({ id: "g1", weight: 80, supervisorRatingCode: "A" }),
      buildGoal({ id: "g2", weight: 20, supervisorRatingCode: "A" }),
    ]);

    expect(result).toBe("A");
  });

  it("returns S for S + A with 70/30 weights (74 pts)", () => {
    const result = calculateSupervisorOverallRating([
      buildGoal({ id: "g1", weight: 70, supervisorRatingCode: "S" }),
      buildGoal({ id: "g2", weight: 30, supervisorRatingCode: "A" }),
    ]);

    expect(result).toBe("S");
  });

  it("returns D for single-goal D", () => {
    const result = calculateSupervisorOverallRating([
      buildGoal({ weight: 100, supervisorRatingCode: "D" }),
    ]);

    expect(result).toBe("D");
  });

  it("returns '−' when no goals have a rating code", () => {
    const result = calculateSupervisorOverallRating([
      buildGoal({ id: "g1", weight: 80, supervisorRatingCode: undefined }),
      buildGoal({ id: "g2", weight: 20, supervisorRatingCode: undefined }),
    ]);

    expect(result).toBe("−");
  });

  it("ignores goals without a rating code but still computes from valid ones", () => {
    const result = calculateSupervisorOverallRating([
      buildGoal({ id: "g1", weight: 80, supervisorRatingCode: "SS" }),
      buildGoal({ id: "g2", weight: 20, supervisorRatingCode: undefined }),
    ]);

    // (80/5) × 5 = 80 pts → S (>=70 but <86 since goal 2 contributed 0)
    expect(result).toBe("S");
  });
});
