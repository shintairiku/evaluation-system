import OrganizationAwareProfileWrapper from '@/feature/setup/components/OrganizationAwareProfileWrapper';

export default function ProfilePage() {
  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">プロフィール設定</h1>
        <p className="text-gray-600">
          システムを利用するために必要な情報を入力してください。
        </p>
      </div>
      
      <OrganizationAwareProfileWrapper />
    </div>
  );
}
