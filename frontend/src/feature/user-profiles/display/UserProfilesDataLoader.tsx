import { getUserDirectoryBasePageDataAction } from '@/api/server-actions/users';
import UserManagementWithSearch from "./UserManagementWithSearch";
import { ProfileOptionsProvider } from '@/feature/user-shared/context/ProfileOptionsContext';
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
  const result = await getUserDirectoryBasePageDataAction({ page, limit });

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
  
  const filters = result.data!.filters;
  const initialOptions = {
    departments: filters.departments ?? [],
    stages: filters.stages ?? [],
    roles: filters.roles ?? [],
  };

  return (
    <ProfileOptionsProvider initialOptions={initialOptions}>
      <UserManagementWithSearch initialUsers={result.data!.users} />
    </ProfileOptionsProvider>
  );
}
