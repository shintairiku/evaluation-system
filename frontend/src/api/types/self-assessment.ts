import type { UUID, SubmissionStatus } from './common';

/**
 * Self Assessment type definitions
 * These types match the backend Pydantic schemas for SelfAssessment-related operations
 */

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