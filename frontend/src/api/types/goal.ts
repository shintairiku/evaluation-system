import { UUID, PaginatedResponse } from './common';
import type { SupervisorReview } from './supervisor-review';

export type GoalStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type PerformanceGoalType = 'quantitative' | 'qualitative';

export interface GoalBase {
  periodId: UUID;
  goalCategory: string; // "業績目標" | "コンピテンシー" 
  weight: number; // 0-100
  status: GoalStatus;
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
  competencyIds?: UUID[] | null;
  selectedIdealActions?: Record<string, string[]> | null;
  actionPlan: string;
}


export type GoalCreateRequest =
  | (GoalBase & { goalCategory: '業績目標' } & PerformanceGoalFields)
  | (GoalBase & { goalCategory: 'コンピテンシー' } & CompetencyGoalFields);

// Performance goal update fields - all optional since it's an update
export interface PerformanceGoalUpdateFields {
  title?: string;
  performanceGoalType?: PerformanceGoalType;
  specificGoalText?: string;
  achievementCriteriaText?: string;
  meansMethodsText?: string;
}

// Competency goal update fields - all optional since it's an update
export interface CompetencyGoalUpdateFields {
  competencyIds?: UUID[] | null;
  selectedIdealActions?: Record<string, string[]> | null;
  actionPlan?: string;
}

export type GoalUpdateRequest =
  | ({ weight?: number } & PerformanceGoalUpdateFields)
  | ({ weight?: number } & CompetencyGoalUpdateFields);

export interface GoalResponse {
  id: UUID;
  userId: UUID;
  periodId: UUID;
  goalCategory: string;
  weight: number;
  status: GoalStatus;
  approvedBy?: UUID | null;
  approvedAt?: string | null;
  previousGoalId?: UUID | null;
  createdAt: string;
  updatedAt: string;

  // Performance fields (when goalCategory is "業績目標")
  title?: string;
  performanceGoalType?: PerformanceGoalType;
  specificGoalText?: string;
  achievementCriteriaText?: string;
  meansMethodsText?: string;

  // Competency fields (when goalCategory is "コンピテンシー")
  competencyIds?: UUID[] | null;
  selectedIdealActions?: Record<string, string[]> | null;
  actionPlan?: string;

  // Performance optimization: Embedded reviews (populated when includeReviews=true)
  supervisorReview?: SupervisorReview | null;
  rejectionHistory?: SupervisorReview[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GoalListResponse extends PaginatedResponse<GoalResponse> {}


