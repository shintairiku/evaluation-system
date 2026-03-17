import { getPendingSupervisorReviewsAction } from '@/api/server-actions/supervisor-reviews';
import { getGoalsAction } from '@/api/server-actions/goals/queries';
import { getSelfAssessmentsAction } from '@/api/server-actions/self-assessments';
import { getMyEvaluationAction, getCoreValuePendingFeedbackCountAction } from '@/api/server-actions/core-values';
import { getSupervisorFeedbacksAction } from '@/api/server-actions/supervisor-feedbacks';

export interface SidebarCounts {
  initialPendingCount: number;
  initialRejectedGoalsCount: number;
  initialDraftCount: number;
  initialPendingEvaluationsCount: number;
}

export async function fetchSidebarCounts(
  periodId: string | undefined,
  userId: string | undefined,
): Promise<SidebarCounts> {
  const [
    pendingReviewsResult,
    rejectedGoalsResult,
    selfAssessmentsResult,
    coreValueMyResult,
    supervisorFeedbacksResult,
    coreValuePendingResult,
  ] = await Promise.allSettled([
    getPendingSupervisorReviewsAction({ pagination: { limit: 1 }, periodId }),
    getGoalsAction({ periodId, userId, status: 'draft', hasPreviousGoalId: true, limit: 1 }),
    getSelfAssessmentsAction({ periodId, status: 'draft', selfOnly: true, pagination: { limit: 1 } }),
    getMyEvaluationAction(periodId ?? ''),
    getSupervisorFeedbacksAction({ periodId, supervisorId: userId, action: 'PENDING', hasReturnComment: false, pagination: { limit: 1 } }),
    getCoreValuePendingFeedbackCountAction(periodId ?? ''),
  ]);

  const initialPendingCount = pendingReviewsResult.status === 'fulfilled' ? (pendingReviewsResult.value.data?.total ?? 0) : 0;
  const initialRejectedGoalsCount = rejectedGoalsResult.status === 'fulfilled' ? (rejectedGoalsResult.value.data?.total ?? 0) : 0;
  const selfAssessmentsCount = selfAssessmentsResult.status === 'fulfilled' ? (selfAssessmentsResult.value.data?.total ?? 0) : 0;
  const coreValueIsDraft = coreValueMyResult.status === 'fulfilled' && coreValueMyResult.value.data?.status === 'draft' ? 1 : 0;
  const initialDraftCount = selfAssessmentsCount + coreValueIsDraft;
  const supervisorFeedbacksCount = supervisorFeedbacksResult.status === 'fulfilled' ? (supervisorFeedbacksResult.value.data?.total ?? 0) : 0;
  const coreValuePendingCount = coreValuePendingResult.status === 'fulfilled' ? (coreValuePendingResult.value.data?.count ?? 0) : 0;

  return {
    initialPendingCount,
    initialRejectedGoalsCount,
    initialDraftCount,
    initialPendingEvaluationsCount: supervisorFeedbacksCount + coreValuePendingCount,
  };
}
