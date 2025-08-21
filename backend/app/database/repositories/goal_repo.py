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
from ...schemas.goal import (
    GoalCreate, GoalUpdate, GoalStatus,
    PerformanceGoalUpdate, CompetencyGoalUpdate, CoreValueGoalUpdate
)
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
                status=goal_data.status.value if goal_data.status else GoalStatus.INCOMPLETE.value
            )
            
            self.session.add(goal)
            logger.info(f"Added goal to session: user_id={user_id}, category={goal_data.goal_category}")
            return goal
            
        except IntegrityError as e:
            logger.error(f"Integrity error creating goal for user {user_id}: {e}")
            if "check_individual_weight_bounds" in str(e):
                raise ValidationError("Individual weight must be between 0 and 100")
            elif "check_status_values" in str(e):
                raise ValidationError("Invalid status value")
            else:
                raise ConflictError(f"Database constraint violation: {e}")
        except ValueError as e:
            logger.error(f"Validation error creating goal for user {user_id}: {e}")
            raise ValidationError(str(e))
        except SQLAlchemyError as e:
            logger.error(f"Database error creating goal for user {user_id}: {e}")
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
        # TODO: Need to reconsider more about not including rejected goals in filter
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
        """Update a goal with new data, including validation and atomic operations."""
        try:
            # Validate goal exists first
            existing_goal = await self._validate_goal_exists(goal_id)
            
            # Validate weight constraints if weight is being updated
            if goal_data.weight is not None:
                new_weight = Decimal(str(goal_data.weight))
                await self._validate_performance_goal_weight_constraints(
                    existing_goal.user_id, 
                    existing_goal.period_id, 
                    new_weight,
                    existing_goal.goal_category,
                    exclude_goal_id=goal_id
                )
            
            # Build update dictionary
            update_data = {}
            
            if goal_data.weight is not None:
                update_data["weight"] = Decimal(str(goal_data.weight))
            
            # Status updates are handled separately via update_goal_status method
            # to ensure proper validation and business rules
            
            # Build target_data for category-specific fields
            target_data_updates = {}
            
            # Check the type of goal_data and handle accordingly
            if isinstance(goal_data, PerformanceGoalUpdate):
                # Performance goal fields
                if goal_data.title is not None:
                    target_data_updates["title"] = goal_data.title
                if goal_data.performance_goal_type is not None:
                    target_data_updates["performance_goal_type"] = goal_data.performance_goal_type.value
                if goal_data.specific_goal_text is not None:
                    target_data_updates["specific_goal_text"] = goal_data.specific_goal_text
                if goal_data.achievement_criteria_text is not None:
                    target_data_updates["achievement_criteria_text"] = goal_data.achievement_criteria_text
                if goal_data.means_methods_text is not None:
                    target_data_updates["means_methods_text"] = goal_data.means_methods_text
            
            elif isinstance(goal_data, CompetencyGoalUpdate):
                # Competency goal fields
                if goal_data.competency_id is not None:
                    target_data_updates["competency_id"] = str(goal_data.competency_id)
                if goal_data.action_plan is not None:
                    target_data_updates["action_plan"] = goal_data.action_plan
            
            elif isinstance(goal_data, CoreValueGoalUpdate):
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
            
            # Execute update if there are changes
            if update_data:
                update_data["updated_at"] = datetime.now(timezone.utc)
                await self.session.execute(
                    update(Goal)
                    .where(Goal.id == goal_id)
                    .values(**update_data)
                )
            
            # Return updated goal
            return await self.get_goal_by_id(goal_id)
            
        except IntegrityError as e:
            logger.error(f"Integrity error updating goal {goal_id}: {e}")
            if "check_individual_weight_bounds" in str(e):
                raise ValidationError("Individual weight must be between 0 and 100")
            elif "check_status_values" in str(e):
                raise ValidationError("Invalid status value")
            else:
                raise ConflictError(f"Database constraint violation: {e}")
        except ValueError as e:
            logger.error(f"Validation error updating goal {goal_id}: {e}")
            raise ValidationError(str(e))
        except SQLAlchemyError as e:
            logger.error(f"Database error updating goal {goal_id}: {e}")
            raise

    async def update_goal_status(
        self, 
        goal_id: UUID, 
        status: GoalStatus,
        approved_by: Optional[UUID] = None
    ) -> Optional[Goal]:
        """Update goal status and approval information with validation."""
        try:
            # Validate goal exists first
            existing_goal = await self._validate_goal_exists(goal_id)
            
            # Validate approver exists if provided
            if approved_by:
                await self._validate_user_and_period(approved_by, existing_goal.period_id)
            
            # Validate status transition logic
            self._validate_status_transition(existing_goal.status, status.value)
            
            # Special validation: When submitting for approval, ensure performance goals sum to 100%
            if status == GoalStatus.PENDING_APPROVAL:
                await self._validate_all_performance_goals_sum_to_100(
                    existing_goal.user_id, existing_goal.period_id
                )
            
            update_data = {
                "status": status.value,
                "updated_at": datetime.now(timezone.utc)
            }
            
            if status == GoalStatus.APPROVED:
                if not approved_by:
                    raise ValidationError("approved_by is required when approving a goal")
                update_data["approved_by"] = approved_by
                update_data["approved_at"] = datetime.now(timezone.utc)
            elif status == GoalStatus.REJECTED:
                # Clear approval info on rejection
                update_data["approved_by"] = None
                update_data["approved_at"] = None
            
            await self.session.execute(
                update(Goal)
                .where(Goal.id == goal_id)
                .values(**update_data)
            )
            
            logger.info(f"Updated goal {goal_id} status to {status.value}")
            return await self.get_goal_by_id(goal_id)
            
        except IntegrityError as e:
            logger.error(f"Integrity error updating goal status {goal_id}: {e}")
            if "check_approval_required" in str(e):
                raise ValidationError("Approved goals must have approved_by and approved_at")
            elif "check_status_values" in str(e):
                raise ValidationError(f"Invalid status value: {status}")
            else:
                raise ConflictError(f"Database constraint violation: {e}")
        except ValueError as e:
            logger.error(f"Validation error updating goal status {goal_id}: {e}")
            raise ValidationError(str(e))
        except SQLAlchemyError as e:
            logger.error(f"Database error updating goal status {goal_id}: {e}")
            raise

    def _validate_status_transition(self, current_status: str, new_status: str) -> None:
        """Validate that the status transition is allowed."""
        valid_transitions = {
            "incomplete": ["draft", "pending_approval"],  # Incomplete goals can be moved to draft or submitted
            "draft": ["pending_approval"],
            "pending_approval": ["approved", "rejected"],
            "approved": [],  # Approved goals cannot be changed
            "rejected": ["draft", "pending_approval"]
        }
        
        allowed_next_statuses = valid_transitions.get(current_status, [])
        if new_status not in allowed_next_statuses:
            raise ValidationError(
                f"Invalid status transition from '{current_status}' to '{new_status}'. "
                f"Allowed transitions: {allowed_next_statuses}"
            )

    # ========================================
    # DELETE OPERATIONS
    # ========================================

    async def delete_goal(self, goal_id: UUID) -> bool:
        """Delete a goal by ID with validation."""
        try:
            # Validate goal exists first
            existing_goal = await self._validate_goal_exists(goal_id)
            
            # Check if goal can be deleted (e.g., only draft or rejected goals)
            if existing_goal.status == "approved":
                raise ValidationError("Cannot delete approved goals")
            
            result = await self.session.execute(
                delete(Goal).where(Goal.id == goal_id)
            )
            
            deleted = result.rowcount > 0
            if deleted:
                logger.info(f"Deleted goal {goal_id}")
            
            return deleted
            
        except SQLAlchemyError as e:
            logger.error(f"Database error deleting goal {goal_id}: {e}")
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

    

    async def _validate_goal_exists(self, goal_id: UUID) -> Goal:
        """Validate goal exists and return it, raise NotFoundError if not."""
        goal = await self.get_goal_by_id(goal_id)
        if not goal:
            raise NotFoundError(f"Goal not found: {goal_id}")
        return goal

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

    async def _validate_all_performance_goals_sum_to_100(
        self, user_id: UUID, period_id: UUID
    ) -> None:
        """
        Validate that all performance goals for a user/period sum to exactly 100%.
        This should be called when submitting goals for approval.
        """
        weight_totals = await self.get_weight_totals_by_category(user_id, period_id)
        performance_total = weight_totals.get("業績目標", Decimal("0"))
        
        if performance_total != 100:
            raise ValidationError(
                f"Performance goals must sum to exactly 100%. "
                f"Current total: {performance_total}%. "
                f"Please adjust goal weights before submitting for approval."
            )

    async def validate_user_goals_for_submission(
        self, user_id: UUID, period_id: UUID
    ) -> Dict[str, Any]:
        """
        Comprehensive validation for user goals before submission.
        Returns validation status and detailed information.
        """
        weight_totals = await self.get_weight_totals_by_category(user_id, period_id)
        performance_total = weight_totals.get("業績目標", Decimal("0"))
        
        validation_result = {
            "valid": performance_total == 100,
            "performance_goals_total": float(performance_total),
            "target_total": 100.0,
            "difference": float(performance_total - 100),
            "weight_breakdown": {k: float(v) for k, v in weight_totals.items()},
            "message": None
        }
        
        if performance_total == 100:
            validation_result["message"] = "✅ Performance goals correctly sum to 100%"
        elif performance_total < 100:
            validation_result["message"] = f"❌ Performance goals total {performance_total}% - need {100 - performance_total}% more"
        else:
            validation_result["message"] = f"❌ Performance goals total {performance_total}% - {performance_total - 100}% over limit"
        
        return validation_result

    def _build_target_data(self, goal_data: GoalCreate) -> Dict[str, Any]:
        """Build target_data JSON structure based on goal category."""
        target_data = {}
        
        if goal_data.goal_category == "業績目標":  # Performance goal
            target_data = {
                "title": goal_data.title,
                "performance_goal_type": goal_data.performance_goal_type.value,
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