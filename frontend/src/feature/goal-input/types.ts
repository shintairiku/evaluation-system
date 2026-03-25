import type { PerformanceGoalType } from '@/api/types/goal';

export interface StageWeightBudget {
  quantitative: number;
  qualitative: number;
  competency: number;
  stageName?: string;
}

export const DEFAULT_STAGE_WEIGHT_BUDGET: StageWeightBudget = {
  quantitative: 70,
  qualitative: 30,
  competency: 10,
};

export const DEFAULT_ACHIEVEMENT_CRITERIA_QUANTITATIVE = [
  'SS：',
  'S：',
  'A：',
  'B：',
  'C：',
  'D：',
].join('\n');

export const DEFAULT_ACHIEVEMENT_CRITERIA_QUALITATIVE = [
  'SS：',
  'S：',
  'A：',
  'B：',
  'C：',
].join('\n');

export const getDefaultAchievementCriteria = (type: PerformanceGoalType) => {
  return type === 'qualitative'
    ? DEFAULT_ACHIEVEMENT_CRITERIA_QUALITATIVE
    : DEFAULT_ACHIEVEMENT_CRITERIA_QUANTITATIVE;
};

// Read-only goal types for displaying submitted/approved goals alongside editable ones
export interface ReadOnlyPerformanceGoal {
  id: string;
  status: 'submitted' | 'approved';
  type: 'quantitative' | 'qualitative';
  title: string;
  specificGoal: string;
  achievementCriteria: string;
  method: string;
  weight: number;
}

export interface ReadOnlyCompetencyGoal {
  id: string;
  status: 'submitted' | 'approved';
  competencyIds?: string[] | null;
  selectedIdealActions?: Record<string, string[]> | null;
  actionPlan: string;
}

export interface ReadOnlyGoals {
  performanceGoals: ReadOnlyPerformanceGoal[];
  competencyGoals: ReadOnlyCompetencyGoal[];
}

/**
 * Compute effective budgets by subtracting read-only goal weights from stage budgets.
 * Used to determine remaining budget available for new editable goals.
 */
export function computeEffectiveBudgets(
  stageBudgets: StageWeightBudget,
  readOnlyGoals: ReadOnlyGoals | null
): StageWeightBudget {
  if (!readOnlyGoals) return stageBudgets;
  const roQuantWeight = readOnlyGoals.performanceGoals
    .filter(g => g.type === 'quantitative').reduce((sum, g) => sum + g.weight, 0);
  const roQualWeight = readOnlyGoals.performanceGoals
    .filter(g => g.type === 'qualitative').reduce((sum, g) => sum + g.weight, 0);
  return {
    quantitative: Math.max(0, stageBudgets.quantitative - roQuantWeight),
    qualitative: Math.max(0, stageBudgets.qualitative - roQualWeight),
    competency: readOnlyGoals.competencyGoals.length > 0 ? 0 : stageBudgets.competency,
    stageName: stageBudgets.stageName,
  };
}

/**
 * Check if the competency step can proceed.
 * Mirrors the pattern from PerformanceGoalsStep.canProceed.
 */
export function canProceedCompetency(
  actionPlan: string,
  goalId: string | undefined,
  goalTracking: { isGoalDirty: (id: string) => boolean } | undefined,
  isAutoSaving: boolean
): boolean {
  const isTemporaryGoalId = (id: string) => /^\d+$/.test(id);
  const hasActionPlan = actionPlan.trim() !== '';
  const hasTemporaryId = goalId ? isTemporaryGoalId(goalId) : true;
  const hasUnsavedChanges = goalId ? (goalTracking?.isGoalDirty(goalId) ?? false) : false;
  const autoSaveInFlight = !!isAutoSaving;
  return hasActionPlan && !hasTemporaryId && !hasUnsavedChanges && !autoSaveInFlight;
}
