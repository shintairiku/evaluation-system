import { getUsersAction } from '@/api/server-actions';
import UserManagementWithSearch from "@/feature/user-profiles/display/UserManagementWithSearch";
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
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          エラー: {result.error || 'ユーザーリストの取得に失敗しました'}
        </AlertDescription>
      </Alert>
    );
  }

  console.log('🔍 DEBUG: About to render UserManagementWithSearch with users:', result.data?.items?.length || 0);
  
  return (
    <UserManagementWithSearch initialUsers={result.data!.items} />
  );
} 