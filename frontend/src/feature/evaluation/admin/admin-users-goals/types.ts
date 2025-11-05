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
    competency: number;
    team: number;
    individual: number;
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
