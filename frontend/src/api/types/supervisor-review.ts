import type { UUID, SubmissionStatus } from './common';

/**
 * Supervisor Review type definitions
 * These types match the backend Pydantic schemas for SupervisorReview-related operations
 */

export enum SupervisorAction {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PENDING = 'pending',
}

export interface SupervisorReviewBase {
  action: SupervisorAction;
  comment: string;
}

export interface SupervisorReview extends SupervisorReviewBase {
  id: UUID;
  goal_id: UUID;
  period_id: UUID;
  supervisor_id: UUID;
  status: SubmissionStatus;
  reviewed_at?: string; // ISO date string
  created_at: string;
  updated_at: string;
}

export interface SupervisorReviewDetail extends SupervisorReview {
  // Timeline information
  isOverdue: boolean;
  daysUntilDeadline?: number;
  
  // Related information (optional, may be populated by backend)
  goal?: unknown; // Avoid circular import
  evaluationPeriod?: unknown; // Avoid circular import
  employee?: unknown; // Avoid circular import
}

export interface SupervisorReviewCreate extends SupervisorReviewBase {
  goalId: UUID;
  periodId: UUID;
  status?: SubmissionStatus; // defaults to 'incomplete'
}

export interface SupervisorReviewUpdate {
  action?: SupervisorAction;
  comment?: string;
  status?: SubmissionStatus;
}

export interface SupervisorReviewList {
  items: SupervisorReview[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}