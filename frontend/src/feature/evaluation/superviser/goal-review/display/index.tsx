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

  useEffect(() => {
    loadGoalData();
  }, []);

  const loadGoalData = async () => {
    try {
      setLoading(true);
      setError(null);

      // FAKE DATA FOR TESTING
      const fakeUsers: UserDetailResponse[] = [
        {
          id: 'user-1',
          clerk_user_id: 'clerk_1',
          name: '田中 太郎',
          email: 'tanaka@company.com',
          employee_code: 'EMP001',
          job_title: 'シニアエンジニア',
          status: 'active',
          department: {
            id: 'dept-1',
            name: 'エンジニアリング部',
            description: 'システム開発部門',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01'
          },
          roles: [{
            id: 'role-1',
            name: 'エンジニア',
            description: 'システム開発者',
            permissions: [],
            hierarchy_level: 3,
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01'
          }],
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01'
        },
        {
          id: 'user-2',
          clerk_user_id: 'clerk_2',
          name: '佐藤 花子',
          email: 'sato@company.com',
          employee_code: 'EMP002',
          job_title: 'マーケティングスペシャリスト',
          status: 'active',
          department: {
            id: 'dept-2',
            name: 'マーケティング部',
            description: 'マーケティング戦略部門',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01'
          },
          roles: [{
            id: 'role-2',
            name: 'マーケター',
            description: 'マーケティング担当者',
            permissions: [],
            hierarchy_level: 3,
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01'
          }],
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01'
        }
      ];

      const fakeGoals: GoalResponse[] = [
        {
          id: 'goal-1',
          userId: 'user-1',
          periodId: 'period-2024',
          goalCategory: '業績目標',
          title: 'React Nativeアプリのパフォーマンス向上',
          specificGoalText: 'モバイルアプリの読み込み時間を現在の3秒から1.5秒以下に短縮し、ユーザー満足度を向上させる。',
          achievementCriteriaText: '・アプリ起動時間: 3秒 → 1.5秒以下\n・画面遷移時間: 500ms以下を維持\n・ユーザー満足度調査で4.0以上（5点満点）を達成',
          meansMethodsText: '・コード分割とレイジーローディングの実装\n・画像最適化とキャッシュ戦略の見直し\n・不要な依存関係の削除\n・ネイティブモジュールの活用検討',
          performanceGoalType: 'quantitative',
          weight: 40,
          status: 'pending_approval',
          user: fakeUsers[0],
          createdAt: '2024-09-20T10:30:00Z',
          updatedAt: '2024-09-20T10:30:00Z'
        },
        {
          id: 'goal-2',
          userId: 'user-1',
          periodId: 'period-2024',
          goalCategory: 'コンピテンシー',
          competencyIds: ['comp-1', 'comp-2'],
          selectedIdealActions: {
            'チームワーク': [
              'チームメンバーとの定期的な技術共有を行う',
              'コードレビューで建設的なフィードバックを提供する'
            ],
            'リーダーシップ': [
              '新人エンジニアのメンタリングを担当する',
              '技術勉強会の企画・運営を行う'
            ]
          },
          actionPlan: '月1回の技術勉強会を企画し、チーム全体のスキル向上を図る。新人エンジニア2名のメンタリングを通じて、自身のリーダーシップスキルも向上させる。',
          weight: 30,
          status: 'pending_approval',
          user: fakeUsers[0],
          createdAt: '2024-09-20T11:00:00Z',
          updatedAt: '2024-09-20T11:00:00Z'
        },
        {
          id: 'goal-3',
          userId: 'user-2',
          periodId: 'period-2024',
          goalCategory: '業績目標',
          title: 'ブランド認知度向上キャンペーン',
          specificGoalText: 'SNSマーケティングキャンペーンを通じて、ブランド認知度を現在の15%から25%に向上させる。',
          achievementCriteriaText: '・ブランド認知度調査で25%以上を達成\n・SNSフォロワー数を30%増加\n・エンゲージメント率3%以上を維持',
          meansMethodsText: '・インフルエンサーマーケティングの活用\n・ターゲット層に合わせたコンテンツ制作\n・A/Bテストによる広告効果の最適化\n・月次効果測定と戦略調整',
          performanceGoalType: 'quantitative',
          weight: 50,
          status: 'pending_approval',
          user: fakeUsers[1],
          createdAt: '2024-09-21T09:15:00Z',
          updatedAt: '2024-09-21T09:15:00Z'
        }
      ];

      setTotalPendingCount(fakeGoals.length);

      // Group goals by employee
      const grouped: GroupedGoals[] = fakeUsers.map(user => {
        const userGoals = fakeGoals.filter(goal => goal.userId === user.id);
        return {
          employee: user,
          goals: userGoals,
          pendingCount: userGoals.length
        };
      }).filter(group => group.goals.length > 0);

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