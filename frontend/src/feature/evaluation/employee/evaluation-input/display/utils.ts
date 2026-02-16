import { getGoalsAction } from "@/api/server-actions/goals";
import { getSelfAssessmentsAction } from "@/api/server-actions/self-assessments";
import { getSupervisorFeedbacksAction } from "@/api/server-actions/supervisor-feedbacks";
import type { SelfAssessment, SupervisorFeedback } from "@/api/types";
import type { GoalWithAssessment } from "./index";

export interface CategorizedGoals {
  performance: GoalWithAssessment[];
  competency: GoalWithAssessment[];
}

/**
 * Fetches goals, self-assessments, and supervisor feedbacks for a given period,
 * then categorizes them by goal type.
 *
 * @param periodId - The evaluation period ID
 * @returns Categorized goals with their assessments and feedbacks
 */
export async function fetchAndCategorizeGoals(
  periodId: string
): Promise<CategorizedGoals> {
  // Fetch approved goals, self-assessments, and supervisor feedbacks in parallel
  // selfOnly: true ensures supervisors only see their own data, not subordinates'
  const [goalsResult, assessmentsResult, feedbacksResult] = await Promise.all([
    getGoalsAction({ periodId, status: 'approved', selfOnly: true }),
    getSelfAssessmentsAction({ periodId, selfOnly: true }),
    getSupervisorFeedbacksAction({ periodId, selfOnly: true })
  ]);

  const performance: GoalWithAssessment[] = [];
  const competency: GoalWithAssessment[] = [];

  if (!goalsResult.success || !goalsResult.data) {
    return { performance, competency };
  }

  const goals = goalsResult.data.items || [];
  const assessments = assessmentsResult.success && assessmentsResult.data
    ? assessmentsResult.data.items || []
    : [];
  const feedbacks = feedbacksResult.success && feedbacksResult.data
    ? feedbacksResult.data.items || []
    : [];

  // Create a map of goalId -> SelfAssessment for quick lookup
  const assessmentMap = new Map<string, SelfAssessment>();
  assessments.forEach(assessment => {
    assessmentMap.set(assessment.goalId, assessment);
  });

  // Create a map of selfAssessmentId -> SupervisorFeedback for quick lookup
  const feedbackMap = new Map<string, SupervisorFeedback>();
  feedbacks.forEach(feedback => {
    feedbackMap.set(feedback.selfAssessmentId, feedback);
  });

  // Categorize goals and combine with their assessments and feedbacks
  goals.forEach(goal => {
    const selfAssessment = assessmentMap.get(goal.id) || null;
    const supervisorFeedback = selfAssessment
      ? feedbackMap.get(selfAssessment.id) || null
      : null;

    const combined: GoalWithAssessment = {
      goal,
      selfAssessment,
      supervisorFeedback
    };

    if (goal.goalCategory === '業績目標') {
      performance.push(combined);
    } else if (goal.goalCategory === 'コンピテンシー') {
      competency.push(combined);
    }
  });

  return { performance, competency };
}
