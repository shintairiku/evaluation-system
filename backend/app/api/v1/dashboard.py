"""
Dashboard API endpoints for admin, supervisor, and employee dashboards.
Provides aggregated data views for different user roles.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...schemas.dashboard import (
    AdminDashboardResponse, SystemStatsData, PendingApprovalsData, SystemAlertsData,
    SupervisorDashboardResponse, TeamProgressData, PendingTasksData, SubordinatesListData,
    EmployeeDashboardResponse, PersonalProgressData, TodoTasksData,
    DeadlineAlertsData, HistoryAccessData
)
from ...schemas.common import BaseResponse
from ...services.dashboard_service import DashboardService
from ...security import AuthContext, get_auth_context
from ...security.dependencies import require_admin, require_supervisor_or_above
from ...core.exceptions import NotFoundError

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# ========================================
# ADMIN DASHBOARD ENDPOINTS
# ========================================

@router.get("/admin", response_model=AdminDashboardResponse)
async def get_admin_dashboard(
    context: AuthContext = Depends(require_admin),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get complete admin dashboard data.

    **Required Permission:** admin role

    Returns:
    - System statistics (users, departments, periods, goals, evaluations)
    - Pending approvals (users, goals, evaluations)
    - System alerts (deadline warnings, critical notifications)
    """
    try:
        service = DashboardService(session)
        dashboard_data = await service.get_admin_dashboard_data(context.organization_id)

        return dashboard_data

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching admin dashboard: {str(e)}"
        )


@router.get("/admin/stats", response_model=SystemStatsData)
async def get_admin_stats(
    context: AuthContext = Depends(require_admin),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get system statistics only.

    **Required Permission:** admin role

    Returns:
    - Total and active user counts
    - Department count
    - Active evaluation periods count
    - Total goals and evaluations count
    """
    try:
        service = DashboardService(session)
        dashboard_data = await service.get_admin_dashboard_data(context.organization_id)

        return dashboard_data.system_stats

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching system stats: {str(e)}"
        )


@router.get("/admin/approvals", response_model=PendingApprovalsData)
async def get_admin_approvals(
    context: AuthContext = Depends(require_admin),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get pending approvals information only.

    **Required Permission:** admin role

    Returns:
    - Pending user approvals
    - Pending goal approvals
    - Pending evaluation reviews
    - Total pending count
    """
    try:
        service = DashboardService(session)
        dashboard_data = await service.get_admin_dashboard_data(context.organization_id)

        return dashboard_data.pending_approvals

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching pending approvals: {str(e)}"
        )


@router.get("/admin/alerts", response_model=SystemAlertsData)
async def get_admin_alerts(
    context: AuthContext = Depends(require_admin),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get system alerts only.

    **Required Permission:** admin role

    Returns:
    - List of active system alerts
    - Alert counts by severity (critical, warning)
    - Total alert count
    """
    try:
        service = DashboardService(session)
        dashboard_data = await service.get_admin_dashboard_data(context.organization_id)

        return dashboard_data.system_alerts

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching system alerts: {str(e)}"
        )


@router.post("/admin/alerts/{alert_id}/dismiss", response_model=BaseResponse)
async def dismiss_admin_alert(
    alert_id: str,
    context: AuthContext = Depends(require_admin),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Dismiss/acknowledge a system alert.

    **Required Permission:** admin role

    Note: Currently this endpoint acknowledges the request but does not persist dismissals.
    Alert dismissal persistence can be implemented in future iterations if needed.
    """
    try:
        # TODO: Implement alert dismissal persistence if needed
        # For now, just acknowledge the request

        return BaseResponse(
            success=True,
            message=f"Alert {alert_id} dismissed successfully"
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error dismissing alert: {str(e)}"
        )


# ========================================
# SUPERVISOR DASHBOARD ENDPOINTS
# ========================================

@router.get("/supervisor", response_model=SupervisorDashboardResponse)
async def get_supervisor_dashboard(
    context: AuthContext = Depends(require_supervisor_or_above),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get complete supervisor dashboard data for the current user.

    **Required Permission:** supervisor, manager, or admin role

    Uses context.user_id automatically - shows data for the authenticated user.

    Returns:
    - Team progress statistics
    - Pending tasks (goal approvals, feedback submissions)
    - Subordinates list with status
    """
    try:
        service = DashboardService(session)
        dashboard_data = await service.get_supervisor_dashboard_data(
            context.user_id,
            context.organization_id
        )

        return dashboard_data

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching supervisor dashboard: {str(e)}"
        )


@router.get("/supervisor/team-progress", response_model=TeamProgressData)
async def get_supervisor_team_progress(
    context: AuthContext = Depends(require_supervisor_or_above),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get team progress statistics only.

    **Required Permission:** supervisor, manager, or admin role

    Returns:
    - Subordinate counts (total, active)
    - Goal setting and approval statistics
    - Self-assessment completion statistics
    - Feedback provision statistics
    - Overall team completion rate
    """
    try:
        service = DashboardService(session)
        dashboard_data = await service.get_supervisor_dashboard_data(
            context.user_id,
            context.organization_id
        )

        return dashboard_data.team_progress

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching team progress: {str(e)}"
        )


@router.get("/supervisor/pending-tasks", response_model=PendingTasksData)
async def get_supervisor_pending_tasks(
    context: AuthContext = Depends(require_supervisor_or_above),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get pending tasks for supervisor.

    **Required Permission:** supervisor, manager, or admin role

    Returns:
    - Goal approvals pending
    - Evaluation feedbacks pending
    - Overdue approvals count
    - Overdue feedbacks count
    - Total pending tasks
    """
    try:
        service = DashboardService(session)
        dashboard_data = await service.get_supervisor_dashboard_data(
            context.user_id,
            context.organization_id
        )

        return dashboard_data.pending_tasks

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching pending tasks: {str(e)}"
        )


@router.get("/supervisor/subordinates", response_model=SubordinatesListData)
async def get_supervisor_subordinates(
    context: AuthContext = Depends(require_supervisor_or_above),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get subordinates list with their status.

    **Required Permission:** supervisor, manager, or admin role

    Returns:
    - List of subordinates with detailed status
    - Each subordinate includes:
      - Basic info (name, employee code, department)
      - Current status (needs approval, needs feedback, on track, delayed)
      - Priority level for supervisor attention
      - Goal and evaluation progress
    - Count of subordinates needing attention
    """
    try:
        service = DashboardService(session)
        dashboard_data = await service.get_supervisor_dashboard_data(
            context.user_id,
            context.organization_id
        )

        return dashboard_data.subordinates

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching subordinates: {str(e)}"
        )


# ========================================
# EMPLOYEE DASHBOARD ENDPOINTS
# ========================================

@router.get("/employee", response_model=EmployeeDashboardResponse)
async def get_employee_dashboard(
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get complete employee dashboard data for the current user.

    **Authentication Required:** Any authenticated user

    Uses context.user_id automatically - shows data for the authenticated user.

    Returns:
    - Current evaluation period information
    - Personal progress through evaluation stages
    - TODO tasks list
    - Deadline alerts
    - Historical evaluation data access
    """
    try:
        service = DashboardService(session)
        dashboard_data = await service.get_employee_dashboard_data(
            context.user_id,
            context.organization_id
        )

        return dashboard_data

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching employee dashboard: {str(e)}"
        )


@router.get("/employee/progress", response_model=PersonalProgressData)
async def get_employee_progress(
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get personal evaluation progress only.

    **Authentication Required:** Any authenticated user

    Returns:
    - Goal setting status and counts
    - Self-assessment completion status
    - Feedback reception status
    - Overall completion percentage
    - Current evaluation stage
    """
    try:
        service = DashboardService(session)
        dashboard_data = await service.get_employee_dashboard_data(
            context.user_id,
            context.organization_id
        )

        return dashboard_data.personal_progress

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching personal progress: {str(e)}"
        )


@router.get("/employee/todos", response_model=TodoTasksData)
async def get_employee_todos(
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get TODO tasks list only.

    **Authentication Required:** Any authenticated user

    Returns:
    - List of pending tasks
    - Each task includes:
      - Type (set goals, submit goals, self-assess, review feedback, etc.)
      - Title and description
      - Priority level (high, medium, low)
      - Deadline and days remaining
      - Overdue status
      - Action URL
    - High priority count
    - Overdue count
    """
    try:
        service = DashboardService(session)
        dashboard_data = await service.get_employee_dashboard_data(
            context.user_id,
            context.organization_id
        )

        return dashboard_data.todo_tasks

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching TODO tasks: {str(e)}"
        )


@router.get("/employee/deadlines", response_model=DeadlineAlertsData)
async def get_employee_deadlines(
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get deadline alerts only.

    **Authentication Required:** Any authenticated user

    Returns:
    - List of deadline alerts
    - Each alert includes:
      - Title and description
      - Deadline date
      - Days remaining
      - Urgency level (critical, warning, normal)
      - Overdue status
      - Type (goal submission, evaluation, etc.)
      - Action URL
    - Critical alerts count (<=3 days)
    - Overdue count
    """
    try:
        service = DashboardService(session)
        dashboard_data = await service.get_employee_dashboard_data(
            context.user_id,
            context.organization_id
        )

        return dashboard_data.deadline_alerts

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching deadline alerts: {str(e)}"
        )


@router.get("/employee/history", response_model=HistoryAccessData)
async def get_employee_history(
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get historical evaluation data access.

    **Authentication Required:** Any authenticated user

    Returns:
    - Recent completed evaluation periods (up to 5 most recent)
    - Each period includes:
      - Period name and type
      - End date
      - Goals count
      - Completed assessments count
      - Received feedbacks count
    - Total historical periods count
    - Has historical data flag
    """
    try:
        service = DashboardService(session)
        dashboard_data = await service.get_employee_dashboard_data(
            context.user_id,
            context.organization_id
        )

        return dashboard_data.history_access

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching history data: {str(e)}"
        )