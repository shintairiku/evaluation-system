import Header from "@/components/display/header";
import Sidebar from "@/components/display/sidebar";
import { AuthSyncProvider } from '@/components/auth/AuthSyncProvider';
import { GoalListProvider } from '@/context/GoalListContext';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getCurrentUserContextAction } from '@/api/server-actions/current-user-context';
import { CurrentUserProvider } from '@/context/CurrentUserContext';

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

  return (
    <AuthSyncProvider>
      <CurrentUserProvider value={currentUserContext}>
        <GoalListProvider>
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
