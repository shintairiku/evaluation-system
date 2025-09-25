'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { getGoalsAction } from '@/api/server-actions/goals';
import { getUsersAction } from '@/api/server-actions/users';
import type { GoalResponse, UserDetailResponse } from '@/api/types';
import { EmployeeTabNavigation } from '../components/EmployeeTabNavigation';
import { EmployeeInfoHeader } from '../components/EmployeeInfoHeader';
import { GoalApprovalCard } from '../components/GoalApprovalCard';

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

  useEffect(() => {
    loadGoalData();
  }, []);

  const loadGoalData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch pending goals
      const goalsResult = await getGoalsAction({
        status: 'pending_approval',
        limit: 100 // Reasonable limit for supervisor review
      });

      if (!goalsResult.success || !goalsResult.data) {
        throw new Error(goalsResult.error || 'Failed to load goals');
      }

      const pendingGoals = goalsResult.data.items || [];
      setTotalPendingCount(pendingGoals.length);

      if (pendingGoals.length === 0) {
        setGroupedGoals([]);
        return;
      }

      // Get unique user IDs from goals
      const userIds = [...new Set(pendingGoals.map(goal => goal.userId))];

      // Fetch user details
      const usersResult = await getUsersAction({
        limit: userIds.length
      });

      if (!usersResult.success || !usersResult.data) {
        throw new Error(usersResult.error || 'Failed to load user data');
      }

      const users = usersResult.data.items || [];

      // Group goals by employee
      const grouped: GroupedGoals[] = userIds.map(userId => {
        const employee = users.find(user => user.id === userId);
        const employeeGoals = pendingGoals.filter(goal => goal.userId === userId);

        return {
          employee: employee!,
          goals: employeeGoals,
          pendingCount: employeeGoals.length
        };
      }).filter(group => group.employee); // Filter out any missing employee data

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
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-muted-foreground">目標データを読み込み中...</p>
          </div>
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
              現在の評価期間: 2024年度
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
            現在の評価期間: 2024年度
          </div>
        </div>

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