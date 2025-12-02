import type { UUID, SubmissionStatus } from './common';

/**
 * Self Assessment type definitions
 * These types match the API contract defined in:
 * .kiro/specs/self-assessment-ui-mock/02-api-contract.md
 */

// ============================================================================
// LEGACY TYPES (kept for backward compatibility)
// ============================================================================

export interface SelfAssessmentBase {
  selfRating?: number; // 0-100
  selfComment?: string;
}

export interface SelfAssessment extends SelfAssessmentBase {
  id: UUID;
  goalId: UUID;
  periodId: UUID;
  status: SubmissionStatus;
  submittedAt?: string; // ISO date string
  createdAt: string;
  updatedAt: string;
}

export interface SelfAssessmentDetail extends SelfAssessment {
  // Assessment state information
  isEditable: boolean;
  isOverdue: boolean;
  daysUntilDeadline?: number;

  // Goal context
  goalCategory?: string;
  goalStatus?: string;

  // Related information (optional, may be populated by backend)
  goal?: unknown; // Avoid circular import
  evaluationPeriod?: unknown; // Avoid circular import
  employee?: unknown; // Avoid circular import
}

export interface SelfAssessmentCreate extends SelfAssessmentBase {
  status: SubmissionStatus; // 'draft' or 'submitted'
}

export interface SelfAssessmentUpdate {
  selfRating?: number; // 0-100
  selfComment?: string;
  status?: SubmissionStatus;
}

export interface SelfAssessmentList {
  items: SelfAssessment[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ============================================================================
// NEW SELF-ASSESSMENT API TYPES (from API contract)
// ============================================================================

/**
 * Rating codes used for self-assessment
 */
export type RatingCode = 'SS' | 'S' | 'A+' | 'A' | 'A-' | 'B' | 'C' | 'D';

/**
 * Bucket types for goal categories
 */
export type BucketType = 'quantitative' | 'qualitative' | 'competency';

/**
 * Self-assessment status
 */
export type SelfAssessmentStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

/**
 * Stage weights for goal category distribution
 */
export interface StageWeights {
  quantitative: number; // 0-100
  qualitative: number;  // 0-100
  competency: number;   // 0-100
}

/**
 * Draft entry for a single goal (used for auto-save and submission)
 */
export interface DraftEntry {
  goalId: UUID;
  bucket: BucketType;
  ratingCode?: RatingCode; // Optional for draft, required for submit
  comment?: string; // Max 500 characters
}

/**
 * Bucket contribution to final score
 */
export interface BucketContribution {
  bucket: BucketType;
  weight: number; // Stage weight percentage (0-100)
  avgScore: number; // Weighted average rating (0-7)
  contribution: number; // (avgScore × weight) / 100
}

/**
 * Self-assessment summary (after submission)
 */
export interface SelfAssessmentSummary {
  id: UUID;
  submittedAt: string; // ISO8601 timestamp
  finalRating: RatingCode;
  weightedTotal: number; // 0-7 scale
  perBucket?: BucketContribution[];
  flags?: {
    fail: boolean;
    notes: string[];
  };
}

/**
 * Supervisor feedback on a bucket decision
 */
export interface SupervisorFeedback {
  bucket: BucketType;
  supervisorRating?: RatingCode | null;
  supervisorComment?: string | null;
  status: 'pending' | 'approved' | 'rejected';
}

/**
 * Bucket decision (supervisor review)
 */
export interface BucketDecision {
  id: UUID;
  bucket: BucketType;
  employeeRating: RatingCode;
  employeeComment: string;
  employeeContribution: number;
  supervisorRating?: RatingCode | null;
  supervisorComment?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Response for GET /self-assessments/context
 * Contains all data needed for employee to complete self-assessment
 */
export interface SelfAssessmentContextResponse {
  goals: any[]; // Import from goal types to avoid circular dependency
  draft: DraftEntry[];
  summary: SelfAssessmentSummary | null;
  stageWeights: StageWeights;
  reviewStatus: SelfAssessmentStatus | null;
}

/**
 * Request for POST /self-assessments/draft
 */
export interface SaveDraftRequest {
  entries: DraftEntry[];
}

/**
 * Response for POST /self-assessments/draft
 */
export interface SaveDraftResponse {
  success: boolean;
  updatedAt: string; // ISO8601 timestamp
}

/**
 * Request for POST /self-assessments/submit
 */
export interface SubmitAssessmentRequest {
  entries: DraftEntry[]; // All entries must have ratingCode
}

/**
 * Response for POST /self-assessments/submit
 */
export interface SubmitAssessmentResponse {
  id: UUID;
  submittedAt: string;
  finalRating: RatingCode;
  weightedTotal: number;
  perBucket: BucketContribution[];
  flags: {
    fail: boolean;
    notes: string[];
  };
}

/**
 * Response for GET /self-assessments/summary/:periodId
 */
export interface SelfAssessmentSummaryResponse {
  id: UUID;
  status: SelfAssessmentStatus;
  submittedAt: string;
  finalRating: RatingCode;
  weightedTotal: number;
  perBucket: BucketContribution[];
  supervisorFeedback?: SupervisorFeedback[] | null;
}

// ============================================================================
// SUPERVISOR REVIEW TYPES
// ============================================================================

/**
 * Employee with pending self-assessment (for supervisor review)
 */
export interface EmployeePendingReview {
  employeeId: UUID;
  employeeName: string;
  employeeCode: string;
  assessment: {
    id: UUID;
    submittedAt: string;
    status: 'submitted';
    buckets: BucketDecision[];
  };
}

/**
 * Response for GET /supervisor-reviews/pending/grouped
 */
export interface PendingReviewsResponse {
  employees: EmployeePendingReview[];
}

/**
 * Decision for a single bucket (supervisor review)
 */
export interface BucketDecisionInput {
  bucket: BucketType;
  status: 'approved' | 'rejected';
  supervisorRating?: RatingCode | null; // Override employee rating
  supervisorComment?: string | null; // Required if rejecting or overriding
}

/**
 * Request for PATCH /supervisor-reviews/:assessmentId/bucket-decisions
 */
export interface SubmitBucketDecisionsRequest {
  decisions: BucketDecisionInput[];
}

/**
 * Response for PATCH /supervisor-reviews/:assessmentId/bucket-decisions
 */
export interface SubmitBucketDecisionsResponse {
  assessmentId: UUID;
  status: 'approved' | 'rejected';
  updatedAt: string;
  finalRating?: RatingCode | null; // Only if approved
  message: string;
}