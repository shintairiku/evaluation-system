import { getEmployeeGoalListPageDataAction } from '@/api/server-actions/goals';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import GoalListClient from './GoalListClient';
import type { UUID } from '@/api/types';

interface GoalListDataLoaderProps {
  periodId?: UUID;
}

export default async function GoalListDataLoader({ periodId }: GoalListDataLoaderProps) {
  const result = await getEmployeeGoalListPageDataAction({ periodId });

  if (!result.success || !result.data) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>エラーが発生しました</AlertTitle>
          <AlertDescription className="mt-2">
            {result.error || '目標一覧の読み込みに失敗しました'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <GoalListClient pageData={result.data} />;
}

