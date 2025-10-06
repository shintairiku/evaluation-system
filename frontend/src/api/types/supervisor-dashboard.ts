// Supervisor Dashboard related types

import type { UUID } from './common';

/**
 * Individual subordinate progress information
 */
export interface SubordinateProgress {
  userId: UUID;
  name: string;
  email: string;
  employeeCode: string;
  jobTitle?: string;
  avatarUrl?: string;

  // Progress indicators
  hasSetGoals: boolean;
  hasCompletedSelfAssessment: boolean;
  hasReceivedFeedback: boolean;

  // Status indicators
  needsUrgentAttention: boolean;
  isOverdue: boolean;
  daysUntilDeadline?: number;

  // Timestamps
  lastActivityAt?: string;
}

/**
 * Team evaluation progress summary
 */
export interface TeamProgressData {
  totalSubordinates: number;

  // Goal setting progress
  goalsSetCount: number;
  goalsSetPercentage: number;

  // Self-assessment progress
  selfAssessmentsCompletedCount: number;
  selfAssessmentsCompletedPercentage: number;

  // Review/Feedback progress
  reviewsCompletedCount: number;
  reviewsCompletedPercentage: number;

  // Subordinates needing attention
  needsAttentionCount: number;
  overdueCount: number;

  lastUpdated?: string;
}

/**
 * Pending approval item for supervisor dashboard
 */
export interface SupervisorPendingApprovalItem {
  type: 'goal' | 'feedback';
  count: number;
  priority: 'high' | 'medium' | 'low';
  label: string;
  href?: string;
  overdueCount?: number;
}

/**
 * Pending approvals data for supervisor dashboard
 */
export interface SupervisorPendingApprovalsData {
  items: SupervisorPendingApprovalItem[];
  totalPending: number;
  lastUpdated?: string;
}

/**
 * Subordinate information for listing
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SubordinateInfo extends SubordinateProgress {
  // Additional display information can be added here
}

/**
 * Subordinates list data
 */
export interface SubordinatesListData {
  subordinates: SubordinateInfo[];
  totalCount: number;
  needsAttentionCount: number;
  lastUpdated?: string;
}

/**
 * Complete supervisor dashboard data structure
 */
export interface SupervisorDashboardData {
  teamProgress: TeamProgressData;
  pendingApprovals: SupervisorPendingApprovalsData;
  subordinatesList: SubordinatesListData;
  currentPeriod?: {
    id: UUID;
    name: string;
    startDate: string;
    endDate: string;
  };
  lastUpdated: string;
}

/**
 * Response structure for supervisor dashboard API
 */
export interface SupervisorDashboardResponse {
  teamProgress: TeamProgressData;
  pendingApprovals: SupervisorPendingApprovalsData;
  subordinatesList: SubordinatesListData;
  currentPeriod?: {
    id: UUID;
    name: string;
    startDate: string;
    endDate: string;
  };
}