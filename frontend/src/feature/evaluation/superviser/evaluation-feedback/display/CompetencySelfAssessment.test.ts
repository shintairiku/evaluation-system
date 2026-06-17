import { describe, it, expect } from "vitest";
import type { GoalResponse, SelfAssessment } from "@/api/types";
import { transformCompetencyGoalsForDisplay } from "./CompetencySelfAssessment";

/**
 * The competency_snapshot backend fix guarantees that the goal's
 * allStageCompetencyIds/IdealActionTexts are CONSISTENT with the stored
 * rating_data (both reflect the stage at evaluation time). These tests document
 * the resulting display behavior the user sees.
 */

const COMP = "11111111-1111-1111-1111-111111111111";

function competencyGoal(overrides: Partial<GoalResponse> = {}): GoalResponse {
  return {
    id: "goal-1",
    goalCategory: "コンピテンシー",
    status: "approved",
    allStageCompetencyIds: [COMP],
    allStageCompetencyNames: { [COMP]: "チームワーク" },
    allStageIdealActionTexts: { [COMP]: { "1": "行動1", "2": "行動2" } },
    selectedIdealActions: {},
    ...overrides,
  } as unknown as GoalResponse;
}

function selfAssessment(ratingData: Record<string, Record<string, string>>): SelfAssessment {
  return { goalId: "goal-1", ratingData, selfComment: "コメント" } as unknown as SelfAssessment;
}

describe("transformCompetencyGoalsForDisplay (competency_snapshot consistency)", () => {
  it("renders 小項目 with ratings when allStage* matches rating_data (post-fix)", () => {
    const [comp] = transformCompetencyGoalsForDisplay(
      [competencyGoal()],
      [selfAssessment({ [COMP]: { "1": "A", "2": "B" } })],
    );
    expect(comp.name).toBe("チームワーク");
    expect(comp.items).toHaveLength(2); // 小項目 present
    expect(comp.items.map((i) => i.rating)).toEqual(["A", "B"]); // ratings present
    expect(comp.competencyRating).not.toBe("−"); // 大項目 total computed
  });

  it("documents the broken state: when ids mismatch, ratings are blank", () => {
    // rating_data keyed by a DIFFERENT competency id (old stage) → no match
    const [comp] = transformCompetencyGoalsForDisplay(
      [competencyGoal()],
      [selfAssessment({ "99999999-9999-9999-9999-999999999999": { "1": "A", "2": "B" } })],
    );
    expect(comp.items.map((i) => i.rating)).toEqual([undefined, undefined]); // no ratings → bug
  });
});
