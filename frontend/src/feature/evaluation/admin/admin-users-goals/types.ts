import type { GoalResponse, Department, Stage, User } from '@/api/types';

/**
 * User goal summary for user-centric view
 * Aggregates all goals for a single user with counts and status breakdown
 */
export interface UserGoalSummary {
  userId: string;
  userName: string;
  userEmail: string;
  department: Department | null | undefined;
  stage: Stage | null | undefined;
  supervisor: User | null | undefined;
  counts: {
    total: number;
    performance: number; // 業績目標 (total)
    performanceQuantitative: number; // 定量的
    performanceQualitative: number; // 定性的
    competency: number; // コンピテンシー
  };
  statusCounts: {
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
  };
  lastActivity: Date | null;
  goals: GoalResponse[];
}

/**
 * Status filter options for user-centric view
 */
export type StatusFilterOption =
  | 'all'
  | 'no-goals'
  | 'has-drafts'
  | 'all-submitted'
  | 'all-approved'
  | 'has-rejected';
