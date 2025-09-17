import { currentUser } from '@clerk/nextjs/server';
import { CompetencyManagementView } from '@/feature/competency-management';
import { getCompetenciesWithStagesAction } from '@/api/server-actions/competency-management';

/**
 * Competency Management Page (Admin/Viewer Only)
 *
 * Server Component following GitHub issue #181 specifications:
 * - Role-based access control (Admin/Viewer permissions)
 * - Displays stage-based competency grid
 * - Admin-only editing capabilities
 * - Comprehensive error handling
 */
export default async function CompetencyManagementPage() {
  // Get current user for role checking
  const user = await currentUser();

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-600">Authentication Required</h1>
          <p className="text-gray-600">
            Please sign in to access the competency management page.
          </p>
        </div>
      </div>
    );
  }

  // Check if user has required permissions (Admin or Viewer)
  const userRoles = user.publicMetadata?.roles as string[] || [];
  const hasPermission = userRoles.includes('admin') || userRoles.includes('viewer');
  const isAdmin = userRoles.includes('admin');

  if (!hasPermission) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="text-gray-600">
            You don&apos;t have permission to access the competency management page.
          </p>
          <p className="text-sm text-gray-500">
            Admin or Viewer permissions required.
          </p>
        </div>
      </div>
    );
  }

  // Fetch competencies and stages data
  const dataResult = await getCompetenciesWithStagesAction();

  // Handle data fetch error
  if (!dataResult.success) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-600">Data Load Error</h1>
          <p className="text-gray-600">
            Failed to load competency management data.
          </p>
          <p className="text-sm text-gray-500">
            Error: {dataResult.error}
          </p>
          <p className="text-xs text-gray-400 mt-4">
            Please try refreshing the page or contact your system administrator.
          </p>
        </div>
      </div>
    );
  }

  const { competencies, stages } = dataResult.data!;

  return (
    <div className="container mx-auto p-6">
      <CompetencyManagementView
        initialCompetencies={competencies}
        stages={stages}
        isAdmin={isAdmin}
      />
    </div>
  );
}

// Metadata for SEO and page info
export const metadata = {
  title: 'コンピテンシー管理 | 人事評価システム',
  description: 'ステージ別コンピテンシー項目の管理と確認',
};