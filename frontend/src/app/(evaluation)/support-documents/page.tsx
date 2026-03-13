import { getSupportDocumentsAction } from '@/api/server-actions/support-documents';
import { SupportDocumentsPage } from '@/feature/support-documents';

export default async function SupportDocumentsRoute() {
  const result = await getSupportDocumentsAction();

  const data = result.success && result.data
    ? result.data
    : { items: [], categories: [] };

  return <SupportDocumentsPage initialData={data} />;
}
