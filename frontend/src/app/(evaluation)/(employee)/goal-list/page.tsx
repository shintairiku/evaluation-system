import GoalListRoute from '@/feature/evaluation/employee/goal-list/display/GoalListRoute';

interface GoalListPageProps {
  searchParams: Promise<{
    periodId?: string;
  }>;
}

export default async function Page({ searchParams }: GoalListPageProps) {
  const resolvedSearchParams = await searchParams;
  return <GoalListRoute periodId={resolvedSearchParams.periodId} />;
}
