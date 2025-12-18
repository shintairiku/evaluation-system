'use server';

import { getCurrentUserContextAction } from '../current-user-context';
import { getGoalsAction } from './queries';
import type { EmployeeGoalListPageData } from '../../types/page-loaders';
import type { UUID } from '../../types';

export async function getEmployeeGoalListPageDataAction(
  params?: { periodId?: UUID },
): Promise<{ success: boolean; data?: EmployeeGoalListPageData; error?: string }> {
  try {
    const currentUserContext = await getCurrentUserContextAction();
    const periods = currentUserContext.periods;
    const allPeriods = periods?.all ?? [];

    const selectedPeriod = params?.periodId
      ? allPeriods.find(p => p.id === params.periodId) ?? null
      : currentUserContext.currentPeriod ?? periods?.current ?? null;

    if (!selectedPeriod) {
      return {
        success: false,
        error: params?.periodId ? '選択された評価期間が見つかりません' : '評価期間が設定されていません',
      };
    }

    const goalsResult = await getGoalsAction({
      periodId: selectedPeriod.id,
      userId: currentUserContext.user?.id,
      limit: 100,
      includeReviews: true,
      includeRejectionHistory: true,
    });

    if (!goalsResult.success || !goalsResult.data?.items) {
      return {
        success: false,
        error: goalsResult.error || '目標の読み込みに失敗しました',
      };
    }

    const goals = goalsResult.data.items;

    // Rejected goals are sometimes replaced by a new draft copy (linked via previousGoalId).
    // Only hide rejected goals that already have a replacement draft; otherwise keep them visible
    // so the employee can review rejection details and take action.
    const replacedRejectedGoalIds = new Set(
      goals
        .filter(goal => goal.status === 'draft' && Boolean(goal.previousGoalId))
        .map(goal => goal.previousGoalId as UUID),
    );

    const displayGoals = goals.filter(
      goal => !(goal.status === 'rejected' && replacedRejectedGoalIds.has(goal.id)),
    );

    const rejectedGoalsCount = goals.filter(
      goal => goal.status === 'draft' && Boolean(goal.previousGoalId),
    ).length;

    return {
      success: true,
      data: {
        currentUserContext,
        periods,
        selectedPeriod,
        goals: displayGoals,
        rejectedGoalsCount,
      },
    };
  } catch (error) {
    console.error('Get employee goal list page data action error:', error);
    return {
      success: false,
      error: '目標一覧の読み込み中に予期しないエラーが発生しました',
    };
  }
}
