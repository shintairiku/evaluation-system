import logging
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select, update, func, delete, and_
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.goal import Goal
from ..models.user import User
from ..models.evaluation import EvaluationPeriod
from ...schemas.goal import GoalCreate, GoalUpdate, GoalStatus
from ...schemas.common import PaginationParams
from ...core.exceptions import (
    NotFoundError, ConflictError, ValidationError
)

logger = logging.getLogger(__name__)


class GoalRepository:
    """Repository for Goal database operations following established patterns"""

    def __init__(self, session: AsyncSession):
        self.session = session

    # ========================================
    # CREATE OPERATIONS
    # ========================================

    async def create_goal(self, goal_data: GoalCreate, user_id: UUID) -> Goal:
        """
        Create a new goal from GoalCreate schema with validation and error handling.
        Adds to session (does not commit - let service layer handle transactions).
        """
        try:
            # Validate user and period existence first
            await self._validate_user_and_period(user_id, goal_data.period_id)
            
            # Validate weight constraints for performance goals
            if goal_data.weight is not None:
                await self._validate_performance_goal_weight_constraints(
                    user_id, 
                    goal_data.period_id, 
                    Decimal(str(goal_data.weight)),
                    goal_data.goal_category
                )
            
            # Build and validate target_data based on goal category
            target_data = self._build_target_data(goal_data)
            
            # Create goal with validated data
            goal = Goal(
                user_id=user_id,
                period_id=goal_data.period_id,
                goal_category=goal_data.goal_category,
                target_data=target_data,
                weight=Decimal(str(goal_data.weight)) if goal_data.weight is not None else None,
                status=goal_data.status.value if goal_data.status else GoalStatus.DRAFT.value
            )
            
            self.session.add(goal)
            logger.info(f"Added goal to session: user_id={user_id}, category={goal_data.goal_category}")
            return goal
        except SQLAlchemyError as e:
            logger.error(f"Error creating goal for user {user_id}: {e}")
            raise

    # ========================================
    # READ OPERATIONS
    # ========================================

    async def get_goal_by_id(self, goal_id: UUID) -> Optional[Goal]:
        """Get goal by ID."""
        try:
            result = await self.session.execute(
                select(Goal).filter(Goal.id == goal_id)
            )
            return result.scalars().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching goal by ID {goal_id}: {e}")
            raise

    async def get_goal_by_id_with_details(self, goal_id: UUID) -> Optional[Goal]:
        """Get goal by ID with all related data."""
        try:
            result = await self.session.execute(
                select(Goal)
                .options(
                    joinedload(Goal.user),
                    joinedload(Goal.period),
                    joinedload(Goal.approver)
                )
                .filter(Goal.id == goal_id)
            )
            return result.scalars().unique().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching goal details for ID {goal_id}: {e}")
            raise

    async def get_goals_by_user_and_period(
        self, 
        user_id: UUID, 
        period_id: Optional[UUID] = None
    ) -> List[Goal]:
        """Get all goals for a user, optionally filtered by period."""
        try:
            query = select(Goal).filter(Goal.user_id == user_id)
            
            if period_id:
                query = query.filter(Goal.period_id == period_id)
            
            query = query.order_by(Goal.created_at.desc())
            
            result = await self.session.execute(query)
            return result.scalars().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching goals for user {user_id}: {e}")
            raise

    async def search_goals(
        self,
        user_ids: Optional[List[UUID]] = None,
        period_id: Optional[UUID] = None,
        goal_category: Optional[str] = None,
        status: Optional[str] = None,
        pagination: Optional[PaginationParams] = None
    ) -> List[Goal]:
        """Search goals with various filters."""
        try:
            query = select(Goal).options(
                joinedload(Goal.user),
                joinedload(Goal.period)
            )
            
            # Apply filters
            if user_ids:
                query = query.filter(Goal.user_id.in_(user_ids))
            
            if period_id:
                query = query.filter(Goal.period_id == period_id)
            
            if goal_category:
                query = query.filter(Goal.goal_category == goal_category)
            
            if status:
                query = query.filter(Goal.status == status)
            
            # Apply ordering
            query = query.order_by(Goal.created_at.desc())
            
            # Apply pagination
            if pagination:
                query = query.offset(pagination.offset).limit(pagination.limit)
            
            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error searching goals: {e}")
            raise

    async def count_goals(
        self,
        user_ids: Optional[List[UUID]] = None,
        period_id: Optional[UUID] = None,
        goal_category: Optional[str] = None,
        status: Optional[str] = None
    ) -> int:
        """Count goals matching the given filters."""
        try:
            query = select(func.count(Goal.id))
            
            # Apply same filters as search_goals
            if user_ids:
                query = query.filter(Goal.user_id.in_(user_ids))
            
            if period_id:
                query = query.filter(Goal.period_id == period_id)
            
            if goal_category:
                query = query.filter(Goal.goal_category == goal_category)
            
            if status:
                query = query.filter(Goal.status == status)
            
            result = await self.session.execute(query)
            return result.scalar() or 0
        except SQLAlchemyError as e:
            logger.error(f"Error counting goals: {e}")
            raise

    async def get_weight_totals_by_category(
        self, 
        user_id: UUID, 
        period_id: UUID,
        exclude_goal_id: Optional[UUID] = None
    ) -> Dict[str, Decimal]:
        """Get total weight by category for weight validation."""
        try:
            query = select(
                Goal.goal_category,
                func.sum(Goal.weight).label('total_weight')
            ).filter(
                and_(
                    Goal.user_id == user_id,
                    Goal.period_id == period_id,
                    Goal.status != GoalStatus.REJECTED.value
                )
            )
            
            if exclude_goal_id:
                query = query.filter(Goal.id != exclude_goal_id)
            
            query = query.group_by(Goal.goal_category)
            
            result = await self.session.execute(query)
            return {row.goal_category: row.total_weight or Decimal('0') for row in result}
        except SQLAlchemyError as e:
            logger.error(f"Error calculating weight totals for user {user_id}: {e}")
            raise

    async def get_pending_approvals_for_supervisor(
        self, 
        supervisor_id: UUID,
        period_id: Optional[UUID] = None,
        pagination: Optional[PaginationParams] = None
    ) -> List[Goal]:
        """Get goals pending approval for a supervisor's subordinates."""
        try:
            # This requires joining with supervisor relationships
            from ..models.user import UserSupervisor
            
            query = (
                select(Goal)
                .join(UserSupervisor, Goal.user_id == UserSupervisor.user_id)
                .options(
                    joinedload(Goal.user),
                    joinedload(Goal.period)
                )
                .filter(
                    and_(
                        UserSupervisor.supervisor_id == supervisor_id,
                        Goal.status == GoalStatus.PENDING_APPROVAL.value,
                        UserSupervisor.valid_to.is_(None)  # Current supervisor relationship
                    )
                )
            )
            
            if period_id:
                query = query.filter(Goal.period_id == period_id)
            
            query = query.order_by(Goal.created_at.asc())  # Oldest first for approval queue
            
            if pagination:
                query = query.offset(pagination.offset).limit(pagination.limit)
            
            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching pending approvals for supervisor {supervisor_id}: {e}")
            raise

    # ========================================
    # UPDATE OPERATIONS
    # ========================================

    async def update_goal(self, goal_id: UUID, goal_data: GoalUpdate) -> Optional[Goal]:
        """Update a goal with new data."""
        try:
            # Build update dictionary
            update_data = {}
            
            if goal_data.weight is not None:
                update_data["weight"] = Decimal(str(goal_data.weight))
            
            if goal_data.status is not None:
                update_data["status"] = goal_data.status.value
            
            # Build target_data for category-specific fields
            target_data_updates = {}
            
            # Performance goal fields
            if goal_data.performance_goal_type is not None:
                target_data_updates["performance_goal_type"] = goal_data.performance_goal_type.value
            if goal_data.specific_goal_text is not None:
                target_data_updates["specific_goal_text"] = goal_data.specific_goal_text
            if goal_data.achievement_criteria_text is not None:
                target_data_updates["achievement_criteria_text"] = goal_data.achievement_criteria_text
            if goal_data.means_methods_text is not None:
                target_data_updates["means_methods_text"] = goal_data.means_methods_text
            
            # Competency goal fields
            if goal_data.competency_id is not None:
                target_data_updates["competency_id"] = str(goal_data.competency_id)
            if goal_data.action_plan is not None:
                target_data_updates["action_plan"] = goal_data.action_plan
            
            # Core value goal fields
            if goal_data.core_value_plan is not None:
                target_data_updates["core_value_plan"] = goal_data.core_value_plan
            
            if target_data_updates:
                # Get current goal to merge target_data
                current_goal = await self.get_goal_by_id(goal_id)
                if current_goal and current_goal.target_data:
                    merged_target_data = {**current_goal.target_data, **target_data_updates}
                else:
                    merged_target_data = target_data_updates
                
                update_data["target_data"] = merged_target_data
            
            if not update_data:
                # No updates to apply
                return await self.get_goal_by_id(goal_id)
            
            update_data["updated_at"] = datetime.utcnow()
            
            await self.session.execute(
                update(Goal)
                .where(Goal.id == goal_id)
                .values(**update_data)
            )
            
            return await self.get_goal_by_id(goal_id)
        except SQLAlchemyError as e:
            logger.error(f"Error updating goal {goal_id}: {e}")
            raise

    async def update_goal_status(
        self, 
        goal_id: UUID, 
        status: GoalStatus,
        approved_by: Optional[UUID] = None
    ) -> Optional[Goal]:
        """Update goal status and approval information."""
        try:
            update_data = {
                "status": status.value,
                "updated_at": datetime.utcnow()
            }
            
            if status == GoalStatus.APPROVED and approved_by:
                update_data["approved_by"] = approved_by
                update_data["approved_at"] = datetime.utcnow()
            elif status == GoalStatus.REJECTED:
                # Clear approval info on rejection
                update_data["approved_by"] = None
                update_data["approved_at"] = None
            
            await self.session.execute(
                update(Goal)
                .where(Goal.id == goal_id)
                .values(**update_data)
            )
            
            return await self.get_goal_by_id(goal_id)
        except SQLAlchemyError as e:
            logger.error(f"Error updating goal status {goal_id}: {e}")
            raise

    # ========================================
    # DELETE OPERATIONS
    # ========================================

    async def delete_goal(self, goal_id: UUID) -> bool:
        """Delete a goal by ID."""
        try:
            result = await self.session.execute(
                delete(Goal).where(Goal.id == goal_id)
            )
            return result.rowcount > 0
        except SQLAlchemyError as e:
            logger.error(f"Error deleting goal {goal_id}: {e}")
            raise

    # ========================================
    # HELPER METHODS
    # ========================================

    async def _validate_user_and_period(self, user_id: UUID, period_id: UUID) -> None:
        """Validate that user and evaluation period exist."""
        # Check user exists
        user_result = await self.session.execute(
            select(User).filter(User.id == user_id)
        )
        if not user_result.scalars().first():
            raise NotFoundError(f"User not found: {user_id}")
        
        # Check evaluation period exists
        period_result = await self.session.execute(
            select(EvaluationPeriod).filter(EvaluationPeriod.id == period_id)
        )
        if not period_result.scalars().first():
            raise NotFoundError(f"Evaluation period not found: {period_id}")

    async def _validate_performance_goal_weight_constraints(
        self, user_id: UUID, period_id: UUID, new_weight: Decimal, 
        goal_category: str, exclude_goal_id: Optional[UUID] = None
    ) -> None:
        """
        Validate performance goal weight constraints.
        
        Business Rule: The sum of all 業績目標 (performance goals) weights 
        for the same user and period must equal 100%.
        """
        if goal_category != "業績目標":
            # Only performance goals have the 100% weight requirement
            return
            
        # Get current weight totals for performance goals only
        weight_totals = await self.get_weight_totals_by_category(
            user_id, period_id, exclude_goal_id
        )
        
        # Get current performance goal weight total
        current_performance_weight = weight_totals.get("業績目標", Decimal("0"))
        
        # Calculate what the new total would be
        new_total_weight = current_performance_weight + new_weight
        
        # For performance goals, the total must eventually equal 100%
        # We allow temporary states during creation/editing, but warn about the requirement
        if new_total_weight > 100:
            raise ValidationError(
                f"Performance goals total weight cannot exceed 100%: "
                f"current {current_performance_weight}% + new {new_weight}% = {new_total_weight}%"
            )
        
        logger.info(
            f"Performance goal weight validation: user {user_id}, period {period_id} - "
            f"current: {current_performance_weight}%, new goal: {new_weight}%, "
            f"total: {new_total_weight}% (target: 100%)"
        )

    def _build_target_data(self, goal_data: GoalCreate) -> Dict[str, Any]:
        """Build target_data JSON structure based on goal category."""
        target_data = {}
        
        if goal_data.goal_category == "業績目標":  # Performance goal
            target_data = {
                "performance_goal_type": goal_data.performance_goal_type.value if goal_data.performance_goal_type else None,
                "specific_goal_text": goal_data.specific_goal_text,
                "achievement_criteria_text": goal_data.achievement_criteria_text,
                "means_methods_text": goal_data.means_methods_text
            }
        elif goal_data.goal_category == "コンピテンシー":  # Competency goal
            target_data = {
                "competency_id": str(goal_data.competency_id) if goal_data.competency_id else None,
                "action_plan": goal_data.action_plan
            }
        elif goal_data.goal_category == "コアバリュー":  # Core value goal
            target_data = {
                "core_value_plan": goal_data.core_value_plan
            }
        
        return target_data