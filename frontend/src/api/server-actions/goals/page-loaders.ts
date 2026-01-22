'use server';

import { getCurrentUserContextAction } from '../current-user-context';
import { getGoalsAction, getGoalsByIdsAction } from './queries';
import type { EmployeeGoalListPageData } from '../../types/page-loaders';
import type { UUID, UserDetailResponse } from '../../types';
import type { SupervisorGoalReviewPageData, SupervisorGoalReviewGroup } from '../../types/page-loaders';
import { getPendingSupervisorReviewsAction } from '../supervisor-reviews';
import { getSubordinatesAction, getUsersByIdsAction } from '../users';

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

    const supervisorId = currentUserContext.user?.id;
    let subordinateUsers: UserDetailResponse[] = [];
    if (supervisorId) {
      const subordinatesResult = await getSubordinatesAction(supervisorId);
      subordinateUsers = subordinatesResult.success && subordinatesResult.data?.items
        ? subordinatesResult.data.items
        : [];
    }

    const reviewsResult = await getPendingSupervisorReviewsAction({
      pagination: { limit: 200 },
      periodId: selectedPeriod.id,
      include: 'goal,subordinate',
    });

    if (!reviewsResult.success || !reviewsResult.data || !reviewsResult.data.items) {
      return {
        success: false,
        error: reviewsResult.error || '承認待ちの目標の読み込みに失敗しました',
      };
    }

    const reviews = reviewsResult.data.items;

    const goalIds = Array.from(new Set(reviews.map(r => r.goalId))).sort();
    const userIds = Array.from(new Set(reviews.map(r => r.subordinateId))).sort();

    const embeddedGoals = new Map(reviews.filter(r => r.goal).map(r => [r.goal!.id, r.goal!]));
    const embeddedUsers = new Map(reviews.filter(r => r.subordinate).map(r => [r.subordinate!.id, r.subordinate!]));

    const knownUserIds = new Set([...subordinateUsers.map(u => u.id), ...embeddedUsers.keys()]);
    const missingGoalIds = goalIds.filter(id => !embeddedGoals.has(id));
    const missingUserIds = userIds.filter(id => !knownUserIds.has(id));

    const [usersResult, goalsResult] = await Promise.all([
      missingUserIds.length > 0
        ? getUsersByIdsAction({
            userIds: missingUserIds,
            include: 'department,roles',
          })
        : Promise.resolve(
            ({ success: true, data: [], error: undefined }) satisfies Awaited<
              ReturnType<typeof getUsersByIdsAction>
            >,
          ),
      missingGoalIds.length > 0
        ? getGoalsByIdsAction({
            goalIds: missingGoalIds,
          })
        : Promise.resolve(
            ({ success: true, data: [], error: undefined }) satisfies Awaited<
              ReturnType<typeof getGoalsByIdsAction>
            >,
          ),
    ]);

    if (!usersResult.success) {
      return {
        success: false,
        error: usersResult.error || 'ユーザー情報の読み込みに失敗しました',
      };
    }

    if (!goalsResult.success) {
      return {
        success: false,
        error: goalsResult.error || '目標の読み込みに失敗しました',
      };
    }

    const resolvedUsers = usersResult.data ?? [];
    const resolvedGoals = goalsResult.data ?? [];

    const users = [...subordinateUsers, ...embeddedUsers.values(), ...resolvedUsers];
    const goals = [...embeddedGoals.values(), ...resolvedGoals];

    const userById = new Map(users.map(u => [u.id, u]));
    const goalById = new Map(goals.map(g => [g.id, g]));

    // Preserve subordinate order for a stable first selection.
    const groupedBySubordinate = new Map<string, SupervisorGoalReviewGroup>();

    for (const employee of subordinateUsers) {
      groupedBySubordinate.set(employee.id, {
        employee,
        goals: [],
        reviewsByGoalId: {},
      });
    }

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
          reviewsByGoalId: {},
        });
      }

      const group = groupedBySubordinate.get(review.subordinateId)!;
      group.goals.push(goal);
      group.reviewsByGoalId[review.goalId] = review;
    }

    const grouped = Array.from(groupedBySubordinate.values());
    const totalPendingCount = reviewsResult.data.total ?? reviews.length;

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
