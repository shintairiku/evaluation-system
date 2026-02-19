import { getGoalsAction } from "@/api/server-actions/goals";
import { getSelfAssessmentsAction } from "@/api/server-actions/self-assessments";
import {
  createSupervisorFeedbackAction,
  getSupervisorFeedbacksAction,
  getSupervisorFeedbacksByAssessmentAction,
} from "@/api/server-actions/supervisor-feedbacks";
import type { Competency, GoalResponse, SelfAssessment, SupervisorFeedback } from "@/api/types";
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function findFeedbackByAssessmentWithRetry(
  selfAssessmentId: string,
  retryDelays: number[] = [0]
): Promise<SupervisorFeedback | null> {
  for (const delay of retryDelays) {
    if (delay > 0) {
      await sleep(delay);
    }

    const existingResult = await getSupervisorFeedbacksByAssessmentAction(selfAssessmentId);
    if (existingResult.success && existingResult.data) {
      return existingResult.data;
    }
  }

  return null;
}

async function ensureSupervisorFeedbackRecords(
  selfAssessments: SelfAssessment[],
  supervisorFeedbacks: SupervisorFeedback[]
): Promise<SupervisorFeedback[]> {
  const feedbackByAssessmentId = new Set(
    supervisorFeedbacks.map((feedback) => feedback.selfAssessmentId)
  );

  const missingAssessments = selfAssessments.filter(
    (assessment) =>
      assessment.status === "submitted" &&
      !feedbackByAssessmentId.has(assessment.id)
  );

  if (missingAssessments.length === 0) {
    return supervisorFeedbacks;
  }

  const ensuredFeedbacks = await Promise.all(
    missingAssessments.map(async (assessment) => {
      const existingFeedback = await findFeedbackByAssessmentWithRetry(assessment.id);
      if (existingFeedback) {
        return existingFeedback;
      }

      const createResult = await createSupervisorFeedbackAction({
        selfAssessmentId: assessment.id,
        periodId: assessment.periodId,
        action: "PENDING",
        status: "draft",
      });

      if (createResult.success && createResult.data) {
        return createResult.data;
      }

      return findFeedbackByAssessmentWithRetry(
        assessment.id,
        [150, 300, 600]
      );
    })
  );

  const merged = [
    ...supervisorFeedbacks,
    ...ensuredFeedbacks.filter((feedback): feedback is SupervisorFeedback => !!feedback),
  ];

  const deduplicated = new Map<string, SupervisorFeedback>();
  merged.forEach((feedback) => {
    deduplicated.set(feedback.id, feedback);
  });
  return Array.from(deduplicated.values());
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
  subordinateId: string,
  stageCompetencies: Competency[] = []
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
  let supervisorFeedbacks: SupervisorFeedback[] = feedbacksResult.success && feedbacksResult.data?.items
    ? feedbacksResult.data.items
    : [];

  supervisorFeedbacks = await ensureSupervisorFeedbackRecords(
    selfAssessments,
    supervisorFeedbacks
  );

  // Transform data for self-assessment display components (read-only)
  const performanceGoals = transformPerformanceGoalsForDisplay(goals, selfAssessments);
  const competencyData = transformCompetencyGoalsForDisplay(goals, selfAssessments, stageCompetencies);

  // Transform data for supervisor evaluation components (editable)
  const supervisorPerformanceGoals = transformPerformanceGoalsForSupervisor(goals, selfAssessments, supervisorFeedbacks);
  const supervisorCompetencyData = transformCompetencyGoalsForSupervisor(
    goals,
    selfAssessments,
    supervisorFeedbacks,
    stageCompetencies
  );

  return {
    performanceGoals,
    competencyData,
    supervisorPerformanceGoals,
    supervisorCompetencyData,
  };
}
