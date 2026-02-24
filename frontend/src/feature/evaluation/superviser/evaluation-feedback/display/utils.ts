import { getGoalsAction } from "@/api/server-actions/goals";
import { getSelfAssessmentsAction } from "@/api/server-actions/self-assessments";
import { getSupervisorFeedbacksAction } from "@/api/server-actions/supervisor-feedbacks";
import type { GoalResponse, SelfAssessment, SupervisorFeedback } from "@/api/types";
import {
  transformPerformanceGoalsForDisplay,
  type PerformanceGoalDisplayData,
} from "./PerformanceGoalsSelfAssessment";
import {
  transformPerformanceGoalsForSupervisor,
  type PerformanceGoalSupervisorData,
} from "./PerformanceGoalsSupervisorEvaluation";
import {
  transformCompetencyGoalsForDisplay,
  type CompetencyDisplayData,
} from "./CompetencySelfAssessment";
import {
  transformCompetencyGoalsForSupervisor,
  type CompetencySupervisorData,
} from "./CompetencySupervisorEvaluation";

/**
 * Result of fetching and transforming evaluation data for a subordinate
 */
export interface SubordinateEvaluationData {
  performanceGoals: PerformanceGoalDisplayData[];
  competencyData: CompetencyDisplayData[];
  supervisorPerformanceGoals: PerformanceGoalSupervisorData[];
  supervisorCompetencyData: CompetencySupervisorData[];
}

/**
 * Fetches goals, self-assessments, and supervisor feedbacks for a subordinate,
 * then transforms them into display-ready formats.
 *
 * @param periodId - The evaluation period ID
 * @param subordinateId - The subordinate user ID
 * @returns Transformed evaluation data for display
 */
export async function fetchSubordinateEvaluationData(
  periodId: string,
  subordinateId: string
): Promise<SubordinateEvaluationData> {
  // Fetch goals, self-assessments, and supervisor feedbacks in parallel
  const [goalsResult, assessmentsResult, feedbacksResult] = await Promise.all([
    getGoalsAction({
      periodId,
      userId: subordinateId,
      status: 'approved',
      limit: 100,
    }),
    getSelfAssessmentsAction({
      periodId,
      userId: subordinateId,
    }),
    getSupervisorFeedbacksAction({
      periodId,
      subordinateId,
    }),
  ]);

  const goals: GoalResponse[] = goalsResult.success && goalsResult.data?.items
    ? goalsResult.data.items
    : [];
  const selfAssessments: SelfAssessment[] = assessmentsResult.success && assessmentsResult.data?.items
    ? assessmentsResult.data.items
    : [];
  const supervisorFeedbacks: SupervisorFeedback[] = feedbacksResult.success && feedbacksResult.data?.items
    ? feedbacksResult.data.items
    : [];

  // Transform data for self-assessment display components (read-only)
  const performanceGoals = transformPerformanceGoalsForDisplay(goals, selfAssessments);
  const competencyData = transformCompetencyGoalsForDisplay(goals, selfAssessments);

  // Transform data for supervisor evaluation components (editable)
  const supervisorPerformanceGoals = transformPerformanceGoalsForSupervisor(goals, selfAssessments, supervisorFeedbacks);
  const supervisorCompetencyData = transformCompetencyGoalsForSupervisor(goals, selfAssessments, supervisorFeedbacks);

  return {
    performanceGoals,
    competencyData,
    supervisorPerformanceGoals,
    supervisorCompetencyData,
  };
}
