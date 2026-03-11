import Header from "@/components/display/header";
import Sidebar from "@/components/display/sidebar";
import SidebarRefresher from "@/components/display/SidebarRefresher";
import { AuthSyncProvider } from '@/components/auth/AuthSyncProvider';
import { GoalListProvider } from '@/context/GoalListContext';
import { GoalReviewProvider } from '@/context/GoalReviewContext';
import { DraftAssessmentsProvider } from '@/context/ReturnedAssessmentsContext';
import { PendingEvaluationsProvider } from '@/context/PendingEvaluationsContext';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getCurrentUserContextAction } from '@/api/server-actions/current-user-context';
import { CurrentUserProvider } from '@/context/CurrentUserContext';
import { getPendingSupervisorReviewsAction } from '@/api/server-actions/supervisor-reviews';
import { getGoalsAction } from '@/api/server-actions/goals/queries';
import { getSelfAssessmentsAction } from '@/api/server-actions/self-assessments';
import { getMyEvaluationAction, getCoreValuePendingFeedbackCountAction } from '@/api/server-actions/core-values';
import { getSupervisorFeedbacksAction } from '@/api/server-actions/supervisor-feedbacks';

export const dynamic = 'force-dynamic';

export default async function EvaluationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { orgId } = await auth();
  if (!orgId) {
    redirect('/org');
  }

  const currentUserContext = await getCurrentUserContextAction();

  const periodId = currentUserContext?.currentPeriod?.id;
  const userId = currentUserContext?.user?.id;

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
  const initialPendingEvaluationsCount = supervisorFeedbacksCount + coreValuePendingCount;

  return (
    <AuthSyncProvider>
      <CurrentUserProvider value={currentUserContext}>
        <GoalReviewProvider initialPendingCount={initialPendingCount} initialPeriodId={periodId}>
          <GoalListProvider initialRejectedGoalsCount={initialRejectedGoalsCount} initialPeriodId={periodId} initialUserId={userId}>
            <DraftAssessmentsProvider initialDraftCount={initialDraftCount} initialPeriodId={periodId} initialUserId={userId}>
              <PendingEvaluationsProvider initialPendingEvaluationsCount={initialPendingEvaluationsCount} initialPeriodId={periodId} initialUserId={userId}>
                <div className="min-h-screen bg-background">
                  <Header />
                  <Sidebar />
                  <SidebarRefresher />
                  <main className="ml-[64px] min-w-0">
                    <div className="mt-[45px]">
                      {children}
                    </div>
                  </main>
                </div>
              </PendingEvaluationsProvider>
            </DraftAssessmentsProvider>
          </GoalListProvider>
        </GoalReviewProvider>
      </CurrentUserProvider>
    </AuthSyncProvider>
  );
}
