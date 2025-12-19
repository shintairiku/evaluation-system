import { getSupervisorGoalReviewPageDataAction } from '@/api/server-actions/goals';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import GoalReviewClient from './GoalReviewClient';
import type { UUID } from '@/api/types';

interface GoalReviewDataLoaderProps {
  periodId?: UUID;
}

export default async function GoalReviewDataLoader({ periodId }: GoalReviewDataLoaderProps) {
  const result = await getSupervisorGoalReviewPageDataAction({ periodId });

  if (!result.success || !result.data) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>エラーが発生しました</AlertTitle>
          <AlertDescription className="mt-2">
            {result.error || '目標承認ページの読み込みに失敗しました'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <GoalReviewClient pageData={result.data} />;
}

