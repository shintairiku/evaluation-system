import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/api/server-actions/goals", () => ({
  getGoalsAction: vi.fn(),
}));
vi.mock("@/api/server-actions/self-assessments", () => ({
  getSelfAssessmentsAction: vi.fn(),
}));
vi.mock("@/api/server-actions/supervisor-feedbacks", () => ({
  getSupervisorFeedbacksAction: vi.fn(),
}));
vi.mock("@/api/server-actions/peer-reviews", () => ({
  getMyPeerReviewDetailAction: vi.fn(),
}));

import { getGoalsAction } from "@/api/server-actions/goals";
import { getSelfAssessmentsAction } from "@/api/server-actions/self-assessments";
import { getSupervisorFeedbacksAction } from "@/api/server-actions/supervisor-feedbacks";
import { getMyPeerReviewDetailAction } from "@/api/server-actions/peer-reviews";
import type { EvaluationPeriod, EvaluationDetailResponse } from "@/api/types";
import type { PerformanceGoalSupervisorData } from "@/feature/evaluation/superviser/evaluation-feedback/display/PerformanceGoalsSupervisorEvaluation";
import type { CompetencySupervisorData } from "@/feature/evaluation/superviser/evaluation-feedback/display/CompetencySupervisorEvaluation";
import {
  fetchMyEvaluationData,
  pickDefaultFinalizedPeriod,
  mapSupervisorPerformanceToDisplay,
  mapSupervisorCompetencyToDisplay,
} from "../utils";

const mockGetGoals = vi.mocked(getGoalsAction);
const mockGetSelfAssessments = vi.mocked(getSelfAssessmentsAction);
const mockGetSupervisorFeedbacks = vi.mocked(getSupervisorFeedbacksAction);
const mockGetMyPeerReviewDetail = vi.mocked(getMyPeerReviewDetailAction);

const PERIOD_ID = "period-1";
const USER_ID = "user-1";

function buildCoreValueDetail(): EvaluationDetailResponse {
  return {
    userId: USER_ID,
    userName: "自分",
    departmentName: null,
    positionName: null,
    supervisorName: null,
    periodName: "2026上期",
    allSubmitted: true,
    coreValues: [],
    comments: [],
    selfAvgRating: "A",
    peer1AvgRating: "A+",
    peer2AvgRating: "B",
    supervisorAvgRating: "S",
    overallRating: "A+",
  } as EvaluationDetailResponse;
}

describe("fetchMyEvaluationData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries every source scoped to the logged-in employee (self-only)", async () => {
    mockGetGoals.mockResolvedValue({ success: true, data: { items: [] } } as never);
    mockGetSelfAssessments.mockResolvedValue({ success: true, data: { items: [] } } as never);
    mockGetSupervisorFeedbacks.mockResolvedValue({ success: true, data: { items: [] } } as never);
    mockGetMyPeerReviewDetail.mockResolvedValue({ success: true, data: buildCoreValueDetail() } as never);

    await fetchMyEvaluationData(PERIOD_ID, USER_ID);

    expect(mockGetGoals).toHaveBeenCalledWith({
      periodId: PERIOD_ID,
      userId: USER_ID,
      status: "approved",
      limit: 100,
    });
    expect(mockGetSelfAssessments).toHaveBeenCalledWith({
      periodId: PERIOD_ID,
      userId: USER_ID,
    });
    // The employee can only read feedback where they are the subordinate (=self)
    expect(mockGetSupervisorFeedbacks).toHaveBeenCalledWith({
      periodId: PERIOD_ID,
      subordinateId: USER_ID,
    });
    expect(mockGetMyPeerReviewDetail).toHaveBeenCalledWith(PERIOD_ID);
  });

  it("unwraps the .items arrays and core value detail on success", async () => {
    const goal = { id: "g1" };
    const assessment = { id: "a1" };
    const feedback = { id: "f1" };
    const detail = buildCoreValueDetail();
    mockGetGoals.mockResolvedValue({ success: true, data: { items: [goal] } } as never);
    mockGetSelfAssessments.mockResolvedValue({ success: true, data: { items: [assessment] } } as never);
    mockGetSupervisorFeedbacks.mockResolvedValue({ success: true, data: { items: [feedback] } } as never);
    mockGetMyPeerReviewDetail.mockResolvedValue({ success: true, data: detail } as never);

    const result = await fetchMyEvaluationData(PERIOD_ID, USER_ID);

    expect(result.goals).toEqual([goal]);
    expect(result.selfAssessments).toEqual([assessment]);
    expect(result.supervisorFeedbacks).toEqual([feedback]);
    expect(result.coreValueDetail).toBe(detail);
  });

  it("falls back to empty arrays / null when any source fails", async () => {
    mockGetGoals.mockResolvedValue({ success: false, error: "boom" } as never);
    mockGetSelfAssessments.mockResolvedValue({ success: false, error: "boom" } as never);
    mockGetSupervisorFeedbacks.mockResolvedValue({ success: false, error: "boom" } as never);
    mockGetMyPeerReviewDetail.mockResolvedValue({ success: false, error: "boom" } as never);

    const result = await fetchMyEvaluationData(PERIOD_ID, USER_ID);

    expect(result.goals).toEqual([]);
    expect(result.selfAssessments).toEqual([]);
    expect(result.supervisorFeedbacks).toEqual([]);
    expect(result.coreValueDetail).toBeNull();
  });
});

describe("pickDefaultFinalizedPeriod", () => {
  function period(overrides: Partial<EvaluationPeriod>): EvaluationPeriod {
    return {
      id: "p",
      name: "P",
      start_date: "2026-01-01",
      end_date: "2026-06-30",
      status: "completed",
      ...overrides,
    } as EvaluationPeriod;
  }

  it("returns the most recent finalized (completed) period", () => {
    const periods = [
      period({ id: "old", status: "completed", end_date: "2025-06-30" }),
      period({ id: "active", status: "active", end_date: "2026-12-31" }),
      period({ id: "recent", status: "completed", end_date: "2026-06-30" }),
    ];
    expect(pickDefaultFinalizedPeriod(periods)?.id).toBe("recent");
  });

  it("ignores non-completed periods", () => {
    const periods = [
      period({ id: "active", status: "active", end_date: "2026-12-31" }),
      period({ id: "draft", status: "draft", end_date: "2026-11-30" }),
    ];
    expect(pickDefaultFinalizedPeriod(periods)).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(pickDefaultFinalizedPeriod([])).toBeNull();
  });
});

describe("mapSupervisorPerformanceToDisplay", () => {
  function buildSupervisorGoal(
    overrides: Partial<PerformanceGoalSupervisorData> = {},
  ): PerformanceGoalSupervisorData {
    return {
      id: "row-1",
      goalId: "goal-1",
      selfAssessmentId: "assessment-1",
      feedbackId: "feedback-1",
      type: "quantitative",
      weight: 60,
      specificGoal: "売上目標",
      achievementCriteria: "達成基準",
      methods: "手段",
      supervisorRatingCode: "A",
      supervisorRating: 75,
      supervisorComment: "上長コメント",
      ...overrides,
    };
  }

  it("maps supervisor rating/comment into the display shape keyed by goalId", () => {
    const [mapped] = mapSupervisorPerformanceToDisplay([buildSupervisorGoal()]);
    expect(mapped).toEqual({
      id: "goal-1",
      type: "quantitative",
      weight: 60,
      specificGoal: "売上目標",
      achievementCriteria: "達成基準",
      methods: "手段",
      ratingCode: "A",
      comment: "上長コメント",
    });
  });

  it("coerces a null supervisor rating to undefined", () => {
    const [mapped] = mapSupervisorPerformanceToDisplay([
      buildSupervisorGoal({ supervisorRatingCode: null }),
    ]);
    expect(mapped.ratingCode).toBeUndefined();
  });
});

describe("mapSupervisorCompetencyToDisplay", () => {
  function buildSupervisorCompetency(
    overrides: Partial<CompetencySupervisorData> = {},
  ): CompetencySupervisorData {
    return {
      competencyId: "comp-1",
      goalId: "goal-1",
      goalWeight: 100,
      goalSupervisorRating: 70,
      selfAssessmentId: "assessment-1",
      feedbackId: "feedback-1",
      name: "チームワーク",
      items: [
        { id: "comp-1-0", actionIndex: "0", description: "行動1", rating: "A" },
        { id: "comp-1-1", actionIndex: "1", description: "行動2", rating: undefined },
      ],
      supervisorComment: "上長コメント",
      competencyRating: "A",
      ratingData: { "comp-1": { "0": "A" } },
      isLastInGoal: true,
      isFocused: false,
      ...overrides,
    };
  }

  it("maps items to {id, description, rating} (dropping actionIndex) and uses the supervisor comment", () => {
    const [mapped] = mapSupervisorCompetencyToDisplay([buildSupervisorCompetency()]);
    expect(mapped).toEqual({
      competencyId: "comp-1",
      goalId: "goal-1",
      name: "チームワーク",
      items: [
        { id: "comp-1-0", description: "行動1", rating: "A" },
        { id: "comp-1-1", description: "行動2", rating: undefined },
      ],
      comment: "上長コメント",
      competencyRating: "A",
      isLastInGoal: true,
      isFocused: false,
    });
  });
});
