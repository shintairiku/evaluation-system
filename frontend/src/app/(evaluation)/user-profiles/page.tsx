import { getUsersAction } from '@/api/server-actions';
import UserManagementIndex from "@/feature/user-profiles/display/index";
import Sidebar from "@/components/display/sidebar";
import Header from "@/components/display/header";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface UserProfilesPageProps {
  searchParams: {
    page?: string;
    limit?: string;
  };
}

export default async function UserProfilesPage({ searchParams }: UserProfilesPageProps) {
  // Await searchParams for Next.js 15 compatibility
  const resolvedSearchParams = await searchParams;
  
  // Parse pagination parameters from URL
  const page = parseInt(resolvedSearchParams.page || '1', 10);
  const limit = parseInt(resolvedSearchParams.limit || '50', 10);
  
  // Server-side data fetching using getUsersAction as specified in task #112
  const result = await getUsersAction({ page, limit });

  // DEBUG: Log the result to see what we're getting
  console.log('UserProfilesPage - API Result:', {
    success: result.success,
    hasData: !!result.data,
    userCount: result.data?.items?.length || 0,
    error: result.error,
    totalUsers: result.data?.total
  });

  if (!result.success) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex mt-[45px]">
          <div className="fixed left-0 top-[45px] h-[calc(100vh-45px)]">
            <Sidebar />
          </div>
          <main className="flex-1 ml-[314px] p-5">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                エラー: {result.error || 'ユーザーリストの取得に失敗しました'}
              </AlertDescription>
            </Alert>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex mt-[45px]">
        <div className="fixed left-0 top-[45px] h-[calc(100vh-45px)]">
          <Sidebar />
        </div>
        <main className="flex-1 ml-[314px] p-5">
          {/* Pass real user data to the existing UserManagementIndex component */}
          <UserManagementIndex initialUsers={result.data!.items} />
        </main>
      </div>
    </div>
  );
} 