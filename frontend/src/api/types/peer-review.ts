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

export interface BulkAssignReviewersItem {
  revieweeId: string;
  reviewerIds: string[];
}

export interface BulkAssignReviewersResult {
  revieweeId: string;
  success: boolean;
  error?: string;
}

export interface BulkAssignReviewersResponse {
  results: BulkAssignReviewersResult[];
  successCount: number;
  failureCount: number;
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

// ============================================================
// Evaluation Detail (admin - 評価詳細)
// ============================================================

export interface CoreValueItemScore {
  definitionId: string;
  displayOrder: number;
  name: string;
  selfRating: string | null;
  peer1Rating: string | null;
  peer2Rating: string | null;
  supervisorRating: string | null;
  averageRating: string | null;
}

export interface EvaluationSourceComment {
  sourceLabel: string;
  sourceType: 'self' | 'peer1' | 'peer2' | 'supervisor';
  comment: string | null;
}

export interface EvaluationDetailResponse {
  userId: string;
  userName: string;
  departmentName: string | null;
  positionName: string | null;
  supervisorName: string | null;
  periodName: string | null;
  allSubmitted: boolean;
  coreValues: CoreValueItemScore[];
  comments: EvaluationSourceComment[];
  selfAvgRating: string | null;
  peer1AvgRating: string | null;
  peer2AvgRating: string | null;
  supervisorAvgRating: string | null;
  overallRating: string | null;
}

// ============================================================
// Evaluation Progress (admin - 評価進捗)
// ============================================================

export interface EvaluationProgressSource {
  evaluatorName: string | null;
  status: string | null;
}

export interface EvaluationProgressEntry {
  userId: string;
  userName: string;
  departmentName: string | null;
  selfAssessment: EvaluationProgressSource;
  peerReviewer1: EvaluationProgressSource;
  peerReviewer2: EvaluationProgressSource;
  supervisor: EvaluationProgressSource;
}
