"""
Dashboard schemas for admin, supervisor, and employee dashboard responses.
All schemas use snake_case (backend convention) - frontend transforms to camelCase.
"""

from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from uuid import UUID
from enum import Enum


# ========================================
# ENUMS
# ========================================

class TaskPriority(str, Enum):
    """Priority levels for tasks"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class TaskType(str, Enum):
    """Types of tasks for employees"""
    SET_GOALS = "set_goals"
    SUBMIT_GOALS = "submit_goals"
    REVISE_GOALS = "revise_goals"
    COMPLETE_SELF_ASSESSMENT = "complete_self_assessment"
    REVIEW_FEEDBACK = "review_feedback"
    ACKNOWLEDGE_FEEDBACK = "acknowledge_feedback"
    OTHER = "other"


class DeadlineUrgency(str, Enum):
    """Urgency levels for deadline alerts"""
    CRITICAL = "critical"  # <= 3 days
    WARNING = "warning"    # 4-7 days
    NORMAL = "normal"      # > 7 days


class AlertSeverity(str, Enum):
    """Severity levels for system alerts"""
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class EvaluationStage(str, Enum):
    """Current stage in evaluation process"""
    NOT_STARTED = "not_started"
    GOALS_SETTING = "goals_setting"
    SELF_ASSESSMENT = "self_assessment"
    FEEDBACK = "feedback"
    COMPLETED = "completed"


class SubordinateStatus(str, Enum):
    """Status categories for subordinates requiring supervisor attention"""
    NEEDS_GOAL_APPROVAL = "needs_goal_approval"
    NEEDS_FEEDBACK = "needs_feedback"
    ON_TRACK = "on_track"
    DELAYED = "delayed"


# ========================================
# ADMIN DASHBOARD SCHEMAS
# ========================================

class SystemStatsData(BaseModel):
    """System-wide statistics for admin dashboard"""
    total_users: int = Field(..., description="Total number of users in the system")
    active_users: int = Field(..., description="Number of active users")
    total_departments: int = Field(..., description="Total number of departments")
    active_evaluation_periods: int = Field(..., description="Number of currently active evaluation periods")
    total_goals: int = Field(..., description="Total number of goals across all users")
    total_evaluations: int = Field(..., description="Total number of evaluations")


class PendingApprovalsData(BaseModel):
    """Pending approval counts for admin dashboard"""
    pending_users: int = Field(..., description="Number of users pending approval")
    pending_goals: int = Field(..., description="Number of goals awaiting approval")
    pending_evaluations: int = Field(..., description="Number of evaluations awaiting review")
    total_pending: int = Field(..., description="Total items pending approval")


class SystemAlert(BaseModel):
    """Individual system alert"""
    id: str = Field(..., description="Alert identifier")
    severity: AlertSeverity = Field(..., description="Alert severity level")
    title: str = Field(..., description="Alert title")
    message: str = Field(..., description="Alert message")
    count: Optional[int] = Field(None, description="Number of affected items")
    action_url: Optional[str] = Field(None, description="URL for action")
    created_at: datetime = Field(..., description="Alert creation timestamp")


class SystemAlertsData(BaseModel):
    """System alerts for admin dashboard"""
    alerts: List[SystemAlert] = Field(default_factory=list, description="List of active system alerts")
    total_alerts: int = Field(..., description="Total number of alerts")
    critical_count: int = Field(..., description="Number of critical alerts")
    warning_count: int = Field(..., description="Number of warning alerts")


class AdminDashboardResponse(BaseModel):
    """Complete admin dashboard data"""
    system_stats: SystemStatsData
    pending_approvals: PendingApprovalsData
    system_alerts: SystemAlertsData
    last_updated: datetime = Field(default_factory=datetime.utcnow)


# ========================================
# SUPERVISOR DASHBOARD SCHEMAS
# ========================================

class TeamProgressData(BaseModel):
    """Team progress statistics for supervisor dashboard"""
    total_subordinates: int = Field(..., description="Total number of direct reports")
    active_subordinates: int = Field(..., description="Number of active subordinates")
    goals_set_count: int = Field(..., description="Number of subordinates who set goals")
    goals_approved_count: int = Field(..., description="Number of subordinates with approved goals")
    self_assessments_completed_count: int = Field(..., description="Number of completed self-assessments")
    feedbacks_provided_count: int = Field(..., description="Number of feedbacks provided")
    overall_completion_rate: float = Field(..., description="Overall team completion percentage (0-100)")
    current_period_id: Optional[UUID] = Field(None, description="Current evaluation period ID")
    current_period_name: Optional[str] = Field(None, description="Current evaluation period name")


class PendingTasksData(BaseModel):
    """Pending tasks for supervisor dashboard"""
    goal_approvals_pending: int = Field(..., description="Number of goals awaiting approval")
    evaluation_feedbacks_pending: int = Field(..., description="Number of evaluations awaiting feedback")
    overdue_approvals: int = Field(..., description="Number of overdue goal approvals")
    overdue_feedbacks: int = Field(..., description="Number of overdue feedback submissions")
    total_pending: int = Field(..., description="Total pending tasks")


class SubordinateInfo(BaseModel):
    """Individual subordinate status information"""
    user_id: UUID = Field(..., description="User ID")
    name: str = Field(..., description="Employee name")
    employee_code: Optional[str] = Field(None, description="Employee code")
    department_name: Optional[str] = Field(None, description="Department name")
    status: SubordinateStatus = Field(..., description="Current status category")
    priority: TaskPriority = Field(..., description="Priority level for supervisor attention")
    has_pending_goals: bool = Field(..., description="Has goals awaiting approval")
    has_pending_feedback: bool = Field(..., description="Has evaluations awaiting feedback")
    goals_count: int = Field(..., description="Total number of goals")
    goals_approved_count: int = Field(..., description="Number of approved goals")
    self_assessment_completed: bool = Field(..., description="Self-assessment completed")
    feedback_provided: bool = Field(..., description="Feedback provided")
    last_activity: Optional[datetime] = Field(None, description="Last activity timestamp")


class SubordinatesListData(BaseModel):
    """List of subordinates for supervisor dashboard"""
    subordinates: List[SubordinateInfo] = Field(default_factory=list, description="List of subordinates")
    total_subordinates: int = Field(..., description="Total number of subordinates")
    needs_attention_count: int = Field(..., description="Number of subordinates needing attention")


class SupervisorDashboardResponse(BaseModel):
    """Complete supervisor dashboard data"""
    team_progress: TeamProgressData
    pending_tasks: PendingTasksData
    subordinates: SubordinatesListData
    last_updated: datetime = Field(default_factory=datetime.utcnow)


# ========================================
# EMPLOYEE DASHBOARD SCHEMAS
# ========================================

class CurrentPeriodInfo(BaseModel):
    """Current evaluation period information"""
    period_id: Optional[UUID] = Field(None, description="Evaluation period ID")
    period_name: Optional[str] = Field(None, description="Evaluation period name")
    period_type: Optional[str] = Field(None, description="Period type (半期, 月次, etc.)")
    start_date: Optional[date] = Field(None, description="Period start date")
    end_date: Optional[date] = Field(None, description="Period end date")
    goal_submission_deadline: Optional[date] = Field(None, description="Goal submission deadline")
    evaluation_deadline: Optional[date] = Field(None, description="Evaluation deadline")
    days_until_goal_deadline: Optional[int] = Field(None, description="Days remaining until goal deadline")
    days_until_evaluation_deadline: Optional[int] = Field(None, description="Days remaining until evaluation deadline")
    is_goal_deadline_passed: bool = Field(default=False, description="Goal deadline has passed")
    is_evaluation_deadline_passed: bool = Field(default=False, description="Evaluation deadline has passed")


class PersonalProgressData(BaseModel):
    """Personal evaluation progress for employee dashboard"""
    period_id: Optional[UUID] = Field(None, description="Current period ID")
    period_name: Optional[str] = Field(None, description="Current period name")
    has_set_goals: bool = Field(..., description="Employee has set goals")
    goals_count: int = Field(default=0, description="Total number of goals")
    goals_approved: int = Field(default=0, description="Number of approved goals")
    goals_pending: int = Field(default=0, description="Number of pending goals")
    goals_rejected: int = Field(default=0, description="Number of rejected goals")
    has_completed_self_assessment: bool = Field(..., description="Self-assessment is completed")
    self_assessments_count: int = Field(default=0, description="Total self-assessments")
    self_assessments_completed: int = Field(default=0, description="Completed self-assessments")
    self_assessments_pending: int = Field(default=0, description="Pending self-assessments")
    has_received_feedback: bool = Field(..., description="Has received supervisor feedback")
    feedbacks_received: int = Field(default=0, description="Number of feedbacks received")
    feedbacks_pending: int = Field(default=0, description="Number of feedbacks pending")
    overall_completion_percentage: float = Field(..., description="Overall completion percentage (0-100)")
    current_stage: EvaluationStage = Field(..., description="Current stage in evaluation process")
    last_updated: Optional[datetime] = Field(None, description="Last update timestamp")


class TodoTask(BaseModel):
    """Individual TODO task for employee"""
    id: str = Field(..., description="Task identifier")
    type: TaskType = Field(..., description="Task type")
    title: str = Field(..., description="Task title")
    description: str = Field(..., description="Task description")
    priority: TaskPriority = Field(..., description="Task priority")
    deadline: Optional[date] = Field(None, description="Task deadline")
    days_remaining: Optional[int] = Field(None, description="Days remaining until deadline")
    is_overdue: bool = Field(default=False, description="Task is overdue")
    action_url: Optional[str] = Field(None, description="URL to complete the task")
    related_entity_id: Optional[UUID] = Field(None, description="Related entity ID (goal, assessment, etc.)")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp if completed")


class TodoTasksData(BaseModel):
    """TODO tasks list for employee dashboard"""
    tasks: List[TodoTask] = Field(default_factory=list, description="List of TODO tasks")
    total_tasks: int = Field(..., description="Total number of tasks")
    high_priority_count: int = Field(..., description="Number of high priority tasks")
    overdue_count: int = Field(..., description="Number of overdue tasks")
    last_updated: datetime = Field(default_factory=datetime.utcnow)


class DeadlineAlert(BaseModel):
    """Individual deadline alert"""
    id: str = Field(..., description="Alert identifier")
    title: str = Field(..., description="Alert title")
    description: str = Field(..., description="Alert description")
    deadline: date = Field(..., description="Deadline date")
    days_remaining: int = Field(..., description="Days remaining until deadline")
    urgency: DeadlineUrgency = Field(..., description="Urgency level")
    is_overdue: bool = Field(default=False, description="Deadline has passed")
    type: str = Field(..., description="Type of deadline (goal_submission, evaluation, etc.)")
    action_url: Optional[str] = Field(None, description="URL to take action")
    related_entity_id: Optional[UUID] = Field(None, description="Related entity ID")


class DeadlineAlertsData(BaseModel):
    """Deadline alerts for employee dashboard"""
    alerts: List[DeadlineAlert] = Field(default_factory=list, description="List of deadline alerts")
    total_alerts: int = Field(..., description="Total number of alerts")
    critical_count: int = Field(..., description="Number of critical alerts (<=3 days)")
    overdue_count: int = Field(..., description="Number of overdue deadlines")
    last_updated: datetime = Field(default_factory=datetime.utcnow)


class HistoricalPeriodSummary(BaseModel):
    """Summary of a historical evaluation period"""
    period_id: UUID = Field(..., description="Period ID")
    period_name: str = Field(..., description="Period name")
    period_type: str = Field(..., description="Period type")
    end_date: date = Field(..., description="Period end date")
    goals_count: int = Field(..., description="Number of goals")
    completed_assessments_count: int = Field(..., description="Number of completed assessments")
    received_feedbacks_count: int = Field(..., description="Number of received feedbacks")


class HistoryAccessData(BaseModel):
    """Historical evaluation data access"""
    recent_periods: List[HistoricalPeriodSummary] = Field(default_factory=list, description="Recent evaluation periods")
    total_periods: int = Field(..., description="Total number of historical periods")
    has_historical_data: bool = Field(..., description="User has historical evaluation data")


class EmployeeDashboardResponse(BaseModel):
    """Complete employee dashboard data"""
    current_period: CurrentPeriodInfo
    personal_progress: PersonalProgressData
    todo_tasks: TodoTasksData
    deadline_alerts: DeadlineAlertsData
    history_access: HistoryAccessData
    last_updated: datetime = Field(default_factory=datetime.utcnow)