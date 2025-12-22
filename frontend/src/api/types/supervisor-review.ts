import type { UUID, SubmissionStatus } from './common';
import type { GoalResponse } from './goal';
import type { UserDetailResponse } from './user';

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
  goalId: UUID;
  periodId: UUID;
  supervisorId: UUID;
  subordinateId: UUID;
  status: SubmissionStatus;
  reviewedAt?: string; // ISO date string
  createdAt: string;
  updatedAt: string;
  goal?: GoalResponse;
  subordinate?: UserDetailResponse;
}

export interface SupervisorReviewDetail extends SupervisorReview {
  // Timeline information
  isOverdue: boolean;
  daysUntilDeadline?: number;
  
  // Related information (optional, may be populated by backend)
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
