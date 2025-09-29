import logging
from uuid import UUID
import pytest
import pytest_asyncio

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database.repositories.supervisor_review_repository import SupervisorReviewRepository
from app.database.repositories.goal_repo import GoalRepository
from app.schemas.goal import GoalCreate, GoalStatus, PerformanceGoalType
from app.database.session import get_db_session
from tests.repositories.test_logging_utils import (
    setup_repository_test_logging,
    log_test_start,
    log_data_verification,
    log_assertion_success,
    log_supabase_connectivity,
)


# Set up centralized logging for supervisor review repository tests
TEST_LOG_FILE = setup_repository_test_logging('supervisor_review')


class TestSupervisorReviewRepository:
    """Test SupervisorReviewRepository with actual Supabase data following project patterns"""

    @pytest_asyncio.fixture
    async def session(self) -> AsyncSession:
        """Get actual database session"""
        async for session in get_db_session():
            yield session
            break

    @pytest_asyncio.fixture
    async def review_repo(self, session: AsyncSession) -> SupervisorReviewRepository:
        return SupervisorReviewRepository(session)

    @pytest_asyncio.fixture
    async def goal_repo(self, session: AsyncSession) -> GoalRepository:
        return GoalRepository(session)

    # Seeded IDs from existing tests
    SEED_USER_IDS = {
        "yamada": UUID("123e4567-e89b-12d3-a456-426614174000"),
        "sato": UUID("223e4567-e89b-12d3-a456-426614174001"),
        "tanaka": UUID("333e4567-e89b-12d3-a456-426614174002"),
    }

    EVALUATION_PERIOD_ID = UUID("a1b2c3d4-e5f6-7890-1234-56789abcdef0")

    @pytest.mark.asyncio
    async def test_supabase_connectivity(self, session: AsyncSession):
        """Test basic Supabase connectivity (pattern parity with other repo tests)."""
        log_test_start("test_supabase_connectivity")
        result = await session.execute(text("SELECT 1 as test"))
        test_value = result.scalar()
        log_supabase_connectivity(True, f"Query executed successfully: {test_value}")
        assert test_value == 1
        log_assertion_success("Supabase connectivity verified")

    @pytest.mark.asyncio
    async def test_create_and_delete_review(self, session: AsyncSession, review_repo: SupervisorReviewRepository, goal_repo: GoalRepository):
        """Create a goal, create a supervisor review for it, then delete both (clean up)."""
        log_test_start("test_create_and_delete_review")

        # Create a temporary goal for testing
        user_id = self.SEED_USER_IDS["yamada"]
        period_id = self.EVALUATION_PERIOD_ID

        goal_data = GoalCreate(
            periodId=period_id,
            goalCategory="業績目標",
            weight=10.0,
            performanceGoalType=PerformanceGoalType.QUANTITATIVE,
            specificGoalText="Supervisor review repo test goal",
            achievementCriteriaText="Criteria",
            meansMethodsText="Methods",
            status=GoalStatus.DRAFT,
        )

        try:
            goal_model = await goal_repo.create_goal(goal_data, user_id)
            await session.flush()

            log_data_verification("Goal creation for review", {
                "goal_id": str(goal_model.id),
                "user_id": str(goal_model.user_id),
                "period_id": str(goal_model.period_id),
            })

            # Create a supervisor review with a seeded supervisor user
            supervisor_id = self.SEED_USER_IDS["sato"]
            review = await review_repo.create(
                goal_id=goal_model.id,
                period_id=goal_model.period_id,
                supervisor_id=supervisor_id,
                action="pending",
                comment="",
                status="draft",
            )
            await session.flush()

            log_data_verification("SupervisorReview creation", {
                "review_id": str(review.id),
                "goal_id": str(review.goal_id),
                "period_id": str(review.period_id),
                "supervisor_id": str(review.supervisor_id),
                "status": review.status,
                "action": review.action,
            })

            assert review.id is not None
            assert review.goal_id == goal_model.id
            assert review.period_id == goal_model.period_id
            assert review.supervisor_id == supervisor_id
            assert review.status == "draft"
            assert review.action == "pending"

            # Clean up: delete review and goal
            deleted = await review_repo.delete(review.id)
            assert deleted is True
            await goal_repo.delete_goal(goal_model.id)
            await session.commit()

            log_assertion_success("SupervisorReview created and deleted successfully")

        except Exception as e:
            await session.rollback()
            logging.error(f"SupervisorReview repo create/delete test failed: {e}")
            raise

    @pytest.mark.asyncio
    async def test_list_and_count_queries(self, review_repo: SupervisorReviewRepository, session: AsyncSession):
        """Verify list and count methods work and return correct types."""
        log_test_start("test_list_and_count_queries")

        supervisor_id = self.SEED_USER_IDS["sato"]
        reviews = await review_repo.get_by_supervisor(supervisor_id)
        count = await review_repo.count_by_supervisor(supervisor_id)

        log_data_verification("List/count by supervisor", {
            "supervisor_id": str(supervisor_id),
            "list_len": len(reviews),
            "count": count,
        })

        assert isinstance(reviews, list)
        assert isinstance(count, int)
        assert count >= 0

        log_assertion_success("List/count queries returned valid results")


