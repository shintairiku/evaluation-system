import { getUsersForOrgChartAction } from '@/api/server-actions';
import ReadOnlyOrganizationView from './ReadOnlyOrganizationView';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default async function ReadOnlyOrganizationDataLoader() {
  // Server-side data fetching using getUsersForOrgChartAction
  const result = await getUsersForOrgChartAction();

  if (!result.success) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          エラー: {result.error || '組織図データの取得に失敗しました'}
        </AlertDescription>
      </Alert>
    );
  }

  if (!result.data || result.data.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          組織図に表示するユーザーが見つかりませんでした。
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <ReadOnlyOrganizationView users={result.data} />
  );
}