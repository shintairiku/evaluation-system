import type { AuthUserExistsResponse } from '@/api/types/auth';

interface UserInfoCardProps {
  user: AuthUserExistsResponse;
}

export default function UserInfoCard({ user }: UserInfoCardProps) {
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'アクティブ';
      case 'pending_approval':
        return '承認待ち';
      default:
        return status;
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
      <h3 className="font-medium text-blue-900 mb-2">ログイン情報</h3>
      <div className="text-sm text-blue-700 space-y-1">
        <p>メール: {user.email}</p>
        <p>ステータス: {getStatusLabel(user.status || '')}</p>
      </div>
    </div>
  );
} 