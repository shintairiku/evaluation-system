import type { GoalResponse } from '@/api/types';

/**
 * Filter goals to return only latest versions (not superseded by resubmissions)
 *
 * A goal is superseded if another goal has it as previousGoalId.
 * This is used to show only the most recent version of each goal,
 * hiding previous rejected/resubmitted versions.
 *
 * @param goals - Array of goals to filter
 * @returns Array containing only goals that are not superseded by newer versions
 *
 * @example
 * ```typescript
 * // Goal #1 (rejected) -> Goal #2 (rejected) -> Goal #3 (approved)
 * // Only Goal #3 will be returned
 * const allGoals = [goal1, goal2, goal3];
 * const latestGoals = filterLatestGoals(allGoals); // [goal3]
 * ```
 */
export function filterLatestGoals(goals: GoalResponse[]): GoalResponse[] {
  // Build a Set of all goal IDs that have been superseded
  const supersededGoalIds = new Set(
    goals
      .map(g => g.previousGoalId)
      .filter((id): id is string => id !== null && id !== undefined)
  );

  // Return only goals that are NOT in the superseded set
  return goals.filter(goal => !supersededGoalIds.has(goal.id));
}
