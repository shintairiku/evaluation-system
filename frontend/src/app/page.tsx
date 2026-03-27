import { SignedIn, SignedOut } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Header from "@/components/display/header";
import Sidebar from "@/components/display/sidebar";
import WelcomeDashboard from "@/components/display/WelcomeDashboard";
import InactiveAccountMessage from "@/components/display/InactiveAccountMessage";
import LandingPage from "@/components/display/LandingPage";
import AuthRedirectHandler from "@/components/auth/AuthRedirectHandler";
import { checkUserExistsAction } from "@/api/server-actions/users";
import SidebarRefresher from "@/components/display/SidebarRefresher";
import { getCurrentUserContextAction } from '@/api/server-actions/current-user-context';
import { CurrentUserProvider } from '@/context/CurrentUserContext';
import { GoalReviewProvider } from '@/context/GoalReviewContext';
import { GoalListProvider } from '@/context/GoalListContext';
import { DraftAssessmentsProvider } from '@/context/ReturnedAssessmentsContext';
import { PendingEvaluationsProvider } from '@/context/PendingEvaluationsContext';
import { fetchSidebarCounts } from '@/lib/sidebar-counts';

async function SignedInContent() {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  if (!orgId) {
    redirect('/org');
  }

  // Check if user exists in database
  const userResult = await checkUserExistsAction(userId);
  
  if (!userResult.success || !userResult.data) {
    // API call failed, redirect to profile creation
    redirect("/setup");
  }

  const userCheck = userResult.data;
  
  // If user doesn't exist in database, redirect to profile creation
  if (!userCheck.exists) {
    redirect("/setup");
  }
  
  // Only redirect inactive users - pending users can access the system
  if (userCheck.status === 'inactive') {
    return <InactiveAccountMessage />;
  }

  // User exists and can access the system - show main dashboard
  const currentUserContext = await getCurrentUserContextAction();
  const periodId = currentUserContext?.currentPeriod?.id;
  const backendUserId = currentUserContext?.user?.id;

  const { initialPendingCount, initialRejectedGoalsCount, initialDraftCount, initialPendingEvaluationsCount } =
    await fetchSidebarCounts(periodId, backendUserId);

  return (
    <CurrentUserProvider value={currentUserContext}>
      <GoalReviewProvider initialPendingCount={initialPendingCount} initialPeriodId={periodId}>
        <GoalListProvider initialRejectedGoalsCount={initialRejectedGoalsCount} initialPeriodId={periodId} initialUserId={backendUserId}>
          <DraftAssessmentsProvider initialDraftCount={initialDraftCount} initialPeriodId={periodId} initialUserId={backendUserId}>
            <PendingEvaluationsProvider initialPendingEvaluationsCount={initialPendingEvaluationsCount} initialPeriodId={periodId} initialUserId={backendUserId}>
              <SidebarRefresher />
              <div className="flex mt-[45px]">
                <div className="fixed left-0 top-[45px] h-[calc(100vh-45px)]">
                  <Sidebar />
                </div>
                <main className="flex-1 ml-[314px] p-6">
                  <WelcomeDashboard user={userCheck} />
                </main>
              </div>
            </PendingEvaluationsProvider>
          </DraftAssessmentsProvider>
        </GoalListProvider>
      </GoalReviewProvider>
    </CurrentUserProvider>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <SignedOut>
        <LandingPage />
      </SignedOut>

      <SignedIn>
        {/* Client-side redirect handler for smooth user flow */}
        <AuthRedirectHandler />
        <SignedInContent />
      </SignedIn>
    </div>
  );
}
