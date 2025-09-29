'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { getGoalsAction } from '@/api/server-actions/goals';
import { getUsersAction } from '@/api/server-actions/users';
import { getCurrentEvaluationPeriodAction } from '@/api/server-actions/evaluation-periods';
import { GoalApprovalCardSkeleton, DelayedSkeleton } from '@/components/ui/loading-skeleton';
import { useGoalReviewContext } from '@/context/GoalReviewContext';
import type { GoalResponse, UserDetailResponse, EvaluationPeriod } from '@/api/types';
import { EmployeeTabNavigation } from '../components/EmployeeTabNavigation';
import { EmployeeInfoHeader } from '../components/EmployeeInfoHeader';
import { GoalApprovalCard } from '../components/GoalApprovalCard';
import { GuidelinesAlert } from '../components/GuidelinesAlert';
import { ApprovalGuidelinesPanel } from '../components/ApprovalGuidelinesPanel';

interface GroupedGoals {
  employee: UserDetailResponse;
  goals: GoalResponse[];
  pendingCount: number;
}

export default function GoalReviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupedGoals, setGroupedGoals] = useState<GroupedGoals[]>([]);
  const [totalPendingCount, setTotalPendingCount] = useState(0);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [currentPeriod, setCurrentPeriod] = useState<EvaluationPeriod | null>(null);
  const { setPendingCount } = useGoalReviewContext();

  useEffect(() => {
    loadGoalData();

    // Cleanup: reset count when component unmounts
    return () => {
      setPendingCount(0);
    };
  }, [setPendingCount]);

  // Format period name for display
  const formatPeriodDisplay = (period: EvaluationPeriod | null): string => {
    if (!period) return '評価期間未設定';
    return period.name || '2024年度'; // Fallback to current year if name is empty
  };

  // Period display component with loading state
  const PeriodDisplay = () => {
    if (loading) {
      return <div className="h-4 w-24 bg-gray-200 rounded animate-pulse inline-block"></div>;
    }
    return <>現在の評価期間: {formatPeriodDisplay(currentPeriod)}</>;
  };

  const loadGoalData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load current evaluation period
      const periodResult = await getCurrentEvaluationPeriodAction();
      if (periodResult.success && periodResult.data) {
        setCurrentPeriod(periodResult.data);
      }

      // TODO: Replace with real API calls when ready
      // For now, using real APIs but they may return empty data
      const goalsResult = await getGoalsAction();
      const usersResult = await getUsersAction();

      let goals: GoalResponse[] = [];
      let users: UserDetailResponse[] = [];

      if (goalsResult.success && goalsResult.data?.items) {
        goals = goalsResult.data.items.filter(goal => goal.status === 'submitted');
      }

      if (usersResult.success && usersResult.data?.items) {
        users = usersResult.data.items;
      }

      setTotalPendingCount(goals.length);
      setPendingCount(goals.length); // Update global context

      // Group goals by employee
      const grouped: GroupedGoals[] = users
        .map(user => {
          const userGoals = goals.filter(goal => goal.userId === user.id);
          return {
            employee: user,
            goals: userGoals,
            pendingCount: userGoals.length
          };
        })
        .filter(group => group.goals.length > 0);

      setGroupedGoals(grouped);

      // Set first employee as selected by default
      if (grouped.length > 0) {
        setSelectedEmployeeId(grouped[0].employee.id);
      }

    } catch (err) {
      console.error('Error loading goal data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="space-y-4 md:space-y-6">
          {/* Page Header Skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-32 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-6 w-6 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
          </div>

          {/* Guidelines Skeleton */}
          <div className="h-16 bg-gray-100 rounded-lg animate-pulse"></div>
          <div className="h-48 bg-gray-100 rounded-lg animate-pulse"></div>

          {/* Employee Tabs Skeleton */}
          <div className="flex space-x-2">
            <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-10 w-28 bg-gray-200 rounded animate-pulse"></div>
          </div>

          {/* Employee Info Skeleton */}
          <div className="h-20 bg-gray-100 rounded-lg animate-pulse"></div>

          {/* Goal Cards Skeleton */}
          <DelayedSkeleton delay={300}>
            <GoalApprovalCardSkeleton count={3} />
          </DelayedSkeleton>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="text-center space-y-4 py-12">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-xl sm:text-2xl font-bold text-red-600">エラーが発生しました</h1>
          <p className="text-muted-foreground text-sm sm:text-base">{error}</p>
          <button
            onClick={loadGoalData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  if (groupedGoals.length === 0) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="space-y-4 md:space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold">目標承認</h1>
              <Badge variant="secondary" className="text-sm">
                {totalPendingCount}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              <PeriodDisplay />
            </div>
          </div>

          {/* Empty State */}
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-lg font-semibold mb-2">承認待ちの目標はありません</h3>
            <p className="text-muted-foreground text-sm sm:text-base">
              現在、承認が必要な目標はありません。
            </p>
            <button
              onClick={loadGoalData}
              className="mt-4 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 underline"
            >
              データを再読み込み
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedGroup = groupedGoals.find(group => group.employee.id === selectedEmployeeId);

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="space-y-4 md:space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold">目標承認</h1>
            <Badge variant="secondary" className="text-sm">
              {totalPendingCount}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            <PeriodDisplay />
          </div>
        </div>

        {/* Guidelines */}
        <GuidelinesAlert />
        <ApprovalGuidelinesPanel />

        {/* Employee Navigation Tabs */}
        <Tabs value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
          <EmployeeTabNavigation
            groupedGoals={groupedGoals}
          />

          {/* Selected Employee Content */}
          {selectedGroup && (
            <TabsContent value={selectedEmployeeId} className="mt-4 md:mt-6">
              <div className="space-y-4 md:space-y-6">
                {/* Employee Info Header */}
                <EmployeeInfoHeader employee={selectedGroup.employee} />

                {/* Goals List */}
                <div className="space-y-4">
                  {selectedGroup.goals.map((goal) => (
                    <GoalApprovalCard
                      key={goal.id}
                      goal={goal}
                      employeeName={selectedGroup.employee.name}
                      onGoalUpdate={loadGoalData}
                    />
                  ))}
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}