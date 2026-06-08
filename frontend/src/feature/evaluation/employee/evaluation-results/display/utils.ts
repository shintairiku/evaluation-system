import { getGoalsAction } from "@/api/server-actions/goals";
import { getSelfAssessmentsAction } from "@/api/server-actions/self-assessments";
import { getSupervisorFeedbacksAction } from "@/api/server-actions/supervisor-feedbacks";
import { getMyPeerReviewDetailAction } from "@/api/server-actions/peer-reviews";
import type {
  GoalResponse,
  SelfAssessment,
  SupervisorFeedback,
  EvaluationDetailResponse,
  EvaluationPeriod,
  RatingCode,
} from "@/api/types";
// Type-only imports (erased at build) — keep this module server-safe.
import type { PerformanceGoalDisplayData } from "@/feature/evaluation/superviser/evaluation-feedback/display/PerformanceGoalsSelfAssessment";
import type { PerformanceGoalSupervisorData } from "@/feature/evaluation/superviser/evaluation-feedback/display/PerformanceGoalsSupervisorEvaluation";
import type { CompetencyDisplayData } from "@/feature/evaluation/superviser/evaluation-feedback/display/CompetencySelfAssessment";
import type { CompetencySupervisorData } from "@/feature/evaluation/superviser/evaluation-feedback/display/CompetencySupervisorEvaluation";

/**
 * Raw (untransformed) evaluation data for the logged-in employee.
 *
 * Only fetching happens here so this module stays server-safe and can be called
 * during SSR. The display transforms live in the client component because they
 * are co-located with "use client" components.
 */
export interface MyEvaluationRawData {
  goals: GoalResponse[];
  selfAssessments: SelfAssessment[];
  supervisorFeedbacks: SupervisorFeedback[];
  coreValueDetail: EvaluationDetailResponse | null;
}

/**
 * Fetches goals, self-assessments, supervisor feedbacks and the anonymized core
 * value detail for the logged-in employee. All sources are employee-safe
 * (self / subordinate=self / results/mine).
 *
 * @param periodId - The evaluation period ID
 * @param userId - The logged-in employee's user ID
 */
export async function fetchMyEvaluationData(
  periodId: string,
  userId: string,
): Promise<MyEvaluationRawData> {
  const [goalsResult, assessmentsResult, feedbacksResult, coreValueDetailResult] =
    await Promise.all([
      getGoalsAction({ periodId, userId, status: "approved", limit: 100 }),
      getSelfAssessmentsAction({ periodId, userId }),
      getSupervisorFeedbacksAction({ periodId, subordinateId: userId }),
      getMyPeerReviewDetailAction(periodId),
    ]);

  return {
    goals: goalsResult.success && goalsResult.data?.items ? goalsResult.data.items : [],
    selfAssessments:
      assessmentsResult.success && assessmentsResult.data?.items
        ? assessmentsResult.data.items
        : [],
    supervisorFeedbacks:
      feedbacksResult.success && feedbacksResult.data?.items
        ? feedbacksResult.data.items
        : [],
    coreValueDetail:
      coreValueDetailResult.success && coreValueDetailResult.data
        ? coreValueDetailResult.data
        : null,
  };
}

/**
 * Picks the default period to show: the most recent finalized (完了) period.
 * Returns null when there is no finalized period.
 */
export function pickDefaultFinalizedPeriod(
  periods: EvaluationPeriod[],
): EvaluationPeriod | null {
  return (
    periods
      .filter((p) => p.status === "completed")
      .sort((a, b) => (b.end_date || "").localeCompare(a.end_date || ""))[0] ?? null
  );
}

// ---- Unified (self + supervisor) display shapes ----

/** One performance goal with both self and supervisor ratings/comments. */
export interface UnifiedPerformanceItem {
  goalId: string;
  type: "quantitative" | "qualitative";
  weight: number;
  specificGoal: string;
  achievementCriteria: string;
  methods: string;
  selfRating?: RatingCode;
  selfComment: string;
  supervisorRating?: RatingCode;
  supervisorComment: string;
}

/** One competency with per-action self/supervisor ratings + goal-level comments. */
export interface UnifiedCompetencyItem {
  competencyId: string;
  goalId: string;
  name: string;
  isFocused: boolean;
  actions: Array<{
    id: string;
    description: string;
    selfRating?: RatingCode;
    supervisorRating?: RatingCode;
  }>;
  selfComment: string;
  supervisorComment: string;
}

/**
 * Joins self-assessment and supervisor performance goals (by goalId) into a single
 * per-goal item carrying both sides. Goal details come from the self side.
 */
export function mergePerformanceItems(
  self: PerformanceGoalDisplayData[],
  supervisor: PerformanceGoalSupervisorData[],
): UnifiedPerformanceItem[] {
  const supMap = new Map(supervisor.map((g) => [g.goalId, g]));
  return self.map((g) => {
    const sv = supMap.get(g.id);
    return {
      goalId: g.id,
      type: g.type,
      weight: g.weight,
      specificGoal: g.specificGoal,
      achievementCriteria: g.achievementCriteria,
      methods: g.methods,
      selfRating: g.ratingCode,
      selfComment: g.comment,
      supervisorRating: sv?.supervisorRatingCode ?? undefined,
      supervisorComment: sv?.supervisorComment ?? "",
    };
  });
}

/**
 * Joins self and supervisor competency data (by competencyId, actions by id) into a
 * single per-competency item carrying both ratings per action and both comments.
 */
export function mergeCompetencyItems(
  self: CompetencyDisplayData[],
  supervisor: CompetencySupervisorData[],
): UnifiedCompetencyItem[] {
  const supMap = new Map(supervisor.map((c) => [c.competencyId, c]));
  return self.map((c) => {
    const sv = supMap.get(c.competencyId);
    const supActions = new Map((sv?.items ?? []).map((it) => [it.id, it.rating]));
    return {
      competencyId: c.competencyId,
      goalId: c.goalId,
      name: c.name,
      isFocused: c.isFocused,
      actions: c.items.map((it) => ({
        id: it.id,
        description: it.description,
        selfRating: it.rating,
        supervisorRating: supActions.get(it.id),
      })),
      selfComment: c.comment,
      supervisorComment: sv?.supervisorComment ?? "",
    };
  });
}
