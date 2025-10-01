"""
Dashboard service for aggregating data across multiple repositories.
Provides business logic for admin, supervisor, and employee dashboards.
"""

import logging
from datetime import date, datetime, timezone
from typing import List, Optional, Dict
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_

from ..database.repositories.user_repo import UserRepository
from ..database.repositories.department_repo import DepartmentRepository
from ..database.repositories.goal_repo import GoalRepository
from ..database.repositories.self_assessment_repo import SelfAssessmentRepository
from ..database.repositories.supervisor_feedback_repo import SupervisorFeedbackRepository
from ..database.repositories.evaluation_period_repo import EvaluationPeriodRepository
from ..database.models.user import User
from ..database.models.goal import Goal
from ..database.models.self_assessment import SelfAssessment
from ..database.models.supervisor_feedback import SupervisorFeedback
from ..database.models.evaluation import EvaluationPeriod, EvaluationPeriodStatus
from ..schemas.dashboard import (
    AdminDashboardResponse, SystemStatsData, PendingApprovalsData, SystemAlertsData, SystemAlert,
    SupervisorDashboardResponse, TeamProgressData, PendingTasksData, SubordinatesListData, SubordinateInfo,
    EmployeeDashboardResponse, CurrentPeriodInfo, PersonalProgressData, TodoTasksData, TodoTask,
    DeadlineAlertsData, DeadlineAlert, HistoryAccessData, HistoricalPeriodSummary,
    AlertSeverity, TaskPriority, TaskType, DeadlineUrgency, EvaluationStage, SubordinateStatus
)
from ..schemas.user import UserStatus
from ..core.exceptions import NotFoundError, PermissionDeniedError

logger = logging.getLogger(__name__)


class DashboardService:
    """Service for dashboard data aggregation and business logic"""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)
        self.department_repo = DepartmentRepository(session)
        self.goal_repo = GoalRepository(session)
        self.self_assessment_repo = SelfAssessmentRepository(session)
        self.supervisor_feedback_repo = SupervisorFeedbackRepository(session)
        self.evaluation_period_repo = EvaluationPeriodRepository(session)

    # ========================================
    # ADMIN DASHBOARD
    # ========================================

    async def get_admin_dashboard_data(self, org_id: str) -> AdminDashboardResponse:
        """Get complete admin dashboard data"""
        logger.info(f"Fetching admin dashboard data for org {org_id}")

        system_stats = await self._get_system_stats(org_id)
        pending_approvals = await self._get_pending_approvals(org_id)
        system_alerts = await self._get_system_alerts(org_id)

        return AdminDashboardResponse(
            system_stats=system_stats,
            pending_approvals=pending_approvals,
            system_alerts=system_alerts,
            last_updated=datetime.now(timezone.utc)
        )

    async def _get_system_stats(self, org_id: str) -> SystemStatsData:
        """Calculate system-wide statistics"""
        # Count total users
        total_users_query = select(func.count(User.id)).where(User.organization_id == org_id)
        total_users_result = await self.session.execute(total_users_query)
        total_users = total_users_result.scalar() or 0

        # Count active users
        active_users_query = select(func.count(User.id)).where(
            and_(User.organization_id == org_id, User.status == UserStatus.ACTIVE)
        )
        active_users_result = await self.session.execute(active_users_query)
        active_users = active_users_result.scalar() or 0

        # Count departments
        from ..database.models.organization import Department
        departments_query = select(func.count(Department.id)).where(Department.organization_id == org_id)
        departments_result = await self.session.execute(departments_query)
        total_departments = departments_result.scalar() or 0

        # Count active evaluation periods
        active_periods_query = select(func.count(EvaluationPeriod.id)).where(
            and_(
                EvaluationPeriod.organization_id == org_id,
                EvaluationPeriod.status == EvaluationPeriodStatus.ACTIVE
            )
        )
        active_periods_result = await self.session.execute(active_periods_query)
        active_evaluation_periods = active_periods_result.scalar() or 0

        # Count total goals (join through users for org scope)
        goals_query = select(func.count(Goal.id)).join(User, Goal.user_id == User.id).where(
            User.organization_id == org_id
        )
        goals_result = await self.session.execute(goals_query)
        total_goals = goals_result.scalar() or 0

        # Count total evaluations (self-assessments)
        evaluations_query = select(func.count(SelfAssessment.id)).join(
            User, SelfAssessment.user_id == User.id
        ).where(User.organization_id == org_id)
        evaluations_result = await self.session.execute(evaluations_query)
        total_evaluations = evaluations_result.scalar() or 0

        return SystemStatsData(
            total_users=total_users,
            active_users=active_users,
            total_departments=total_departments,
            active_evaluation_periods=active_evaluation_periods,
            total_goals=total_goals,
            total_evaluations=total_evaluations
        )

    async def _get_pending_approvals(self, org_id: str) -> PendingApprovalsData:
        """Calculate pending approval counts"""
        # Pending users (pending_approval status)
        pending_users_query = select(func.count(User.id)).where(
            and_(User.organization_id == org_id, User.status == UserStatus.PENDING_APPROVAL)
        )
        pending_users_result = await self.session.execute(pending_users_query)
        pending_users = pending_users_result.scalar() or 0

        # Pending goals (submitted status, awaiting approval)
        pending_goals_query = select(func.count(Goal.id)).join(User, Goal.user_id == User.id).where(
            and_(User.organization_id == org_id, Goal.status == "submitted")
        )
        pending_goals_result = await self.session.execute(pending_goals_query)
        pending_goals = pending_goals_result.scalar() or 0

        # Pending evaluations (submitted self-assessments without feedback)
        pending_evaluations_query = select(func.count(SelfAssessment.id)).join(
            User, SelfAssessment.user_id == User.id
        ).where(
            and_(
                User.organization_id == org_id,
                SelfAssessment.status == "submitted"
            )
        )
        pending_evaluations_result = await self.session.execute(pending_evaluations_query)
        pending_evaluations = pending_evaluations_result.scalar() or 0

        total_pending = pending_users + pending_goals + pending_evaluations

        return PendingApprovalsData(
            pending_users=pending_users,
            pending_goals=pending_goals,
            pending_evaluations=pending_evaluations,
            total_pending=total_pending
        )

    async def _get_system_alerts(self, org_id: str) -> SystemAlertsData:
        """Generate system alerts based on deadlines and pending items"""
        alerts: List[SystemAlert] = []

        # Get active periods to check deadlines
        active_periods = await self.evaluation_period_repo.get_by_status(
            EvaluationPeriodStatus.ACTIVE, org_id
        )

        today = date.today()

        for period in active_periods:
            # Goal submission deadline alerts
            if period.goal_submission_deadline:
                days_until_goal_deadline = (period.goal_submission_deadline - today).days
                if 0 <= days_until_goal_deadline <= 3:
                    # Count users without submitted goals
                    users_without_goals_query = select(func.count(User.id)).select_from(User).outerjoin(
                        Goal, and_(Goal.user_id == User.id, Goal.period_id == period.id)
                    ).where(
                        and_(
                            User.organization_id == org_id,
                            User.status == UserStatus.ACTIVE,
                            Goal.id.is_(None)
                        )
                    )
                    users_without_goals_result = await self.session.execute(users_without_goals_query)
                    users_without_goals = users_without_goals_result.scalar() or 0

                    if users_without_goals > 0:
                        alerts.append(SystemAlert(
                            id=f"goal_deadline_{period.id}",
                            severity=AlertSeverity.CRITICAL if days_until_goal_deadline <= 1 else AlertSeverity.WARNING,
                            title=f"目標提出期限迫る - {period.name}",
                            message=f"目標提出期限まで{days_until_goal_deadline}日です",
                            count=users_without_goals,
                            action_url=f"/evaluation/periods/{period.id}/goals",
                            created_at=datetime.now(timezone.utc)
                        ))

            # Evaluation deadline alerts
            if period.evaluation_deadline:
                days_until_eval_deadline = (period.evaluation_deadline - today).days
                if 0 <= days_until_eval_deadline <= 7:
                    # Count incomplete evaluations
                    incomplete_evals_query = select(func.count(User.id)).select_from(User).outerjoin(
                        SelfAssessment, and_(
                            SelfAssessment.user_id == User.id,
                            SelfAssessment.period_id == period.id
                        )
                    ).where(
                        and_(
                            User.organization_id == org_id,
                            User.status == UserStatus.ACTIVE,
                            or_(SelfAssessment.status != "submitted", SelfAssessment.id.is_(None))
                        )
                    )
                    incomplete_evals_result = await self.session.execute(incomplete_evals_query)
                    incomplete_evals = incomplete_evals_result.scalar() or 0

                    if incomplete_evals > 0:
                        alerts.append(SystemAlert(
                            id=f"eval_deadline_{period.id}",
                            severity=AlertSeverity.CRITICAL if days_until_eval_deadline <= 3 else AlertSeverity.WARNING,
                            title=f"評価期限迫る - {period.name}",
                            message=f"評価期限まで{days_until_eval_deadline}日です",
                            count=incomplete_evals,
                            action_url=f"/evaluation/periods/{period.id}/evaluations",
                            created_at=datetime.now(timezone.utc)
                        ))

        critical_count = sum(1 for alert in alerts if alert.severity == AlertSeverity.CRITICAL)
        warning_count = sum(1 for alert in alerts if alert.severity == AlertSeverity.WARNING)

        return SystemAlertsData(
            alerts=alerts,
            total_alerts=len(alerts),
            critical_count=critical_count,
            warning_count=warning_count
        )

    # ========================================
    # SUPERVISOR DASHBOARD
    # ========================================

    async def get_supervisor_dashboard_data(
        self, supervisor_id: UUID, org_id: str
    ) -> SupervisorDashboardResponse:
        """Get complete supervisor dashboard data"""
        logger.info(f"Fetching supervisor dashboard data for user {supervisor_id} in org {org_id}")

        team_progress = await self._get_team_progress(supervisor_id, org_id)
        pending_tasks = await self._get_supervisor_pending_tasks(supervisor_id, org_id)
        subordinates = await self._get_subordinates_list(supervisor_id, org_id)

        return SupervisorDashboardResponse(
            team_progress=team_progress,
            pending_tasks=pending_tasks,
            subordinates=subordinates,
            last_updated=datetime.now(timezone.utc)
        )

    async def _get_team_progress(self, supervisor_id: UUID, org_id: str) -> TeamProgressData:
        """Calculate team progress statistics"""
        # Get all subordinates
        subordinates = await self.user_repo.get_subordinates(supervisor_id, org_id)
        total_subordinates = len(subordinates)
        active_subordinates = sum(1 for sub in subordinates if sub.status == UserStatus.ACTIVE)

        if total_subordinates == 0:
            return TeamProgressData(
                total_subordinates=0,
                active_subordinates=0,
                goals_set_count=0,
                goals_approved_count=0,
                self_assessments_completed_count=0,
                feedbacks_provided_count=0,
                overall_completion_rate=0.0,
                current_period_id=None,
                current_period_name=None
            )

        subordinate_ids = [sub.id for sub in subordinates]

        # Get current active period
        active_periods = await self.evaluation_period_repo.get_by_status(
            EvaluationPeriodStatus.ACTIVE, org_id
        )
        current_period = active_periods[0] if active_periods else None

        period_filter = [Goal.period_id == current_period.id] if current_period else []

        # Count subordinates who have set goals
        goals_set_query = select(func.count(func.distinct(Goal.user_id))).where(
            and_(Goal.user_id.in_(subordinate_ids), *period_filter)
        )
        goals_set_result = await self.session.execute(goals_set_query)
        goals_set_count = goals_set_result.scalar() or 0

        # Count subordinates with approved goals
        goals_approved_query = select(func.count(func.distinct(Goal.user_id))).where(
            and_(Goal.user_id.in_(subordinate_ids), Goal.status == "approved", *period_filter)
        )
        goals_approved_result = await self.session.execute(goals_approved_query)
        goals_approved_count = goals_approved_result.scalar() or 0

        # Count completed self-assessments
        period_filter_sa = [SelfAssessment.period_id == current_period.id] if current_period else []
        assessments_completed_query = select(func.count(func.distinct(SelfAssessment.user_id))).where(
            and_(
                SelfAssessment.user_id.in_(subordinate_ids),
                SelfAssessment.status == "submitted",
                *period_filter_sa
            )
        )
        assessments_completed_result = await self.session.execute(assessments_completed_query)
        self_assessments_completed_count = assessments_completed_result.scalar() or 0

        # Count feedbacks provided
        period_filter_sf = [SupervisorFeedback.period_id == current_period.id] if current_period else []
        feedbacks_query = select(func.count(func.distinct(SupervisorFeedback.employee_id))).where(
            and_(
                SupervisorFeedback.supervisor_id == supervisor_id,
                SupervisorFeedback.employee_id.in_(subordinate_ids),
                SupervisorFeedback.status == "submitted",
                *period_filter_sf
            )
        )
        feedbacks_result = await self.session.execute(feedbacks_query)
        feedbacks_provided_count = feedbacks_result.scalar() or 0

        # Calculate overall completion rate (average of stages)
        if active_subordinates > 0:
            goals_rate = (goals_approved_count / active_subordinates) * 100
            assessment_rate = (self_assessments_completed_count / active_subordinates) * 100
            feedback_rate = (feedbacks_provided_count / active_subordinates) * 100
            overall_completion_rate = (goals_rate + assessment_rate + feedback_rate) / 3
        else:
            overall_completion_rate = 0.0

        return TeamProgressData(
            total_subordinates=total_subordinates,
            active_subordinates=active_subordinates,
            goals_set_count=goals_set_count,
            goals_approved_count=goals_approved_count,
            self_assessments_completed_count=self_assessments_completed_count,
            feedbacks_provided_count=feedbacks_provided_count,
            overall_completion_rate=round(overall_completion_rate, 2),
            current_period_id=current_period.id if current_period else None,
            current_period_name=current_period.name if current_period else None
        )

    async def _get_supervisor_pending_tasks(self, supervisor_id: UUID, org_id: str) -> PendingTasksData:
        """Calculate pending tasks for supervisor"""
        subordinates = await self.user_repo.get_subordinates(supervisor_id, org_id)
        subordinate_ids = [sub.id for sub in subordinates]

        if not subordinate_ids:
            return PendingTasksData(
                goal_approvals_pending=0,
                evaluation_feedbacks_pending=0,
                overdue_approvals=0,
                overdue_feedbacks=0,
                total_pending=0
            )

        # Get current period
        active_periods = await self.evaluation_period_repo.get_by_status(
            EvaluationPeriodStatus.ACTIVE, org_id
        )
        current_period = active_periods[0] if active_periods else None
        today = date.today()

        # Count goal approvals pending (submitted goals)
        period_filter = [Goal.period_id == current_period.id] if current_period else []
        goal_approvals_query = select(func.count(Goal.id)).where(
            and_(
                Goal.user_id.in_(subordinate_ids),
                Goal.status == "submitted",
                *period_filter
            )
        )
        goal_approvals_result = await self.session.execute(goal_approvals_query)
        goal_approvals_pending = goal_approvals_result.scalar() or 0

        # Count overdue goal approvals
        overdue_approvals = 0
        if current_period and current_period.goal_submission_deadline:
            if today > current_period.goal_submission_deadline:
                overdue_approvals = goal_approvals_pending

        # Count feedback pending (submitted assessments without feedback)
        period_filter_sa = [SelfAssessment.period_id == current_period.id] if current_period else []
        feedback_pending_query = select(func.count(SelfAssessment.id)).select_from(
            SelfAssessment
        ).outerjoin(
            SupervisorFeedback,
            and_(
                SupervisorFeedback.employee_id == SelfAssessment.user_id,
                SupervisorFeedback.period_id == SelfAssessment.period_id
            )
        ).where(
            and_(
                SelfAssessment.user_id.in_(subordinate_ids),
                SelfAssessment.status == "submitted",
                SupervisorFeedback.id.is_(None),
                *period_filter_sa
            )
        )
        feedback_pending_result = await self.session.execute(feedback_pending_query)
        evaluation_feedbacks_pending = feedback_pending_result.scalar() or 0

        # Count overdue feedbacks
        overdue_feedbacks = 0
        if current_period and current_period.evaluation_deadline:
            if today > current_period.evaluation_deadline:
                overdue_feedbacks = evaluation_feedbacks_pending

        total_pending = goal_approvals_pending + evaluation_feedbacks_pending

        return PendingTasksData(
            goal_approvals_pending=goal_approvals_pending,
            evaluation_feedbacks_pending=evaluation_feedbacks_pending,
            overdue_approvals=overdue_approvals,
            overdue_feedbacks=overdue_feedbacks,
            total_pending=total_pending
        )

    async def _get_subordinates_list(self, supervisor_id: UUID, org_id: str) -> SubordinatesListData:
        """Get detailed list of subordinates with their status"""
        subordinates = await self.user_repo.get_subordinates(supervisor_id, org_id)

        if not subordinates:
            return SubordinatesListData(
                subordinates=[],
                total_subordinates=0,
                needs_attention_count=0
            )

        # Get current period
        active_periods = await self.evaluation_period_repo.get_by_status(
            EvaluationPeriodStatus.ACTIVE, org_id
        )
        current_period = active_periods[0] if active_periods else None

        subordinate_infos: List[SubordinateInfo] = []
        needs_attention_count = 0

        for subordinate in subordinates:
            # Get department name
            department_name = None
            if subordinate.department_id:
                department = await self.department_repo.get_by_id(subordinate.department_id, org_id)
                if department:
                    department_name = department.name

            # Get goal status for current period
            has_pending_goals = False
            goals_count = 0
            goals_approved_count = 0

            if current_period:
                goals_query = select(Goal).where(
                    and_(Goal.user_id == subordinate.id, Goal.period_id == current_period.id)
                )
                goals_result = await self.session.execute(goals_query)
                goals = list(goals_result.scalars().all())
                goals_count = len(goals)
                goals_approved_count = sum(1 for g in goals if g.status == "approved")
                has_pending_goals = any(g.status == "submitted" for g in goals)

            # Get self-assessment status
            self_assessment_completed = False
            if current_period:
                assessment_query = select(SelfAssessment).where(
                    and_(
                        SelfAssessment.user_id == subordinate.id,
                        SelfAssessment.period_id == current_period.id,
                        SelfAssessment.status == "submitted"
                    )
                )
                assessment_result = await self.session.execute(assessment_query)
                self_assessment_completed = assessment_result.scalar_one_or_none() is not None

            # Get feedback status
            has_pending_feedback = False
            feedback_provided = False
            if current_period and self_assessment_completed:
                feedback_query = select(SupervisorFeedback).where(
                    and_(
                        SupervisorFeedback.supervisor_id == supervisor_id,
                        SupervisorFeedback.employee_id == subordinate.id,
                        SupervisorFeedback.period_id == current_period.id
                    )
                )
                feedback_result = await self.session.execute(feedback_query)
                feedback = feedback_result.scalar_one_or_none()
                if feedback:
                    feedback_provided = feedback.status == "submitted"
                else:
                    has_pending_feedback = True

            # Determine status and priority
            if has_pending_goals:
                status = SubordinateStatus.NEEDS_GOAL_APPROVAL
                priority = TaskPriority.HIGH
                needs_attention_count += 1
            elif has_pending_feedback:
                status = SubordinateStatus.NEEDS_FEEDBACK
                priority = TaskPriority.HIGH
                needs_attention_count += 1
            elif not goals_count or not self_assessment_completed:
                status = SubordinateStatus.DELAYED
                priority = TaskPriority.MEDIUM
                needs_attention_count += 1
            else:
                status = SubordinateStatus.ON_TRACK
                priority = TaskPriority.LOW

            # Get last activity (most recent updated_at from goals or assessments)
            last_activity = subordinate.updated_at

            subordinate_infos.append(SubordinateInfo(
                user_id=subordinate.id,
                name=subordinate.name,
                employee_code=subordinate.employee_code,
                department_name=department_name,
                status=status,
                priority=priority,
                has_pending_goals=has_pending_goals,
                has_pending_feedback=has_pending_feedback,
                goals_count=goals_count,
                goals_approved_count=goals_approved_count,
                self_assessment_completed=self_assessment_completed,
                feedback_provided=feedback_provided,
                last_activity=last_activity
            ))

        # Sort by priority and status
        priority_order = {TaskPriority.HIGH: 0, TaskPriority.MEDIUM: 1, TaskPriority.LOW: 2}
        subordinate_infos.sort(key=lambda x: (priority_order[x.priority], x.name))

        return SubordinatesListData(
            subordinates=subordinate_infos,
            total_subordinates=len(subordinates),
            needs_attention_count=needs_attention_count
        )

    # ========================================
    # EMPLOYEE DASHBOARD
    # ========================================

    async def get_employee_dashboard_data(
        self, employee_id: UUID, org_id: str
    ) -> EmployeeDashboardResponse:
        """Get complete employee dashboard data (all authenticated users)"""
        logger.info(f"Fetching employee dashboard data for user {employee_id} in org {org_id}")

        current_period_info = await self._get_current_period_info(org_id)
        personal_progress = await self._get_personal_progress(employee_id, org_id, current_period_info)
        todo_tasks = await self._get_todo_tasks(employee_id, org_id, current_period_info)
        deadline_alerts = await self._get_deadline_alerts(employee_id, org_id, current_period_info)
        history_access = await self._get_history_access(employee_id, org_id)

        return EmployeeDashboardResponse(
            current_period=current_period_info,
            personal_progress=personal_progress,
            todo_tasks=todo_tasks,
            deadline_alerts=deadline_alerts,
            history_access=history_access,
            last_updated=datetime.now(timezone.utc)
        )

    async def _get_current_period_info(self, org_id: str) -> CurrentPeriodInfo:
        """Get current active evaluation period information"""
        active_periods = await self.evaluation_period_repo.get_by_status(
            EvaluationPeriodStatus.ACTIVE, org_id
        )

        if not active_periods:
            return CurrentPeriodInfo()

        period = active_periods[0]  # Take the first active period
        today = date.today()

        # Calculate days until deadlines
        days_until_goal_deadline = None
        days_until_evaluation_deadline = None
        is_goal_deadline_passed = False
        is_evaluation_deadline_passed = False

        if period.goal_submission_deadline:
            days_until_goal_deadline = (period.goal_submission_deadline - today).days
            is_goal_deadline_passed = days_until_goal_deadline < 0

        if period.evaluation_deadline:
            days_until_evaluation_deadline = (period.evaluation_deadline - today).days
            is_evaluation_deadline_passed = days_until_evaluation_deadline < 0

        return CurrentPeriodInfo(
            period_id=period.id,
            period_name=period.name,
            period_type=period.period_type,
            start_date=period.start_date,
            end_date=period.end_date,
            goal_submission_deadline=period.goal_submission_deadline,
            evaluation_deadline=period.evaluation_deadline,
            days_until_goal_deadline=days_until_goal_deadline,
            days_until_evaluation_deadline=days_until_evaluation_deadline,
            is_goal_deadline_passed=is_goal_deadline_passed,
            is_evaluation_deadline_passed=is_evaluation_deadline_passed
        )

    async def _get_personal_progress(
        self, employee_id: UUID, org_id: str, current_period: CurrentPeriodInfo
    ) -> PersonalProgressData:
        """Calculate personal evaluation progress"""
        if not current_period.period_id:
            return PersonalProgressData(
                period_id=None,
                period_name=None,
                has_set_goals=False,
                goals_count=0,
                goals_approved=0,
                goals_pending=0,
                goals_rejected=0,
                has_completed_self_assessment=False,
                self_assessments_count=0,
                self_assessments_completed=0,
                self_assessments_pending=0,
                has_received_feedback=False,
                feedbacks_received=0,
                feedbacks_pending=0,
                overall_completion_percentage=0.0,
                current_stage=EvaluationStage.NOT_STARTED,
                last_updated=datetime.now(timezone.utc)
            )

        # Get goals for current period
        goals_query = select(Goal).where(
            and_(Goal.user_id == employee_id, Goal.period_id == current_period.period_id)
        )
        goals_result = await self.session.execute(goals_query)
        goals = list(goals_result.scalars().all())

        goals_count = len(goals)
        has_set_goals = goals_count > 0
        goals_approved = sum(1 for g in goals if g.status == "approved")
        goals_pending = sum(1 for g in goals if g.status == "submitted")
        goals_rejected = sum(1 for g in goals if g.status == "rejected")

        # Get self-assessments
        assessments_query = select(SelfAssessment).where(
            and_(
                SelfAssessment.user_id == employee_id,
                SelfAssessment.period_id == current_period.period_id
            )
        )
        assessments_result = await self.session.execute(assessments_query)
        assessments = list(assessments_result.scalars().all())

        self_assessments_count = len(assessments)
        self_assessments_completed = sum(1 for a in assessments if a.status == "submitted")
        self_assessments_pending = self_assessments_count - self_assessments_completed
        has_completed_self_assessment = self_assessments_completed > 0

        # Get feedbacks
        feedbacks_query = select(SupervisorFeedback).where(
            and_(
                SupervisorFeedback.employee_id == employee_id,
                SupervisorFeedback.period_id == current_period.period_id
            )
        )
        feedbacks_result = await self.session.execute(feedbacks_query)
        feedbacks = list(feedbacks_result.scalars().all())

        feedbacks_received = sum(1 for f in feedbacks if f.status == "submitted")
        feedbacks_pending = len(feedbacks) - feedbacks_received
        has_received_feedback = feedbacks_received > 0

        # Determine current stage
        if not has_set_goals:
            current_stage = EvaluationStage.NOT_STARTED
        elif goals_approved == 0:
            current_stage = EvaluationStage.GOALS_SETTING
        elif not has_completed_self_assessment:
            current_stage = EvaluationStage.SELF_ASSESSMENT
        elif not has_received_feedback:
            current_stage = EvaluationStage.FEEDBACK
        else:
            current_stage = EvaluationStage.COMPLETED

        # Calculate overall completion percentage
        goals_completion = (goals_approved / goals_count * 100) if goals_count > 0 else 0
        assessment_completion = (self_assessments_completed / goals_count * 100) if goals_count > 0 else 0
        feedback_completion = (feedbacks_received / goals_count * 100) if goals_count > 0 else 0
        overall_completion_percentage = (goals_completion + assessment_completion + feedback_completion) / 3

        return PersonalProgressData(
            period_id=current_period.period_id,
            period_name=current_period.period_name,
            has_set_goals=has_set_goals,
            goals_count=goals_count,
            goals_approved=goals_approved,
            goals_pending=goals_pending,
            goals_rejected=goals_rejected,
            has_completed_self_assessment=has_completed_self_assessment,
            self_assessments_count=self_assessments_count,
            self_assessments_completed=self_assessments_completed,
            self_assessments_pending=self_assessments_pending,
            has_received_feedback=has_received_feedback,
            feedbacks_received=feedbacks_received,
            feedbacks_pending=feedbacks_pending,
            overall_completion_percentage=round(overall_completion_percentage, 2),
            current_stage=current_stage,
            last_updated=datetime.now(timezone.utc)
        )

    async def _get_todo_tasks(
        self, employee_id: UUID, org_id: str, current_period: CurrentPeriodInfo
    ) -> TodoTasksData:
        """Generate TODO tasks based on current progress"""
        tasks: List[TodoTask] = []

        if not current_period.period_id:
            return TodoTasksData(
                tasks=[],
                total_tasks=0,
                high_priority_count=0,
                overdue_count=0,
                last_updated=datetime.now(timezone.utc)
            )

        # Check if goals are set
        goals_query = select(Goal).where(
            and_(Goal.user_id == employee_id, Goal.period_id == current_period.period_id)
        )
        goals_result = await self.session.execute(goals_query)
        goals = list(goals_result.scalars().all())

        if not goals:
            # Task: Set goals
            is_overdue = current_period.is_goal_deadline_passed
            tasks.append(TodoTask(
                id=f"set_goals_{current_period.period_id}",
                type=TaskType.SET_GOALS,
                title="目標を設定してください",
                description=f"{current_period.period_name}の目標を設定する必要があります",
                priority=TaskPriority.HIGH,
                deadline=current_period.goal_submission_deadline,
                days_remaining=current_period.days_until_goal_deadline,
                is_overdue=is_overdue,
                action_url=f"/evaluation/goals/create?period={current_period.period_id}",
                related_entity_id=current_period.period_id
            ))
        else:
            # Check for draft goals that need submission
            draft_goals = [g for g in goals if g.status == "draft"]
            if draft_goals:
                is_overdue = current_period.is_goal_deadline_passed
                tasks.append(TodoTask(
                    id=f"submit_goals_{current_period.period_id}",
                    type=TaskType.SUBMIT_GOALS,
                    title="目標を提出してください",
                    description=f"{len(draft_goals)}件の下書き目標があります",
                    priority=TaskPriority.HIGH,
                    deadline=current_period.goal_submission_deadline,
                    days_remaining=current_period.days_until_goal_deadline,
                    is_overdue=is_overdue,
                    action_url=f"/evaluation/goals?period={current_period.period_id}",
                    related_entity_id=current_period.period_id
                ))

            # Check for rejected goals that need revision
            rejected_goals = [g for g in goals if g.status == "rejected"]
            if rejected_goals:
                for goal in rejected_goals:
                    tasks.append(TodoTask(
                        id=f"revise_goal_{goal.id}",
                        type=TaskType.REVISE_GOALS,
                        title="却下された目標を修正してください",
                        description=f"目標「{goal.goal_category}」が却下されました",
                        priority=TaskPriority.HIGH,
                        deadline=current_period.goal_submission_deadline,
                        days_remaining=current_period.days_until_goal_deadline,
                        is_overdue=current_period.is_goal_deadline_passed,
                        action_url=f"/evaluation/goals/{goal.id}/edit",
                        related_entity_id=goal.id
                    ))

            # Check for approved goals without self-assessment
            approved_goals = [g for g in goals if g.status == "approved"]
            if approved_goals:
                for goal in approved_goals:
                    assessment_query = select(SelfAssessment).where(
                        and_(
                            SelfAssessment.user_id == employee_id,
                            SelfAssessment.goal_id == goal.id,
                            SelfAssessment.status == "submitted"
                        )
                    )
                    assessment_result = await self.session.execute(assessment_query)
                    assessment = assessment_result.scalar_one_or_none()

                    if not assessment:
                        is_overdue = current_period.is_evaluation_deadline_passed
                        tasks.append(TodoTask(
                            id=f"self_assess_{goal.id}",
                            type=TaskType.COMPLETE_SELF_ASSESSMENT,
                            title="自己評価を完了してください",
                            description=f"目標「{goal.goal_category}」の自己評価が未完了です",
                            priority=TaskPriority.MEDIUM if not is_overdue else TaskPriority.HIGH,
                            deadline=current_period.evaluation_deadline,
                            days_remaining=current_period.days_until_evaluation_deadline,
                            is_overdue=is_overdue,
                            action_url=f"/evaluation/self-assessments/create?goal={goal.id}",
                            related_entity_id=goal.id
                        ))

        # Check for feedbacks to review
        feedbacks_query = select(SupervisorFeedback).where(
            and_(
                SupervisorFeedback.employee_id == employee_id,
                SupervisorFeedback.period_id == current_period.period_id,
                SupervisorFeedback.status == "submitted"
            )
        )
        feedbacks_result = await self.session.execute(feedbacks_query)
        feedbacks = list(feedbacks_result.scalars().all())

        if feedbacks:
            tasks.append(TodoTask(
                id=f"review_feedback_{current_period.period_id}",
                type=TaskType.REVIEW_FEEDBACK,
                title="フィードバックを確認してください",
                description=f"{len(feedbacks)}件の新しいフィードバックがあります",
                priority=TaskPriority.MEDIUM,
                deadline=None,
                days_remaining=None,
                is_overdue=False,
                action_url=f"/evaluation/feedbacks?period={current_period.period_id}",
                related_entity_id=current_period.period_id
            ))

        high_priority_count = sum(1 for t in tasks if t.priority == TaskPriority.HIGH)
        overdue_count = sum(1 for t in tasks if t.is_overdue)

        return TodoTasksData(
            tasks=tasks,
            total_tasks=len(tasks),
            high_priority_count=high_priority_count,
            overdue_count=overdue_count,
            last_updated=datetime.now(timezone.utc)
        )

    async def _get_deadline_alerts(
        self, employee_id: UUID, org_id: str, current_period: CurrentPeriodInfo
    ) -> DeadlineAlertsData:
        """Generate deadline alerts based on upcoming deadlines"""
        alerts: List[DeadlineAlert] = []

        if not current_period.period_id:
            return DeadlineAlertsData(
                alerts=[],
                total_alerts=0,
                critical_count=0,
                overdue_count=0,
                last_updated=datetime.now(timezone.utc)
            )

        # Goal submission deadline alert
        if current_period.goal_submission_deadline and current_period.days_until_goal_deadline is not None:
            days = current_period.days_until_goal_deadline
            if days <= 7 or days < 0:
                urgency = DeadlineUrgency.CRITICAL if days <= 3 else DeadlineUrgency.WARNING
                is_overdue = days < 0

                alerts.append(DeadlineAlert(
                    id=f"goal_deadline_{current_period.period_id}",
                    title="目標提出期限",
                    description=f"{current_period.period_name}の目標提出期限です",
                    deadline=current_period.goal_submission_deadline,
                    days_remaining=days,
                    urgency=urgency,
                    is_overdue=is_overdue,
                    type="goal_submission",
                    action_url=f"/evaluation/goals?period={current_period.period_id}",
                    related_entity_id=current_period.period_id
                ))

        # Evaluation deadline alert
        if current_period.evaluation_deadline and current_period.days_until_evaluation_deadline is not None:
            days = current_period.days_until_evaluation_deadline
            if days <= 7 or days < 0:
                urgency = DeadlineUrgency.CRITICAL if days <= 3 else DeadlineUrgency.WARNING
                is_overdue = days < 0

                alerts.append(DeadlineAlert(
                    id=f"eval_deadline_{current_period.period_id}",
                    title="評価提出期限",
                    description=f"{current_period.period_name}の評価提出期限です",
                    deadline=current_period.evaluation_deadline,
                    days_remaining=days,
                    urgency=urgency,
                    is_overdue=is_overdue,
                    type="evaluation",
                    action_url=f"/evaluation/self-assessments?period={current_period.period_id}",
                    related_entity_id=current_period.period_id
                ))

        critical_count = sum(1 for a in alerts if a.urgency == DeadlineUrgency.CRITICAL)
        overdue_count = sum(1 for a in alerts if a.is_overdue)

        return DeadlineAlertsData(
            alerts=alerts,
            total_alerts=len(alerts),
            critical_count=critical_count,
            overdue_count=overdue_count,
            last_updated=datetime.now(timezone.utc)
        )

    async def _get_history_access(self, employee_id: UUID, org_id: str) -> HistoryAccessData:
        """Get historical evaluation periods summary"""
        # Get all completed periods
        completed_periods = await self.evaluation_period_repo.get_by_status(
            EvaluationPeriodStatus.COMPLETED, org_id
        )

        if not completed_periods:
            return HistoryAccessData(
                recent_periods=[],
                total_periods=0,
                has_historical_data=False
            )

        # Sort by end_date descending and take most recent 5
        completed_periods.sort(key=lambda p: p.end_date, reverse=True)
        recent_periods = completed_periods[:5]

        period_summaries: List[HistoricalPeriodSummary] = []

        for period in recent_periods:
            # Count goals for this period
            goals_query = select(func.count(Goal.id)).where(
                and_(Goal.user_id == employee_id, Goal.period_id == period.id)
            )
            goals_result = await self.session.execute(goals_query)
            goals_count = goals_result.scalar() or 0

            # Count completed assessments
            assessments_query = select(func.count(SelfAssessment.id)).where(
                and_(
                    SelfAssessment.user_id == employee_id,
                    SelfAssessment.period_id == period.id,
                    SelfAssessment.status == "submitted"
                )
            )
            assessments_result = await self.session.execute(assessments_query)
            completed_assessments = assessments_result.scalar() or 0

            # Count received feedbacks
            feedbacks_query = select(func.count(SupervisorFeedback.id)).where(
                and_(
                    SupervisorFeedback.employee_id == employee_id,
                    SupervisorFeedback.period_id == period.id,
                    SupervisorFeedback.status == "submitted"
                )
            )
            feedbacks_result = await self.session.execute(feedbacks_query)
            received_feedbacks = feedbacks_result.scalar() or 0

            period_summaries.append(HistoricalPeriodSummary(
                period_id=period.id,
                period_name=period.name,
                period_type=period.period_type,
                end_date=period.end_date,
                goals_count=goals_count,
                completed_assessments_count=completed_assessments,
                received_feedbacks_count=received_feedbacks
            ))

        return HistoryAccessData(
            recent_periods=period_summaries,
            total_periods=len(completed_periods),
            has_historical_data=len(completed_periods) > 0
        )