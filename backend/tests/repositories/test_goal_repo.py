import logging
from uuid import UUID
from decimal import Decimal
import pytest

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import pytest_asyncio

from app.database.repositories.goal_repo import GoalRepository
from app.schemas.goal import GoalCreate, GoalUpdate, GoalStatus, PerformanceGoalType
from app.database.session import get_db_session
from tests.repositories.test_logging_utils import (
    setup_repository_test_logging, 
    log_test_start, 
    log_data_verification, 
    log_assertion_success,
    log_supabase_connectivity
)

# Set up centralized logging for goal repository tests
TEST_LOG_FILE = setup_repository_test_logging('goal')


class TestGoalRepository:
    """Test GoalRepository with actual Supabase data"""
    
    @pytest_asyncio.fixture
    async def session(self):
        """Get actual database session"""
        async for session in get_db_session():
            yield session
            break
    
    @pytest_asyncio.fixture
    async def goal_repo(self, session):
        """Create GoalRepository instance"""
        return GoalRepository(session)
    
    # Test data from existing seed data
    SEED_USER_IDS = {
        "yamada": UUID("123e4567-e89b-12d3-a456-426614174000"), 
        "sato": UUID("223e4567-e89b-12d3-a456-426614174001"),
        "tanaka": UUID("333e4567-e89b-12d3-a456-426614174002")
    }
    
    EVALUATION_PERIOD_ID = UUID("a1b2c3d4-e5f6-7890-1234-56789abcdef0")
    
    # Existing goal IDs from seed data
    EXISTING_GOAL_IDS = {
        "performance_goal": UUID("11111111-1111-1111-1111-111111111111"),
        "competency_goal": UUID("55555555-5555-5555-5555-555555555555"),
        "core_value_goal": UUID("77777777-7777-7777-7777-777777777777")
    }

    @pytest.mark.asyncio
    async def test_supabase_connectivity(self, session: AsyncSession):
        """Test basic Supabase connectivity"""
        log_test_start("test_supabase_connectivity")
        
        try:
            # Test basic query execution
            result = await session.execute(text("SELECT 1 as test"))
            test_value = result.scalar()
            
            log_supabase_connectivity(True, f"Query executed successfully: {test_value}")
            assert test_value == 1
            log_assertion_success("Supabase connectivity verified")
            
        except Exception as e:
            log_supabase_connectivity(False, f"Connection failed: {str(e)}")
            raise

    @pytest.mark.asyncio
    async def test_get_goal_by_id(self, goal_repo: GoalRepository, session: AsyncSession):
        """Test getting a goal by ID"""
        log_test_start("test_get_goal_by_id")
        
        goal_id = self.EXISTING_GOAL_IDS["performance_goal"]
        
        # Get goal by ID
        goal = await goal_repo.get_goal_by_id(goal_id)
        
        log_data_verification("Goal retrieval", {
            "goal_id": str(goal_id),
            "found": goal is not None,
            "goal_category": goal.goal_category if goal else None,
            "status": goal.status if goal else None
        })
        
        assert goal is not None, f"Goal {goal_id} should exist"
        assert goal.id == goal_id
        assert hasattr(goal, 'goal_category')
        assert hasattr(goal, 'status')
        
        log_assertion_success(f"Goal {goal_id} retrieved successfully")

    @pytest.mark.asyncio
    async def test_get_goal_by_id_with_details(self, goal_repo: GoalRepository, session: AsyncSession):
        """Test getting a goal by ID with relationship details"""
        log_test_start("test_get_goal_by_id_with_details")
        
        goal_id = self.EXISTING_GOAL_IDS["performance_goal"]
        
        # Get goal with details
        goal = await goal_repo.get_goal_by_id_with_details(goal_id)
        
        log_data_verification("Goal with details retrieval", {
            "goal_id": str(goal_id),
            "found": goal is not None,
            "has_user": hasattr(goal, 'user') if goal else False,
            "has_period": hasattr(goal, 'period') if goal else False,
        })
        
        assert goal is not None, f"Goal {goal_id} should exist"
        assert goal.id == goal_id
        # Note: Relationships might be lazy-loaded, so we just check they exist as attributes
        assert hasattr(goal, 'user')
        assert hasattr(goal, 'period')
        
        log_assertion_success(f"Goal {goal_id} with details retrieved successfully")

    @pytest.mark.asyncio
    async def test_get_goals_by_user_and_period(self, goal_repo: GoalRepository, session: AsyncSession):
        """Test getting goals by user and period"""
        log_test_start("test_get_goals_by_user_and_period")
        
        user_id = self.SEED_USER_IDS["yamada"]
        period_id = self.EVALUATION_PERIOD_ID
        
        # Get goals by user and period
        goals = await goal_repo.get_goals_by_user_and_period(user_id, period_id)
        
        log_data_verification("Goals by user and period", {
            "user_id": str(user_id),
            "period_id": str(period_id),
            "goal_count": len(goals),
            "goal_categories": [g.goal_category for g in goals] if goals else []
        })
        
        assert isinstance(goals, list)
        
        # If goals exist, verify they belong to the user and period
        for goal in goals:
            assert goal.user_id == user_id
            assert goal.period_id == period_id
        
        log_assertion_success(f"Found {len(goals)} goals for user {user_id}")

    @pytest.mark.asyncio
    async def test_search_goals(self, goal_repo: GoalRepository, session: AsyncSession):
        """Test searching goals with filters"""
        log_test_start("test_search_goals")
        
        user_ids = [self.SEED_USER_IDS["yamada"], self.SEED_USER_IDS["tanaka"]]
        
        # Search goals with user filter
        goals = await goal_repo.search_goals(user_ids=user_ids)
        
        log_data_verification("Goal search results", {
            "user_ids": [str(uid) for uid in user_ids],
            "goal_count": len(goals),
            "unique_users": len(set(g.user_id for g in goals)) if goals else 0
        })
        
        assert isinstance(goals, list)
        
        # If goals exist, verify they belong to the specified users
        for goal in goals:
            assert goal.user_id in user_ids
        
        log_assertion_success(f"Search returned {len(goals)} goals")

    @pytest.mark.asyncio
    async def test_count_goals(self, goal_repo: GoalRepository, session: AsyncSession):
        """Test counting goals with filters"""
        log_test_start("test_count_goals")
        
        user_ids = [self.SEED_USER_IDS["yamada"]]
        
        # Count goals
        count = await goal_repo.count_goals(user_ids=user_ids)
        
        log_data_verification("Goal count", {
            "user_ids": [str(uid) for uid in user_ids],
            "count": count
        })
        
        assert isinstance(count, int)
        assert count >= 0
        
        log_assertion_success(f"Goal count: {count}")

    @pytest.mark.asyncio
    async def test_get_weight_totals_by_category(self, goal_repo: GoalRepository, session: AsyncSession):
        """Test getting weight totals by category"""
        log_test_start("test_get_weight_totals_by_category")
        
        user_id = self.SEED_USER_IDS["yamada"]
        period_id = self.EVALUATION_PERIOD_ID
        
        # Get weight totals by category
        weight_totals = await goal_repo.get_weight_totals_by_category(user_id, period_id)
        
        log_data_verification("Weight totals by category", {
            "user_id": str(user_id),
            "period_id": str(period_id),
            "categories": list(weight_totals.keys()),
            "totals": {k: float(v) for k, v in weight_totals.items()}
        })
        
        assert isinstance(weight_totals, dict)
        
        # Verify all values are Decimal and non-negative
        for category, total in weight_totals.items():
            assert isinstance(total, Decimal)
            assert total >= 0
        
        log_assertion_success(f"Weight totals calculated for {len(weight_totals)} categories")

    @pytest.mark.asyncio
    async def test_create_goal(self, goal_repo: GoalRepository, session: AsyncSession):
        """Test creating a new goal"""
        log_test_start("test_create_goal")
        
        user_id = self.SEED_USER_IDS["yamada"]
        period_id = self.EVALUATION_PERIOD_ID
        
        # Create goal data
        goal_data = GoalCreate(
            periodId=period_id,
            goalCategory="業績目標",
            weight=25.0,
            performanceGoalType=PerformanceGoalType.QUANTITATIVE,
            specificGoalText="Test goal creation",
            achievementCriteriaText="Test criteria",
            meansMethodsText="Test methods",
            status=GoalStatus.DRAFT
        )
        
        try:
            # Create goal
            created_goal = await goal_repo.create_goal(goal_data, user_id)
            
            # Flush to get ID
            await session.flush()
            
            log_data_verification("Goal creation", {
                "user_id": str(user_id),
                "goal_id": str(created_goal.id),
                "category": created_goal.goal_category,
                "weight": float(created_goal.weight),
                "status": created_goal.status
            })
            
            assert created_goal.id is not None
            assert created_goal.user_id == user_id
            assert created_goal.period_id == period_id
            assert created_goal.goal_category == "業績目標"
            assert created_goal.weight == Decimal("25.0")
            
            log_assertion_success(f"Goal created successfully with ID: {created_goal.id}")
            
            # Clean up - delete the test goal
            await goal_repo.delete_goal(created_goal.id)
            await session.commit()
            
        except Exception as e:
            await session.rollback()
            logging.error(f"Test goal creation failed: {str(e)}")
            raise

    @pytest.mark.asyncio
    async def test_update_goal(self, goal_repo: GoalRepository, session: AsyncSession):
        """Test updating an existing goal"""
        log_test_start("test_update_goal")
        
        # First create a test goal
        user_id = self.SEED_USER_IDS["yamada"]
        period_id = self.EVALUATION_PERIOD_ID
        
        goal_data = GoalCreate(
            periodId=period_id,
            goalCategory="業績目標",
            weight=30.0,
            performanceGoalType=PerformanceGoalType.QUANTITATIVE,
            specificGoalText="Original goal text",
            achievementCriteriaText="Original criteria",
            meansMethodsText="Original methods",
            status=GoalStatus.DRAFT
        )
        
        try:
            # Create goal
            created_goal = await goal_repo.create_goal(goal_data, user_id)
            await session.flush()
            
            # Update goal
            update_data = GoalUpdate(
                weight=35.0,
                specificGoalText="Updated goal text",
                status=GoalStatus.PENDING_APPROVAL
            )
            
            updated_goal = await goal_repo.update_goal(created_goal.id, update_data)
            
            log_data_verification("Goal update", {
                "goal_id": str(created_goal.id),
                "original_weight": float(created_goal.weight),
                "updated_weight": float(updated_goal.weight) if updated_goal else None,
                "updated_status": updated_goal.status if updated_goal else None
            })
            
            assert updated_goal is not None
            assert updated_goal.weight == Decimal("35.0")
            assert updated_goal.status == GoalStatus.PENDING_APPROVAL.value
            
            log_assertion_success(f"Goal {created_goal.id} updated successfully")
            
            # Clean up
            await goal_repo.delete_goal(created_goal.id)
            await session.commit()
            
        except Exception as e:
            await session.rollback()
            logging.error(f"Test goal update failed: {str(e)}")
            raise

    @pytest.mark.asyncio
    async def test_delete_goal(self, goal_repo: GoalRepository, session: AsyncSession):
        """Test deleting a goal"""
        log_test_start("test_delete_goal")
        
        # First create a test goal
        user_id = self.SEED_USER_IDS["yamada"]
        period_id = self.EVALUATION_PERIOD_ID
        
        goal_data = GoalCreate(
            periodId=period_id,
            goalCategory="業績目標",
            weight=20.0,
            performanceGoalType=PerformanceGoalType.QUANTITATIVE,
            specificGoalText="Goal to delete",
            achievementCriteriaText="Delete criteria",
            meansMethodsText="Delete methods",
            status=GoalStatus.DRAFT
        )
        
        try:
            # Create goal
            created_goal = await goal_repo.create_goal(goal_data, user_id)
            await session.flush()
            
            goal_id = created_goal.id
            
            # Delete goal
            success = await goal_repo.delete_goal(goal_id)
            
            log_data_verification("Goal deletion", {
                "goal_id": str(goal_id),
                "deletion_success": success
            })
            
            assert success is True
            
            # Verify goal is deleted
            deleted_goal = await goal_repo.get_goal_by_id(goal_id)
            assert deleted_goal is None
            
            log_assertion_success(f"Goal {goal_id} deleted successfully")
            
            await session.commit()
            
        except Exception as e:
            await session.rollback()
            logging.error(f"Test goal deletion failed: {str(e)}")
            raise