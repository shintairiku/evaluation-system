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

/**
 * Maps supervisor performance-goal data into the self-assessment display shape so
 * the same (read-only) PerformanceGoalsSelfAssessment card can render the 上長 column.
 */
export function mapSupervisorPerformanceToDisplay(
  data: PerformanceGoalSupervisorData[],
): PerformanceGoalDisplayData[] {
  return data.map((g) => ({
    id: g.goalId,
    type: g.type,
    weight: g.weight,
    specificGoal: g.specificGoal,
    achievementCriteria: g.achievementCriteria,
    methods: g.methods,
    ratingCode: g.supervisorRatingCode ?? undefined,
    comment: g.supervisorComment,
  }));
}

/**
 * Maps supervisor competency data into the self-assessment display shape so the same
 * (read-only) CompetencySelfAssessment card can render the 上長 column.
 */
export function mapSupervisorCompetencyToDisplay(
  data: CompetencySupervisorData[],
): CompetencyDisplayData[] {
  return data.map((c) => ({
    competencyId: c.competencyId,
    goalId: c.goalId,
    name: c.name,
    items: c.items.map((it) => ({
      id: it.id,
      description: it.description,
      rating: it.rating,
    })),
    comment: c.supervisorComment,
    competencyRating: c.competencyRating,
    isLastInGoal: c.isLastInGoal,
    isFocused: c.isFocused,
  }));
}
