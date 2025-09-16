import { getStagesAdminAction } from '@/api/server-actions/stages';
import { getUsersAction } from '@/api/server-actions/users';
import StageManagementContainer from '@/feature/stage-management/StageManagementContainer';

/**
 * Stage Management Page (Admin Only)
 * 
 * Server Component following .kiro specifications:
 * - Uses getStagesAdminAction for admin verification
 * - Server-side 403 error handling
 * - Fetches initial data for SSR
 */
export default async function StageManagementPage() {
  // Check admin access by calling admin-only endpoint
  // If user doesn't have admin permissions, backend returns 403
  const stagesResult = await getStagesAdminAction();

  // Handle non-admin access with 403 error display
  if (!stagesResult.success) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="text-gray-600">
            You don&apos;t have admin permissions to access this page.
          </p>
          <p className="text-sm text-gray-500">
            Contact your system administrator if you believe this is an error.
          </p>
          <p className="text-xs text-gray-400 mt-4">
            Error: {stagesResult.error}
          </p>
        </div>
      </div>
    );
  }

  // Fetch users data for stage management
  const usersResult = await getUsersAction({ 
    limit: 100, // Reasonable limit to prevent performance issues
    page: 1 
  });

  // Handle users fetch error
  if (!usersResult.success) {
    throw new Error(usersResult.error || 'Failed to load users');
  }

  return (
    <div className="container mx-auto p-6">
      <StageManagementContainer
        initialStages={stagesResult.data || []}
        initialUsers={usersResult.data?.items || []}
        total={usersResult.data?.total || 0}
      />
    </div>
  );
}

// Metadata for SEO and page info
export const metadata = {
  title: 'ステージ管理 | 人事評価システム',
  description: '評価ステージ間でユーザーをドラッグ&ドロップして管理',
};