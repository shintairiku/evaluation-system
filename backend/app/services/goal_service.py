from __future__ import annotations
import logging
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from cachetools import TTLCache

from ..database.repositories.goal_repo import GoalRepository
from ..database.repositories.user_repo import UserRepository
from ..database.repositories.evaluation_period_repo import EvaluationPeriodRepository
from ..database.repositories.competency_repo import CompetencyRepository
from ..database.repositories.supervisor_review_repository import SupervisorReviewRepository
from ..database.models.goal import Goal as GoalModel
from ..schemas.goal import (
    GoalCreate, GoalUpdate, Goal, GoalDetail, GoalStatus
)
from ..schemas.common import PaginationParams, PaginatedResponse
from ..security.context import AuthContext
from ..security.permissions import Permission
from ..core.exceptions import (
    NotFoundError, PermissionDeniedError, BadRequestError, ValidationError
)
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Cache for goal search results (50 items, 5-minute TTL aligned with other services)
goal_search_cache = TTLCache(maxsize=50, ttl=300)


class GoalService:
    """Service layer for goal-related business logic and operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.goal_repo = GoalRepository(session)
        self.user_repo = UserRepository(session)
        self.evaluation_period_repo = EvaluationPeriodRepository(session)
        self.competency_repo = CompetencyRepository(session)
        self.supervisor_review_repo = SupervisorReviewRepository(session)
    
    async def get_goals(
        self,
        current_user_context: AuthContext,
        user_id: Optional[UUID] = None,
        period_id: Optional[UUID] = None,
        goal_category: Optional[str] = None,
        status: Optional[str] = None,
        pagination: Optional[PaginationParams] = None
    ) -> PaginatedResponse[Goal]:
        """
        Get goals based on current user's permissions and filters.
        
        Access rules:
        - Employees: can only view their own goals
        - Supervisors: can view their subordinates' goals + their own
        - Admins: can view all goals
        """
        try:
            # Determine which users' goals the current user can access
            accessible_user_ids = await self._get_accessible_user_ids(current_user_context, user_id)
            
            # Search goals with filters
            goals = await self.goal_repo.search_goals(
                user_ids=accessible_user_ids,
                period_id=period_id,
                goal_category=goal_category,
                status=status,
                pagination=pagination
            )
            
            # Get total count for pagination
            total_count = await self.goal_repo.count_goals(
                user_ids=accessible_user_ids,
                period_id=period_id,
                goal_category=goal_category,
                status=status
            )
            
            # Convert to response format
            enriched_goals = []
            for goal_model in goals:
                enriched_goal = await self._enrich_goal_data(goal_model)
                enriched_goals.append(enriched_goal)
            
            # Create paginated response
            if pagination:
                total_pages = (total_count + pagination.limit - 1) // pagination.limit
            else:
                total_pages = 1
            
            return PaginatedResponse(
                items=enriched_goals,
                total=total_count,
                page=pagination.page if pagination else 1,
                limit=pagination.limit if pagination else len(enriched_goals),
                pages=total_pages
            )
            
        except Exception as e:
            logger.error(f"Error in get_goals: {e}")
            raise

    async def get_goal_by_id(
        self,
        goal_id: UUID,
        current_user_context: AuthContext
    ) -> GoalDetail:
        """Get detailed goal information by ID with permission checks."""
        try:
            goal = await self.goal_repo.get_goal_by_id_with_details(goal_id)
            if not goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found")
            
            # Permission check
            await self._check_goal_access_permission(goal, current_user_context)
            
            # Enrich with detailed information
            enriched_goal = await self._enrich_goal_detail_data(goal)
            return enriched_goal
            
        except Exception as e:
            logger.error(f"Error getting goal {goal_id}: {str(e)}")
            raise

    async def create_goal(
        self,
        goal_data: GoalCreate,
        current_user_context: AuthContext
    ) -> Goal:
        """Create a new goal with validation and business rules."""
        try:
            # Permission check - must have goal management permissions
            if not (current_user_context.has_permission(Permission.GOAL_MANAGE) or 
                    current_user_context.has_permission(Permission.GOAL_MANAGE_SELF)):
                raise PermissionDeniedError("You do not have permission to create goals")
            
            # Users create goals for themselves (admin can create for anyone, but we'll keep it simple for now)
            target_user_id = current_user_context.user_id
            
            # Business validation
            await self._validate_goal_creation(goal_data, target_user_id)
            
            # Validate weight limits (skip for incomplete status - relaxed validation)
            if goal_data.status != GoalStatus.INCOMPLETE:
                await self._validate_weight_limits(
                    target_user_id, 
                    goal_data.period_id, 
                    goal_data.goal_category,
                    goal_data.weight
                )
            
            # Create goal
            created_goal = await self.goal_repo.create_goal(goal_data, target_user_id)
            
            # Commit transaction
            await self.session.commit()
            await self.session.refresh(created_goal)
            
            # If goal is submitted for approval, create related assessment records
            if goal_data.status == GoalStatus.PENDING_APPROVAL:
                await self._create_related_assessment_records(created_goal)
                await self.session.commit()
            
            # Enrich response data
            enriched_goal = await self._enrich_goal_data(created_goal)
            
            logger.info(f"Goal created successfully: {created_goal.id}")
            return enriched_goal
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error creating goal: {str(e)}")
            raise

    async def update_goal(
        self,
        goal_id: UUID,
        goal_data: GoalUpdate,
        current_user_context: AuthContext
    ) -> Goal:
        """Update a goal with validation and business rules."""
        try:
            # Check if goal exists
            existing_goal = await self.goal_repo.get_goal_by_id(goal_id)
            if not existing_goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found")
            
            # Permission check - only goal owner can update
            await self._check_goal_update_permission(existing_goal, current_user_context)
            
            # Business validation
            await self._validate_goal_update(goal_data, existing_goal)
            
            # Validate weight limits if weight is being changed (skip for incomplete status)
            if goal_data.weight is not None and existing_goal.status != GoalStatus.INCOMPLETE.value:
                await self._validate_weight_limits(
                    existing_goal.user_id,
                    existing_goal.period_id,
                    existing_goal.goal_category,
                    goal_data.weight,
                    exclude_goal_id=goal_id
                )
            
            # Update goal
            updated_goal = await self.goal_repo.update_goal(goal_id, goal_data)
            if not updated_goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found after update")
            
            # Reset approval if substantial changes made
            if self._requires_reapproval(goal_data):
                await self.goal_repo.update_goal_status(
                    goal_id, 
                    GoalStatus.DRAFT if updated_goal.status == GoalStatus.APPROVED.value else GoalStatus(updated_goal.status)
                )
                updated_goal = await self.goal_repo.get_goal_by_id(goal_id)
            
            # Commit transaction
            await self.session.commit()
            
            # Enrich response data
            enriched_goal = await self._enrich_goal_data(updated_goal)
            
            logger.info(f"Goal updated successfully: {goal_id}")
            return enriched_goal
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error updating goal {goal_id}: {str(e)}")
            raise

    async def delete_goal(
        self,
        goal_id: UUID,
        current_user_context: AuthContext
    ) -> bool:
        """Delete a goal with permission and business rule checks."""
        try:
            # Check if goal exists
            existing_goal = await self.goal_repo.get_goal_by_id(goal_id)
            if not existing_goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found")
            
            # Permission check
            await self._check_goal_update_permission(existing_goal, current_user_context)
            
            # Business rule: can only delete draft goals or rejected goals
            if existing_goal.status not in [GoalStatus.DRAFT.value, GoalStatus.REJECTED.value]:
                raise BadRequestError("Can only delete draft or rejected goals")
            
            # Delete goal
            success = await self.goal_repo.delete_goal(goal_id)
            
            if success:
                await self.session.commit()
                logger.info(f"Goal deleted successfully: {goal_id}")
            
            return success
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error deleting goal {goal_id}: {str(e)}")
            raise

    async def submit_goal_for_approval(
        self,
        goal_id: UUID,
        current_user_context: AuthContext
    ) -> Goal:
        """Submit a goal for approval by changing status to pending_approval."""
        try:
            # Check if goal exists and user can update it
            existing_goal = await self.goal_repo.get_goal_by_id(goal_id)
            if not existing_goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found")
            
            # Permission check - only goal owner can submit
            await self._check_goal_update_permission(existing_goal, current_user_context)
            
            # Business rule: can only submit draft or rejected goals
            if existing_goal.status not in [GoalStatus.DRAFT.value, GoalStatus.REJECTED.value]:
                raise BadRequestError("Can only submit draft or rejected goals for approval")
            
            # Update status using dedicated method with validation
            updated_goal = await self.goal_repo.update_goal_status(
                goal_id, 
                GoalStatus.PENDING_APPROVAL
            )
            
            # Commit transaction
            await self.session.commit()
            
            # Auto-create draft supervisor review(s) for current supervisor(s)
            try:
                # Get supervisors of goal owner
                supervisors = await self.user_repo.get_user_supervisors(existing_goal.user_id)
                for supervisor in supervisors:
                    await self.supervisor_review_repo.create(
                        goal_id=existing_goal.id,
                        period_id=existing_goal.period_id,
                        supervisor_id=supervisor.id,
                        action="pending",
                        comment="",
                        status="draft",
                    )
                await self.session.commit()
            except Exception as auto_create_error:
                logger.error(f"Auto-create SupervisorReview failed for goal {goal_id}: {auto_create_error}")
                # Do not rollback goal submission due to review auto-creation failure

            # Enrich response data
            enriched_goal = await self._enrich_goal_data(updated_goal)
            
            logger.info(f"Goal submitted for approval: {goal_id} by {current_user_context.user_id}")
            return enriched_goal
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error submitting goal {goal_id}: {str(e)}")
            raise

    async def approve_goal(
        self,
        goal_id: UUID,
        current_user_context: AuthContext
    ) -> Goal:
        """Approve a goal (supervisor/admin only)."""
        try:
            goal = await self.goal_repo.get_goal_by_id_with_details(goal_id)
            if not goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found")
            
            # Permission check - must be supervisor of goal owner or admin
            await self._check_goal_approval_permission(goal, current_user_context)
            
            # Business validation
            if goal.status != GoalStatus.PENDING_APPROVAL.value:
                raise BadRequestError("Goal must be in pending approval status")
            
            # Update status
            updated_goal = await self.goal_repo.update_goal_status(
                goal_id, 
                GoalStatus.APPROVED,
                approved_by=current_user_context.user_id
            )
            
            # Commit transaction
            await self.session.commit()
            
            # Enrich response data
            enriched_goal = await self._enrich_goal_data(updated_goal)
            
            logger.info(f"Goal approved successfully: {goal_id} by {current_user_context.user_id}")
            return enriched_goal
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error approving goal {goal_id}: {str(e)}")
            raise

    async def reject_goal(
        self,
        goal_id: UUID,
        rejection_reason: str,
        current_user_context: AuthContext
    ) -> Goal:
        """Reject a goal (supervisor/admin only)."""
        try:
            goal = await self.goal_repo.get_goal_by_id_with_details(goal_id)
            if not goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found")
            
            # Permission check
            await self._check_goal_approval_permission(goal, current_user_context)
            
            # Business validation
            if goal.status != GoalStatus.PENDING_APPROVAL.value:
                raise BadRequestError("Goal must be in pending approval status")
            
            # Update status
            updated_goal = await self.goal_repo.update_goal_status(goal_id, GoalStatus.REJECTED)
            
            # TODO: Store rejection reason (requires extending model)
            
            # Commit transaction
            await self.session.commit()
            
            # Enrich response data
            enriched_goal = await self._enrich_goal_data(updated_goal)
            
            logger.info(f"Goal rejected successfully: {goal_id} by {current_user_context.user_id}")
            return enriched_goal
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error rejecting goal {goal_id}: {str(e)}")
            raise

    async def get_pending_approvals(
        self,
        current_user_context: AuthContext,
        period_id: Optional[UUID] = None,
        pagination: Optional[PaginationParams] = None
    ) -> PaginatedResponse[Goal]:
        """Get goals pending approval for current supervisor."""
        try:
            # Permission check
            if not current_user_context.has_permission(Permission.GOAL_APPROVE):
                raise PermissionDeniedError("You do not have permission to view pending approvals")
            
            # Get pending goals for supervisor's subordinates
            goals = await self.goal_repo.get_pending_approvals_for_supervisor(
                current_user_context.user_id,
                period_id=period_id,
                pagination=pagination
            )
            
            # Count for pagination
            total_count = len(goals)  # Simple count for now
            
            # Enrich data
            enriched_goals = []
            for goal_model in goals:
                enriched_goal = await self._enrich_goal_data(goal_model)
                enriched_goals.append(enriched_goal)
            
            # Create response
            if pagination:
                total_pages = (total_count + pagination.limit - 1) // pagination.limit
            else:
                total_pages = 1
            
            return PaginatedResponse(
                items=enriched_goals,
                total=total_count,
                page=pagination.page if pagination else 1,
                limit=pagination.limit if pagination else len(enriched_goals),
                pages=total_pages
            )
            
        except Exception as e:
            logger.error(f"Error getting pending approvals: {e}")
            raise

    async def get_supervisor_subordinate_goals(
        self,
        current_user_context: AuthContext,
        supervisor_id: UUID,
        period_id: Optional[UUID] = None,
        status: Optional[str] = None,
        pagination: Optional[PaginationParams] = None
    ) -> PaginatedResponse[Goal]:
        """Get goals for a supervisor's subordinates with optional filters (period, status).

        Rules:
        - Admin (GOAL_READ_ALL): can view any supervisor's subordinates' goals
        - Supervisors/Managers (GOAL_READ_SUBORDINATES):
          - Can view their own subordinates' goals (supervisor_id == current_user_context.user_id)
          - Managers can view a subordinate supervisor's subordinates' goals if that supervisor is in their subordinate list
        - Employees/Part-time (no GOAL_READ_SUBORDINATES): cannot access (even for their own ID)
        """
        from ..core.exceptions import PermissionDeniedError
        try:
            # Admin can view any supervisor's subordinates
            if not current_user_context.has_permission(Permission.GOAL_READ_ALL):
                # Must have subordinate-read permission (supervisors/managers)
                if not current_user_context.has_permission(Permission.GOAL_READ_SUBORDINATES):
                    raise PermissionDeniedError("You do not have permission to view subordinate goals")
                # Allow own or supervised supervisor's teams
                if supervisor_id != current_user_context.user_id:
                    subs = await self.user_repo.get_subordinates(current_user_context.user_id)
                    subordinate_ids = [sub.id for sub in subs]
                    if supervisor_id not in subordinate_ids:
                        raise PermissionDeniedError("You can only view subordinate goals for yourself or supervised supervisors")

            # Determine subordinates of the requested supervisor
            subs = await self.user_repo.get_subordinates(supervisor_id)
            subordinate_user_ids = [sub.id for sub in subs]

            # Fetch goals using generic search with filters
            goals = await self.goal_repo.search_goals(
                user_ids=subordinate_user_ids,
                period_id=period_id,
                goal_category=None,
                status=status,
                pagination=pagination
            )
            total_count = await self.goal_repo.count_goals(
                user_ids=subordinate_user_ids,
                period_id=period_id,
                goal_category=None,
                status=status
            )

            enriched_goals: list[Goal] = []
            for goal_model in goals:
                enriched_goal = await self._enrich_goal_data(goal_model)
                enriched_goals.append(enriched_goal)

            total_pages = (total_count + pagination.limit - 1) // pagination.limit if pagination else 1
            return PaginatedResponse(
                items=enriched_goals,
                total=total_count,
                page=pagination.page if pagination else 1,
                limit=pagination.limit if pagination else len(enriched_goals),
                pages=total_pages
            )
        except Exception as e:
            logger.error(f"Error getting goals for supervisor {supervisor_id}: {e}")
            raise

    # ========================================
    # PRIVATE HELPER METHODS
    # ========================================

    async def _get_accessible_user_ids(
        self,
        current_user_context: AuthContext,
        requested_user_id: Optional[UUID] = None
    ) -> Optional[List[UUID]]:
        """Determine which users' goals the current user can access."""
        
        if current_user_context.has_permission(Permission.GOAL_READ_ALL):
            # Admin: can see all goals
            if requested_user_id:
                return [requested_user_id]
            return None  # All users
        
        accessible_ids = []
        
        # Add self if user has GOAL_READ_SELF permission
        if current_user_context.has_permission(Permission.GOAL_READ_SELF):
            accessible_ids.append(current_user_context.user_id)
        
        if current_user_context.has_permission(Permission.GOAL_READ_SUBORDINATES):
            # Supervisor: can see subordinates' goals
            subordinates = await self.user_repo.get_subordinates(current_user_context.user_id)
            accessible_ids.extend([sub.id for sub in subordinates])
        
        # If specific user requested, check if accessible
        if requested_user_id:
            if requested_user_id not in accessible_ids:
                raise PermissionDeniedError(f"You do not have permission to access goals for user {requested_user_id}")
            return [requested_user_id]
        
        return accessible_ids

    async def _check_goal_access_permission(self, goal: GoalModel, current_user_context: AuthContext):
        """Check if user has permission to access this goal."""
        if current_user_context.has_permission(Permission.GOAL_READ_ALL):
            return  # Admin can access all
        
        if goal.user_id == current_user_context.user_id:
            # Verify user has permission to read own goals
            if current_user_context.has_permission(Permission.GOAL_READ_SELF):
                return  # Own goal with proper permission
        
        if current_user_context.has_permission(Permission.GOAL_READ_SUBORDINATES):
            # Check if goal owner is subordinate
            subordinates = await self.user_repo.get_subordinates(current_user_context.user_id)
            subordinate_ids = [sub.id for sub in subordinates]
            if goal.user_id in subordinate_ids:
                return
        
        raise PermissionDeniedError("You do not have permission to access this goal")

    async def _check_goal_update_permission(self, goal: GoalModel, current_user_context: AuthContext):
        """Check if user has permission to update this goal."""
        # Admin can manage all goals
        if current_user_context.has_permission(Permission.GOAL_MANAGE):
            # Admin can manage any goal, but still check if goal is editable
            if goal.status == GoalStatus.APPROVED.value:
                raise BadRequestError("Cannot update approved goals")
            return
        
        # Check if user has permission to manage their own goals
        if not current_user_context.has_permission(Permission.GOAL_MANAGE_SELF):
            raise PermissionDeniedError("You do not have permission to manage goals")
        
        # Other roles can only manage their own goals
        if goal.user_id != current_user_context.user_id:
            raise PermissionDeniedError("You can only update your own goals")
        
        # Check if goal is still editable
        if goal.status == GoalStatus.APPROVED.value:
            raise BadRequestError("Cannot update approved goals")

    async def _check_goal_approval_permission(self, goal: GoalModel, current_user_context: AuthContext):
        """Check if user has permission to approve/reject this goal."""
        if not current_user_context.has_permission(Permission.GOAL_APPROVE):
            raise PermissionDeniedError("You do not have permission to approve goals")
        
        # Must be supervisor of goal owner (unless admin)
        if not current_user_context.has_permission(Permission.GOAL_READ_ALL):
            subordinates = await self.user_repo.get_subordinates(current_user_context.user_id)
            subordinate_ids = [sub.id for sub in subordinates]
            if goal.user_id not in subordinate_ids:
                raise PermissionDeniedError("You can only approve goals for your subordinates")

    async def _validate_goal_creation(self, goal_data: GoalCreate, user_id: UUID):
        """Validate goal creation business rules."""
        # Check if evaluation period exists and is active
        period = await self.evaluation_period_repo.get_by_id(goal_data.period_id)
        if not period:
            raise BadRequestError(f"Evaluation period {goal_data.period_id} not found")
        
        # Check if competency exists (for competency goals)
        if goal_data.goal_category == "コンピテンシー" and goal_data.competency_id:
            competency = await self.competency_repo.get_by_id(goal_data.competency_id)
            if not competency:
                raise BadRequestError(f"Competency {goal_data.competency_id} not found")

    async def _validate_goal_update(self, goal_data: GoalUpdate, existing_goal: GoalModel):
        """Validate goal update business rules."""
        # Check if competency exists (for competency goals)
        if goal_data.competency_id:
            competency = await self.competency_repo.get_by_id(goal_data.competency_id)
            if not competency:
                raise BadRequestError(f"Competency {goal_data.competency_id} not found")

    async def _validate_weight_limits(
        self,
        user_id: UUID,
        period_id: UUID,
        goal_category: str,
        new_weight: float,
        exclude_goal_id: Optional[UUID] = None
    ):
        """Validate that total weight doesn't exceed 100% per category."""
        # Get current weight totals by category
        weight_totals = await self.goal_repo.get_weight_totals_by_category(
            user_id, period_id, exclude_goal_id
        )
        
        current_total = weight_totals.get(goal_category, Decimal('0'))
        new_total = current_total + Decimal(str(new_weight))
        
        if new_total > Decimal('100'):
            raise ValidationError(
                f"Total weight for {goal_category} would exceed 100%. "
                f"Current: {current_total}%, Adding: {new_weight}%, Total: {new_total}%"
            )

    def _requires_reapproval(self, goal_data: GoalUpdate) -> bool:
        """Check if the update requires reapproval."""
        # Any change to content fields requires reapproval
        content_fields = [
            'specific_goal_text', 'achievement_criteria_text', 'means_methods_text',
            'action_plan', 'core_value_plan', 'weight'
        ]
        
        for field in content_fields:
            if getattr(goal_data, field, None) is not None:
                return True
        
        return False

    async def _enrich_goal_data(self, goal_model: GoalModel) -> Goal:
        """Convert GoalModel to Goal response schema with enriched data."""
        # Base goal data
        goal_dict = {
            "id": goal_model.id,
            "user_id": goal_model.user_id,
            "period_id": goal_model.period_id,
            "goal_category": goal_model.goal_category,
            "weight": float(goal_model.weight) if goal_model.weight else 0.0,
            "status": goal_model.status,
            "approved_by": goal_model.approved_by,
            "approved_at": goal_model.approved_at,
            "created_at": goal_model.created_at,
            "updated_at": goal_model.updated_at
        }
        
        # Add target_data fields with proper handling for incomplete goals
        if goal_model.target_data:
            # Safely add target_data fields, handling potential missing fields for incomplete goals
            target_data = goal_model.target_data
            if isinstance(target_data, dict):
                # For incomplete goals, some fields might be missing - add them as None
                for field_name, value in target_data.items():
                    goal_dict[field_name] = value
            else:
                # If target_data is already a Pydantic model, convert to dict
                goal_dict.update(target_data.model_dump() if hasattr(target_data, 'model_dump') else target_data)
        
        return Goal(**goal_dict)

    async def _enrich_goal_detail_data(self, goal_model: GoalModel) -> GoalDetail:
        """Convert GoalModel to GoalDetail response schema with essential enriched data."""
        # Start with basic goal data
        base_goal = await self._enrich_goal_data(goal_model)
        detail_dict = base_goal.model_dump()
        
        # Add essential detail fields only
        detail_dict.update({
            "has_self_assessment": False,  # Placeholder for future assessment integration
            "has_supervisor_feedback": False,  # Placeholder for future feedback integration
            "is_editable": goal_model.status in [GoalStatus.DRAFT.value, GoalStatus.REJECTED.value],
            "is_assessment_open": False,  # Placeholder for future period status check
            "is_overdue": False,  # Placeholder for future deadline check
        })
        
        # Days since submission for pending goals
        if goal_model.created_at and goal_model.status == GoalStatus.PENDING_APPROVAL.value:
            days_since = (datetime.utcnow() - goal_model.created_at).days
            detail_dict["days_since_submission"] = days_since
        
        return GoalDetail(**detail_dict)

    async def _create_related_assessment_records(self, goal: GoalModel):
        """Create related self-assessment and supervisor review records when goal is submitted."""
        # TODO: Implement creation of related assessment records
        # This would create SelfAssessment and SupervisorReview records
        pass