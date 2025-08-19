import { UUID, PaginatedResponse } from './common';

export type GoalStatus = 'incomplete' | 'draft' | 'pending_approval' | 'approved' | 'rejected';
export type PerformanceGoalType = 'quantitative' | 'qualitative';

export interface GoalBase {
  periodId: UUID;
  goalCategory: string; // "業績目標" | "コンピテンシー" | "コアバリュー"
  weight: number; // 0-100
  status: GoalStatus; // 'draft' | 'pending_approval'
}

// Performance goal specific fields
export interface PerformanceGoalFields {
  title: string;
  performanceGoalType: PerformanceGoalType;
  specificGoalText: string;
  achievementCriteriaText: string;
  meansMethodsText: string;
}

// Competency goal specific fields
export interface CompetencyGoalFields {
  competencyId: UUID;
  actionPlan: string;
}

// Core value goal specific fields (not used in this flow but included for completeness)
export interface CoreValueGoalFields {
  coreValuePlan: string;
}

export type GoalCreateRequest =
  | (GoalBase & { goalCategory: '業績目標' } & PerformanceGoalFields)
  | (GoalBase & { goalCategory: 'コンピテンシー' } & CompetencyGoalFields)
  | (GoalBase & { goalCategory: 'コアバリュー' } & CoreValueGoalFields);

export interface GoalResponse {
  id: UUID;
  userId: UUID;
  periodId: UUID;
  goalCategory: string;
  weight: number;
  status: GoalStatus;
  approvedBy?: UUID | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;

  // Performance fields (when goalCategory is "業績目標")
  title?: string;
  performanceGoalType?: PerformanceGoalType;
  specificGoalText?: string;
  achievementCriteriaText?: string;
  meansMethodsText?: string;

  // Competency fields (when goalCategory is "コンピテンシー")
  competencyId?: UUID;
  competencyName?: string;
  actionPlan?: string;

  // Core value fields (when goalCategory is "コアバリュー")
  coreValuePlan?: string;
}

export interface GoalListResponse extends PaginatedResponse<GoalResponse> {}


