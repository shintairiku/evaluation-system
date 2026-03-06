import { describe, expect, it } from "vitest";
import type { PeerReviewEvaluation } from "@/api/types";
import { isEvaluationComplete } from "../PeerReviewSubmitButton";

function buildEvaluation(
  overrides: Partial<PeerReviewEvaluation>
): PeerReviewEvaluation {
  return {
    id: "eval-1",
    assignmentId: "assign-1",
    periodId: "period-1",
    revieweeId: "reviewee-1",
    revieweeName: "山本 好乃",
    reviewerId: "reviewer-1",
    scores: null,
    comment: null,
    status: "draft",
    submittedAt: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

const DEFINITION_COUNT = 9;

function buildFullScores(): Record<string, string> {
  const scores: Record<string, string> = {};
  for (let i = 1; i <= DEFINITION_COUNT; i++) {
    scores[`cv-${i}`] = "A";
  }
  return scores;
}

describe("isEvaluationComplete", () => {
  it("returns true when status is submitted (regardless of scores/comment)", () => {
    const evaluation = buildEvaluation({ status: "submitted", scores: null, comment: null });
    expect(isEvaluationComplete(evaluation, DEFINITION_COUNT)).toBe(true);
  });

  it("returns true when all scores and comment are present", () => {
    const evaluation = buildEvaluation({
      scores: buildFullScores(),
      comment: "Great work on core values",
    });
    expect(isEvaluationComplete(evaluation, DEFINITION_COUNT)).toBe(true);
  });

  it("returns false when missing one score", () => {
    const scores = buildFullScores();
    delete scores["cv-9"];
    const evaluation = buildEvaluation({ scores, comment: "Comment" });
    expect(isEvaluationComplete(evaluation, DEFINITION_COUNT)).toBe(false);
  });

  it("returns false when comment is null", () => {
    const evaluation = buildEvaluation({
      scores: buildFullScores(),
      comment: null,
    });
    expect(isEvaluationComplete(evaluation, DEFINITION_COUNT)).toBe(false);
  });

  it("returns false when comment is whitespace only", () => {
    const evaluation = buildEvaluation({
      scores: buildFullScores(),
      comment: "   ",
    });
    expect(isEvaluationComplete(evaluation, DEFINITION_COUNT)).toBe(false);
  });

  it("returns false when comment is empty string", () => {
    const evaluation = buildEvaluation({
      scores: buildFullScores(),
      comment: "",
    });
    expect(isEvaluationComplete(evaluation, DEFINITION_COUNT)).toBe(false);
  });

  it("returns false when no scores at all", () => {
    const evaluation = buildEvaluation({ scores: null, comment: "Comment" });
    expect(isEvaluationComplete(evaluation, DEFINITION_COUNT)).toBe(false);
  });

  it("returns false when scores is empty object", () => {
    const evaluation = buildEvaluation({ scores: {}, comment: "Comment" });
    expect(isEvaluationComplete(evaluation, DEFINITION_COUNT)).toBe(false);
  });

  it("returns false when both scores and comment are missing", () => {
    const evaluation = buildEvaluation({ scores: null, comment: null });
    expect(isEvaluationComplete(evaluation, DEFINITION_COUNT)).toBe(false);
  });
});
