import { Suspense } from 'react';
import GoalListDataLoader from './GoalListDataLoader';
import type { UUID } from '@/api/types';

interface GoalListRouteProps {
  periodId?: UUID;
}

function GoalListLoading() {
  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 w-80 bg-gray-200 rounded animate-pulse" />
        </div>

        <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />

        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function GoalListRoute({ periodId }: GoalListRouteProps) {
  return (
    <Suspense fallback={<GoalListLoading />}>
      <GoalListDataLoader periodId={periodId} />
    </Suspense>
  );
}

