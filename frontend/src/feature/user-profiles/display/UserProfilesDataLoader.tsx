import { getUsersPageAction } from '@/api/server-actions/users';
import UserManagementWithSearch from "./UserManagementWithSearch";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface UserProfilesDataLoaderProps {
  page?: number;
  limit?: number;
}

export default async function UserProfilesDataLoader({ 
  page = 1, 
  limit = 50 
}: UserProfilesDataLoaderProps) {
  // Server-side data fetching using getUsersAction
  const result = await getUsersPageAction({ page, limit, withCount: false, include: 'stage' });

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
  
  return (
    <UserManagementWithSearch initialUsers={result.data!.users} />
  );
}
