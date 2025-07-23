import { getUserByIdAction } from '@/api/server-actions';
import UserProfileCard from '@/feature/user-profile/display/UserProfileCard';
import Sidebar from "@/components/display/sidebar";
import Header from "@/components/display/header";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface UserProfilesPageProps {
  searchParams: {
    userId?: string;
  };
}

export default async function UserProfilesPage({ searchParams }: UserProfilesPageProps) {
  // Get userId from URL params - using actual existing user ID for demo
  const userId = searchParams.userId || 'afa75299-1d51-4f78-8e54-d7701aec8d7b'; // Silva (シルバ) - current user
  
  // Server-side data fetching using getUserByIdAction as specified
  const result = await getUserByIdAction(userId);

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
                エラー: {result.error || 'ユーザーが見つかりませんでした'}
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
          <UserProfileCard user={result.data!} />
        </main>
      </div>
    </div>
  );
} 