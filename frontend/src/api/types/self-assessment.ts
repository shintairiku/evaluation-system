import type {
  UUID,
  RatingCode,
  SelfAssessmentStatus,
  SupervisorFeedbackAction,
  PaginatedResponse,
} from './common';
import type { GoalResponse } from './goal';
import type { EvaluationPeriod } from './evaluation-period';
import type { UserProfileOption } from './user';

/**
 * Self Assessment type definitions
 * These types match the backend Pydantic schemas for SelfAssessment-related operations
 * @see .kiro/specs/self-assessment/frontend-typescript-types.md
 */

/**
 * Base self-assessment fields (editable by employee)
 */
export interface SelfAssessmentBase {
  /** Letter grade: SS, S, A+, A, A-, B, C, D */
  selfRatingCode?: RatingCode;
  /** Employee's narrative self-assessment comment */
  selfComment?: string;
}

/**
 * Self-assessment entity (API response)
 * @see .kiro/specs/self-assessment/api-contract.md Section 4.1
 */
export interface SelfAssessment extends SelfAssessmentBase {
  /** Unique identifier */
  id: UUID;
  /** Reference to the goal being assessed */
  goalId: UUID;
  /** Reference to the evaluation period */
  periodId: UUID;
  /** Reference to previous self-assessment (for rejection history) */
  previousSelfAssessmentId?: UUID;
  /** Numeric rating (0.0-7.0), auto-calculated from selfRatingCode */
  selfRating?: number;
  /** Current status: draft, submitted, approved, or rejected */
  status: SelfAssessmentStatus;
  /** Timestamp when assessment was submitted */
  submittedAt?: string;
  /** Record creation timestamp */
  createdAt: string;
  /** Last modification timestamp */
  updatedAt: string;
}

/**
 * Detailed self-assessment with additional context
 * Used for single item views (GET /self-assessments/:id)
 * @see .kiro/specs/self-assessment/api-contract.md Section 4.4
 *
 * NOTE: Goal title should be extracted using getGoalTitle() helper:
 * - Performance goals: use goal.title
 * - Competency goals: use competency names or fallback
 */
export interface SelfAssessmentDetail extends SelfAssessment {
  // Assessment state information
  /** Whether this assessment can still be edited */
  isEditable: boolean;
  /** Whether this assessment is past the deadline */
  isOverdue: boolean;
  /** Days remaining until assessment deadline */
  daysUntilDeadline?: number;

  // Goal context (convenience fields, extracted from goal relationship)
  /** Category of the goal being assessed (e.g., '業績目標', 'コンピテンシー') */
  goalCategory?: string;
  /** Current status of the goal */
  goalStatus?: string;

  // Embedded relationships
  /** The goal being assessed - use getGoalTitle() helper to extract title */
  goal?: GoalResponse;
  /** The evaluation period this assessment belongs to */
  evaluationPeriod?: EvaluationPeriod;
  /** The employee who owns this assessment */
  employee?: UserProfileOption;
}

/**
 * Self-assessment with embedded goal information (for list views)
 * Goal title should be extracted using getGoalTitle() helper
 */
export interface SelfAssessmentWithGoal extends SelfAssessment {
  goal: GoalResponse;
}

/**
 * Request body for updating a self-assessment
 * @see .kiro/specs/self-assessment/api-contract.md Section 4.5
 */
export interface SelfAssessmentUpdate {
  /** Letter grade: SS, S, A+, A, A-, B, C, D */
  selfRatingCode?: RatingCode;
  /** Employee's narrative self-assessment comment */
  selfComment?: string;
}

/**
 * Paginated list of self-assessments
 * @see .kiro/specs/self-assessment/api-contract.md Section 4.1
 */
export interface SelfAssessmentList extends PaginatedResponse<SelfAssessment> {}

/**
 * Query parameters for fetching self-assessments
 */
export interface SelfAssessmentQueryParams {
  periodId?: UUID;
  userId?: UUID;
  status?: SelfAssessmentStatus;
  goalCategory?: string;
  page?: number;
  limit?: number;
}

/**
 * Rejection history item (for history chain display)
 * @see .kiro/specs/self-assessment/api-contract.md Section 4.8
 */
export interface SelfAssessmentHistoryItem {
  id: UUID;
  status: SelfAssessmentStatus;
  selfRatingCode?: RatingCode;
  selfComment?: string;
  previousSelfAssessmentId?: UUID;
  submittedAt?: string;
  /** Supervisor's comment (from SupervisorFeedback) */
  supervisorComment?: string;
  /** Supervisor's action (from SupervisorFeedback) */
  supervisorAction?: SupervisorFeedbackAction;
}

/**
 * Rejection history response
 */
export interface SelfAssessmentHistory {
  items: SelfAssessmentHistoryItem[];
  total: number;
}
