import { UUID, PaginatedResponse } from './common';

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

export interface EvaluationPeriodListResponse {
  evaluation_periods: EvaluationPeriod[];
  total: number;
  page: number;
  size: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface EvaluationPeriodCreateRequest {
  name: string;
  startDate: string;
  endDate: string;
  description?: string;
}

export interface EvaluationPeriodUpdateRequest extends Partial<EvaluationPeriodCreateRequest> {
  status?: EvaluationPeriodStatus;
}

// Response for getting categorized evaluation periods
export interface CategorizedEvaluationPeriods {
  current: EvaluationPeriod | null;
  upcoming: EvaluationPeriod[];
  all: EvaluationPeriod[];
}