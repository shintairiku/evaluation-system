import { getHttpClient } from '../client/http-client';
import type { ApiResponse } from '../types';
import type {
  EmployeeDashboardResponse,
  EmployeeDashboardData,
  PersonalProgressData,
  TodoTasksData,
  DeadlineAlertsData,
  HistoryAccessData
} from '../types/employee-dashboard';

const httpClient = getHttpClient();

/**
 * Employee Dashboard API endpoints
 * Provides data fetching functions for employee dashboard views
 */

/**
 * Transform API response to frontend format
 */
function transformEmployeeDashboardResponse(
  response: EmployeeDashboardResponse
): EmployeeDashboardData {
  return {
    currentPeriod: {
      period: response.current_period.period,
      daysUntilGoalDeadline: response.current_period.days_until_goal_deadline,
      daysUntilEvaluationDeadline: response.current_period.days_until_evaluation_deadline,
      isGoalDeadlinePassed: response.current_period.is_goal_deadline_passed,
      isEvaluationDeadlinePassed: response.current_period.is_evaluation_deadline_passed
    },
    personalProgress: {
      periodId: response.personal_progress.period_id,
      periodName: response.personal_progress.period_name,
      hasSetGoals: response.personal_progress.has_set_goals,
      goalsCount: response.personal_progress.goals_count,
      goalsApproved: response.personal_progress.goals_approved,
      goalsPending: response.personal_progress.goals_pending,
      goalsRejected: response.personal_progress.goals_rejected,
      hasCompletedSelfAssessment: response.personal_progress.has_completed_self_assessment,
      selfAssessmentsCount: response.personal_progress.self_assessments_count,
      selfAssessmentsCompleted: response.personal_progress.self_assessments_completed,
      selfAssessmentsPending: response.personal_progress.self_assessments_pending,
      hasReceivedFeedback: response.personal_progress.has_received_feedback,
      feedbacksReceived: response.personal_progress.feedbacks_received,
      feedbacksPending: response.personal_progress.feedbacks_pending,
      overallCompletionPercentage: response.personal_progress.overall_completion_percentage,
      currentStage: response.personal_progress.current_stage,
      lastUpdated: response.personal_progress.last_updated
    },
    todoTasks: {
      tasks: response.todo_tasks.tasks.map(task => ({
        id: task.id,
        type: task.type,
        title: task.title,
        description: task.description,
        priority: task.priority,
        deadline: task.deadline,
        daysRemaining: task.days_remaining,
        isOverdue: task.is_overdue,
        actionUrl: task.action_url,
        relatedEntityId: task.related_entity_id,
        completedAt: task.completed_at
      })),
      totalTasks: response.todo_tasks.total_tasks,
      highPriorityCount: response.todo_tasks.high_priority_count,
      overdueCount: response.todo_tasks.overdue_count,
      lastUpdated: response.todo_tasks.last_updated
    },
    deadlineAlerts: {
      alerts: response.deadline_alerts.alerts.map(alert => ({
        id: alert.id,
        title: alert.title,
        description: alert.description,
        deadline: alert.deadline,
        daysRemaining: alert.days_remaining,
        urgency: alert.urgency,
        isOverdue: alert.is_overdue,
        type: alert.type,
        actionUrl: alert.action_url,
        relatedEntityId: alert.related_entity_id
      })),
      totalAlerts: response.deadline_alerts.total_alerts,
      criticalCount: response.deadline_alerts.critical_count,
      overdueCount: response.deadline_alerts.overdue_count,
      lastUpdated: response.deadline_alerts.last_updated
    },
    historyAccess: {
      recentPeriods: response.history_access.recent_periods.map(period => ({
        periodId: period.period_id,
        periodName: period.period_name,
        periodType: period.period_type,
        endDate: period.end_date,
        goalsCount: period.goals_count,
        completedAssessmentsCount: period.completed_assessments_count,
        receivedFeedbacksCount: period.received_feedbacks_count
      })),
      totalPeriods: response.history_access.total_periods,
      hasHistoricalData: response.history_access.has_historical_data
    }
  };
}

/**
 * Get complete employee dashboard data
 */
export const employeeDashboardApi = {
  /**
   * Get all employee dashboard data for the current user
   */
  getEmployeeDashboardData: async (): Promise<ApiResponse<EmployeeDashboardData>> => {
    const response = await httpClient.get<EmployeeDashboardResponse>('/employee/dashboard');

    if (response.success && response.data) {
      return {
        success: true,
        data: transformEmployeeDashboardResponse(response.data)
      };
    }

    return response as ApiResponse<EmployeeDashboardData>;
  },

  /**
   * Get personal progress data only
   */
  getPersonalProgress: async (): Promise<ApiResponse<PersonalProgressData>> => {
    const response = await httpClient.get<{ personal_progress: EmployeeDashboardResponse['personal_progress'] }>(
      '/employee/dashboard/progress'
    );

    if (response.success && response.data) {
      const transformed: PersonalProgressData = {
        periodId: response.data.personal_progress.period_id,
        periodName: response.data.personal_progress.period_name,
        hasSetGoals: response.data.personal_progress.has_set_goals,
        goalsCount: response.data.personal_progress.goals_count,
        goalsApproved: response.data.personal_progress.goals_approved,
        goalsPending: response.data.personal_progress.goals_pending,
        goalsRejected: response.data.personal_progress.goals_rejected,
        hasCompletedSelfAssessment: response.data.personal_progress.has_completed_self_assessment,
        selfAssessmentsCount: response.data.personal_progress.self_assessments_count,
        selfAssessmentsCompleted: response.data.personal_progress.self_assessments_completed,
        selfAssessmentsPending: response.data.personal_progress.self_assessments_pending,
        hasReceivedFeedback: response.data.personal_progress.has_received_feedback,
        feedbacksReceived: response.data.personal_progress.feedbacks_received,
        feedbacksPending: response.data.personal_progress.feedbacks_pending,
        overallCompletionPercentage: response.data.personal_progress.overall_completion_percentage,
        currentStage: response.data.personal_progress.current_stage,
        lastUpdated: response.data.personal_progress.last_updated
      };

      return {
        success: true,
        data: transformed
      };
    }

    return response as ApiResponse<PersonalProgressData>;
  },

  /**
   * Get TODO tasks only
   */
  getTodoTasks: async (): Promise<ApiResponse<TodoTasksData>> => {
    const response = await httpClient.get<{ todo_tasks: EmployeeDashboardResponse['todo_tasks'] }>(
      '/employee/dashboard/todos'
    );

    if (response.success && response.data) {
      const transformed: TodoTasksData = {
        tasks: response.data.todo_tasks.tasks.map(task => ({
          id: task.id,
          type: task.type,
          title: task.title,
          description: task.description,
          priority: task.priority,
          deadline: task.deadline,
          daysRemaining: task.days_remaining,
          isOverdue: task.is_overdue,
          actionUrl: task.action_url,
          relatedEntityId: task.related_entity_id,
          completedAt: task.completed_at
        })),
        totalTasks: response.data.todo_tasks.total_tasks,
        highPriorityCount: response.data.todo_tasks.high_priority_count,
        overdueCount: response.data.todo_tasks.overdue_count,
        lastUpdated: response.data.todo_tasks.last_updated
      };

      return {
        success: true,
        data: transformed
      };
    }

    return response as ApiResponse<TodoTasksData>;
  },

  /**
   * Get deadline alerts only
   */
  getDeadlineAlerts: async (): Promise<ApiResponse<DeadlineAlertsData>> => {
    const response = await httpClient.get<{ deadline_alerts: EmployeeDashboardResponse['deadline_alerts'] }>(
      '/employee/dashboard/deadlines'
    );

    if (response.success && response.data) {
      const transformed: DeadlineAlertsData = {
        alerts: response.data.deadline_alerts.alerts.map(alert => ({
          id: alert.id,
          title: alert.title,
          description: alert.description,
          deadline: alert.deadline,
          daysRemaining: alert.days_remaining,
          urgency: alert.urgency,
          isOverdue: alert.is_overdue,
          type: alert.type,
          actionUrl: alert.action_url,
          relatedEntityId: alert.related_entity_id
        })),
        totalAlerts: response.data.deadline_alerts.total_alerts,
        criticalCount: response.data.deadline_alerts.critical_count,
        overdueCount: response.data.deadline_alerts.overdue_count,
        lastUpdated: response.data.deadline_alerts.last_updated
      };

      return {
        success: true,
        data: transformed
      };
    }

    return response as ApiResponse<DeadlineAlertsData>;
  },

  /**
   * Get history access data only
   */
  getHistoryAccess: async (): Promise<ApiResponse<HistoryAccessData>> => {
    const response = await httpClient.get<{ history_access: EmployeeDashboardResponse['history_access'] }>(
      '/employee/dashboard/history'
    );

    if (response.success && response.data) {
      const transformed: HistoryAccessData = {
        recentPeriods: response.data.history_access.recent_periods.map(period => ({
          periodId: period.period_id,
          periodName: period.period_name,
          periodType: period.period_type,
          endDate: period.end_date,
          goalsCount: period.goals_count,
          completedAssessmentsCount: period.completed_assessments_count,
          receivedFeedbacksCount: period.received_feedbacks_count
        })),
        totalPeriods: response.data.history_access.total_periods,
        hasHistoricalData: response.data.history_access.has_historical_data
      };

      return {
        success: true,
        data: transformed
      };
    }

    return response as ApiResponse<HistoryAccessData>;
  }
};