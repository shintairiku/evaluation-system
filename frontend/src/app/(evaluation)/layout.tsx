import Header from "@/components/display/header";
import Sidebar from "@/components/display/sidebar";
import { ProfileOptionsProvider } from '@/context/ProfileOptionsContext';
import { AuthSyncProvider } from '@/components/auth/AuthSyncProvider';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';

export default function EvaluationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server component: enforce organization context for evaluation area
  // If not in an organization, redirect to org page to select/create
  // This complements middleware and ensures server-rendered routes are protected
  (async () => {
    const { orgId } = await auth();
    if (!orgId) {
      redirect('/org');
    }
  })();

  return (
    <AuthSyncProvider>
      <ProfileOptionsProvider>
        <div className="min-h-screen bg-background">
          <Header />
          <Sidebar />
          <main className="ml-[64px] min-w-0">
            <div className="mt-[45px]">
              {children}
            </div>
          </main>
        </div>
      </ProfileOptionsProvider>
    </AuthSyncProvider>
  );
}