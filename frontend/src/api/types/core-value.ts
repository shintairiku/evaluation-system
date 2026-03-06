/**
 * Core Value Evaluation type definitions
 * These types match the backend Pydantic schemas for CoreValue-related operations
 */

/**
 * Core value rating codes (7-level scale)
 * Different from goal RatingCode which has 6 levels
 */
export type CoreValueRatingCode = 'SS' | 'S' | 'A+' | 'A' | 'A-' | 'B' | 'C';

/**
 * Ordered list of core value rating codes (highest to lowest)
 */
export const CORE_VALUE_RATING_CODES: CoreValueRatingCode[] = [
  'SS', 'S', 'A+', 'A', 'A-', 'B', 'C',
];

/**
 * Core value rating code to numeric value mapping (7-level scale)
 */
export const CORE_VALUE_RATING_VALUES: Record<CoreValueRatingCode, number> = {
  'SS': 7.0,
  'S': 6.0,
  'A+': 5.0,
  'A': 4.0,
  'A-': 3.0,
  'B': 2.0,
  'C': 1.0,
};

/**
 * Core value rating code display labels (Japanese)
 */
export const CORE_VALUE_RATING_LABELS: Record<CoreValueRatingCode, string> = {
  'SS': 'SS - 卓越',
  'S': 'S - 優秀',
  'A+': 'A+ - 非常に良い',
  'A': 'A - 良好',
  'A-': 'A- - やや良好',
  'B': 'B - 標準',
  'C': 'C - 要改善',
};

// ============================================================
// Status / Action types
// ============================================================

export type CoreValueEvaluationStatus = 'draft' | 'submitted' | 'approved';
export type CoreValueFeedbackStatus = 'incomplete' | 'draft' | 'submitted';
export type CoreValueFeedbackAction = 'PENDING' | 'APPROVED';

// ============================================================
// Definition
// ============================================================

export interface CoreValueDefinition {
  id: string;
  organizationId: string;
  displayOrder: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Evaluation (employee self-evaluation)
// ============================================================

export interface CoreValueEvaluation {
  id: string;
  periodId: string;
  userId: string;
  /** Map of core value definition ID to rating code (e.g. { "uuid": "A+" }) */
  scores: Record<string, string> | null;
  comment: string | null;
  status: CoreValueEvaluationStatus;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoreValueEvaluationUpdate {
  scores?: Record<string, string>;
  comment?: string;
}

// ============================================================
// Feedback (supervisor)
// ============================================================

export interface CoreValueFeedback {
  id: string;
  coreValueEvaluationId: string;
  periodId: string;
  supervisorId: string;
  subordinateId: string | null;
  scores: Record<string, string> | null;
  comment: string | null;
  returnComment: string | null;
  action: CoreValueFeedbackAction;
  status: CoreValueFeedbackStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoreValueFeedbackUpdate {
  scores?: Record<string, string>;
  comment?: string;
}

export interface CoreValueFeedbackSubmit {
  action: 'APPROVED';
  scores?: Record<string, string>;
  comment?: string;
}

export interface CoreValueFeedbackReturn {
  returnComment: string;
}

// ============================================================
// Combined subordinate response
// ============================================================

export interface CoreValueSubordinateData {
  evaluation: CoreValueEvaluation | null;
  feedback: CoreValueFeedback | null;
}
