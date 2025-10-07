import type { UUID, SubmissionStatus } from './common';

/**
 * Supervisor Feedback type definitions
 * These types match the backend Pydantic schemas for SupervisorFeedback-related operations
 */

export interface SupervisorFeedbackBase {
  rating?: number; // 0-100
  comment?: string;
}

export interface SupervisorFeedback extends SupervisorFeedbackBase {
  id: UUID;
  self_assessment_id: UUID;
  period_id: UUID;
  supervisor_id: UUID;
  status: SubmissionStatus;
  submitted_at?: string; // ISO date string
  created_at: string;
  updated_at: string;
}

export interface SupervisorFeedbackDetail extends SupervisorFeedback {
  // Field aliases for API compatibility
  selfAssessmentId: UUID;
  periodId: UUID;
  supervisorId: UUID;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
  
  // Feedback state information
  isEditable: boolean;
  isOverdue: boolean;
  daysUntilDeadline?: number;
  
  // Assessment context
  goalCategory?: string;
  goalTitle?: string;
  goalDescription?: string;
  evaluationPeriodName?: string;
  
  // Related information (optional, may be populated by backend)
  selfAssessment?: unknown; // Avoid circular import
  evaluationPeriod?: unknown; // Avoid circular import
  subordinate?: unknown; // Avoid circular import
  supervisor?: unknown; // Avoid circular import
}

export interface SupervisorFeedbackCreate extends SupervisorFeedbackBase {
  selfAssessmentId: UUID;
  periodId: UUID;
  status: SubmissionStatus; // 'draft' or 'submitted'
}

export interface SupervisorFeedbackUpdate {
  rating?: number; // 0-100
  comment?: string;
}

export interface SupervisorFeedbackList {
  items: SupervisorFeedback[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}