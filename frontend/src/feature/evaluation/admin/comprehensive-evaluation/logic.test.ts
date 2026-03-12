import { describe, expect, it } from "vitest";

import { applyComprehensiveEvaluationManualOverride, computeComprehensiveEvaluationRow } from "./logic";
import { mockDefaultComprehensiveEvaluationSettings } from "./mock";
import type { ComprehensiveEvaluationRow } from "./types";

function buildRow(overrides: Partial<ComprehensiveEvaluationRow>): ComprehensiveEvaluationRow {
  return {
    id: "row-1",
    userId: "user-1",
    evaluationPeriodId: "period-1",
    employeeCode: "E001",
    name: "Test User",
    departmentName: "Engineering",
    employmentType: "employee",
    processingStatus: "processed",
    performanceFinalRank: "A+",
    performanceWeightPercent: 100,
    performanceScore: 4.5,
    competencyFinalRank: "A+",
    competencyWeightPercent: 10,
    competencyScore: 0.0,
    coreValueFinalRank: null,
    leaderInterviewCleared: null,
    divisionHeadPresentationCleared: null,
    ceoInterviewCleared: null,
    currentStage: "STAGE4",
    currentLevel: 25,
    ...overrides,
  };
}

describe("comprehensive evaluation logic", () => {
  it("evaluates promotion candidate with unknown core value rank ignored", () => {
    const row = buildRow({
      performanceScore: 4.5,
      competencyScore: 0.2, // total 4.7 => A+
      competencyFinalRank: "A+",
      coreValueFinalRank: null,
      currentLevel: 25,
    });

    const computed = computeComprehensiveEvaluationRow(row, mockDefaultComprehensiveEvaluationSettings);

    expect(computed.overallRank).toBe("A+");
    expect(computed.isPromotionCandidate).toBe(true);
    expect(computed.promotionFlag).toBe(true);
    expect(computed.decision).toBe("昇格");
  });

  it("activates promotion flag even when the new level stays below 30", () => {
    const row = buildRow({
      performanceScore: 4.5,
      competencyScore: 0.2, // total 4.7 => A+
      competencyFinalRank: "A+",
      coreValueFinalRank: null,
      currentLevel: 10,
    });

    const computed = computeComprehensiveEvaluationRow(row, mockDefaultComprehensiveEvaluationSettings);

    expect(computed.overallRank).toBe("A+");
    expect(computed.newLevel).toBe(16);
    expect(computed.isPromotionCandidate).toBe(true);
    expect(computed.promotionFlag).toBe(true);
    expect(computed.decision).toBe("昇格");
  });

  it("evaluates demotion candidate from overall D", () => {
    const row = buildRow({
      performanceScore: 0.1,
      competencyScore: 0.0, // total 0.1 => D
      competencyFinalRank: "D",
      currentLevel: 20,
    });

    const computed = computeComprehensiveEvaluationRow(row, mockDefaultComprehensiveEvaluationSettings);

    expect(computed.overallRank).toBe("D");
    expect(computed.isDemotionCandidate).toBe(true);
    expect(computed.demotionFlag).toBe(true);
    expect(computed.decision).toBe("降格");
  });

  it("does not apply manual stage/level values when manual decision is 対象外", () => {
    const row = buildRow({
      performanceScore: 4.5,
      competencyScore: 0.2,
      currentStage: "STAGE4",
      currentLevel: 25,
    });
    const base = computeComprehensiveEvaluationRow(row, mockDefaultComprehensiveEvaluationSettings);

    const applied = applyComprehensiveEvaluationManualOverride(row, base, {
      decision: "対象外",
      stageAfter: "STAGE9",
      levelAfter: 30,
      reason: "not applied",
      appliedAt: "2026-02-20T00:00:00Z",
    });

    expect(applied.decision).toBe("対象外");
    expect(applied.newStage).toBe(base.newStage);
    expect(applied.newLevel).toBe(base.newLevel);
  });

  it("defaults manual level to current level when level is omitted", () => {
    const row = buildRow({
      performanceScore: 4.5,
      competencyScore: 0.2,
      currentStage: "STAGE4",
      currentLevel: 25,
    });
    const base = computeComprehensiveEvaluationRow(row, mockDefaultComprehensiveEvaluationSettings);

    const applied = applyComprehensiveEvaluationManualOverride(row, base, {
      decision: "昇格",
      stageAfter: "STAGE5",
      reason: "stage changed only",
      appliedAt: "2026-02-20T00:00:00Z",
    });

    expect(applied.newStage).toBe("STAGE5");
    expect(applied.newLevel).toBe(25);
    expect(applied.levelDelta).toBe(0);
  });
});
