import { CompetencyManagementView } from '@/feature/competency-management';
import { getCompetenciesAction } from '@/api/server-actions/competencies';
import { getStagesAdminAction } from '@/api/server-actions/stages';

/**
 * Competency Management Page (Admin/Viewer Only)
 *
 * Server Component following the same pattern as stage-management:
 * - Uses getStagesAdminAction for admin verification
 * - Server-side 403 error handling
 * - Fetches initial data for SSR
 */
export default async function CompetencyManagementPage() {
  // Check admin access by calling admin-only endpoint
  // Using getStagesAdminAction to verify admin permissions (similar to stage-management)
  const [competenciesResult, stagesResult] = await Promise.all([
    getCompetenciesAction({ page: 1, limit: 100 }),
    getStagesAdminAction(),
  ]);

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

  if (!competenciesResult.success) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-600">Error Loading Data</h1>
          <p className="text-gray-600">
            Failed to load competencies data.
          </p>
          <p className="text-xs text-gray-400 mt-4">
            Error: {competenciesResult.error}
          </p>
        </div>
      </div>
    );
  }

  const competencies = competenciesResult.data!;
  const stages = stagesResult.data!;

  return (
    <div className="container mx-auto p-6">
      <CompetencyManagementView
        initialCompetencies={competencies}
        stages={stages}
        isAdmin={true} // Since we reached here, user has admin access
      />
    </div>
  );
}

// Metadata for SEO and page info
export const metadata = {
  title: 'コンピテンシー管理 | 人事評価システム',
  description: 'ステージ別コンピテンシー項目の管理と確認',
};