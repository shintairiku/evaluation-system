import { Metadata } from 'next';
import { getCategorizedEvaluationPeriodsAction } from '@/api/server-actions/evaluation-periods';
import { EvaluationPeriodManagementContainer } from '@/feature/evaluation-period-management';
import type { ViewType } from '@/feature/evaluation-period-management/types';

export const metadata: Metadata = {
  title: '評価期間設定 | 人事評価システム',
  description: '評価期間の作成、編集、削除を行います'
};

interface EvaluationPeriodManagementPageProps {
  searchParams: {
    view?: ViewType;
    period?: string;
  };
}

export default async function EvaluationPeriodManagementPage({
  searchParams
}: EvaluationPeriodManagementPageProps) {
  // Admin access is now controlled by middleware - no need for checks here
  const periodsResult = await getCategorizedEvaluationPeriodsAction();

  return (
    <div className="container mx-auto p-6">
      <EvaluationPeriodManagementContainer
        initialPeriods={periodsResult.data || { current: null, upcoming: [], all: [] }}
        initialView={(searchParams.view as ViewType) || 'list'}
      />
    </div>
  );
}