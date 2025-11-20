import type { UUID } from './common';
import type { UserDetailResponse } from './user';

/**
 * Self Assessment Review type definitions
 * These types match the backend Pydantic schemas for pending self-assessment reviews (bucket-based supervisor feedback)
 */

/**
 * Individual bucket decision data for supervisor review
 */
export interface BucketDecision {
  bucket: 'performance' | 'competency';
  employeeWeight: number;
  employeeContribution: number;
  employeeRating: string;
  status: 'pending' | 'approved' | 'rejected';
  supervisorRating?: string | null;
  comment?: string | null;
}

/**
 * Pending self-assessment review item for supervisor approval
 * Represents a bucket-based supervisor feedback record
 */
export interface SelfAssessmentReview {
  id: UUID; // supervisor_feedback.id
  userId: UUID; // Employee being reviewed
  periodId: UUID;
  supervisorId: UUID;
  previousFeedbackId?: UUID | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  bucketDecisions: BucketDecision[];
  subordinate?: UserDetailResponse | null; // Employee details (full user info)
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

/**
 * Paginated list of pending self-assessment reviews
 */
export interface SelfAssessmentReviewList {
  items: SelfAssessmentReview[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/**
 * Request payload for updating bucket decisions
 */
export interface UpdateBucketDecisionsRequest {
  bucketDecisions: BucketDecision[];
  status?: 'draft' | 'submitted' | 'approved' | 'rejected';
}
