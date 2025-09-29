"""
Tests for SupervisorReviewService following existing service test patterns.
"""
import pytest
from unittest.mock import MagicMock
from uuid import UUID

from app.services.supervisor_review_service import SupervisorReviewService
from app.schemas.supervisor_review import SupervisorReviewCreate, SupervisorAction, SupervisorReviewUpdate
from app.schemas.common import PaginationParams
from app.security.context import AuthContext, RoleInfo
from app.security.permissions import Permission
from app.database.session import get_db_session
from app.schemas.goal import GoalCreate, GoalStatus, PerformanceGoalType

from tests.services.test_logging_utils import (
    setup_service_test_logging,
    log_test_start,
    log_test_success,
    log_test_failure,
    log_assertion_success,
    log_business_logic_verification,
)


TEST_LOG_FILE = setup_service_test_logging('supervisor_review')


def create_mock_auth_context(user_id: str, role: str = "supervisor") -> AuthContext:
    mock_context = MagicMock(spec=AuthContext)
    mock_context.user_id = UUID(user_id)
    mock_context.clerk_user_id = f"clerk_{role}"
    mock_context.roles = [RoleInfo(id=1, name=role, description=f"Test {role} role")]

    if role == "admin":
        mock_context.has_permission.return_value = True
    elif role == "supervisor":
        mock_context.has_permission.side_effect = lambda perm: perm in [
            Permission.GOAL_READ_SELF,
            Permission.GOAL_READ_SUBORDINATES,
            Permission.GOAL_MANAGE,
            Permission.GOAL_APPROVE,
        ]
    else:
        mock_context.has_permission.side_effect = lambda perm: perm in [Permission.GOAL_READ_SELF]
    return mock_context


@pytest.mark.asyncio
async def test_create_list_submit_review():
    test_name = "test_create_list_submit_review"
    log_test_start(test_name)
    try:
        async for session in get_db_session():
            service = SupervisorReviewService(session)

            # Create a temporary goal to attach review to
            from app.services.goal_service import GoalService
            goal_service = GoalService(session)
            employee_context = create_mock_auth_context("123e4567-e89b-12d3-a456-426614174000", "employee")

            goal_data = GoalCreate(
                periodId=UUID("a1b2c3d4-e5f6-7890-1234-56789abcdef0"),
                goalCategory="業績目標",
                weight=10.0,
                performanceGoalType=PerformanceGoalType.QUANTITATIVE,
                specificGoalText="Temp for review",
                achievementCriteriaText="criteria",
                meansMethodsText="methods",
                status=GoalStatus.DRAFT,
            )
            created_goal = await goal_service.goal_repo.create_goal(goal_data, employee_context.user_id)
            await session.flush()

            supervisor_context = create_mock_auth_context("223e4567-e89b-12d3-a456-426614174001", "supervisor")

            # Create review (draft/pending)
            review_create = SupervisorReviewCreate(
                goalId=created_goal.id,
                periodId=created_goal.period_id,
                action=SupervisorAction.PENDING,
                comment="",
                status="draft",
            )
            created = await service.create_review(review_create, supervisor_context)
            log_business_logic_verification("Review creation", created.model_dump())
            assert created.id is not None

            # List reviews for supervisor
            pagination = PaginationParams(page=1, limit=10)
            result = await service.get_reviews(supervisor_context, period_id=created_goal.period_id, pagination=pagination)
            log_business_logic_verification("List reviews", {"total": result.total, "items": len(result.items)})
            assert isinstance(result.total, int)

            # Submit review (still pending action, should keep goal in pending_approval)
            updated = await service.update_review(created.id, SupervisorReviewUpdate(status="submitted"), supervisor_context)
            assert updated.status == "submitted"

            # Cleanup
            await service.repo.delete(created.id)
            await goal_service.goal_repo.delete_goal(created_goal.id)
            await session.commit()

            log_assertion_success("Create/list/submit flow passed")
            break
        log_test_success(test_name)
    except Exception as e:
        log_test_failure(test_name, e)
        raise


