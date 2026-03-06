import { describe, expect, it } from "vitest";
import type { Competency, GoalResponse } from "@/api/types";
import {
  getGoalActionTexts,
  getGoalCompetencyIds,
  getGoalRequiredCompetencyActions,
  getSelectedCompetencyIdsForReference,
} from "./competencyRequirements";

function buildGoal(overrides: Partial<GoalResponse>): GoalResponse {
  return {
    id: "goal-1",
    userId: "user-1",
    periodId: "period-1",
    goalCategory: "コンピテンシー",
    weight: 50,
    status: "approved",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

const stageCompetencies: Competency[] = [
  {
    id: "comp-1",
    name: "Comp 1",
    stageId: "stage-1",
    description: { "1": "a1", "2": "a2", "3": "a3" },
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "comp-2",
    name: "Comp 2",
    stageId: "stage-1",
    description: { "1": "b1", "2": "b2" },
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
];

describe("competencyRequirements", () => {
  it("uses all stage action texts when stage mapping exists", () => {
    const goal = buildGoal({
      selectedIdealActions: { "comp-1": ["2", "5"] },
      allStageIdealActionTexts: {
        "comp-1": {
          "1": "stage action 1",
          "2": "stage action 2",
          "5": "stage action 5",
        },
      },
    });

    expect(getGoalActionTexts(goal)).toEqual({
      "comp-1": {
        "1": "stage action 1",
        "2": "stage action 2",
        "5": "stage action 5",
      },
    });
  });

  it("maps fallback action texts by action index for sparse action IDs", () => {
    const goal = buildGoal({
      selectedIdealActions: { "comp-1": ["2", "5"] },
      idealActionTexts: {
        "comp-1": ["a1", "a2", "a3", "a4", "a5"],
      },
    });

    expect(getGoalActionTexts(goal)).toEqual({
      "comp-1": {
        "2": "a2",
        "5": "a5",
      },
    });
  });

  it("falls back to selection order when fallback texts are selected-only", () => {
    const goal = buildGoal({
      selectedIdealActions: { "comp-1": ["2", "5"] },
      idealActionTexts: {
        "comp-1": ["selected a2", "selected a5"],
      },
    });

    expect(getGoalActionTexts(goal)).toEqual({
      "comp-1": {
        "2": "selected a2",
        "5": "selected a5",
      },
    });
  });

  it("uses stage competencies for required actions when stage config exists", () => {
    const goal = buildGoal({
      competencyIds: ["comp-1"],
      selectedIdealActions: { "comp-1": ["2"] },
    });

    expect(getGoalRequiredCompetencyActions(goal, stageCompetencies)).toEqual({
      "comp-1": ["1", "2", "3"],
      "comp-2": ["1", "2"],
    });
  });

  it("uses all stage competency IDs for assessment scope", () => {
    const goal = buildGoal({
      competencyIds: ["comp-1"],
      selectedIdealActions: null,
    });

    expect(getGoalCompetencyIds(goal, stageCompetencies)).toEqual(["comp-1", "comp-2"]);
  });

  it("falls back to goal-selected actions when stage competencies are unavailable", () => {
    const goal = buildGoal({
      competencyIds: null,
      selectedIdealActions: { "comp-2": ["2", "1"] },
    });

    expect(getGoalCompetencyIds(goal, [])).toEqual(["comp-2"]);
    expect(getGoalRequiredCompetencyActions(goal, [])).toEqual({
      "comp-2": ["1", "2"],
    });
  });

  it("keeps selected competencies for reference-only display", () => {
    const goal = buildGoal({
      competencyIds: ["comp-1"],
      selectedIdealActions: { "comp-2": ["1"] },
    });

    expect(getSelectedCompetencyIdsForReference(goal)).toEqual(["comp-1"]);
  });
});
