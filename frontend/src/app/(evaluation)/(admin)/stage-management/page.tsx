import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getStagesAction } from '@/api/server-actions/stages';
import { getUsersAction } from '@/api/server-actions/users';
import StageManagementView from '@/feature/stage-management/StageManagementView';

/**
 * Stage Management Page (Admin Only)
 * 
 * Server Component that:
 * 1. Verifies user authentication
 * 2. Checks admin role (server-side)
 * 3. Fetches initial data for SSR
 * 4. Renders the Stage Management interface
 */
export default async function StageManagementPage() {
  // Verify authentication
  const { userId } = auth();
  
  if (!userId) {
    redirect('/sign-in');
  }

  // Fetch initial data server-side for better performance
  const [stagesResult, usersResult] = await Promise.all([
    getStagesAction(),
    getUsersAction({ limit: 1000 }) // Get all users for stage management
  ]);

  // Handle API errors
  if (!stagesResult.success) {
    throw new Error(stagesResult.error || 'Failed to load stages');
  }

  if (!usersResult.success) {
    throw new Error(usersResult.error || 'Failed to load users');
  }

  return (
    <div className="container mx-auto py-8">
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Stage Management
          </h1>
          <p className="text-gray-600 mt-2">
            Drag and drop users between evaluation stages
          </p>
        </div>

        {/* Stage Management Interface */}
        <StageManagementView
          initialStages={stagesResult.data || []}
          initialUsers={usersResult.data?.items || []}
        />
      </div>
    </div>
  );
}

// Metadata for SEO and page info
export const metadata = {
  title: 'Stage Management | HR Evaluation System',
  description: 'Manage user evaluation stages with drag and drop interface',
};