export type UUID = string;

export enum SubmissionStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
}

/**
 * Self-Assessment status enum (4 states)
 * @see .kiro/specs/self-assessment/domain-model.md Section 5
 */
export enum SelfAssessmentStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * Letter grade rating codes
 * Maps to numeric values 0.0-7.0
 * @see .kiro/specs/self-assessment/domain-model.md Section 2.1
 */
export type RatingCode = 'SS' | 'S' | 'A+' | 'A' | 'A-' | 'B' | 'C' | 'D';

/**
 * Rating code to numeric value mapping
 */
export const RATING_CODE_VALUES: Record<RatingCode, number> = {
  SS: 7.0,
  S: 6.0,
  'A+': 5.0,
  A: 4.0,
  'A-': 3.0,
  B: 2.0,
  C: 1.0,
  D: 0.0,
};

/**
 * Rating code display labels (Japanese)
 */
export const RATING_CODE_LABELS: Record<RatingCode, string> = {
  SS: 'SS - 卓越',
  S: 'S - 優秀',
  'A+': 'A+ - 非常に良い+',
  A: 'A - 非常に良い',
  'A-': 'A- - 良い',
  B: 'B - 標準',
  C: 'C - 期待以下',
  D: 'D - 不十分',
};

/**
 * Supervisor feedback action enum
 */
export enum SupervisorFeedbackAction {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * Supervisor feedback workflow status enum
 */
export enum SupervisorFeedbackStatus {
  INCOMPLETE = 'incomplete',
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
}

export interface Permission {
  name: string;
  description: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  withCount?: boolean;
  /**
   * Optional comma-separated list of related entities to include.
   * Used by some v2 endpoints (e.g. users) to control eager loading.
   */
  include?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface BaseResponse {
  success: boolean;
  message?: string;
}

export interface ErrorResponse {
  error: boolean;
  message: string;
  status_code: number;
}

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  version: string;
}
