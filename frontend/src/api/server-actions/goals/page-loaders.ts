'use server';

import { getCurrentUserContextAction } from '../current-user-context';
import { getGoalByIdAction, getGoalsAction } from './queries';
import type { EmployeeGoalListPageData } from '../../types/page-loaders';
import type { UUID } from '../../types';
import type { SupervisorGoalReviewPageData, SupervisorGoalReviewGroup } from '../../types/page-loaders';
import { getPendingSupervisorReviewsAction } from '../supervisor-reviews';
import { getUsersAction } from '../users';

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

export async function getSupervisorGoalReviewPageDataAction(
  params?: { periodId?: UUID },
): Promise<{ success: boolean; data?: SupervisorGoalReviewPageData; error?: string }> {
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

    const reviewsResult = await getPendingSupervisorReviewsAction({
      pagination: { limit: 200 },
      periodId: selectedPeriod.id,
    });

    const reviews = reviewsResult.success && reviewsResult.data?.items ? reviewsResult.data.items : [];

    if (!reviewsResult.success) {
      return {
        success: false,
        error: reviewsResult.error || '承認待ちレビューの読み込みに失敗しました',
      };
    }

    if (reviews.length === 0) {
      return {
        success: true,
        data: {
          currentUserContext,
          periods,
          selectedPeriod,
          grouped: [],
          totalPendingCount: 0,
        },
      };
    }

    const [usersResult, goalsResult] = await Promise.all([
      getUsersAction(),
      getGoalsAction({
        periodId: selectedPeriod.id,
        status: 'submitted',
        limit: 200,
      }),
    ]);

    if (!usersResult.success || !usersResult.data?.items) {
      return {
        success: false,
        error: usersResult.error || '従業員情報の読み込みに失敗しました',
      };
    }

    if (!goalsResult.success || !goalsResult.data?.items) {
      return {
        success: false,
        error: goalsResult.error || '目標の読み込みに失敗しました',
      };
    }

    const users = usersResult.data.items;
    const goals = goalsResult.data.items;

    const userById = new Map(users.map(u => [u.id, u]));
    const goalById = new Map(goals.map(g => [g.id, g]));

    const missingGoalIds = Array.from(new Set(
      reviews
        .map(r => r.goalId)
        .filter(goalId => !goalById.has(goalId)),
    ));

    if (missingGoalIds.length > 0) {
      const missingResults = await Promise.all(
        missingGoalIds.map(goalId => getGoalByIdAction(goalId)),
      );

      missingResults.forEach(result => {
        if (result.success && result.data) {
          goalById.set(result.data.id, result.data);
        }
      });
    }

    // Preserve review order for a stable first selection.
    const groupedBySubordinate = new Map<string, SupervisorGoalReviewGroup>();

    for (const review of reviews) {
      const employee = userById.get(review.subordinateId);
      const goal = goalById.get(review.goalId);

      if (!employee || !goal) continue;
      // Defensive: ensure review matches the goal owner.
      if (goal.userId !== review.subordinateId) continue;

      if (!groupedBySubordinate.has(review.subordinateId)) {
        groupedBySubordinate.set(review.subordinateId, {
          employee,
          goals: [],
          goalToReviewMap: {},
        });
      }

      const group = groupedBySubordinate.get(review.subordinateId)!;
      group.goals.push(goal);
      group.goalToReviewMap[review.goalId] = review.id;
    }

    const grouped = Array.from(groupedBySubordinate.values()).filter(g => g.goals.length > 0);
    const totalPendingCount = grouped.reduce((sum, g) => sum + g.goals.length, 0);

    return {
      success: true,
      data: {
        currentUserContext,
        periods,
        selectedPeriod,
        grouped,
        totalPendingCount,
      },
    };
  } catch (error) {
    console.error('Get supervisor goal review page data action error:', error);
    return {
      success: false,
      error: '目標承認ページの読み込み中に予期しないエラーが発生しました',
    };
  }
}
