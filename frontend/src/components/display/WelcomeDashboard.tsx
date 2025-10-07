import type { AuthUserExistsResponse } from '@/api/types/auth';
import PendingApprovalNotification from './PendingApprovalNotification';
import UserInfoCard from './UserInfoCard';

interface WelcomeDashboardProps {
  user: AuthUserExistsResponse;
}

export default function WelcomeDashboard({ user }: WelcomeDashboardProps) {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        ようこそ、{user.name || 'ユーザー'} さん
      </h2>
      <p className="text-gray-600 mb-4">
        人事評価システムのダッシュボードです
      </p>
      
      {/* Show pending approval notification */}
      {user.status === 'pending_approval' && (
        <PendingApprovalNotification />
      )}
      
      <UserInfoCard user={user} />
    </div>
  );
} 