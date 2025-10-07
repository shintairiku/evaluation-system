import type { UUID } from './common';

/**
 * Evaluation Period type definitions
 * These types match the backend Pydantic schemas for EvaluationPeriod-related operations
 */

export type EvaluationPeriodStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export type PeriodType = '半期' | '月次' | '四半期' | '年次' | 'その他';

export const PERIOD_TYPE_LABELS: Record<PeriodType, string> = {
  '半期': '半期',
  '月次': '月次',
  '四半期': '四半期',
  '年次': '年次',
  'その他': 'その他'
};

export interface EvaluationPeriod {
  id: UUID;
  name: string;
  period_type: PeriodType;
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
  period_type: PeriodType;
  start_date: string;
  end_date: string;
  goal_submission_deadline: string;
  evaluation_deadline: string;
  description?: string;
}

export interface EvaluationPeriodUpdate {
  name?: string;
  period_type?: PeriodType;
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

// Goal Statistics interfaces
export interface UserActivity {
  user_id: UUID;
  user_name: string;
  employee_code: string;
  user_role: string;
  department_name: string;
  subordinate_name?: string;
  supervisor_name?: string;
  last_goal_submission?: string | Date; // ISO date string or Date object
  last_review_submission?: string | Date; // ISO date string or Date object
  goal_count: number;
  goal_statuses: Record<string, number>;
}

export interface GoalStatistics {
  period_id: UUID;
  total: number;
  by_status: Record<string, number>;
  user_activities: UserActivity[];
}

// Form data interface for create/edit modals
export interface EvaluationPeriodFormData {
  name: string;
  period_type: PeriodType;
  start_date: string; // ISO date string
  end_date: string;
  goal_submission_deadline: string;
  evaluation_deadline: string;
  description?: string;
}