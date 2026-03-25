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
