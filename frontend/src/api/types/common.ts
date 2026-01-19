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
 * Individual goal rating codes (User Input Scale - 6 levels)
 * Used when user evaluates each individual goal
 * @see .kiro/specs/self-assessment/domain-model.md Section 4.2
 */
export type RatingCode = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';

/**
 * Final calculated rating codes (System Output Scale - 8 levels)
 * Includes intermediate grades A+, A- for precise final evaluation
 * Used for overall period performance rating
 */
export type FinalRatingCode = 'SS' | 'S' | 'A+' | 'A' | 'A-' | 'B' | 'C' | 'D';

/**
 * Qualitative goal rating codes (no D grade)
 * Used for 定性目標 assessments
 */
export type QualitativeRatingCode = 'SS' | 'S' | 'A' | 'B' | 'C';

/**
 * Quantitative goal rating codes (includes D grade)
 * Used for 定量目標 assessments
 */
export type QuantitativeRatingCode = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';

/**
 * Individual rating code to numeric value mapping (6-level scale)
 */
export const RATING_CODE_VALUES: Record<RatingCode, number> = {
  SS: 7.0,
  S: 6.0,
  A: 4.0,
  B: 2.0,
  C: 1.0,
  D: 0.0,
};

/**
 * Final rating code to numeric value mapping (8-level scale)
 */
export const FINAL_RATING_CODE_VALUES: Record<FinalRatingCode, number> = {
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
 * Rating code display labels (Japanese) - 6-level scale
 */
export const RATING_CODE_LABELS: Record<RatingCode, string> = {
  SS: 'SS - 卓越',
  S: 'S - 優秀',
  A: 'A - 良好',
  B: 'B - 標準',
  C: 'C - 要改善',
  D: 'D - 不十分',
};

/**
 * Final rating code display labels (Japanese) - 8-level scale
 */
export const FINAL_RATING_CODE_LABELS: Record<FinalRatingCode, string> = {
  SS: 'SS - 卓越',
  S: 'S - 優秀',
  'A+': 'A+ - 非常に良い',
  A: 'A - 良好',
  'A-': 'A- - やや良好',
  B: 'B - 標準',
  C: 'C - 要改善',
  D: 'D - 不十分',
};

/**
 * Rating codes for qualitative goals (定性目標)
 * Does not include 'D' grade
 */
export const QUALITATIVE_RATING_CODES: QualitativeRatingCode[] = ['SS', 'S', 'A', 'B', 'C'];

/**
 * Rating codes for quantitative goals (定量目標)
 * Includes all grades including 'D'
 */
export const QUANTITATIVE_RATING_CODES: QuantitativeRatingCode[] = ['SS', 'S', 'A', 'B', 'C', 'D'];

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
