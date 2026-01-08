import type {
  UUID,
  RatingCode,
  SupervisorFeedbackAction,
  SupervisorFeedbackStatus,
  PaginatedResponse,
} from './common';
import type { SelfAssessmentWithGoal } from './self-assessment';
import type { EvaluationPeriod } from './evaluation-period';
import type { UserProfileOption } from './user';

/**
 * Supervisor Feedback type definitions
 * These types match the backend Pydantic schemas for SupervisorFeedback-related operations
 * @see .kiro/specs/self-assessment/frontend-typescript-types.md
 */

/**
 * Base supervisor feedback fields (editable by supervisor)
 */
export interface SupervisorFeedbackBase {
  /** Supervisor's letter grade: SS, S, A+, A, A-, B, C, D */
  supervisorRatingCode?: RatingCode;
  /** Supervisor's feedback comment */
  supervisorComment?: string;
}

/**
 * Supervisor feedback entity (API response)
 * @see .kiro/specs/self-assessment/api-contract.md Section 5.1
 */
export interface SupervisorFeedback extends SupervisorFeedbackBase {
  /** Unique identifier */
  id: UUID;
  /** Reference to the self-assessment */
  selfAssessmentId: UUID;
  /** Reference to the evaluation period */
  periodId: UUID;
  /** Supervisor who created this feedback */
  supervisorId: UUID;
  /** Subordinate who created the self-assessment */
  subordinateId: UUID;
  /** Numeric rating (0.0-7.0), auto-calculated */
  supervisorRating?: number;
  /** Decision: PENDING, APPROVED, or REJECTED */
  action: SupervisorFeedbackAction;
  /** Workflow status: incomplete, draft, or submitted */
  status: SupervisorFeedbackStatus;
  /** Timestamp when feedback was submitted */
  submittedAt?: string;
  /** Timestamp when review was completed */
  reviewedAt?: string;
  /** Record creation timestamp */
  createdAt: string;
  /** Last modification timestamp */
  updatedAt: string;
}

/**
 * Detailed supervisor feedback with additional context
 * @see .kiro/specs/self-assessment/api-contract.md Section 5.3
 *
 * NOTE: Goal title/description should be extracted from selfAssessment.goal
 * using getGoalTitle() and getGoalDescription() helpers.
 * Period name should be extracted from evaluationPeriod.name.
 */
export interface SupervisorFeedbackDetail extends SupervisorFeedback {
  /** The self-assessment this feedback is for (includes goal) */
  selfAssessment?: SelfAssessmentWithGoal;
  /** The evaluation period this feedback belongs to */
  evaluationPeriod?: EvaluationPeriod;
  /** Whether this feedback can still be edited */
  isEditable: boolean;
  /** Whether this feedback is past the deadline */
  isOverdue: boolean;
  /** Days remaining until feedback deadline */
  daysUntilDeadline?: number;
  /** Subordinate who created the self-assessment */
  subordinate?: UserProfileOption;
  /** Supervisor providing the feedback */
  supervisor?: UserProfileOption;
}

/**
 * Request body for creating supervisor feedback
 * @see .kiro/specs/self-assessment/api-contract.md Section 5.2
 */
export interface SupervisorFeedbackCreate extends SupervisorFeedbackBase {
  /** Reference to the self-assessment */
  selfAssessmentId: UUID;
  /** Reference to the evaluation period */
  periodId: UUID;
  /** Initial action (usually PENDING) */
  action: SupervisorFeedbackAction;
  /** Initial status */
  status: SupervisorFeedbackStatus;
}

/**
 * Request body for updating supervisor feedback
 * @see .kiro/specs/self-assessment/api-contract.md Section 5.4
 */
export interface SupervisorFeedbackUpdate {
  /** Supervisor's letter grade */
  supervisorRatingCode?: RatingCode;
  /** Supervisor's feedback comment */
  supervisorComment?: string;
}

/**
 * Request body for submitting supervisor feedback (approve/reject)
 * @see .kiro/specs/self-assessment/api-contract.md Section 5.5
 */
export interface SupervisorFeedbackSubmit {
  /** Decision: APPROVED or REJECTED */
  action: 'APPROVED' | 'REJECTED';
  /** Rating code (required for APPROVED) */
  supervisorRatingCode?: RatingCode;
  /** Comment (required for REJECTED, optional for APPROVED) */
  supervisorComment?: string;
}

/**
 * Paginated list of supervisor feedbacks
 */
export interface SupervisorFeedbackList
  extends PaginatedResponse<SupervisorFeedback> {}

/**
 * Query parameters for fetching supervisor feedbacks
 */
export interface SupervisorFeedbackQueryParams {
  periodId?: UUID;
  supervisorId?: UUID;
  subordinateId?: UUID;
  status?: SupervisorFeedbackStatus;
  action?: SupervisorFeedbackAction;
  page?: number;
  limit?: number;
}
