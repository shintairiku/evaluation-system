import { describe, expect, it } from "vitest";

import { applyComprehensiveEvaluationManualOverride, computeComprehensiveEvaluationRow } from "./logic";
import { mockDefaultComprehensiveEvaluationSettings } from "./mock";
import type { ComprehensiveEvaluationSettings } from "./settings";
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
    performanceScore: 64.0,
    competencyFinalRank: "A+",
    competencyWeightPercent: 10,
    competencyScore: 5.0,
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
  // totalScore from A+/A+ = 5*10/11 + 5*1/11 = 5.0 → A+

  it("does not evaluate promotion candidate when a required rank is unknown", () => {
    const row = buildRow({
      performanceFinalRank: "A+",
      competencyFinalRank: "A+",
      coreValueFinalRank: null,
      currentLevel: 25,
    });

    const computed = computeComprehensiveEvaluationRow(row, mockDefaultComprehensiveEvaluationSettings);

    // A+/A+ → 5*10/11 + 5*1/11 = 5.0 → A+
    expect(computed.totalScore).toBe(5.0);
    expect(computed.overallRank).toBe("A+");
    expect(computed.isPromotionCandidate).toBe(false); // coreValueFinalRank is null
    expect(computed.promotionFlag).toBe(false);
    expect(computed.decision).toBe("対象外");
  });

  it("activates promotion flag even when the new level stays below 30", () => {
    const row = buildRow({
      performanceFinalRank: "A+",
      competencyFinalRank: "A+",
      coreValueFinalRank: "A+",
      currentLevel: 10,
    });

    const computed = computeComprehensiveEvaluationRow(row, mockDefaultComprehensiveEvaluationSettings);

    // A+/A+ → 5.0 → A+, level delta for A+ = +6
    expect(computed.overallRank).toBe("A+");
    expect(computed.newLevel).toBe(16);
    expect(computed.isPromotionCandidate).toBe(true);
    expect(computed.promotionFlag).toBe(true);
    expect(computed.decision).toBe("昇格");
  });

  it("supports performance final rank in promotion rules", () => {
    const row = buildRow({
      performanceFinalRank: "S",
      competencyFinalRank: "B",
      coreValueFinalRank: "B",
    });
    const settings: ComprehensiveEvaluationSettings = {
      ...mockDefaultComprehensiveEvaluationSettings,
      promotion: {
        ruleGroups: [
          {
            id: "promotion-group-1",
            conditions: [{ type: "rank_at_least", field: "performanceFinalRank", minimumRank: "A+" }],
          },
        ],
      },
    };

    const computed = computeComprehensiveEvaluationRow(row, settings);

    expect(computed.isPromotionCandidate).toBe(true);
    expect(computed.promotionFlag).toBe(true);
  });

  it("evaluates demotion candidate from overall D", () => {
    const row = buildRow({
      performanceFinalRank: "D",
      competencyFinalRank: "D",
      currentLevel: 20,
    });

    const computed = computeComprehensiveEvaluationRow(row, mockDefaultComprehensiveEvaluationSettings);

    // D/D → 0*10/11 + 0*1/11 = 0.0 → D (boundary rule Q < 0.1)
    expect(computed.totalScore).toBe(0);
    expect(computed.overallRank).toBe("D");
    expect(computed.isDemotionCandidate).toBe(true);
    expect(computed.demotionFlag).toBe(true);
    expect(computed.decision).toBe("降格");
  });

  it("does not apply manual stage/level values when manual decision is 対象外", () => {
    const row = buildRow({
      performanceFinalRank: "A+",
      competencyFinalRank: "A+",
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
      performanceFinalRank: "A+",
      competencyFinalRank: "A+",
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

  // Spec validation tests
  it("spec test: S/S/S → total=6.0, overall=S, promotion (社員00001)", () => {
    const row = buildRow({
      performanceFinalRank: "S",
      competencyFinalRank: "S",
      coreValueFinalRank: "S",
      currentLevel: 24,
    });

    const computed = computeComprehensiveEvaluationRow(row, mockDefaultComprehensiveEvaluationSettings);

    // S(6)*10/11 + S(6)*1/11 = 6.0 → S
    expect(computed.totalScore).toBe(6.0);
    expect(computed.overallRank).toBe("S");
    expect(computed.promotionFlag).toBe(true);
    expect(computed.levelDelta).toBe(8);
    expect(computed.newLevel).toBe(32);
  });

  it("spec test: D/S/S → total=0.55, overall=D, no promotion (社員00002)", () => {
    const row = buildRow({
      performanceFinalRank: "D",
      competencyFinalRank: "S",
      coreValueFinalRank: "S",
      currentLevel: 25,
    });

    const computed = computeComprehensiveEvaluationRow(row, mockDefaultComprehensiveEvaluationSettings);

    // D(0)*10/11 + S(6)*1/11 = 0.5454 → round 0.55 → D
    expect(computed.totalScore).toBe(0.55);
    expect(computed.overallRank).toBe("D");
    expect(computed.promotionFlag).toBe(false);
    expect(computed.levelDelta).toBe(-8);
    expect(computed.newLevel).toBe(17);
  });

  it("SS/SS → total=7.0, overall=SS", () => {
    const row = buildRow({
      performanceFinalRank: "SS",
      competencyFinalRank: "SS",
      coreValueFinalRank: "SS",
    });

    const computed = computeComprehensiveEvaluationRow(row, mockDefaultComprehensiveEvaluationSettings);

    expect(computed.totalScore).toBe(7.0);
    expect(computed.overallRank).toBe("SS");
  });
});
