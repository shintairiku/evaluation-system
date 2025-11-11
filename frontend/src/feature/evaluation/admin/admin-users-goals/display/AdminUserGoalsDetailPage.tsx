'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { EmployeeInfoCard } from '@/components/evaluation/EmployeeInfoCard';
import { AdminGoalListTable } from '../../admin-goal-list/components/AdminGoalListTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Target, Users, ListChecks } from 'lucide-react';
import { getAdminGoalsAction } from '@/api/server-actions/goals';
import { getUsersAction } from '@/api/server-actions/users';
import type { GoalResponse, UserDetailResponse } from '@/api/types';

interface AdminUserGoalsDetailPageProps {
  userId: string;
  periodId?: string;
}

/**
 * Detail page showing all goals for a specific user
 *
 * Features:
 * - Shows user info card
 * - Displays goal summary stats (total, by category, by status)
 * - Shows all user's goals in table format
 * - Back button to return to user list
 *
 * Reuses:
 * - EmployeeInfoCard for user details
 * - AdminGoalListTable for goal list (filtered to this user)
 */
export default function AdminUserGoalsDetailPage({
  userId,
  periodId,
}: AdminUserGoalsDetailPageProps) {
  const router = useRouter();
  const [user, setUser] = useState<UserDetailResponse | null>(null);
  const [goals, setGoals] = useState<GoalResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load user data and goals
   */
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);

        // Load user info and goals in parallel
        const [usersResult, goalsResult] = await Promise.all([
          getUsersAction(),
          getAdminGoalsAction({
            userId,
            periodId,
            includeReviews: true,
          }),
        ]);

        // Set user data
        if (usersResult.success && usersResult.data?.items) {
          const foundUser = usersResult.data.items.find(u => u.id === userId);
          if (foundUser) {
            setUser(foundUser);
          } else {
            setError('ユーザーが見つかりません');
            return;
          }
        }

        // Set goals data
        if (goalsResult.success && goalsResult.data?.items) {
          setGoals(goalsResult.data.items);
        } else {
          setError(goalsResult.error || '目標の読み込みに失敗しました');
        }
      } catch (err) {
        console.error('Error loading user goals detail:', err);
        setError('予期しないエラーが発生しました');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [userId, periodId]);

  /**
   * Calculate goal summary statistics
   */
  const goalStats = useMemo(() => {
    const total = goals.length;
    const competency = goals.filter(g => g.goalCategory === 'competency').length;
    const team = goals.filter(g => g.goalCategory === 'team').length;
    const individual = goals.filter(g => g.goalCategory === 'individual').length;

    const draft = goals.filter(g => g.status === 'draft').length;
    const submitted = goals.filter(g => g.status === 'submitted').length;
    const approved = goals.filter(g => g.status === 'approved').length;
    const rejected = goals.filter(g => g.status === 'rejected').length;

    return {
      total,
      competency,
      team,
      individual,
      draft,
      submitted,
      approved,
      rejected,
    };
  }, [goals]);

  /**
   * Create user map for AdminGoalListTable
   */
  const userMap = useMemo(() => {
    if (!user) return new Map();
    return new Map([
      [
        user.id,
        {
          name: user.name,
          departmentName: user.department?.name,
          supervisorName: user.supervisor?.name,
        },
      ],
    ]);
  }, [user]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error || 'ユーザーが見つかりません'}</p>
          <Button onClick={() => router.push('/admin-goal-list')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            一覧に戻る
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.push('/admin-goal-list')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          戻る
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{user.name}の目標</h1>
          <p className="text-sm text-muted-foreground">目標設定状況の詳細</p>
        </div>
      </div>

      {/* Employee Info Card (REUSE) */}
      <EmployeeInfoCard employee={user} />

      {/* Goal Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Goals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">合計目標</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{goalStats.total}</div>
          </CardContent>
        </Card>

        {/* Competency Goals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">コンピテンシー</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{goalStats.competency}</div>
          </CardContent>
        </Card>

        {/* Team Goals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">チーム目標</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{goalStats.team}</div>
          </CardContent>
        </Card>

        {/* Individual Goals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">個人目標</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{goalStats.individual}</div>
          </CardContent>
        </Card>
      </div>

      {/* Status Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">ステータス内訳</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">下書き:</span>{' '}
              <span className="font-semibold">{goalStats.draft}</span>
            </div>
            <div>
              <span className="text-muted-foreground">提出済み:</span>{' '}
              <span className="font-semibold">{goalStats.submitted}</span>
            </div>
            <div>
              <span className="text-muted-foreground">承認済み:</span>{' '}
              <span className="font-semibold text-green-600">{goalStats.approved}</span>
            </div>
            <div>
              <span className="text-muted-foreground">差し戻し:</span>{' '}
              <span className="font-semibold text-destructive">{goalStats.rejected}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goals Table (REUSE AdminGoalListTable) */}
      <div className="bg-card border rounded-lg">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">目標一覧</h2>
        </div>
        <AdminGoalListTable goals={goals} userMap={userMap} isLoading={false} />
      </div>
    </div>
  );
}
