import type { UUID } from './common';

/**
 * Evaluation Period type definitions
 * These types match the backend Pydantic schemas for EvaluationPeriod-related operations
 */

export type EvaluationPeriodStatus = '準備中' | '実施中' | '完了';

export interface EvaluationPeriod {
  id: UUID;
  name: string;
  period_type: string;
  start_date: string; // ISO date string
  end_date: string; // ISO date string
  goal_submission_deadline: string;
  evaluation_deadline: string;
  status: EvaluationPeriodStatus;
  created_at: string;
  updated_at: string;
}

export interface EvaluationPeriodDetail extends EvaluationPeriod {
  description?: string;
  goals_count?: number;
  users_count?: number;
  completed_evaluations_count?: number;
}

export interface EvaluationPeriodCreate {
  name: string;
  period_type: string;
  start_date: string;
  end_date: string;
  goal_submission_deadline: string;
  evaluation_deadline: string;
  description?: string;
}

export interface EvaluationPeriodUpdate {
  name?: string;
  period_type?: string;
  start_date?: string;
  end_date?: string;
  goal_submission_deadline?: string;
  evaluation_deadline?: string;
  status?: EvaluationPeriodStatus;
  description?: string;
}

export interface EvaluationPeriodList {
  evaluation_periods: EvaluationPeriod[];
  total: number;
  page: number;
  size: number;
  has_next: boolean;
  has_prev: boolean;
}

// Response for getting categorized evaluation periods
export interface CategorizedEvaluationPeriods {
  current: EvaluationPeriod | null;
  upcoming: EvaluationPeriod[];
  all: EvaluationPeriod[];
}