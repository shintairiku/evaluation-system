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
    GoalCreate, GoalUpdate, Goal, GoalDetail, GoalStatus,
    CompetencyGoalUpdate
)
from ..schemas.common import PaginationParams, PaginatedResponse
from ..security.context import AuthContext
from ..security.permissions import Permission
from ..security.rbac_helper import RBACHelper
from ..security.rbac_types import ResourceType
from ..security.decorators import require_permission, require_any_permission
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
        
        # Initialize RBAC Helper with user repository for subordinate queries
        RBACHelper.initialize_with_repository(self.user_repo)
    
    async def get_goals(
        self,
        current_user_context: AuthContext,
        user_id: Optional[UUID] = None,
        period_id: Optional[UUID] = None,
        goal_category: Optional[str] = None,
        status: Optional[List[str]] = None,
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
            accessible_user_ids = await self._get_accessible_goal_user_ids(
                current_user_context, user_id
            )
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            
            # Search goals with filters
            goals = await self.goal_repo.search_goals(
                org_id=org_id,
                user_ids=accessible_user_ids,
                period_id=period_id,
                goal_category=goal_category,
                status=status,
                pagination=pagination
            )
            
            # Get total count for pagination
            total_count = await self.goal_repo.count_goals(
                org_id=org_id,
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
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            goal = await self.goal_repo.get_goal_by_id_with_details(goal_id, org_id)
            if not goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found")
            
            # Permission check using RBACHelper
            can_access = await RBACHelper.can_access_resource(
                auth_context=current_user_context,
                resource_id=goal_id,
                resource_type=ResourceType.GOAL,
                owner_user_id=goal.user_id
            )
            if not can_access:
                raise PermissionDeniedError("You do not have permission to access this goal")
            
            # Enrich with detailed information
            enriched_goal = await self._enrich_goal_detail_data(goal)
            return enriched_goal
            
        except Exception as e:
            logger.error(f"Error getting goal {goal_id}: {str(e)}")
            raise

    @require_any_permission([Permission.GOAL_MANAGE, Permission.GOAL_MANAGE_SELF])
    async def create_goal(
        self,
        goal_data: GoalCreate,
        current_user_context: AuthContext
    ) -> Goal:
        """Create a new goal with validation and business rules."""
        try:
            # Users create goals for themselves (admin can create for anyone, but we'll keep it simple for now)
            target_user_id = current_user_context.user_id
            
            # Business validation
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            await self._validate_goal_creation(goal_data, target_user_id, org_id)
            
            # Validate weight limits only for submitted goals, not drafts
            if goal_data.status == GoalStatus.SUBMITTED:
                await self._validate_weight_limits(
                    target_user_id,
                    goal_data.period_id,
                    goal_data.goal_category,
                    goal_data.weight,
                    org_id
                )
            
            # Create goal
            created_goal = await self.goal_repo.create_goal(goal_data, target_user_id, org_id)
            
            # Commit transaction
            await self.session.commit()
            await self.session.refresh(created_goal)
            
            # If goal is submitted for approval, create related assessment records
            if goal_data.status == GoalStatus.SUBMITTED:
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

    @require_any_permission([Permission.GOAL_MANAGE, Permission.GOAL_MANAGE_SELF])
    async def update_goal(
        self,
        goal_id: UUID,
        goal_data: GoalUpdate,
        current_user_context: AuthContext
    ) -> Goal:
        """Update a goal with validation and business rules."""
        try:
            # Check if goal exists
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            existing_goal = await self.goal_repo.get_goal_by_id(goal_id, org_id)
            if not existing_goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found")
            
            # Permission check - only goal owner can update (unless admin)
            can_update = await RBACHelper.can_access_resource(
                auth_context=current_user_context,
                resource_id=goal_id,
                resource_type=ResourceType.GOAL,
                owner_user_id=existing_goal.user_id
            )
            if not can_update:
                raise PermissionDeniedError("You can only update your own goals")
            
            # Business validation
            await self._validate_goal_update(goal_data, existing_goal, org_id)
            
            # Validate weight limits if weight is being changed and goal is in submitted status
            if goal_data.weight is not None and existing_goal.status == GoalStatus.SUBMITTED.value:
                await self._validate_weight_limits(
                    existing_goal.user_id,
                    existing_goal.period_id,
                    existing_goal.goal_category,
                    goal_data.weight,
                    org_id,
                    exclude_goal_id=goal_id
                )
            
            # Update goal
            updated_goal = await self.goal_repo.update_goal(goal_id, goal_data, org_id)
            if not updated_goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found after update")
            
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

    @require_any_permission([Permission.GOAL_MANAGE, Permission.GOAL_MANAGE_SELF])
    async def delete_goal(
        self,
        goal_id: UUID,
        current_user_context: AuthContext
    ) -> bool:
        """Delete a goal with permission and business rule checks."""
        try:
            # Check if goal exists
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            existing_goal = await self.goal_repo.get_goal_by_id(goal_id, org_id)
            if not existing_goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found")
            
            # Permission check - only goal owner can delete (unless admin)
            can_delete = await RBACHelper.can_access_resource(
                auth_context=current_user_context,
                resource_id=goal_id,
                resource_type=ResourceType.GOAL,
                owner_user_id=existing_goal.user_id
            )
            if not can_delete:
                raise PermissionDeniedError("You can only delete your own goals")
            
            # Business rule: can only delete draft or rejected goals
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

    @require_permission(Permission.GOAL_MANAGE_SELF)
    async def submit_goal(
        self,
        goal_id: UUID,
        status: str,
        current_user_context: AuthContext
    ) -> Goal:
        """Submit a goal with specified status (draft or submitted)."""
        try:
            # Validate status parameter
            if status not in ["draft", "submitted"]:
                raise ValidationError("Status must be either 'draft' or 'submitted'")

            target_status = GoalStatus.DRAFT if status == "draft" else GoalStatus.SUBMITTED
            
            # Check if goal exists and user can update it
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            existing_goal = await self.goal_repo.get_goal_by_id(goal_id, org_id)
            if not existing_goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found")
            
            # Permission check - only goal owner can submit (strict ownership, even admins cannot submit others' goals)
            if current_user_context.user_id != existing_goal.user_id:
                raise PermissionDeniedError("You can only submit your own goals")
            
            # Business rule: can only submit draft or rejected goals
            if existing_goal.status not in [GoalStatus.DRAFT.value, GoalStatus.REJECTED.value]:
                raise BadRequestError("Can only submit draft or rejected goals")

            # Note: Weight validation is now handled on frontend before submission starts
            # Individual goal submission should not validate total weights

            # Update status using dedicated method with validation
            updated_goal = await self.goal_repo.update_goal_status(goal_id, target_status, org_id)
            
            # Commit transaction
            await self.session.commit()
            
            # Auto-create draft supervisor review(s) only when submitting for approval
            if target_status == GoalStatus.SUBMITTED:
                try:
                    # Get supervisors of goal owner
                    supervisors = await self.user_repo.get_user_supervisors(existing_goal.user_id, org_id)
                    for supervisor in supervisors:
                        await self.supervisor_review_repo.create(
                            goal_id=existing_goal.id,
                            period_id=existing_goal.period_id,
                            supervisor_id=supervisor.id,
                            org_id=org_id,
                            action="PENDING",
                            comment="",
                            status="draft",
                        )
                    await self.session.commit()
                except Exception as auto_create_error:
                    logger.error(f"Auto-create SupervisorReview failed for goal {goal_id}: {auto_create_error}")
                    # Do not rollback goal submission due to review auto-creation failure

            # Enrich response data
            enriched_goal = await self._enrich_goal_data(updated_goal)
            
            logger.info(f"Goal submitted with status '{status}': {goal_id} by {current_user_context.user_id}")
            return enriched_goal
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error submitting goal {goal_id}: {str(e)}")
            raise

    @require_permission(Permission.GOAL_APPROVE)
    async def approve_goal(
        self,
        goal_id: UUID,
        current_user_context: AuthContext
    ) -> Goal:
        """Approve a goal (supervisor/admin only)."""
        try:
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            goal = await self.goal_repo.get_goal_by_id_with_details(goal_id, org_id)
            if not goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found")
            
            # Additional permission check - must be supervisor of goal owner or admin
            can_approve = await RBACHelper.can_access_resource(
                auth_context=current_user_context,
                resource_id=goal_id,
                resource_type=ResourceType.GOAL,
                owner_user_id=goal.user_id
            )
            if not can_approve:
                raise PermissionDeniedError("You can only approve goals for your subordinates")
            
            # Business validation
            if goal.status != GoalStatus.SUBMITTED.value:
                raise BadRequestError("Goal must be in pending approval status")
            
            # Update status
            updated_goal = await self.goal_repo.update_goal_status(
                goal_id,
                GoalStatus.APPROVED,
                org_id,
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

    @require_permission(Permission.GOAL_APPROVE)
    async def reject_goal(
        self,
        goal_id: UUID,
        rejection_reason: str,
        current_user_context: AuthContext
    ) -> Goal:
        """Reject a goal (supervisor/admin only)."""
        try:
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            goal = await self.goal_repo.get_goal_by_id_with_details(goal_id, org_id)
            if not goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found")
            
            # Additional permission check - must be supervisor of goal owner or admin
            can_reject = await RBACHelper.can_access_resource(
                auth_context=current_user_context,
                resource_id=goal_id,
                resource_type=ResourceType.GOAL,
                owner_user_id=goal.user_id
            )
            if not can_reject:
                raise PermissionDeniedError("You can only reject goals for your subordinates")
            
            # Business validation
            if goal.status != GoalStatus.SUBMITTED.value:
                raise BadRequestError("Goal must be in pending approval status")
            
            # Update status
            updated_goal = await self.goal_repo.update_goal_status(goal_id, GoalStatus.REJECTED, org_id)
            
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

    @require_permission(Permission.GOAL_APPROVE)
    async def get_pending_approvals(
        self,
        current_user_context: AuthContext,
        period_id: Optional[UUID] = None,
        pagination: Optional[PaginationParams] = None
    ) -> PaginatedResponse[Goal]:
        """Get goals pending approval for current supervisor."""
        try:
            # Get pending goals for supervisor's subordinates
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            goals = await self.goal_repo.get_pending_approvals_for_supervisor(
                current_user_context.user_id,
                org_id,
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

    # ========================================
    # PRIVATE HELPER METHODS
    # ========================================

    async def _get_accessible_goal_user_ids(
        self,
        current_user_context: AuthContext,
        requested_user_id: Optional[UUID] = None
    ) -> Optional[List[UUID]]:
        """Determine which users' goals the current user can access."""
        
        if current_user_context.has_permission(Permission.GOAL_READ_ALL):
            # Admin: can see all goals, but default to own goals unless a target user is explicitly requested
            if requested_user_id:
                return [requested_user_id]
            # Default behavior: scope to the current user's own goals to avoid accidental cross-user data
            return [current_user_context.user_id]
        
        accessible_ids = []
        
        # Add self if user has GOAL_READ_SELF permission
        if current_user_context.has_permission(Permission.GOAL_READ_SELF):
            accessible_ids.append(current_user_context.user_id)
        
        if current_user_context.has_permission(Permission.GOAL_READ_SUBORDINATES):
            # Supervisor: can see subordinates' goals
            subordinate_ids = await RBACHelper._get_subordinate_user_ids(
                current_user_context.user_id, self.user_repo, current_user_context.organization_id
            )
            accessible_ids.extend(subordinate_ids)
        
        # If specific user requested, check if accessible
        if requested_user_id:
            if requested_user_id not in accessible_ids:
                raise PermissionDeniedError(f"You do not have permission to access goals for user {requested_user_id}")
            return [requested_user_id]
        
        return accessible_ids

    async def _validate_goal_creation(self, goal_data: GoalCreate, user_id: UUID, org_id: UUID):
        """Validate goal creation business rules."""
        # Check if evaluation period exists and is active
        period = await self.evaluation_period_repo.get_by_id(goal_data.period_id, org_id)
        if not period:
            raise BadRequestError(f"Evaluation period {goal_data.period_id} not found")
        
        # Check if competencies exist (for competency goals)
        if goal_data.goal_category == "コンピテンシー" and goal_data.competency_ids:
            for competency_id in goal_data.competency_ids:
                competency = await self.competency_repo.get_by_id(competency_id, org_id)
                if not competency:
                    raise BadRequestError(f"Competency {competency_id} not found")

    async def _validate_goal_update(self, goal_data: GoalUpdate, existing_goal: GoalModel, org_id: UUID):
        """Validate goal update business rules."""
        # Check if competencies exist (for competency goals)
        if isinstance(goal_data, CompetencyGoalUpdate) and goal_data.competency_ids:
            for competency_id in goal_data.competency_ids:
                competency = await self.competency_repo.get_by_id(competency_id, org_id)
                if not competency:
                    raise BadRequestError(f"Competency {competency_id} not found")

    async def _validate_weight_limits(
        self,
        user_id: UUID,
        period_id: UUID,
        goal_category: str,
        new_weight: float,
        org_id: UUID,
        exclude_goal_id: Optional[UUID] = None
    ):
        """Validate that total weight doesn't exceed 100% per category."""
        # Get current weight totals by category
        weight_totals = await self.goal_repo.get_weight_totals_by_category(
            user_id, period_id, org_id, exclude_goal_id
        )
        
        current_total = weight_totals.get(goal_category, Decimal('0'))
        new_total = current_total + Decimal(str(new_weight))
        
        if new_total > Decimal('100'):
            raise ValidationError(
                f"Total weight for {goal_category} would exceed 100%. "
                f"Current: {current_total}%, Adding: {new_weight}%, Total: {new_total}%"
            )

    async def _validate_total_weight_before_submission(
        self,
        user_id: UUID,
        period_id: UUID,
        org_id: UUID
    ):
        """Validate that performance goals total exactly 100% before submission."""
        # Get current weight totals by category for all goals
        weight_totals = await self.goal_repo.get_weight_totals_by_category(
            user_id, period_id, org_id
        )

        # Check performance goals total 100%
        performance_total = weight_totals.get('業績目標', Decimal('0'))
        if performance_total != Decimal('100'):
            raise ValidationError(
                f"業績目標の合計ウェイトは100%である必要があります。現在の合計: {performance_total}%"
            )

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
        
        # Add target_data fields directly (simplified)
        if goal_model.target_data:
            goal_dict.update(goal_model.target_data)
        
        # Add competency name lookup for competency goals
        if (goal_model.goal_category == "コンピテンシー" and 
            goal_model.target_data and 
            goal_model.target_data.get("competency_ids")):
            
            try:
                competency_names = {}
                for competency_id in goal_model.target_data["competency_ids"]:
                    competency = await self.competency_repo.get_by_id(competency_id, goal_model.org_id)
                    if competency:
                        competency_names[str(competency_id)] = competency.name
                
                if competency_names:
                    goal_dict["competency_names"] = competency_names
            except Exception as e:
                logger.warning(f"Failed to fetch competency names for goal {goal_model.id}: {str(e)}")
                # Continue without competency names if lookup fails
        
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
        if goal_model.created_at and goal_model.status == GoalStatus.SUBMITTED.value:
            days_since = (datetime.utcnow() - goal_model.created_at).days
            detail_dict["days_since_submission"] = days_since
        
        return GoalDetail(**detail_dict)

    async def _create_related_assessment_records(self, goal: GoalModel):
        """Create related self-assessment and supervisor review records when goal is submitted."""
        # TODO: Implement creation of related assessment records
        # This would create SelfAssessment and SupervisorReview records
        pass