import { SignedIn, SignedOut } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Header from "@/components/display/header";
import Sidebar from "@/components/display/sidebar";
import EnhancedDashboard, { DashboardLoadingSkeleton } from "@/components/dashboard/EnhancedDashboard";
import InactiveAccountMessage from "@/components/display/InactiveAccountMessage";
import LandingPage from "@/components/display/LandingPage";
import AuthRedirectHandler from "@/components/auth/AuthRedirectHandler";
import { checkUserExistsAction, getUserByIdAction } from "@/api/server-actions/users";

async function SignedInContent() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Check if user exists in database
  const userResult = await checkUserExistsAction(userId);

  if (!userResult.success || !userResult.data) {
    // API call failed, redirect to profile creation
    redirect("/setup");
  }

  const userCheck = userResult.data;

  // If user doesn't exist in database, redirect to profile creation
  if (!userCheck.exists || !userCheck.user_id) {
    redirect("/setup");
  }

  // Only redirect inactive users - pending users can access the system
  if (userCheck.status === 'inactive') {
    return <InactiveAccountMessage />;
  }

  // Fetch full user details including roles for dashboard
  // OPTIMIZATION: userDetail is passed to EnhancedDashboard to avoid duplicate API calls
  // The EnhancedDashboard computes roles from this data instead of re-fetching
  const userDetailResult = await getUserByIdAction(userCheck.user_id);
  const userDetail = userDetailResult.success && userDetailResult.data ? userDetailResult.data : null;

  // Determine default dashboard based on user's highest privilege role
  // This ensures proper JWT handling through Docker network (server-side fetch)
  let initialDashboardData = null;
  let initialDashboardRole: 'admin' | 'supervisor' | 'employee' = 'employee';

  if (userDetail?.roles) {
    const { getRoleHierarchyLevel } = await import('@/utils/hierarchy');
    const userHierarchyLevels = userDetail.roles.map(role => getRoleHierarchyLevel(role.name));
    const highestLevel = Math.min(...userHierarchyLevels);

    if (highestLevel <= 2) {
      // Admin or manager - fetch admin dashboard
      initialDashboardRole = 'admin';
      const { getAdminDashboardDataAction } = await import('@/api/server-actions/admin-dashboard');
      const result = await getAdminDashboardDataAction();
      initialDashboardData = result.success ? result.data : null;
    } else if (highestLevel === 3) {
      // Supervisor - fetch supervisor dashboard
      initialDashboardRole = 'supervisor';
      const { getSupervisorDashboardDataAction } = await import('@/api/server-actions/supervisor-dashboard');
      const result = await getSupervisorDashboardDataAction();
      initialDashboardData = result.success ? result.data : null;
    } else {
      // Employee - fetch employee dashboard
      initialDashboardRole = 'employee';
      const { getEmployeeDashboardDataAction } = await import('@/api/server-actions/employee-dashboard');
      const result = await getEmployeeDashboardDataAction();
      initialDashboardData = result.success ? result.data : null;
    }
  } else {
    // No roles - default to employee dashboard
    const { getEmployeeDashboardDataAction } = await import('@/api/server-actions/employee-dashboard');
    const result = await getEmployeeDashboardDataAction();
    initialDashboardData = result.success ? result.data : null;
  }

  // User exists and can access the system - show enhanced dashboard
  // OPTIMIZATION: Initial dashboard data for user's primary role is passed from server-side
  // Additional role data is fetched on-demand when user switches tabs
  return (
    <div className="flex mt-[45px]">
      <div className="fixed left-0 top-[45px] h-[calc(100vh-45px)]">
        <Sidebar />
      </div>
      <main className="flex-1 ml-[314px] p-6">
        <Suspense fallback={<DashboardLoadingSkeleton />}>
          <EnhancedDashboard
            user={userCheck}
            userDetail={userDetail}
            initialDashboardData={initialDashboardData}
            initialDashboardRole={initialDashboardRole}
          />
        </Suspense>
      </main>
    </div>
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
