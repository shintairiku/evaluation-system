export default function PendingApprovalNotification() {
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <h3 className="font-medium text-yellow-900 mb-2">承認待ち</h3>
      <p className="text-sm text-yellow-700">
        アカウントは承認待ちです。管理者の承認後、全機能をご利用いただけます。
      </p>
    </div>
  );
} 