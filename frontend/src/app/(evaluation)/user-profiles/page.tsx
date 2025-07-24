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
  // Parse pagination parameters from URL
  const page = parseInt(searchParams.page || '1', 10);
  const limit = parseInt(searchParams.limit || '50', 10);
  
  // Server-side data fetching using getUsersAction as specified in task #112
  const result = await getUsersAction({ page, limit });

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
          <UserManagementIndex initialUsers={result.data!.users} />
        </main>
      </div>
    </div>
  );
} 