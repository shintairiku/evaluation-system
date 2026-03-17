import { getSupportDocumentsAction } from '@/api/server-actions/support-documents';
import { SupportDocumentsPage } from '@/feature/support-documents';
import { EmptyState } from '@/components/ui/empty-state';
import { AlertCircle } from 'lucide-react';

export default async function SupportDocumentsRoute() {
  const result = await getSupportDocumentsAction();

  if (!result.success) {
    return (
      <div className="container mx-auto p-6">
        <EmptyState
          title="データの取得に失敗しました"
          description={result.errorMessage || 'しばらくしてから再度お試しください'}
          icon={<AlertCircle className="h-12 w-12" />}
        />
      </div>
    );
  }

  const data = result.data ?? { items: [], categories: [] };

  return <SupportDocumentsPage initialData={data} />;
}
