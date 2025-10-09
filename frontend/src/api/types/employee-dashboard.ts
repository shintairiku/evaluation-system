import type { UUID } from './common';
import type { EvaluationPeriod } from './evaluation-period';

/**
 * Employee Dashboard type definitions
 * These types define the data structures for the employee/part-time dashboard
 */

/**
 * Current evaluation period information for employee
 */
export interface CurrentPeriodData {
  period: EvaluationPeriod | null;
  daysUntilGoalDeadline?: number;
  daysUntilEvaluationDeadline?: number;
  isGoalDeadlinePassed: boolean;
  isEvaluationDeadlinePassed: boolean;
}

/**
 * Personal evaluation progress status
 */
export interface PersonalProgressData {
  // Current period
  periodId?: UUID;
  periodName?: string;

  // Progress steps
  hasSetGoals: boolean;
  goalsCount: number;
  goalsApproved: number;
  goalsPending: number;
  goalsRejected: number;

  hasCompletedSelfAssessment: boolean;
  selfAssessmentsCount: number;
  selfAssessmentsCompleted: number;
  selfAssessmentsPending: number;

  hasReceivedFeedback: boolean;
  feedbacksReceived: number;
  feedbacksPending: number;

  // Overall completion
  overallCompletionPercentage: number;
  currentStage: 'not_started' | 'goals_setting' | 'self_assessment' | 'feedback' | 'completed';

  // Timestamps
  lastUpdated?: string;
}

/**
 * Priority levels for tasks and alerts
 */
export type TaskPriority = 'high' | 'medium' | 'low';

/**
 * Task types for employee
 */
export type TaskType =
  | 'set_goals'
  | 'submit_goals'
  | 'revise_goals'
  | 'complete_self_assessment'
  | 'review_feedback'
  | 'acknowledge_feedback'
  | 'other';

/**
 * Individual TODO task item
 */
export interface TodoTask {
  id: string;
  type: TaskType;
  title: string;
  description: string;
  priority: TaskPriority;
  deadline?: string; // ISO date string
  daysRemaining?: number;
  isOverdue: boolean;
  actionUrl?: string; // URL to navigate to complete the task
  relatedEntityId?: UUID; // Related goal, assessment, or feedback ID
  completedAt?: string;
}

/**
 * TODO tasks list data
 */
export interface TodoTasksData {
  tasks: TodoTask[];
  totalTasks: number;
  highPriorityCount: number;
  overdueCount: number;
  lastUpdated?: string;
}

/**
 * Deadline alert urgency levels
 */
export type DeadlineUrgency = 'critical' | 'warning' | 'normal';

/**
 * Individual deadline alert
 */
export interface DeadlineAlert {
  id: string;
  title: string;
  description: string;
  deadline: string; // ISO date string
  daysRemaining: number;
  urgency: DeadlineUrgency;
  isOverdue: boolean;
  type: 'goal_submission' | 'evaluation_deadline' | 'feedback_review' | 'other';
  actionUrl?: string;
  relatedEntityId?: UUID;
}

/**
 * Deadline alerts data
 */
export interface DeadlineAlertsData {
  alerts: DeadlineAlert[];
  totalAlerts: number;
  criticalCount: number;
  overdueCount: number;
  lastUpdated?: string;
}

/**
 * Historical period summary
 */
export interface HistoricalPeriodSummary {
  periodId: UUID;
  periodName: string;
  periodType: string;
  endDate: string;
  goalsCount: number;
  completedAssessmentsCount: number;
  receivedFeedbacksCount: number;
}

/**
 * History access data
 */
export interface HistoryAccessData {
  recentPeriods: HistoricalPeriodSummary[];
  totalPeriods: number;
  hasHistoricalData: boolean;
}

/**
 * Main employee dashboard data container
 */
export interface EmployeeDashboardData {
  currentPeriod: CurrentPeriodData;
  personalProgress: PersonalProgressData;
  todoTasks: TodoTasksData;
  deadlineAlerts: DeadlineAlertsData;
  historyAccess: HistoryAccessData;
}

/**
 * API response for employee dashboard
 * Backend returns CurrentPeriodInfo with flat structure
 */
export interface EmployeeDashboardResponse {
  current_period: {
    // Flat structure from backend (matches CurrentPeriodInfo schema)
    period_id?: UUID;
    period_name?: string;
    period_type?: string;
    start_date?: string;
    end_date?: string;
    goal_submission_deadline?: string;
    evaluation_deadline?: string;
    days_until_goal_deadline?: number;
    days_until_evaluation_deadline?: number;
    is_goal_deadline_passed: boolean;
    is_evaluation_deadline_passed: boolean;
  };
  personal_progress: {
    period_id?: UUID;
    period_name?: string;
    has_set_goals: boolean;
    goals_count: number;
    goals_approved: number;
    goals_pending: number;
    goals_rejected: number;
    has_completed_self_assessment: boolean;
    self_assessments_count: number;
    self_assessments_completed: number;
    self_assessments_pending: number;
    has_received_feedback: boolean;
    feedbacks_received: number;
    feedbacks_pending: number;
    overall_completion_percentage: number;
    current_stage: PersonalProgressData['currentStage'];
    last_updated?: string;
  };
  todo_tasks: {
    tasks: Array<{
      id: string;
      type: TaskType;
      title: string;
      description: string;
      priority: TaskPriority;
      deadline?: string;
      days_remaining?: number;
      is_overdue: boolean;
      action_url?: string;
      related_entity_id?: UUID;
      completed_at?: string;
    }>;
    total_tasks: number;
    high_priority_count: number;
    overdue_count: number;
    last_updated?: string;
  };
  deadline_alerts: {
    alerts: Array<{
      id: string;
      title: string;
      description: string;
      deadline: string;
      days_remaining: number;
      urgency: DeadlineUrgency;
      is_overdue: boolean;
      type: DeadlineAlert['type'];
      action_url?: string;
      related_entity_id?: UUID;
    }>;
    total_alerts: number;
    critical_count: number;
    overdue_count: number;
    last_updated?: string;
  };
  history_access: {
    recent_periods: Array<{
      period_id: UUID;
      period_name: string;
      period_type: string;
      end_date: string;
      goals_count: number;
      completed_assessments_count: number;
      received_feedbacks_count: number;
    }>;
    total_periods: number;
    has_historical_data: boolean;
  };
}