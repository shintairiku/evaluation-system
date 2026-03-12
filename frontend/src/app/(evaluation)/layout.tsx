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
import { fetchSidebarCounts } from '@/lib/sidebar-counts';

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

  const { initialPendingCount, initialRejectedGoalsCount, initialDraftCount, initialPendingEvaluationsCount } =
    await fetchSidebarCounts(periodId, userId);

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
