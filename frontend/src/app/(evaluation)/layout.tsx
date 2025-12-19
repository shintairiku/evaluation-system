import Header from "@/components/display/header";
import Sidebar from "@/components/display/sidebar";
import { AuthSyncProvider } from '@/components/auth/AuthSyncProvider';
import { GoalListProvider } from '@/context/GoalListContext';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getCurrentUserContextAction } from '@/api/server-actions/current-user-context';
import { CurrentUserProvider } from '@/context/CurrentUserContext';
import { getGoalsAction } from '@/api/server-actions/goals';

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
  let initialRejectedGoalsCount = 0;

  try {
    const currentUserId = currentUserContext.user?.id;
    const currentPeriodId = currentUserContext.currentPeriod?.id;

    if (currentUserId && currentPeriodId) {
      const goalsResult = await getGoalsAction({
        periodId: currentPeriodId,
        userId: currentUserId,
        status: 'draft',
        limit: 100,
      });

      if (goalsResult.success && goalsResult.data?.items) {
        initialRejectedGoalsCount = goalsResult.data.items.filter(goal => Boolean(goal.previousGoalId)).length;
      }
    }
  } catch (error) {
    console.warn('Failed to preload rejected goals count:', error);
  }

  return (
    <AuthSyncProvider>
      <CurrentUserProvider value={currentUserContext}>
        <GoalListProvider initialRejectedGoalsCount={initialRejectedGoalsCount}>
          <div className="min-h-screen bg-background">
            <Header />
            <Sidebar />
            <main className="ml-[64px] min-w-0">
              <div className="mt-[45px]">
                {children}
              </div>
            </main>
          </div>
        </GoalListProvider>
      </CurrentUserProvider>
    </AuthSyncProvider>
  );
}
