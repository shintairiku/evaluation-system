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

describe("calculateSupervisorOverallRating", () => {
  it("uses supervisorRatingCode when both code and numeric score exist", () => {
    const result = calculateSupervisorOverallRating([
      buildGoal({
        supervisorRatingCode: "D",
        supervisorRating: 6,
      }),
    ]);

    expect(result).toBe("D");
  });

  it("falls back to numeric score when rating code is missing", () => {
    const result = calculateSupervisorOverallRating([
      buildGoal({
        supervisorRatingCode: undefined,
        supervisorRating: 6,
      }),
    ]);

    expect(result).toBe("S");
  });
});
