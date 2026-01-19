import GoalReviewRoute from '@/feature/evaluation/superviser/goal-review/display/GoalReviewRoute';

interface GoalReviewPageProps {
  searchParams: Promise<{
    periodId?: string;
  }>;
}

export default async function Page({ searchParams }: GoalReviewPageProps) {
  const resolvedSearchParams = await searchParams;
  return <GoalReviewRoute periodId={resolvedSearchParams.periodId} />;
}
