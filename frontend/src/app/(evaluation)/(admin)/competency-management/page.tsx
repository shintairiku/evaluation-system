import { CompetencyManagementView } from '@/feature/competency-management';
import { getCompetenciesWithStagesAction } from '@/api/server-actions/competency-management';

/**
 * Competency Management Page (Admin/Viewer Only)
 *
 * Server Component following the same pattern as stage-management:
 * - Uses getCompetenciesWithStagesAction for admin verification
 * - Server-side 403 error handling
 * - Fetches initial data for SSR
 */
export default async function CompetencyManagementPage() {
  // Check admin access by calling admin-only endpoint
  // If user doesn't have admin permissions, backend returns 403
  const dataResult = await getCompetenciesWithStagesAction();

  // Handle non-admin access with 403 error display
  if (!dataResult.success) {
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
            Error: {dataResult.error || dataResult.errorMessage}
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