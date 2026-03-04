/**
 * Peer Review type definitions
 * These types match the backend Pydantic schemas for PeerReview-related operations
 */

// ============================================================
// Status types
// ============================================================

export type PeerReviewStatus = 'draft' | 'submitted';

// ============================================================
// Assignment types (admin)
// ============================================================

export interface PeerReviewAssignReviewersRequest {
  reviewerIds: string[];
}

export interface PeerReviewAssignment {
  id: string;
  periodId: string;
  revieweeId: string;
  reviewerId: string;
  reviewerName: string | null;
  assignedBy: string;
  evaluationStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PeerReviewAssignmentsByReviewee {
  revieweeId: string;
  revieweeName: string;
  departmentName: string | null;
  assignments: PeerReviewAssignment[];
}

// ============================================================
// Evaluation types (reviewer)
// ============================================================

export interface PeerReviewEvaluationUpdate {
  scores?: Record<string, string>;
  comment?: string;
}

export interface PeerReviewEvaluation {
  id: string;
  assignmentId: string;
  periodId: string;
  revieweeId: string;
  revieweeName: string | null;
  reviewerId: string;
  scores: Record<string, string> | null;
  comment: string | null;
  status: PeerReviewStatus;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Averaged scores (reviewee view - anonymized)
// ============================================================

export interface PeerReviewCoreValueAverage {
  coreValueDefinitionId: string;
  averageScore: number;
  ratingCode: string;
}

export interface PeerReviewAveragedScores {
  revieweeId: string;
  periodId: string;
  completedReviews: number;
  averages: PeerReviewCoreValueAverage[];
}

// ============================================================
// Core Value Summary (admin - 総合評価)
// ============================================================

export interface CoreValueSummarySource {
  label: string;
  ratingCode: string | null;
  score: number | null;
}

export interface CoreValueSummaryResponse {
  selfRating: string | null;
  selfScore: number | null;
  peerSources: CoreValueSummarySource[];
  supervisorRating: string | null;
  supervisorScore: number | null;
  overallRating: string | null;
  overallScore: number | null;
}
